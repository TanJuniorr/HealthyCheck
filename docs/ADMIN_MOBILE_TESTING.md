# Kiểm chứng quản trị bài viết trên ứng dụng

Ngày kiểm tra: 31/10/2026 (Asia/Saigon).

## Kết quả đã thực hiện

- `npx tsc --noEmit`: đạt.
- `npx expo lint`: đạt, không có lỗi/cảnh báo lint.
- `npm test`: 135/135 kiểm thử đạt. Các native control, navigation và image picker được mô phỏng trong Node; đây không phải kiểm thử trên thiết bị.
- `npx --yes --package=@electric-sql/pglite -- node scripts/test-article-db.cjs`: 4/4 kiểm thử tích hợp PostgreSQL tạm đạt. Bao gồm CRUD, lưu nháp, xuất bản nguyên tử, tìm kiếm/phân trang, fallback ngôn ngữ, RLS Admin/User, không cho tự nâng role, thư viện cá nhân, giữ ảnh được tham chiếu bởi cover/nội dung ở mọi trạng thái và thu hồi quyền Admin.
- `npx expo export --platform android --platform ios --output-dir .expo/admin-native-check`: đạt, tạo cả hai bundle Hermes `.hbc`. Lần đầu bị sandbox chặn ghi thư mục tạm; chạy ngoài sandbox đã thành công. Đây không phải bản cài APK/IPA hoặc kiểm thử chạy app.

## Kiểm tra Supabase hiện tại

Tài khoản được xác minh trong `auth.users`, rồi đối chiếu `user_roles.user_id`:

- `phapsutan@gmail.com`: UUID `275b700b-4c1f-49e1-aaac-ced6addd6483`, role `admin`.
- 20 bài xuất bản, 20 cover vẫn tham chiếu đúng 20 object hiện có trong `article-images`.
- Bucket vẫn private, giới hạn 5 MB, MIME JPEG/PNG/WebP.
- Digest toàn bộ hàng articles trước/sau: `9c2275357fffb2b08deae4f9a7a48324`.
- Digest toàn bộ hàng article_translations trước/sau: `5599520ec6cc623a8a7e9d9158c34dd6`.
- Migration `20261030171912_protect_referenced_article_images.sql` đã áp dụng: thêm hàm SECURITY INVOKER và hai restrictive policy để chặn xóa/ghi đè object còn được tham chiếu. Không thay đổi hàng bài viết, bản dịch hoặc object Storage.
- Kiểm tra lại advisors không phát sinh cảnh báo mới. Các cảnh báo có sẵn ngoài phạm vi bài viết vẫn giữ nguyên: quyền gọi `handle_new_user` ([anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)) và [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Bảng private lời mời Admin không có policy là chủ đích chặn truy cập client.

## Những phần cần kiểm thử trên Android/iOS

Môi trường hiện tại không có thiết bị/emulator Android hoặc simulator iOS được kết nối. Chưa xác minh trực tiếp các thao tác sau:

1. Đăng nhập Admin thấy nút `+` và Quản lý bài viết; đăng nhập User không thấy; deep link `/admin` của User bị chặn.
2. Tạo bài, lưu nháp, xem trước, xuất bản, sửa, gỡ xuất bản, lưu trữ và xác nhận xóa. Dùng bài thử riêng, không dùng 20 bài hiện có để kiểm tra thao tác xóa.
3. Chọn ảnh từ thư viện Android/iOS; xem trước rồi upload JPEG/PNG/WebP <= 5 MB. Bài mới cần lưu nháp trước khi upload. Upload/thay ảnh rồi hủy hoặc mất mạng phải giữ ảnh đã lưu; chỉ lưu thành công mới áp dụng ảnh mới.
4. Bàn phím, con trỏ/vùng chọn Markdown, modal, safe area và nút Back/gesture quay lại có cảnh báo thay đổi chưa lưu.
5. Chuyển Việt/Anh giữ nguyên từng bản soạn; User thấy thông báo fallback khi chưa có bản dịch.
6. Đổi role trong database: UI kiểm tra lại khi app trở về foreground hoặc trong vòng 30 giây khi active; RLS áp dụng ngay ở mỗi API request. Khi kiểm tra lại bị lỗi mạng, ẩn khu vực quản trị và giữ form đang soạn để retry.
7. Đăng xuất/chuyển tài khoản, mất mạng giữa lúc lưu/upload; User refresh thấy bài mới xuất bản và không thấy draft/archived.
8. Smoke test các màn hình sức khỏe trên thiết bị. Kiểm thử Node của các tính năng đó đã qua; chưa thay thế kiểm thử runtime native.

Nếu đang dùng development build riêng, cần build lại để có native module `expo-crypto` vừa bổ sung và cập nhật nội dung quyền thư viện ảnh. Expo Go SDK 58 đã có module này.
