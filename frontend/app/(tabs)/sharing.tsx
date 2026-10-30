import { useTranslation } from 'react-i18next';
import { localizeStaticData } from '../../src/i18n/localize';
import { formatDate } from '../../src/i18n/formatting';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';
import { PrimaryButton, TextButton } from '../../src/components/common/Buttons';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import {
  getMySharingInvites,
  pauseSharingInvite,
  resumeSharingInvite,
  revokeSharingInvite,
  deleteSharingInvite,
  subscribeSharingChanges,
} from '../../src/services/sharingService';
import type { SharingInviteRow } from '../../src/types/database';
import { dataError } from '../../src/lib/dataErrors';

interface SharingFeature {
  icon: string;
  title: string;
  description: string;
}

const rawSHARING_FEATURES: SharingFeature[] = [
  {
    icon: 'share-social',
    title: 'sharing.summaryTitle',
    description: 'sharing.summaryHint',
  },
  {
    icon: 'shield-checkmark',
    title: 'sharing.controlTitle',
    description: 'sharing.controlHint',
  },
  {
    icon: 'close-circle',
    title: 'sharing.stopTitle',
    description: 'sharing.stopHint',
  },
];

function recipientDisplayText(item: SharingInviteRow, fallback: string) {
  return item.recipient_email?.trim() || item.recipient_label.trim() || fallback;
}

function recipientInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return (words[0] || '?').slice(0, 2).toUpperCase();
}

export default function SharingScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const SHARING_FEATURES = localizeStaticData(rawSHARING_FEATURES);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [invites, setInvites] = useState<SharingInviteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [revokingItem, setRevokingItem] = useState<SharingInviteRow | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [deletingItem, setDeletingItem] = useState<SharingInviteRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchInvites = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await getMySharingInvites();
      setInvites(data);
    } catch (err) {
      setLoadError(dataError(err).message || t('sharing.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void fetchInvites();
    }, [fetchInvites])
  );

  useEffect(() => {
    const unsubscribe = subscribeSharingChanges(() => {
      void fetchInvites();
    });
    return unsubscribe;
  }, [fetchInvites]);

  const handlePause = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setActionError('');
    try {
      await pauseSharingInvite(id);
      await fetchInvites();
    } catch (err: any) {
      const msg = err?.message || '';
      setActionError(msg.startsWith('sharing.') ? t(msg) : dataError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleResume = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setActionError('');
    try {
      await resumeSharingInvite(id);
      await fetchInvites();
    } catch (err: any) {
      const msg = err?.message || '';
      setActionError(msg.startsWith('sharing.') ? t(msg) : dataError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokingItem || isRevoking) return;
    setIsRevoking(true);
    setActionError('');
    try {
      await revokeSharingInvite(revokingItem.id);
      setRevokingItem(null);
      await fetchInvites();
    } catch (err: any) {
      const msg = err?.message || '';
      setActionError(msg.startsWith('sharing.') ? t(msg) : dataError(err).message);
      setRevokingItem(null);
    } finally {
      setIsRevoking(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem || isDeleting || busyId) return;
    setBusyId(deletingItem.id);
    setIsDeleting(true);
    setActionError('');
    try {
      await deleteSharingInvite(deletingItem.id);
      setDeletingItem(null);
      await fetchInvites();
    } catch (err: any) {
      const msg = err?.message || '';
      setActionError(msg.startsWith('sharing.') ? t(msg) : dataError(err).message);
    } finally {
      setBusyId(null);
      setIsDeleting(false);
    }
  };

  // 1. Loading State
  if (isLoading && invites.length === 0 && !loadError) {
    return (
      <View style={[styles.screen, styles.centerBox, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // 2. Error State
  if (loadError && invites.length === 0) {
    return (
      <View style={[styles.screen, styles.centerBox, { paddingTop: insets.top, paddingHorizontal: Spacing.xl }]}>
        <Ionicons name="alert-circle-outline" size={44} color={Colors.coral} />
        <Text style={styles.errorText}>{loadError}</Text>
        <PrimaryButton
          title={t('sharing.retry')}
          onPress={fetchInvites}
          style={styles.retryButton}
        />
      </View>
    );
  }

  // 3. Has Sharing Invites -> Render Active Sharing Management
  const hasInvites = invites.length > 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {hasInvites ? (
          <>
            {/* Active Sharing Header */}
            <View style={styles.managementHeader}>
              <View>
                <Text style={styles.managementTitle}>{t('sharing.activeShares')}</Text>
                <Text style={styles.managementSubtitle}>{t('sharing.journeyHint')}</Text>
              </View>
            </View>

            {/* Action error banner */}
            {actionError ? (
              <View style={styles.actionErrorBanner} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={18} color={Colors.coral} />
                <Text style={styles.actionErrorText}>{actionError}</Text>
              </View>
            ) : null}

            {/* List of Sharing Cards */}
            <View style={styles.invitesList}>
              {invites.map((item) => {
                const isItemBusy = busyId === item.id;
                const isRevoked = item.status === 'revoked';
                const isPaused = item.status === 'paused';
                const isActive = item.status === 'active';

                const statusBadgeStyle = isActive
                  ? styles.badgeActive
                  : isPaused
                  ? styles.badgePaused
                  : styles.badgeRevoked;

                const statusTextStyle = isActive
                  ? styles.badgeTextActive
                  : isPaused
                  ? styles.badgeTextPaused
                  : styles.badgeTextRevoked;

                const statusLabel = isActive
                  ? t('sharing.statusActive')
                  : isPaused
                  ? t('sharing.statusPaused')
                  : t('sharing.statusRevoked');

                const privacyText =
                  item.privacy_level === 'specific'
                    ? t('sharing.specific')
                    : item.privacy_level === 'family'
                    ? t('sharing.family')
                    : t('sharing.community');
                const displayText = recipientDisplayText(item, t('sharing.contact'));

                return (
                  <View key={item.id} style={styles.shareCard}>
                    {/* Keep recipient details and status on separate rows on narrow screens. */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.recipientInfo}>
                        <View style={styles.recipientAvatar}>
                          <Text style={styles.recipientAvatarText}>{recipientInitials(displayText)}</Text>
                        </View>
                        <View style={styles.recipientTextWrapper}>
                          <Text style={styles.recipientLabel} numberOfLines={1}>{displayText}</Text>
                        </View>
                      </View>

                      <View style={[styles.statusBadge, statusBadgeStyle]}>
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: isActive
                                ? Colors.primary
                                : isPaused
                                ? Colors.orange
                                : Colors.textMuted,
                            },
                          ]}
                        />
                        <Text style={[styles.statusBadgeText, statusTextStyle]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Metadata Row: Privacy Level & Created Date */}
                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons name="shield-outline" size={13} color={Colors.textMuted} />
                        <Text style={styles.metaText}>{privacyText}</Text>
                      </View>
                      <Text style={styles.metaDivider}>•</Text>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                        <Text style={styles.metaText}>
                          {formatDate(item.created_at)}
                        </Text>
                      </View>
                    </View>

                    {/* Category Chips */}
                    <View style={styles.chipsContainer}>
                      {item.share_steps && (
                        <View style={styles.categoryChip}>
                          <Ionicons name="walk" size={13} color={Colors.primary} />
                          <Text style={styles.categoryChipText}>{t('sharing.steps')}</Text>
                        </View>
                      )}
                      {item.share_sleep && (
                        <View style={styles.categoryChip}>
                          <Ionicons name="moon" size={13} color={Colors.purple} />
                          <Text style={styles.categoryChipText}>{t('sharing.sleep')}</Text>
                        </View>
                      )}
                      {item.share_nutrition && (
                        <View style={styles.categoryChip}>
                          <Ionicons name="restaurant" size={13} color={Colors.orange} />
                          <Text style={styles.categoryChipText}>{t('sharing.nutrition')}</Text>
                        </View>
                      )}
                    </View>

                    {/* Action Buttons Row */}
                    <View style={[styles.cardActionsRow, isRevoked && styles.revokedActionsRow]}>
                      {isRevoked ? (
                        <>
                          <Text style={styles.revokedNoticeText}>{t('sharing.statusRevoked')}</Text>
                          <TouchableOpacity
                            style={styles.actionBtnDanger}
                            onPress={() => setDeletingItem(item)}
                            disabled={isItemBusy || Boolean(busyId)}
                            accessibilityRole="button"
                            accessibilityLabel={t('sharing.deleteAction')}
                          >
                            {isItemBusy ? <ActivityIndicator size="small" color={Colors.coral} /> : <>
                              <Ionicons name="trash-outline" size={15} color={Colors.coral} />
                              <Text style={styles.actionBtnDangerText}>{t('sharing.deleteAction')}</Text>
                            </>}
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.actionBtnOutline}
                            onPress={() =>
                              router.push({
                                pathname: '/sharing-setup' as any,
                                params: { id: item.id },
                              })
                            }
                            disabled={isItemBusy}
                            accessibilityRole="button"
                            accessibilityLabel={t('sharing.editAction')}
                          >
                            <Ionicons name="create-outline" size={15} color={Colors.primary} />
                            <Text style={styles.actionBtnOutlineText}>
                              {t('sharing.editAction')}
                            </Text>
                          </TouchableOpacity>

                          {isActive && (
                            <TouchableOpacity
                              style={styles.actionBtnOutline}
                              onPress={() => handlePause(item.id)}
                              disabled={isItemBusy}
                              accessibilityRole="button"
                              accessibilityLabel={t('sharing.pauseAction')}
                            >
                              {isItemBusy ? (
                                <ActivityIndicator size="small" color={Colors.orange} />
                              ) : (
                                <>
                                  <Ionicons name="pause-circle-outline" size={15} color={Colors.orange} />
                                  <Text style={[styles.actionBtnOutlineText, { color: Colors.orange }]}>
                                    {t('sharing.pauseAction')}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}

                          {isPaused && (
                            <TouchableOpacity
                              style={styles.actionBtnOutline}
                              onPress={() => handleResume(item.id)}
                              disabled={isItemBusy}
                              accessibilityRole="button"
                              accessibilityLabel={t('sharing.resumeAction')}
                            >
                              {isItemBusy ? (
                                <ActivityIndicator size="small" color={Colors.primary} />
                              ) : (
                                <>
                                  <Ionicons name="play-circle-outline" size={15} color={Colors.primary} />
                                  <Text style={styles.actionBtnOutlineText}>
                                    {t('sharing.resumeAction')}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            style={styles.actionBtnDanger}
                            onPress={() => setRevokingItem(item)}
                            disabled={isItemBusy}
                            accessibilityRole="button"
                            accessibilityLabel={t('sharing.revokeAction')}
                          >
                            <Ionicons name="trash-outline" size={15} color={Colors.coral} />
                            <Text style={styles.actionBtnDangerText}>
                              {t('sharing.revokeAction')}
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          /* Empty State: Keep original introduction screen */
          <>
            {/* Top Visual Anchor */}
            <View style={styles.heroGraphicWrapper}>
              <View style={styles.heroOuterCircle}>
                <View style={styles.heroInnerCircle}>
                  <Ionicons name="people" size={36} color={Colors.primary} />
                </View>
              </View>
            </View>

            {/* Header Section */}
            <View style={styles.header}>
              <Text style={styles.title}>{t('navigation.sharing')}</Text>
              <Text style={styles.subtitle}>{t('sharing.description')}</Text>
            </View>

            {/* Feature Explanations */}
            <View style={styles.featuresList}>
              {SHARING_FEATURES.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <Ionicons name={feature.icon as any} size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.featureTextContent}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>{feature.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Primary Action & Privacy Note */}
            <View style={styles.footerSection}>
              <View style={styles.privacyNoteContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={14}
                  color={Colors.textMuted}
                  style={styles.lockIcon}
                />
                <Text style={styles.privacyNoteText}>
                  {t('sharing.permissionHint')}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.stickyFooter}>
        <PrimaryButton
          title={hasInvites ? t('sharing.addNewShare') : t('sharing.start')}
          onPress={() => router.push('/sharing-setup' as any)}
          style={styles.stickyAddButton}
        />
      </View>

      {/* Revoke Confirmation Modal */}
      <Modal
        visible={Boolean(revokingItem)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRevokingItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityRole="alertdialog">
            <View style={styles.modalIconBg}>
              <Ionicons name="warning" size={28} color={Colors.coral} />
            </View>
            <Text style={styles.modalTitle}>{t('sharing.confirmRevokeTitle')}</Text>
            <Text style={styles.modalMessage}>
              {revokingItem
                ? t('sharing.confirmRevokeMessage', { recipient: revokingItem.recipient_label })
                : ''}
            </Text>
            <View style={styles.modalActionsRow}>
              <TextButton
                title={t('sharing.cancelAction')}
                onPress={() => setRevokingItem(null)}
                style={styles.modalCancelBtn}
              />
              <PrimaryButton
                title={t('sharing.confirmRevokeButton')}
                onPress={handleConfirmRevoke}
                loading={isRevoking}
                style={styles.modalConfirmBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(deletingItem)}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!isDeleting) setDeletingItem(null); }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityRole="alertdialog">
            <View style={styles.modalIconBg}>
              <Ionicons name="trash-outline" size={26} color={Colors.coral} />
            </View>
            <Text style={styles.modalTitle}>{t('sharing.confirmDeleteTitle')}</Text>
            <Text style={styles.modalMessage}>
              {deletingItem ? t('sharing.confirmDeleteMessage', { recipient: recipientDisplayText(deletingItem, t('sharing.contact')) }) : ''}
            </Text>
            <View style={styles.modalActionsRow}>
              <TextButton
                title={t('sharing.cancelAction')}
                onPress={() => setDeletingItem(null)}
                disabled={isDeleting}
                style={styles.modalCancelBtn}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('sharing.deleteAction')}
                accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
                disabled={isDeleting}
                onPress={handleConfirmDelete}
                style={styles.modalDeleteBtn}
              >
                {isDeleting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalDeleteText}>{t('sharing.deleteAction')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...Typography.body,
    color: Colors.coral,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  retryButton: {
    marginTop: Spacing.lg,
    minWidth: 160,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
  },
  mainScroll: {
    flex: 1,
  },
  stickyFooter: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  stickyAddButton: {
    marginBottom: 0,
  },
  // Management View
  managementHeader: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
  },
  managementTitle: {
    ...Typography.sectionTitle,
    color: Colors.textPrimary,
  },
  managementSubtitle: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F2',
    borderWidth: 1,
    borderColor: '#F8B4B4',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  actionErrorText: {
    ...Typography.supporting,
    color: Colors.coral,
    flex: 1,
  },
  invitesList: {
    gap: Spacing.md,
  },
  shareCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  cardTopRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    width: '100%',
  },
  recipientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  recipientTextWrapper: {
    flex: 1,
    minWidth: 0,
  },
  recipientLabel: {
    ...Typography.cardTitle,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  recipientAvatarText: {
    ...Typography.label,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    ...Typography.labelSmall,
    fontWeight: '600',
  },
  badgeActive: {
    backgroundColor: '#E6F7F5',
  },
  badgeTextActive: {
    color: Colors.primary,
  },
  badgePaused: {
    backgroundColor: '#FFF4E6',
  },
  badgeTextPaused: {
    color: Colors.orange,
  },
  badgeRevoked: {
    backgroundColor: '#F3F4F6',
  },
  badgeTextRevoked: {
    color: Colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...Typography.supporting,
    color: Colors.textMuted,
  },
  metaDivider: {
    color: Colors.border,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F6',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
    gap: 4,
  },
  categoryChipText: {
    ...Typography.supporting,
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  revokedActionsRow: {
    justifyContent: 'space-between',
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    gap: 4,
  },
  actionBtnOutlineText: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  actionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F2',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    gap: 4,
  },
  actionBtnDangerText: {
    ...Typography.supporting,
    color: Colors.coral,
    fontWeight: '600',
  },
  revokedNoticeText: {
    ...Typography.supporting,
    color: Colors.textMuted,
    fontStyle: 'italic',
    flex: 1,
  },
  // Modal Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  modalIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FDF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  modalMessage: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    gap: Spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: Colors.coral,
  },
  modalDeleteBtn: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.coral,
  },
  modalDeleteText: {
    ...Typography.button,
    color: Colors.white,
  },
  // Empty Intro Screen
  heroGraphicWrapper: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  heroOuterCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(14, 165, 164, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInnerCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: Spacing.xxl,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  featuresList: {
    marginBottom: Spacing.xxl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xxl,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
    borderWidth: 1,
    borderColor: '#D4EFEB',
  },
  featureTextContent: {
    flex: 1,
  },
  featureTitle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  featureDescription: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  footerSection: {
    paddingTop: Spacing.md,
  },
  primaryButton: {
    marginBottom: Spacing.lg,
  },
  privacyNoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    gap: 6,
  },
  lockIcon: {
    marginTop: 2,
  },
  privacyNoteText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    flex: 1,
  },
});
