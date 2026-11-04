import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Radius, Spacing } from '../../src/constants/spacing';
import { Typography } from '../../src/constants/typography';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import {
  AIChatError,
  deleteAIConversation,
  getAIConversation,
  listAIConversations,
  sendAIChatMessage,
  type AIChatErrorCode,
} from '../../src/services/aiChatService';
import type { AIChatConversationRow, AIChatConversationSummaryRow, AIChatMessage } from '../../src/types/database';

const MAX_MESSAGE_LENGTH = 1600;

export default function AIChatScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<AIChatMessage>>(null);
  const [conversations, setConversations] = useState<AIChatConversationSummaryRow[]>([]);
  const [conversation, setConversation] = useState<AIChatConversationRow | null>(null);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AIChatConversationSummaryRow | null>(null);
  const [errorCode, setErrorCode] = useState<AIChatErrorCode | null>(null);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [historyErrorOwnerId, setHistoryErrorOwnerId] = useState<string | null>(null);
  const [errorOwnerId, setErrorOwnerId] = useState<string | null>(null);
  const userId = user?.id ?? null;
  const hasOwnerData = Boolean(userId) && dataOwnerId === userId;
  const visibleMessages = hasOwnerData ? messages : [];
  const visibleConversations = hasOwnerData ? conversations : [];
  const visibleConversation = hasOwnerData ? conversation : null;
  const historyError = Boolean(userId) && historyErrorOwnerId === userId;
  const isLoadingHistory = Boolean(userId) && !hasOwnerData && !historyError;

  const loadHistory = useCallback(async (ownerId: string) => {
    setDataOwnerId(null);
    setErrorCode(null);
    setHistoryErrorOwnerId(null);
    try {
      const rows = await listAIConversations();
      if (user?.id !== ownerId) return;
      const latest = rows[0] ? await getAIConversation(rows[0].id) : null;
      if (user?.id !== ownerId) return;
      setConversations(rows);
      setConversation(latest);
      setMessages(latest?.messages ?? []);
      setDataOwnerId(ownerId);
      setErrorOwnerId(null);
    } catch {
      if (user?.id === ownerId) {
        setConversations([]);
        setConversation(null);
        setMessages([]);
        setHistoryErrorOwnerId(ownerId);
        setDataOwnerId(ownerId);
      }
    }
  }, [user]);

  useEffect(() => {
    const ownerId = user?.id;
    if (!ownerId) return;
    let active = true;
    void Promise.resolve().then(() => active ? loadHistory(ownerId) : undefined);
    return () => { active = false; };
  }, [user, loadHistory]);

  useEffect(() => {
    if (visibleMessages.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [visibleMessages.length]);

  const showNewConversation = () => {
    setConversation(null);
    setMessages([]);
    setDataOwnerId(user?.id ?? null);
    setInput('');
    setErrorCode(null);
    setErrorOwnerId(null);
  };

  const openConversation = async (selected: AIChatConversationSummaryRow) => {
    const ownerId = user?.id;
    if (!ownerId) return;
    setDataOwnerId(null);
    setInput('');
    setErrorCode(null);
    setErrorOwnerId(null);
    setHistoryVisible(false);
    try {
      const fullConversation = await getAIConversation(selected.id);
      if (user?.id !== ownerId) return;
      setConversation(fullConversation);
      setMessages(fullConversation.messages ?? []);
      setDataOwnerId(ownerId);
    } catch {
      if (user?.id !== ownerId) return;
      setConversation(null);
      setMessages([]);
      setDataOwnerId(ownerId);
      setErrorCode('conversation_missing');
      setErrorOwnerId(ownerId);
    }
  };

  const sendMessage = async () => {
    const message = input.trim();
    if (!message || isSending || !userId || !hasOwnerData) return;

    setErrorCode(null);
    setErrorOwnerId(null);
    setInput('');
    setIsSending(true);
    const previousMessages = visibleMessages;
    const optimistic: AIChatMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages([...previousMessages, optimistic]);

    try {
      const result = await sendAIChatMessage({
        conversationId: visibleConversation?.id ?? null,
        message,
        includeHealthData: true,
      });
      if (user?.id !== userId) return;
      setConversation(result.conversation);
      setMessages(result.conversation.messages ?? []);
      setDataOwnerId(userId);
      setConversations(current => [
        result.conversation,
        ...current.filter(item => item.id !== result.conversationId),
      ].slice(0, 50));
    } catch (error) {
      if (user?.id !== userId) return;
      setMessages(previousMessages);
      setInput(message);
      setErrorCode(error instanceof AIChatError ? error.code : 'failed');
      setErrorOwnerId(userId);
    } finally {
      setIsSending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteAIConversation(target.id);
      if (user?.id !== target.user_id) return;
      setConversations(current => current.filter(item => item.id !== target.id));
      if (conversation?.id === target.id && user?.id === target.user_id) {
        setConversation(null);
        setMessages([]);
      }
    } catch {
      if (user?.id !== target.user_id) return;
      setErrorCode('history_unavailable');
      setErrorOwnerId(target.user_id);
    }
  };

  const messageListEmpty = (
    <View style={styles.welcome}>
      {isLoadingHistory ? (
        <ActivityIndicator color={Colors.primary} />
      ) : historyError ? (
        <>
          <Text style={styles.welcomeTitle}>{t('ai.loadFailed')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => user?.id && void loadHistory(user.id)}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.welcomeIcon}><Ionicons name="sparkles" size={26} color={Colors.primary} /></View>
          <Text style={styles.welcomeTitle}>{t('ai.welcomeTitle')}</Text>
          <Text style={styles.welcomeBody}>{t('ai.welcomeBody')}</Text>
          <Text style={styles.suggestionsTitle}>{t('ai.suggestionsTitle')}</Text>
          <View style={styles.suggestions}>
            {(['suggestSteps', 'suggestSleep', 'suggestNutrition'] as const).map(key => (
              <TouchableOpacity key={key} onPress={() => setInput(t(`ai.${key}`))} style={styles.suggestion}>
                <Text style={styles.suggestionText}>{t(`ai.${key}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.disclaimer}>{t('ai.disclaimer')}</Text>
        </>
      )}
    </View>
  );

  const renderMessage = ({ item }: { item: AIChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.userMessageRow : styles.assistantMessageRow]}>
        {!isUser ? <View style={styles.assistantAvatar}><Ionicons name="sparkles" size={14} color={Colors.white} /></View> : null}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.assistantMessageText]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>{t('ai.title')}</Text>
            <Text style={styles.subtitle}>{t('ai.subtitle')}</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('ai.newChat')}
            onPress={showNewConversation}
            disabled={isLoadingHistory || isSending}
            style={styles.headerButton}
          >
            <Ionicons name="create-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('ai.history')}
            onPress={() => setHistoryVisible(true)}
            disabled={isLoadingHistory || isSending}
            style={styles.headerButton}
          >
            <Ionicons name="time-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {errorCode && errorOwnerId === userId ? <Text accessibilityRole="alert" style={styles.errorText}>{t(`ai.errors.${errorCode}`)}</Text> : null}

        <FlatList
          ref={listRef}
          style={styles.messageList}
          contentContainerStyle={[styles.messageListContent, visibleMessages.length === 0 && styles.emptyListContent]}
          data={visibleMessages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          ListEmptyComponent={messageListEmpty}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {isSending ? (
            <View style={styles.sendingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.sendingText}>{t('ai.busy')}</Text>
            </View>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t('ai.placeholder')}
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              multiline
              maxLength={MAX_MESSAGE_LENGTH}
              editable={!isSending && !isLoadingHistory}
              accessibilityLabel={t('ai.placeholder')}
              onSubmitEditing={() => void sendMessage()}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('ai.send')}
              accessibilityState={{ disabled: !input.trim() || isSending || isLoadingHistory || !userId || !hasOwnerData }}
              onPress={() => void sendMessage()}
              disabled={!input.trim() || isSending || isLoadingHistory || !userId || !hasOwnerData}
              style={[styles.sendButton, (!input.trim() || isSending || isLoadingHistory || !userId || !hasOwnerData) && styles.disabledSendButton]}
            >
              {isSending ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="arrow-up" size={21} color={Colors.white} />}
            </TouchableOpacity>
          </View>
          <Text style={styles.disclaimerSmall}>{t('ai.disclaimer')}</Text>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={historyVisible} transparent animationType="slide" onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setHistoryVisible(false)} />
          <View style={[styles.historySheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('ai.historyTitle')}</Text>
              <TouchableOpacity onPress={() => setHistoryVisible(false)} style={styles.modalClose} accessibilityLabel={t('ai.close')}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.newChatRow} onPress={() => { showNewConversation(); setHistoryVisible(false); }}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.newChatText}>{t('ai.newChat')}</Text>
            </TouchableOpacity>
            {isLoadingHistory ? <ActivityIndicator style={styles.historySpinner} color={Colors.primary} /> : null}
            {!isLoadingHistory && visibleConversations.length === 0 ? <Text style={styles.historyEmpty}>{t('ai.historyEmpty')}</Text> : null}
            <FlatList
              data={visibleConversations}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.historyList}
              renderItem={({ item }) => (
                <View style={styles.historyRow}>
                  <TouchableOpacity style={styles.historyOpen} onPress={() => void openConversation(item)}>
                    <Text style={styles.historyRowTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.historyRowDate} numberOfLines={1}>{new Date(item.updated_at).toLocaleString()}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    accessibilityRole="button"
                    accessibilityLabel={t('ai.deleteConversation')}
                    onPress={() => setDeleteTarget(item)}
                  >
                    <Ionicons name="trash-outline" size={19} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.confirmRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDeleteTarget(null)} />
          <View style={styles.confirmCard}>
            <Text style={styles.modalTitle}>{t('ai.deleteTitle')}</Text>
            <Text style={styles.confirmText}>{t('ai.deleteConfirm')}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelDeleteButton} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.cancelDeleteText}>{t('ai.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDeleteButton} onPress={() => void confirmDelete()}>
                <Text style={styles.confirmDeleteText}>{t('ai.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  keyboardArea: { flex: 1 },
  header: {
    minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.screenPadding,
    backgroundColor: Colors.surface, borderBottomColor: Colors.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitles: { flex: 1 },
  title: { ...Typography.cardTitle, fontSize: 22, color: Colors.textPrimary },
  subtitle: { ...Typography.supporting, fontSize: 15, color: Colors.textSecondary, marginTop: 2 },
  headerButton: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.xs },
  errorText: {
    ...Typography.supporting, color: Colors.error, marginHorizontal: Spacing.screenPadding, marginTop: Spacing.sm,
    padding: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.errorLight,
  },
  messageList: { flex: 1 },
  messageListContent: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  emptyListContent: { flexGrow: 1, justifyContent: 'center' },
  welcome: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xs },
  welcomeIcon: {
    width: 54, height: 54, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryLight, marginBottom: Spacing.md,
  },
  welcomeTitle: { ...Typography.sectionTitle, color: Colors.textPrimary, textAlign: 'center' },
  welcomeBody: { ...Typography.bodySmall, fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 23 },
  suggestionsTitle: { ...Typography.supporting, fontSize: 15, color: Colors.textMuted, fontWeight: '700', marginTop: Spacing.xxl, marginBottom: Spacing.sm },
  suggestions: { width: '100%', gap: Spacing.sm },
  suggestion: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  suggestionText: { ...Typography.bodySmall, fontSize: 15, color: Colors.textPrimary, textAlign: 'center' },
  disclaimer: { ...Typography.supporting, fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxl, lineHeight: 19 },
  retryButton: { marginTop: Spacing.md, padding: Spacing.md },
  retryText: { ...Typography.buttonSmall, color: Colors.primary },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: Spacing.md, maxWidth: '100%' },
  userMessageRow: { justifyContent: 'flex-end' },
  assistantMessageRow: { justifyContent: 'flex-start' },
  assistantAvatar: { width: 28, height: 28, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.xs },
  messageBubble: { maxWidth: '86%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg },
  userBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: Radius.xs },
  assistantBubble: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: Radius.xs },
  messageText: { ...Typography.bodySmall, fontSize: 15, lineHeight: 23 },
  userMessageText: { color: Colors.white },
  assistantMessageText: { color: Colors.textPrimary },
  composerArea: { backgroundColor: Colors.background, paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.sm },
  sendingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  sendingText: { ...Typography.supporting, fontSize: 14, color: Colors.textSecondary, marginLeft: Spacing.sm },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.xs, borderRadius: Radius.xl,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  input: { flex: 1, ...Typography.body, fontSize: 16, color: Colors.textPrimary, maxHeight: 120, minHeight: 42, paddingHorizontal: Spacing.md, paddingTop: 11, paddingBottom: 9 },
  sendButton: { width: 40, height: 40, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, marginLeft: Spacing.xs },
  disabledSendButton: { opacity: 0.5 },
  disclaimerSmall: { ...Typography.supporting, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xs, lineHeight: 15 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: Colors.overlay },
  historySheet: { maxHeight: '82%', minHeight: '45%', backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  modalTitle: { ...Typography.sectionTitle, color: Colors.textPrimary, flex: 1 },
  modalClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  newChatRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderBottomColor: Colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  newChatText: { ...Typography.buttonSmall, fontSize: 15, color: Colors.primary },
  historySpinner: { marginTop: Spacing.xxl },
  historyEmpty: { ...Typography.bodySmall, fontSize: 15, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.xxl },
  historyList: { flexGrow: 0 },
  historyRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  historyOpen: { flex: 1, paddingVertical: Spacing.sm, paddingRight: Spacing.sm },
  historyRowTitle: { ...Typography.bodySmall, fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  historyRowDate: { ...Typography.supporting, fontSize: 14, color: Colors.textMuted, marginTop: 3 },
  deleteButton: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
  confirmRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  confirmCard: { width: '100%', maxWidth: 420, borderRadius: Radius.lg, backgroundColor: Colors.surface, padding: Spacing.xl },
  confirmText: { ...Typography.bodySmall, fontSize: 15, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 22 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.xl, gap: Spacing.sm },
  cancelDeleteButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.md },
  cancelDeleteText: { ...Typography.buttonSmall, color: Colors.textSecondary },
  confirmDeleteButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.error },
  confirmDeleteText: { ...Typography.buttonSmall, color: Colors.white, fontWeight: '700' },
});
