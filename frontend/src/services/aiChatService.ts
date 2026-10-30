import { supabase } from '../lib/supabase';
import { DataAccessError, dataError } from '../lib/dataErrors';
import { assertIdentity, queryResult, requireAuthenticatedUserId } from './queryCore';
import type { AIChatConversationRow, AIChatConversationSummaryRow, AIChatMessage } from '../types/database';

export type AIChatErrorCode =
  | 'unauthenticated'
  | 'quota_exceeded'
  | 'not_configured'
  | 'health_data_unavailable'
  | 'conversation_missing'
  | 'history_unavailable'
  | 'timeout'
  | 'network'
  | 'failed';

export class AIChatError extends Error {
  constructor(readonly code: AIChatErrorCode) {
    super(code);
    this.name = 'AIChatError';
  }
}

type AIChatReply = {
  conversation_id: string;
  title: string;
  user_message: AIChatMessage;
  reply: AIChatMessage;
};

const CONVERSATION_COLUMNS = 'id,user_id,title,messages,created_at,updated_at';
const CONVERSATION_SUMMARY_COLUMNS = 'id,user_id,title,created_at,updated_at';

export async function listAIConversations(): Promise<AIChatConversationSummaryRow[]> {
  const owner = await requireAuthenticatedUserId();
  const rows = await queryResult(
    supabase.from('ai_chat_conversations').select(CONVERSATION_SUMMARY_COLUMNS)
      .eq('user_id', owner).order('updated_at', { ascending: false }).limit(50),
    owner,
  );
  return (rows ?? []) as AIChatConversationSummaryRow[];
}

export async function getAIConversation(id: string): Promise<AIChatConversationRow> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new DataAccessError('INVALID_INPUT', 'errors.id');
  }
  const owner = await requireAuthenticatedUserId();
  const row = await queryResult(
    supabase.from('ai_chat_conversations').select(CONVERSATION_COLUMNS)
      .eq('id', id).eq('user_id', owner).maybeSingle(),
    owner,
  );
  if (!row) throw new AIChatError('conversation_missing');
  return row as AIChatConversationRow;
}

export async function deleteAIConversation(id: string): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new DataAccessError('INVALID_INPUT', 'errors.id');
  }
  const owner = await requireAuthenticatedUserId();
  const row = await queryResult(
    supabase.from('ai_chat_conversations').delete().eq('id', id).eq('user_id', owner).select('id').maybeSingle(),
    owner,
  );
  if (!row) throw new DataAccessError('NOT_FOUND', 'ai.historyUnavailable');
}

async function edgeErrorCode(error: unknown): Promise<AIChatErrorCode> {
  if (!error || typeof error !== 'object') return 'failed';
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    if (context.status === 401) return 'unauthenticated';
    if (context.status === 429) return 'quota_exceeded';
    try {
      const body = await context.clone().json() as { error?: string };
      if (body.error === 'ai_not_configured' || body.error === 'ai_key_invalid') return 'not_configured';
      if (body.error === 'health_data_unavailable') return 'health_data_unavailable';
      if (body.error === 'conversation_not_found') return 'conversation_missing';
      if (body.error === 'history_unavailable' || body.error === 'history_save_failed') return 'history_unavailable';
      if (body.error === 'ai_timeout') return 'timeout';
      if (body.error === 'ai_network_error' || body.error === 'ai_provider_error') return 'network';
    } catch { /* use the HTTP status fallback */ }
    if (context.status === 404) return 'not_configured';
    if (context.status === 504) return 'timeout';
    if (context.status >= 500) return 'network';
    return 'failed';
  }
  const name = (error as { name?: unknown }).name;
  return typeof name === 'string' && name.includes('Fetch') ? 'network' : 'failed';
}

export async function sendAIChatMessage(options: {
  conversationId: string | null;
  message: string;
  includeHealthData: boolean;
}): Promise<{ conversationId: string; conversation: AIChatConversationRow }> {
  const owner = await requireAuthenticatedUserId();
  const message = options.message.trim();
  if (!message || message.length > 1600) throw new AIChatError('failed');

  const { data, error } = await supabase.functions.invoke<AIChatReply>('ai-chat', {
    body: {
      conversation_id: options.conversationId,
      message,
      include_health_data: options.includeHealthData,
      timezone_offset_minutes: new Date().getTimezoneOffset(),
    },
  });
  if (error) throw new AIChatError(await edgeErrorCode(error));
  if (!data?.conversation_id || !data.user_message || !data.reply) throw new AIChatError('failed');
  await assertIdentity(owner);

  const { data: conversation, error: historyError } = await supabase.from('ai_chat_conversations')
    .select(CONVERSATION_COLUMNS).eq('id', data.conversation_id).eq('user_id', owner).maybeSingle();
  if (historyError) throw dataError(historyError);
  if (!conversation) throw new AIChatError('history_unavailable');
  await assertIdentity(owner);
  return { conversationId: data.conversation_id, conversation: conversation as AIChatConversationRow };
}
