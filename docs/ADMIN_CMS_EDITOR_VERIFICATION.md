# Kiểm chứng CMS Editor — 01/11/2026

## Thay đổi

- Mobile dưới 1.000 px: ba bước Thông tin / Nội dung / Xuất bản; lưu từ mọi bước. Thanh hành động là sibling của ScrollView trong KeyboardAvoidingView; Safe Area tiếp tục do AdminLayout hiện có quản lý.
- Desktop: nội dung ở cột chính, thông tin và xuất bản ở sidebar; không đặt chiều rộng cố định cho các cột.
- Tách UI thành ArticleEditorFields, ArticleEditorChrome, ArticleMarkdownEditor và ArticleEditorPreview; tách trạng thái, lưu, upload và autosave vào useArticleEditor; hàm thuần/validation vào articleEditor.
- Markdown: H2/H3, đậm/nghiêng, danh sách thường/đánh số, trích dẫn, link, ảnh tại vùng chọn, undo/redo giới hạn 40 phiên bản và gom lượt gõ 800 ms. Preview dùng ArticleMarkdown chung với trang đọc.
- Giữ riêng bản Việt/Anh; slug mới tự gợi ý nhưng dừng khi sửa thủ công; slug bài cũ và thời gian đọc đã lưu được giữ nguyên. Nguồn và tác giả tuân theo schema hiện có; tác giả gốc chỉ đọc, do server quản lý.
- Chỉ autosave bản ghi draft đã tồn tại, debounce 12 giây. Request được tuần tự hóa; chỉ snapshot gửi đi được đánh dấu đã lưu. Nội dung mới gõ không bị thay bằng response. Xung đột updated_at dừng autosave và yêu cầu xử lý thủ công. Lỗi mạng/validation dừng tự thử lại và giữ dữ liệu để Admin lưu lại.
- Preflight slug trước xuất bản; unique constraint vẫn xử lý tranh chấp. Validation xuất bản nêu lỗi theo trường, ngôn ngữ và bước; bản dịch thứ hai vẫn tùy chọn theo quy tắc cũ.
- Upload dùng nguyên service/bucket private JPEG/PNG/WebP ≤ 5 MB. Thay hoặc bỏ cover chỉ đổi tham chiếu, không tự xóa object cũ.
- Rời trang có tiếp tục sửa / bỏ thay đổi / lưu rồi rời đi. Expo Router SDK 58 usePreventRemove đồng thời bảo vệ reload/đóng tab Web theo khả năng trình duyệt.

Không sửa schema/RLS, không chạy migration, không dùng tài khoản hoặc dữ liệu sản xuất để thử ghi, không thêm dependency dự án và không commit/push.

## Kết quả lệnh

- `npm ci`: thành công. Lần đầu trong sandbox gặp lỗi npm; chạy lại ngoài sandbox thành công, package.json/package-lock.json không thay đổi.
- `npm run typecheck`: đạt.
- `npm run lint`: đạt.
- `npm test`: 156 test, 154 đạt, 2 lỗi ngoài CMS ở `auth.test.cjs` (Web recovery origin) và `sharing.test.cjs` (owner_id trong response). Các test và service auth/sharing này không bị chỉnh sửa; chạy riêng vẫn tái hiện hai lỗi.
- Các test bài viết/CMS (`article-editor`, `articles-admin`, `articles`, `article-covers`): 44/44 đạt. Có thêm 20 regression tests so với trước thay đổi, gồm autosave đang bay/tiếp tục gõ, cập nhật version tiếp theo, xung đột, request sau unmount, slug trùng, upload thất bại và lưu trước khi rời trang.
- PostgreSQL tạm: `npx --yes --package=@electric-sql/pglite -- node scripts/test-article-db.cjs`: 4/4 đạt. Kiểm tra RPC, RLS Admin/User, xuất bản nguyên tử, optimistic locking và ảnh được tham chiếu ở mọi trạng thái. Chỉ chạy migrations vào database trong bộ nhớ cho test.
- `npx expo export --platform all --output-dir .expo/cms-editor-check`: đạt Web và bundle Hermes Android/iOS. Lần đầu sandbox chặn Hermes ghi file tạm; chạy ngoài sandbox thành công.
- `npx --yes expo-doctor`: 19/20 đạt; một check báo lệch bản vá: expo, expo-router, expo-dev-client, expo-sqlite, @expo/metro-runtime, react-native-screens. Giữ nguyên dependency để tránh trộn nâng cấp SDK với CMS.

## Phạm vi kiểm thử và phần chưa xác minh

Node tests sử dụng native controls/navigation/picker giả lập tại biên I/O; các hook, service, validation, bản dịch và event handler là mã thật. Có kiểm tra cấu trúc ba bước, hai cột và vị trí thanh hành động, nhưng đây không phải phép đo layout trên trình duyệt/thiết bị.

Các luồng tạo bài, lưu nháp thiếu dữ liệu, sửa bài cũ, đổi ngôn ngữ, sửa slug, trùng slug, cover, ảnh nội dung, preview, xuất bản/gỡ xuất bản/lưu trữ, autosave và phân quyền đã có test tự động. Trước khi phát hành cần smoke test trên Android, iOS và Web với tài khoản thử riêng:

1. Màn hình 320–390 px, font lớn, Light/Dark và cả Việt/Anh: không tràn chữ, nút và toolbar cuộn ngang dùng được.
2. Bàn phím Android/iOS, Safe Area, caret/vùng chọn, bộ gõ tiếng Việt, undo/redo và trường dài vẫn nhìn thấy được khi nhập.
3. Picker thật, hủy picker, JPEG/PNG/WebP hợp lệ và ảnh quá 5 MB; upload/thay ảnh, lỗi mạng, retry và preview ảnh private.
4. Back/gesture, điều hướng header, đổi route bài viết, reload và đóng tab: kiểm tra cảnh báo, bỏ thay đổi và lưu trước khi đi. Trình duyệt tự quyết định việc hiện hộp thoại khi đóng tab.
5. Hai thiết bị cùng sửa một draft; thiết bị thứ hai phải báo xung đột, không âm thầm ghi đè. Kiểm tra mất mạng thật và tài khoản bị thu hồi quyền khi đang sửa.

Chưa chạy APK/IPA, emulator/simulator hoặc kiểm thử tương tác thực tế trong browser. Export thành công không chứng minh các thao tác native hoạt động hoàn hảo.
