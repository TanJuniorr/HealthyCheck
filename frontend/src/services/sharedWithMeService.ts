/**
 * Shared-with-me (người nhận) — chỉ đọc.
 *
 * Khác với các service cá nhân dùng queryCore: queryCore luôn ép
 * user_id phải bằng tài khoản đang đăng nhập (requireAuthenticatedUserId
 * + assertIdentity). Ở đây tài khoản đang đăng nhập là NGƯỜI NHẬN, còn
 * dữ liệu cần đọc là của CHỦ TÀI KHOẢN, nên service này KHÔNG được dùng
 * queryCore cho dữ liệu của chủ tài khoản. Quyền truy cập thật sự nằm ở
 * RLS trong file migration kèm theo, không nằm ở client.
 *
 * Phạm vi v1, đúng cờ hiện có trong sharing_invites:
 * - share_steps -> step_records
 * - share_sleep -> sleep_records
 * - share_nutrition -> meal_records (nối foods để tính kcal)
 * share_cycle bị ép false ở sharingService và KHÔNG được mở ở đây.
 * Không có cờ share_water trong bảng hiện tại, nên v1 không chia sẻ nước.
 * Muốn thêm nước thì nhóm phải thêm cột share_water + policy riêng, rồi
 * mới sửa service này.
 */
import { supabase } from '../lib/supabase';
import { DataAccessError, dataError } from '../lib/dataErrors';
import { getLocalDayBounds, toLocalDateKey } from '../lib/dateUtils';
import type { PrivacyLevel, SharingInviteRow, SharingStatus } from '../types/database';

export type SharedOwner = {
  inviteId: string;
  ownerId: string;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  privacyLevel: PrivacyLevel;
  shareSteps: boolean;
  shareSleep: boolean;
  shareNutrition: boolean;
  status: SharingStatus;
  createdAt: string;
};

export type SharedMetrics = {
  updatedAt: string;
  stepsToday: number | null;
  sleepLastHours: number | null;
  sleepLastDate: string | null;
  nutritionTodayKcal: number | null;
  mealsToday: number | null;
};

type CurrentRecipient = { id: string; email: string };

async function getCurrentRecipient(): Promise<CurrentRecipient> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw dataError(error);
  if (!data.user) {
    throw new DataAccessError('UNAUTHENTICATED', 'Vui lòng đăng nhập để xem dữ liệu được chia sẻ.');
  }
  const email = data.user.email?.trim().toLowerCase();
  if (!email) {
    throw new DataAccessError('INVALID_INPUT', 'sharedWithMe.noEmail');
  }
  return { id: data.user.id, email };
}

function throwIfError(error: unknown): void {
  if (error) throw dataError(error);
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type SharedInviteSummary = Pick<
  SharingInviteRow,
  | 'id'
  | 'owner_id'
  | 'privacy_level'
  | 'share_steps'
  | 'share_sleep'
  | 'share_nutrition'
  | 'status'
  | 'created_at'
>;

function toSharedOwner(row: SharedInviteSummary, profile: { full_name: string | null; avatar_url: string | null } | null): SharedOwner {
  return {
    inviteId: row.id,
    ownerId: row.owner_id,
    ownerName: profile?.full_name ?? null,
    ownerAvatarUrl: profile?.avatar_url ?? null,
    privacyLevel: row.privacy_level,
    shareSteps: row.share_steps,
    shareSleep: row.share_sleep,
    shareNutrition: row.share_nutrition,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Liệt kê các chủ tài khoản đang chia sẻ cho tài khoản hiện tại.
 * Cần policy "Recipients can view invites addressed to them" trong
 * migration kèm theo, vì policy cũ chỉ cho CHỦ tài khoản xem lời mời.
 */
export async function getMySharedOwners(): Promise<SharedOwner[]> {
  const recipient = await getCurrentRecipient();
  const { data, error } = await supabase
    .from('sharing_invites')
    .select('id,owner_id,recipient_label,recipient_email,privacy_level,share_steps,share_sleep,share_nutrition,share_cycle,status,created_at,updated_at')
    .eq('recipient_email', recipient.email)
    .order('created_at', { ascending: false });
  throwIfError(error);
  const invites = (data ?? []) as SharedInviteSummary[];
  const owners: SharedOwner[] = [];
  for (const invite of invites) {
    // Chỉ lấy tên + ảnh đại diện của chủ tài khoản, không lấy ngày sinh,
    // chiều cao, giới tính hay bất kỳ trường riêng tư nào khác.
    // Cần policy "Recipients can view sharer display profile" trong migration.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,full_name,avatar_url')
      .eq('id', invite.owner_id)
      .maybeSingle();
    // RLS chặn thì Supabase trả về null, không phải lỗi: khi đó tên sẽ
    // hiển thị bằng chữ dự phòng ở màn hình, không được coi là lỗi tải.
    if (profileError) throw dataError(profileError);
    owners.push(toSharedOwner(invite, profile));
  }
  return owners;
}

async function getActiveInviteForRecipient(inviteId: string, recipientEmail: string): Promise<SharedInviteSummary> {
  const { data, error } = await supabase
    .from('sharing_invites')
    .select('id,owner_id,recipient_label,recipient_email,privacy_level,share_steps,share_sleep,share_nutrition,share_cycle,status,created_at,updated_at')
    .eq('id', inviteId)
    .eq('recipient_email', recipientEmail)
    .maybeSingle();
  throwIfError(error);
  if (!data) {
    throw new DataAccessError('NOT_FOUND', 'sharedWithMe.inviteNotFound');
  }
  if (data.status !== 'active') {
    throw new DataAccessError('PERMISSION_DENIED', 'sharedWithMe.notActive');
  }
  return data as SharedInviteSummary;
}

/**
 * Lấy số liệu hôm nay / bản ghi giấc ngủ gần nhất của 1 chủ tài khoản.
 * Trước mỗi lần lấy đều kiểm tra lại lời mời còn active hay không, để
 * chủ tài khoản vừa tạm dừng hoặc thu hồi là người nhận mất quyền ngay,
 * không phải chờ tới lần mở app sau.
 */
export async function getSharedMetrics(owner: SharedOwner): Promise<SharedMetrics> {
  const recipient = await getCurrentRecipient();
  const invite = await getActiveInviteForRecipient(owner.inviteId, recipient.email);
  const today = toLocalDateKey();
  const bounds = getLocalDayBounds(today);

  let stepsToday: number | null = null;
  let sleepLastHours: number | null = null;
  let sleepLastDate: string | null = null;
  let nutritionTodayKcal: number | null = null;
  let mealsToday: number | null = null;

  if (invite.share_steps) {
    const { data, error } = await supabase
      .from('step_records')
      .select('steps,record_date')
      .eq('user_id', invite.owner_id)
      .eq('record_date', today);
    throwIfError(error);
    stepsToday = (data ?? []).reduce<number>((sum, row) => sum + (toNumber(row.steps) ?? 0), 0);
  }

  if (invite.share_sleep) {
    const { data, error } = await supabase
      .from('sleep_records')
      .select('sleep_start,sleep_end')
      .eq('user_id', invite.owner_id)
      .order('sleep_end', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(error);
    if (data) {
      const start = Date.parse(data.sleep_start);
      const end = Date.parse(data.sleep_end);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        sleepLastHours = Math.round(((end - start) / 3600000) * 10) / 10;
        sleepLastDate = data.sleep_end.slice(0, 10);
      }
    }
  }

  if (invite.share_nutrition) {
    const mealColumns = 'quantity_g,consumed_at,food:foods(calories_per_100g)' as const;
    const { data, error } = await supabase
      .from('meal_records')
      .select(mealColumns)
      .eq('user_id', invite.owner_id)
      .gte('consumed_at', bounds.start)
      .lt('consumed_at', bounds.end)
      .limit(1000);
    throwIfError(error);
    const rows = (data ?? []) as unknown as {
  quantity_g: number | string;
  food: { calories_per_100g: number | string } | null;
}[];
    mealsToday = rows.length;
    nutritionTodayKcal = rows.reduce<number>((sum, row) => {
      const qty = toNumber(row.quantity_g);
      const kcalPer100g = row.food ? toNumber(row.food.calories_per_100g) : null;
      if (qty === null || kcalPer100g === null) return sum;
      return sum + (qty * kcalPer100g) / 100;
    }, 0);
  }

  return {
    updatedAt: new Date().toISOString(),
    stepsToday,
    sleepLastHours,
    sleepLastDate,
    nutritionTodayKcal: nutritionTodayKcal === null ? null : Math.round(nutritionTodayKcal),
    mealsToday,
  };
}

/**
 * Đăng ký Realtime cho 1 chủ tài khoản. Chỉ gọi khi lời mời đang active.
 * Realtime của Supabase tôn trọng RLS, nên nếu migration chưa được áp
 * thì sẽ không có sự kiện nào tới, chứ không phải lỗi ở client.
 * Trả về hàm hủy đăng ký, màn hình PHẢI gọi nó khi unmount hoặc khi
 * chuyển sang chủ tài khoản khác, hoặc khi lời mời bị tạm dừng/thu hồi.
 */
export function subscribeSharedMetrics(
  ownerId: string,
  onDataChange: () => void,
  onInviteChange: () => void,
): () => void {
  const channel = supabase
    .channel(`shared-with-me:${ownerId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'step_records', filter: `user_id=eq.${ownerId}` },
      () => onDataChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sleep_records', filter: `user_id=eq.${ownerId}` },
      () => onDataChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'meal_records', filter: `user_id=eq.${ownerId}` },
      () => onDataChange(),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sharing_invites', filter: `owner_id=eq.${ownerId}` },
      () => onInviteChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
