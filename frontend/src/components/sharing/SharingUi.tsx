import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { Radius, Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { formatSharingDateTime } from '../../lib/sharingPresentation';
import { localizeMessage } from '../../i18n/localize';
import { sharingGroups, sharingStatusLabel } from '../../services/sharingService';
import type { SharingPermissions, SharingStatus } from '../../types/database';
import { PrimaryButton, TextButton } from '../common/Buttons';

export function SharingGroups({ permissions }: { permissions: SharingPermissions }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(baseStyles);
  return <View style={styles.groups}>
    {sharingGroups.filter(group => permissions[`share_${group}`]).map(group =>
      <Text key={group} style={styles.chip}>{t(`sharing.${group}`)}</Text>
    )}
  </View>;
}

function publicAvatar(avatarUrl: string | null | undefined) {
  if (!avatarUrl) return null;
  const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!projectUrl) return null;
  try {
    const url = new URL(avatarUrl);
    if (url.origin === new URL(projectUrl).origin && url.pathname.startsWith('/storage/v1/object/public/avatars/')) {
      return url.origin + url.pathname;
    }
  } catch {
    // Private storage paths and invalid URLs are not loaded in the sharing list.
  }
  return null;
}

export function SharingDisclosure({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  const styles = useThemedStyles(baseStyles);
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.disclosure}>
    <Text style={styles.disclosureLabel}>{title}</Text>
    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={styles.disclosureLabel.color}/>
  </Pressable>;
}

export function SharingSection({ title, open, onToggle, children }: React.PropsWithChildren<{
  title: string;
  open?: boolean;
  onToggle?: () => void;
}>) {
  const styles = useThemedStyles(baseStyles);
  return <View style={styles.section}>
    {onToggle
      ? <SharingDisclosure title={title} open={Boolean(open)} onToggle={onToggle}/>
      : <Text accessibilityRole="header" style={styles.title}>{title}</Text>}
    {open !== false ? children : null}
  </View>;
}

export function SharingCard({ name, status, sentAt, updatedAt, permissions, avatarUrl, identityHint, children }: React.PropsWithChildren<{
  name: string;
  status: SharingStatus;
  sentAt: string;
  updatedAt?: string;
  permissions: SharingPermissions;
  avatarUrl?: string | null;
  identityHint?: string;
}>) {
  const { t } = useTranslation();
  const styles = useThemedStyles(baseStyles);
  const avatar = publicAvatar(avatarUrl);
  return <View style={styles.card}>
    <View style={styles.identity}>
      {avatar ? <Image source={{ uri: avatar }} style={styles.avatar}/> : null}
      <View style={styles.name}>
        <Text accessibilityRole="header" style={styles.title}>{name}</Text>
        {identityHint ? <Text style={styles.text}>{identityHint}</Text> : null}
      </View>
    </View>
    <Text style={styles.status}>{t(sharingStatusLabel(status))}</Text>
    <Text style={styles.text}>{t(updatedAt ? 'sharing.permissionsUpdatedAt' : 'sharing.sentAt', { date: formatSharingDateTime(updatedAt ?? sentAt) })}</Text>
    <SharingGroups permissions={permissions}/>
    {children}
  </View>;
}

export function SharingConfirmation({ title, action, onConfirm, onClose, busy, error, children }: React.PropsWithChildren<{
  title: string;
  action: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error?: string;
}>) {
  const { t } = useTranslation();
  const styles = useThemedStyles(baseStyles);
  return <Modal transparent visible animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View accessibilityViewIsModal style={styles.dialog}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.details}>{children}</ScrollView>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
        <PrimaryButton title={action} loading={busy} onPress={onConfirm}/>
        <TextButton title={t('common.cancel')} disabled={busy} onPress={onClose}/>
      </View>
    </View>
  </Modal>;
}

const baseStyles = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  name: { flex: 1, minWidth: 0 },
  title: { ...Typography.cardTitle, color: Colors.textPrimary },
  text: { ...Typography.bodySmall, color: Colors.textSecondary },
  status: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '700' },
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, backgroundColor: Colors.primaryLight, color: Colors.textPrimary, borderRadius: Radius.sm },
  section: { gap: Spacing.sm },
  disclosure: { minHeight: 44, gap: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  disclosureLabel: { flexShrink: 1, ...Typography.label, color: Colors.primary },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, backgroundColor: 'rgba(0,0,0,0.45)' },
  dialog: { width: '100%', maxWidth: 520, maxHeight: '90%', borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm, backgroundColor: Colors.white },
  scroll: { flexGrow: 0, flexShrink: 1 },
  details: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  error: { color: Colors.error },
});
