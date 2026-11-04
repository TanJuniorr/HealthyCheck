-- Migration: cho NGƯỜI NHẬN đọc dữ liệu đã được chia sẻ (chỉ đọc).
-- BẢN NHÁP ĐỂ NHÓM DUYỆT — KHÔNG tự chạy lên project Supabase chung
-- khi chưa có đồng ý của TanJuniorr / nhóm.
--
-- Phạm vi, đúng cờ hiện có trong sharing_invites:
--   share_steps     -> step_records
--   share_sleep     -> sleep_records
--   share_nutrition -> meal_records (nối foods để tính kcal)
-- share_cycle bị ép false ở sharingService nên KHÔNG mở ở đây.
-- Không có cờ share_water trong bảng hiện tại nên v1 không mở water_records.
--
-- Những gì KHÔNG làm ở migration này, cố tình:
-- - Không thêm INSERT / UPDATE / DELETE cho người nhận ở bất kỳ bảng nào.
-- - Không mở profiles toàn bộ: người nhận chỉ được đọc hàng profiles của
--   chủ tài khoản đã chia sẻ cho mình, và client chỉ SELECT 3 cột
--   id, full_name, avatar_url. RLS là kiểm soát theo HÀNG, không phải
--   theo cột, nên tuyệt đối không SELECT * từ profiles ở phía người nhận.
-- - Không mở menstrual_cycle_settings / menstrual_cycle_logs.
-- - Không dùng service_role key ở frontend để lách RLS.
--
-- Cách email được so khớp: Supabase Auth lưu email của tài khoản đang
-- đăng nhập trong JWT (auth.jwt() ->> 'email'). Người nhận PHẢI đăng
-- nhập bằng đúng email mà chủ tài khoản đã mời (đã lower-case khi tạo
-- lời mời ở sharingService.validateRecipient). Email khác, dù chỉ khác
-- chữ hoa/thường, cũng được lower() ở cả 2 phía nên vẫn khớp; email
-- hoàn toàn khác thì không thấy gì — đó là hành vi bảo mật mong muốn.

-- 1. Chỉ mục để tra lời mời theo email người nhận cho nhanh.
create index if not exists idx_sharing_invites_recipient_email
  on public.sharing_invites (lower(recipient_email));

-- 2. Người nhận được xem chính lời mời gửi cho mình (mọi trạng thái),
-- để màn hình còn hiện được trạng thái paused / revoked thay vì trống.
-- Policy cũ chỉ cho CHỦ tài khoản xem lời mời, nên nếu thiếu policy này
-- thì getMySharedOwners() sẽ luôn trả về danh sách rỗng.
drop policy if exists "Recipients can view invites addressed to them"
  on public.sharing_invites;
create policy "Recipients can view invites addressed to them"
  on public.sharing_invites
  for select
  to authenticated
  using (
    recipient_email is not null
    and lower(recipient_email) = lower(auth.jwt() ->> 'email')
  );

-- 3. Người nhận được đọc tên + ảnh đại diện của chủ tài khoản đã chia sẻ
-- cho mình. Client chỉ SELECT id, full_name, avatar_url (xem ghi chú đầu file).
drop policy if exists "Recipients can view sharer display profile"
  on public.profiles;
create policy "Recipients can view sharer display profile"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sharing_invites as invite
      where invite.owner_id = profiles.id
        and invite.recipient_email is not null
        and lower(invite.recipient_email) = lower(auth.jwt() ->> 'email')
        and invite.status in ('active', 'paused')
    )
  );

-- 4. Người nhận đọc step_records, chỉ khi lời mời còn active + bật bước chân.
drop policy if exists "Recipients can view shared steps"
  on public.step_records;
create policy "Recipients can view shared steps"
  on public.step_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sharing_invites as invite
      where invite.owner_id = step_records.user_id
        and invite.recipient_email is not null
        and lower(invite.recipient_email) = lower(auth.jwt() ->> 'email')
        and invite.status = 'active'
        and invite.share_steps = true
    )
  );

-- 5. Người nhận đọc sleep_records, chỉ khi lời mời còn active + bật giấc ngủ.
drop policy if exists "Recipients can view shared sleep"
  on public.sleep_records;
create policy "Recipients can view shared sleep"
  on public.sleep_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sharing_invites as invite
      where invite.owner_id = sleep_records.user_id
        and invite.recipient_email is not null
        and lower(invite.recipient_email) = lower(auth.jwt() ->> 'email')
        and invite.status = 'active'
        and invite.share_sleep = true
    )
  );

-- 6. Người nhận đọc meal_records, chỉ khi lời mời còn active + bật dinh dưỡng.
drop policy if exists "Recipients can view shared meals"
  on public.meal_records;
create policy "Recipients can view shared meals"
  on public.meal_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sharing_invites as invite
      where invite.owner_id = meal_records.user_id
        and invite.recipient_email is not null
        and lower(invite.recipient_email) = lower(auth.jwt() ->> 'email')
        and invite.status = 'active'
        and invite.share_nutrition = true
    )
  );

-- 7. Realtime (tùy chọn, làm ở Dashboard nếu migration này bị lỗi ở bước này):
-- Vào Supabase Dashboard > Database > Replication, bật Realtime cho
-- step_records, sleep_records, meal_records và sharing_invites.
-- Không bắt buộc cho việc XEM, chỉ bắt buộc cho việc TỰ CẬP NHẬT mà
-- không cần bấm Tải lại. Nếu muốn chạy bằng SQL thì chạy riêng đoạn
-- dưới đây, tách khỏi migration chính để 1 lỗi ở đây không làm hỏng
-- toàn bộ policy ở trên:
--
-- do $$
-- begin
--   if not exists (
--     select 1 from pg_publication_tables
--     where pubname = 'supabase_realtime' and schemaname = 'public'
--       and tablename = 'step_records'
--   ) then
--     alter publication supabase_realtime add table public.step_records;
--   end if;
--   if not exists (
--     select 1 from pg_publication_tables
--     where pubname = 'supabase_realtime' and schemaname = 'public'
--       and tablename = 'sleep_records'
--   ) then
--     alter publication supabase_realtime add table public.sleep_records;
--   end if;
--   if not exists (
--     select 1 from pg_publication_tables
--     where pubname = 'supabase_realtime' and schemaname = 'public'
--       and tablename = 'meal_records'
--   ) then
--     alter publication supabase_realtime add table public.meal_records;
--   end if;
--   if not exists (
--     select 1 from pg_publication_tables
--     where pubname = 'supabase_realtime' and schemaname = 'public'
--       and tablename = 'sharing_invites'
--   ) then
--     alter publication supabase_realtime add table public.sharing_invites;
--   end if;
-- end $$;
