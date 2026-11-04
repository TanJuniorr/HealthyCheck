import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../src/components/common/AppHeader';
import { ScreenContainer } from '../src/components/common/ScreenContainer';
import { AppTextInput } from '../src/components/common/AppTextInput';
import { PrimaryButton } from '../src/components/common/Buttons';
import { DataFeedback } from '../src/components/common/DataFeedback';
import { SharingConfirmation, SharingGroups } from '../src/components/sharing/SharingUi';
import { useAuth } from '../src/contexts/AuthContext';
import { useThemedStyles } from '../src/contexts/ThemeContext';
import { Colors } from '../src/constants/colors';
import { Radius, Spacing } from '../src/constants/spacing';
import { Typography } from '../src/constants/typography';
import { dataError } from '../src/lib/dataErrors';
import { localizeMessage } from '../src/i18n/localize';
import {
  changeSharingInvite, createSharingInvite, emptySharingPermissions, expandsSharing, getSharingInviteById,
  sharingGroups, sharingStatusLabel, validateCategories, validateRecipient,
} from '../src/services/sharingService';
import type { SharingInviteRow, SharingPermissions } from '../src/types/database';

export default function SharingSetupScreen() {
  const { user } = useAuth();
  const { id, reinvite } = useLocalSearchParams<{ id?: string; reinvite?: string }>();
  return user ? <SharingSetup key={`${user.id}:${id ?? ''}:${reinvite ?? ''}`} owner={user.id} id={id} reinvite={reinvite}/> : null;
}

function SharingSetup({ owner, id, reinvite }: { owner: string; id?: string; reinvite?: string }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const [invite, setInvite] = useState<SharingInviteRow | null>(null);
  const [email, setEmail] = useState('');
  const [emailChecked, setEmailChecked] = useState(false);
  const [permissions, setPermissions] = useState<SharingPermissions>(emptySharingPermissions);
  const [loading, setLoading] = useState(Boolean(id || reinvite));
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const reference = id || reinvite;
    if (!reference) return;
    let alive = true;
    void getSharingInviteById(owner, reference).then(row => {
      if (!alive) return;
      if (!row || (id && row.status !== 'active' && row.status !== 'pending')) {
        setLoadError('sharing.errorInviteUnavailable');
        return;
      }
      setInvite(row);
      setEmail(row.recipient_email ?? '');
      setPermissions({ share_steps: row.share_steps, share_sleep: row.share_sleep, share_nutrition: row.share_nutrition });
    }).catch(failure => {
      if (alive) setLoadError(dataError(failure).message);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [owner, id, reinvite, retry]);

  const expansion = Boolean(id && invite && expandsSharing(invite, permissions));
  const hasCategory = sharingGroups.some(group => permissions[`share_${group}`]);
  let emailError: string | undefined;
  if (!id && (emailChecked || email.length > 0)) {
    try { validateRecipient(email); } catch (failure) { emailError = dataError(failure).message; }
  }
  const reviewChanges = () => {
    if (!hasCategory || lock.current) return;
    setEmailChecked(true);
    setError('');
    try {
      if (!id) validateRecipient(email);
      validateCategories(permissions);
      setReview(true);
    } catch (failure) {
      if (id) setError(dataError(failure).message);
    }
  };

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (id && invite) {
        await changeSharingInvite(owner, id, invite.version, 'edit', permissions, expansion);
      } else {
        await createSharingInvite(owner, email, permissions);
      }
      if (mounted.current) {
        setReview(false);
        setSaved(true);
      }
    } catch (failure) {
      if (mounted.current) setError(dataError(failure).message);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const closeReview = () => {
    if (!lock.current) setReview(false);
  };

  return <View style={styles.screen}>
    <AppHeader title={t(id ? 'sharing.editTitle' : 'sharing.setup')}/>
    <ScreenContainer contentContainerStyle={styles.content}>
      {saved ? <>
        <Text accessibilityRole="alert" style={styles.title}>{t(id ? 'sharing.changesSaved' : 'sharing.inviteSent')}</Text>
        <PrimaryButton title={t('common.done')} onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/sharing');
        }}/>
      </> : loading || loadError ? <DataFeedback isLoading={loading} error={loadError || null} refresh={async () => {
        setLoadError('');
        setLoading(true);
        setRetry(value => value + 1);
      }}/> : <>
        <Text style={styles.text}>{t('sharing.privateHint')}</Text>
        <AppTextInput label={t('sharing.recipient')} placeholder={t('sharing.recipientPlaceholder')}
          value={email} editable={!id && !busy && !review} error={emailError}
          onChangeText={value => { setEmail(value); setError(''); }}
          keyboardType="email-address" autoCapitalize="none" style={styles.emailField}/>
        {id ? <Text style={styles.text}>{t('sharing.recipientLocked')}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>{t('sharing.categories')}</Text>
        <Text style={styles.text}>{t('sharing.categoryHint')}</Text>
        {sharingGroups.map(group => {
          const key = `share_${group}` as const;
          const checked = permissions[key];
          const disabled = busy || review;
          return <Pressable key={group} style={styles.option}
            accessibilityRole="switch" accessibilityLabel={t(`sharing.${group}`)}
            accessibilityHint={t(`sharing.groupDescription.${group}`)}
            accessibilityState={{ checked, disabled }} disabled={disabled}
            onPress={() => setPermissions(previous => ({ ...previous, [key]: !previous[key] }))}>
            <View style={styles.optionText}>
              <Text style={styles.title}>{t(`sharing.${group}`)}</Text>
              <Text style={styles.text}>{t(`sharing.groupDescription.${group}`)}</Text>
            </View>
            <View style={[styles.switchTrack, checked && styles.switchOn]}>
              <View style={styles.switchThumb}/>
            </View>
          </Pressable>;
        })}
        {error && !review ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
        {!hasCategory ? <Text style={styles.text}>{t('sharing.errorNoCategorySelected')}</Text> : null}
        <PrimaryButton title={t('sharing.reviewAction')} disabled={busy || !hasCategory} onPress={reviewChanges}/>
      </>}
    </ScreenContainer>
    {review ? <SharingConfirmation title={t(expansion ? 'sharing.confirmExpansion' : 'sharing.reviewTitle')}
      action={t(id ? 'sharing.saveChanges' : 'sharing.sendInvite')} onConfirm={save} onClose={closeReview} busy={busy} error={error}>
      <Text style={styles.title}>{email.trim().toLowerCase()}</Text>
      <SharingGroups permissions={permissions}/>
      <Text style={styles.text}>{t('sharing.readOnly')}</Text>
      {!id ? <Text style={styles.text}>{t('sharing.reviewPending')}</Text> : invite ?
        <Text style={styles.text}>{t(sharingStatusLabel(invite.status))}</Text> : null}
      <Text style={styles.text}>{t(expansion ? 'sharing.expansionHint' : id ? 'sharing.editReviewHint' : 'sharing.inviteReviewHint')}</Text>
      {error === 'sharing.errorConflict' ? <Text style={styles.text}>{t('sharing.reopenEditor')}</Text> : null}
    </SharingConfirmation> : null}
  </View>;
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: Spacing.md, paddingTop: Spacing.lg },
  emailField: { marginBottom: 0 },
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  optionText: { flex: 1, minWidth: 0, gap: Spacing.xs },
  switchTrack: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center', paddingHorizontal: 3, flexShrink: 0, backgroundColor: Colors.textMuted },
  switchOn: { alignItems: 'flex-end', backgroundColor: Colors.primary },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.white },
  title: { ...Typography.cardTitle, color: Colors.textPrimary },
  text: { ...Typography.bodySmall, color: Colors.textSecondary },
  error: { color: Colors.error },
});
