# Explore — 01/11/2026

Đã cập nhật Explore, ArticleCard, BookmarkButton, useArticleFeed, bản dịch Việt/Anh; thêm ExploreControls, articleBookmarkEvents và explore-ui.test.cjs. Không đổi schema, RLS, thuật toán đề xuất hoặc dữ liệu sản xuất.

- Header có menu modal chứa Saved/History/Interests và hai thao tác Admin chỉ khi role được xác minh; không còn dấu cộng thiếu ngữ cảnh.
- Search icon và nút xóa, filter danh mục pill có trạng thái chọn, xóa bộ lọc và refresh thủ công; giữ debounce/race protection cũ.
- Ảnh card 16:9, regular card chuyển sang ngang khi đủ 600 px nội bộ, giới hạn dòng tiêu đề/tóm tắt. Bookmark là sibling của vùng mở bài và chặn propagation, vùng chạm 44 px, trạng thái loading/error; cập nhật các control/feed cùng tài khoản sau xác nhận từ server. Response feed cũ được đối chiếu các thay đổi bookmark phát sinh trong lúc request chạy.
- Khi focus trở lại, revalidate các trang đã tải cùng truy vấn, giữ dữ liệu trong thời gian refresh. Key theo owner/query và generation vẫn chặn response hết hạn. Dedupe theo ID vẫn được giữ.
- Giảm trùng featured/recommended khi có bài thay thế, giữ fallback nếu tất cả gợi ý đều nằm trong featured. Không dùng dữ liệu sức khỏe để đề xuất.
- Skeleton tĩnh và empty states riêng cho danh mục, featured, recommended, tìm kiếm và danh mục không có bài; dùng renderer, ảnh private và quyền đọc cũ.

Kiểm tra: typecheck/lint đạt; npm test 164 test, 162 đạt, hai lỗi auth recovery/sharing từ trước. Bốn test Explore mới và các regression bài viết hiện có đạt. Expo Doctor 19/20, vẫn lệch sáu gói patch như các lượt trước. Web export thành công tại frontend/.expo/explore-web-check.

Chưa kiểm thử tương tác thật trên Android/iOS. Công cụ browser không khởi tạo được (failed to write kernel assets / path not found), nên chưa có xác nhận UI thật trong browser. Sáu chiều rộng 320/375/390/768/1024/1440 được kiểm tra ở mức cấu trúc/props; chưa thay thế screenshot, đo overflow, font scaling, Dark Mode và kiểm tra vị trí cuộn thực tế. Màn hình được giữ mounted thì state/query và các trang tải được giữ; không thêm persistence qua reload/đóng ứng dụng.

Không chạy migration, không ghi dữ liệu sản xuất, không commit/push.
