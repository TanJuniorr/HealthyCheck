# Admin Dashboard — 01/11/2026

Đã cập nhật `frontend/app/admin/index.tsx`, thêm `AdminDashboardParts.tsx`, cập nhật `useArticleFeed.ts`, bản dịch Việt/Anh và `tests/admin-dashboard.test.cjs`. Giữ nguyên CMS Editor, phân quyền, schema, RLS và dependencies.

- Card mobile tách thông tin/thumbnail khỏi hàng thao tác; tiêu đề tối đa ba dòng, flex/minWidth không để nút ép tiêu đề. Table chỉ xuất hiện khi container đạt 1.100 px; cột tiêu đề chiếm tỷ lệ lớn nhất.
- Thống kê dùng RPC cũ, lưới hai hoặc bốn cột. Chưa tải xong hiển thị dấu chờ, có loading/error/retry riêng.
- Tìm kiếm có icon, xóa từ khóa và debounce 300 ms qua hook cũ. Filter cuộn ngang giữ từ khóa. Pagination có load-more chủ động, giới hạn 12 bài/request và dedupe theo ID; bỏ tự tải khi chạm cuối để tránh vòng lặp request.
- Menu modal cuộn được, xác nhận kèm tên bài, khóa double-submit; chỉ refresh thống kê/danh sách sau backend thành công. Draft có xuất bản/lưu trữ; published có gỡ xuất bản/lưu trữ; archived có khôi phục nháp. Giữ chức năng xóa được bảo vệ bằng xác nhận và optimistic locking.
- Preview dùng trang đọc hiện có hỗ trợ Admin xem draft/archived; edit đi theo ID. Hook refresh khi màn hình lấy lại focus, giữ dữ liệu cùng truy vấn trong lúc refresh; đổi tài khoản/truy vấn vẫn che dữ liệu cũ và loại response hết hiệu lực.

Kiểm tra:

- TypeScript và lint: đạt.
- `npm test`: 160 test, 158 đạt; hai lỗi auth Web recovery/sharing owner_id đã có từ lượt trước vẫn tái hiện, không thuộc các module được sửa.
- Bốn test dashboard mới đạt: cấu trúc card/table ở 320, 375, 390, 768, 1024, 1440; thống kê; search/filter/navigation; xác nhận mutation, refresh, lỗi và double-submit. Tests feed hiện có tiếp tục kiểm tra debounce, race, pagination/dedupe và identity isolation; tests guard tiếp tục kiểm tra non-admin.
- Expo Doctor: 19/20, vẫn lệch sáu dependency patch như báo cáo CMS Editor.

Chưa kiểm thử layout thực trong browser hay Android/iOS. Các chiều rộng trên là kiểm tra cấu trúc/props, không phải screenshot hoặc phép đo overflow thực tế. Cần smoke test font scaling, Dark Mode, Safe Area, vị trí cuộn khi quay lại, thao tác menu và mạng thực trước phát hành. Không thử ghi dữ liệu sản xuất, không chạy migration, không commit/push.
