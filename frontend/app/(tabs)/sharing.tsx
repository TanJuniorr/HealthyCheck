import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { PrimaryButton, TextButton } from '../../src/components/common/Buttons';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import { SharingCard, SharingConfirmation, SharingDisclosure, SharingSection } from '../../src/components/sharing/SharingUi';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { useSharingFeed } from '../../src/hooks/useSharingFeed';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { dataError } from '../../src/lib/dataErrors';
import { groupSharingInvites } from '../../src/lib/sharingPresentation';
import { changeSharingInvite, getMySharingInvites } from '../../src/services/sharingService';
import type { SharingInviteRow } from '../../src/types/database';

type Action = 'pause' | 'resume' | 'revoke';

export default function SharingScreen() {
  const { user } = useAuth();
  const { inviteId } = useLocalSearchParams<{ inviteId?: string }>();
  return user ? <SentInvites key={`${user.id}:${inviteId ?? ''}`} owner={user.id} inviteId={inviteId}/> : null;
}

function SentInvites({ owner, inviteId }: { owner: string; inviteId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const [opened, setOpened] = useState<string | undefined>(inviteId);
  const [historyOpen, setHistoryOpen] = useState<boolean>();
  const [confirmation, setConfirmation] = useState<{ invite: SharingInviteRow; action: Action } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const load = useCallback(() => getMySharingInvites(owner), [owner]);
  const feed = useSharingFeed(owner, 'sender', owner, load, true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const apply = async () => {
    if (!confirmation || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const { invite, action } = confirmation;
      await changeSharingInvite(owner, invite.id, invite.version, action);
      if (mounted.current) {
        setConfirmation(null);
        setNotice('sharing.actionSaved');
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

  const openAction = (invite: SharingInviteRow, action: Action) => {
    setError('');
    setConfirmation({ invite, action });
  };

  const groups = groupSharingInvites(feed.data ?? []);
  const showHistory = historyOpen ?? groups.history.some(invite => invite.id === inviteId);
  const renderInvite = (invite: SharingInviteRow) => {
    const selected = opened === invite.id;
    return <SharingCard key={invite.id} name={invite.recipient_email || invite.recipient_label}
      status={invite.status} sentAt={invite.created_at} permissions={invite}>
      {invite.status !== 'revoked' ? <SharingDisclosure title={t('sharing.viewDetails')} open={selected}
        onToggle={() => setOpened(selected ? undefined : invite.id)}/> : null}
      {selected && invite.status !== 'revoked' ? <View style={styles.actions}>
        {invite.status === 'active' ? <>
          <TextButton title={t('sharing.editAction')} onPress={() => router.push({ pathname: '/sharing-setup', params: { id: invite.id } })}/>
          <TextButton title={t('sharing.pauseAction')} onPress={() => openAction(invite, 'pause')}/>
        </> : null}
        {invite.status === 'paused' ? <TextButton title={t('sharing.resumeAction')} onPress={() => openAction(invite, 'resume')}/> : null}
        {['pending', 'active', 'paused'].includes(invite.status) ?
          <TextButton color={styles.danger.color} title={t(invite.status === 'pending' ? 'sharing.cancelInvite' : 'sharing.revokeAction')}
            onPress={() => openAction(invite, 'revoke')}/> : null}
        {invite.status === 'rejected' ?
          <TextButton title={t('sharing.inviteAgain')} onPress={() => router.push({ pathname: '/sharing-setup', params: { reinvite: invite.id } })}/> : null}
      </View> : null}
    </SharingCard>;
  };

  return <View style={styles.screen}>
    <AppHeader title={t('navigation.sharing')} showBack={false}/>
    <ScreenContainer contentContainerStyle={styles.content}>
      <Text style={styles.text}>{t('sharing.privateHint')}</Text>
      <PrimaryButton title={t('sharing.sendInvite')} onPress={() => router.push('/sharing-setup')}/>
      <TextButton title={t('sharedWithMe.viewSharedWithMe')} onPress={() => router.push('/shared-with-me')}/>
      {notice ? <Text accessibilityRole="alert" style={styles.text}>{t(notice)}</Text> : null}
      {(!feed.data && feed.isLoading) || feed.error ? <DataFeedback {...feed} refresh={async () => feed.refresh()}/> : null}
      {feed.data?.length === 0 ? <Text style={styles.text}>{t('sharing.emptyInvites')}</Text> : null}
      {(['pending', 'active', 'paused'] as const).map(group => groups[group].length ?
        <SharingSection key={group} title={t(`sharing.sections.${group}`)}>{groups[group].map(renderInvite)}</SharingSection> : null)}
      {groups.history.length ? <SharingSection title={t('sharing.historyCount', { count: groups.history.length })}
        open={showHistory} onToggle={() => setHistoryOpen(!showHistory)}>{groups.history.map(renderInvite)}</SharingSection> : null}
    </ScreenContainer>
    {confirmation ? <SharingConfirmation title={t(`sharing.confirmAction.${confirmation.action}.title`)}
      action={t(confirmation.invite.status === 'pending' ? 'sharing.cancelInvite' : `sharing.${confirmation.action}Action`)}
      busy={busy} error={error} onConfirm={apply} onClose={() => { if (!lock.current) setConfirmation(null); }}>
      <Text style={styles.text}>{t(`sharing.confirmAction.${confirmation.action}.body`)}</Text>
    </SharingConfirmation> : null}
  </View>;
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingTop: Spacing.lg, gap: Spacing.md },
  text: { color: Colors.textSecondary, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  danger: { color: Colors.error },
});
