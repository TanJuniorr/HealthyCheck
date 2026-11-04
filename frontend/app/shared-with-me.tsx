import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../src/components/common/AppHeader';
import { ScreenContainer } from '../src/components/common/ScreenContainer';
import { DataFeedback } from '../src/components/common/DataFeedback';
import { TextButton } from '../src/components/common/Buttons';
import { SharingCard, SharingConfirmation, SharingDisclosure, SharingGroups, SharingSection } from '../src/components/sharing/SharingUi';
import { SharedHealthDetails } from '../src/components/sharing/SharedHealthDetails';
import { useAuth } from '../src/contexts/AuthContext';
import { useThemedStyles } from '../src/contexts/ThemeContext';
import { useSharingFeed } from '../src/hooks/useSharingFeed';
import { Colors } from '../src/constants/colors';
import { Spacing } from '../src/constants/spacing';
import { Typography } from '../src/constants/typography';
import { dataError } from '../src/lib/dataErrors';
import { groupSharingInvites } from '../src/lib/sharingPresentation';
import { changeSharingInvite } from '../src/services/sharingService';
import { getMySharedOwners } from '../src/services/sharedWithMeService';
import type { IncomingSharingInvite } from '../src/types/database';

export default function SharedWithMeScreen() {
  const { user } = useAuth();
  const { inviteId } = useLocalSearchParams<{ inviteId?: string }>();
  return user ? <ReceivedInvites key={`${user.id}:${inviteId ?? ''}`} recipient={user.id} initialInvite={inviteId}/> : null;
}

function ReceivedInvites({ recipient, initialInvite }: { recipient: string; initialInvite?: string }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(baseStyles);
  const [selected, setSelected] = useState(initialInvite);
  const [historyOpen, setHistoryOpen] = useState<boolean>();
  const [confirmation, setConfirmation] = useState<{ invite: IncomingSharingInvite; action: 'accept' | 'reject' } | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(() => getMySharedOwners(recipient), [recipient]);
  const feed = useSharingFeed(recipient, 'recipient', recipient, load, true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const respond = async () => {
    if (!confirmation || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const { invite, action } = confirmation;
      await changeSharingInvite(recipient, invite.invite_id, invite.version, action);
      if (mounted.current) {
        setConfirmation(null);
        setSelected(invite.invite_id);
        setSaved(true);
        feed.refresh();
      }
    } catch (failure) {
      if (mounted.current) {
        setError(dataError(failure).message);
        feed.refresh();
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const openResponse = (invite: IncomingSharingInvite, action: 'accept' | 'reject') => {
    setError('');
    setConfirmation({ invite, action });
  };

  const invites = feed.data ?? [];
  const groups = groupSharingInvites(invites);
  const showHistory = historyOpen ?? groups.history.some(invite => invite.invite_id === initialInvite);
  const latestByOwner = new Map<string, string>();
  for (const invite of invites) {
    if (!latestByOwner.has(invite.owner_id)) latestByOwner.set(invite.owner_id, invite.invite_id);
  }
  const renderInvite = (invite: typeof invites[number]) => {
    const open = selected === invite.invite_id;
    const historical = invite.status === 'revoked' || invite.status === 'rejected';
    return <SharingCard key={invite.invite_id} name={invite.owner_name?.trim() || t('sharedWithMe.unknownOwner')}
      avatarUrl={invite.avatar_url} status={invite.status} sentAt={invite.created_at} permissions={invite}
      updatedAt={invite.status === 'active' ? invite.updated_at : undefined}
      identityHint={invite.status === 'pending'
        ? t('sharedWithMe.senderCode', { code: invite.owner_id.slice(0, 8) })
        : historical && latestByOwner.get(invite.owner_id) !== invite.invite_id
          ? t('sharedWithMe.earlierInvite') : undefined}>
      {invite.status === 'pending' ? <View style={styles.actions}>
        <TextButton title={t('sharing.acceptAction')} onPress={() => openResponse(invite, 'accept')}/>
        <TextButton title={t('sharing.rejectAction')} onPress={() => openResponse(invite, 'reject')}/>
      </View> : null}
      {invite.status === 'paused' ? <Text style={styles.text}>{t('sharedWithMe.pausedHint')}</Text> : null}
      {invite.status === 'active' ?
        <SharingDisclosure title={t('sharedWithMe.metricsDetails')} open={open}
          onToggle={() => setSelected(open ? undefined : invite.invite_id)}/> : null}
      {open && invite.status === 'active' ? (
        feed.isLoading ? <DataFeedback isLoading error={null} refresh={async () => feed.refresh()}/> :
          <SharedHealthDetails key={`${invite.invite_id}:${invite.version}`} recipient={recipient}
            invite={invite} refreshInvites={feed.refresh}/>
      ) : null}
    </SharingCard>;
  };

  return <View style={styles.screen}>
    <AppHeader title={t('sharedWithMe.title')}/>
    <ScreenContainer contentContainerStyle={styles.content}>
      <Text style={styles.text}>{t('sharedWithMe.viewOnlyNote')}</Text>
      {saved ? <Text accessibilityRole="alert" style={styles.text}>{t('sharing.actionSaved')}</Text> : null}
      {(!feed.data && feed.isLoading) || feed.error ? <DataFeedback {...feed} refresh={async () => feed.refresh()}/> : null}
      {feed.data?.length === 0 ? <Text style={styles.text}>{t('sharedWithMe.empty')}</Text> : null}
      {selected && feed.data && !feed.data.some(invite => invite.invite_id === selected) ?
        <Text style={styles.text}>{t('sharedWithMe.inviteNotFound')}</Text> : null}
      {(['pending', 'active', 'paused'] as const).map(group => groups[group].length ?
        <SharingSection key={group} title={t(`sharedWithMe.sections.${group}`)}>{groups[group].map(renderInvite)}</SharingSection> : null)}
      {groups.history.length ? <SharingSection title={t('sharing.historyCount', { count: groups.history.length })}
        open={showHistory} onToggle={() => setHistoryOpen(!showHistory)}>{groups.history.map(renderInvite)}</SharingSection> : null}
    </ScreenContainer>
    {confirmation ? <SharingConfirmation title={t(`sharing.confirmAction.${confirmation.action}.title`)}
      action={t(`sharing.${confirmation.action}Action`)} busy={busy} error={error}
      onConfirm={respond} onClose={() => { if (!lock.current) setConfirmation(null); }}>
      <Text style={styles.title}>{confirmation.invite.owner_name || t('sharedWithMe.unknownOwner')}</Text>
      <SharingGroups permissions={confirmation.invite}/>
      <Text style={styles.text}>{t(`sharing.confirmAction.${confirmation.action}.body`)}</Text>
    </SharingConfirmation> : null}
  </View>;
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingTop: Spacing.lg, gap: Spacing.md },
  title: { ...Typography.cardTitle, color: Colors.textPrimary },
  text: { color: Colors.textSecondary, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
});
