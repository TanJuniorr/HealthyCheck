# Dữ liệu giám sát hệ thống

Màn hình quản trị lấy trạng thái dịch vụ trực tiếp từ Edge Function `system-monitor`.
Yêu cầu POST đến `ai-chat` và `food-scan` được đo ở server; GET kiểm tra trạng thái
và OPTIONS không được tính. Lỗi JavaScript được ghi qua ErrorUtils trên native,
và sự kiện `error` / `unhandledrejection` trên web khi có phiên đăng nhập.

## Dữ liệu mẫu

Sau khi áp dụng migration `monitor_demo_data`, chạy
`supabase/seeds/monitor-demo.sql` bằng tài khoản quản trị database. Script tạo:

- 240 yêu cầu AI Chat, 120 yêu cầu quét món ăn trong 24 giờ gần nhất.
- 80% thành công, 10% HTTP 429, 10% HTTP 500, với thời gian xử lý khác nhau.
- 30 lỗi JavaScript thuộc 5 nhóm, trên Android/iOS/web, gồm lỗi thường và nghiêm trọng.

Mọi bản ghi đều có `is_demo = true`. Script dùng ID cố định nên chạy lại sẽ
cập nhật thời điểm của chính các bản ghi mẫu, không nhân đôi và không sửa nhật ký thật.
Lỗi mẫu gắn với admin hiện có; script không tạo tài khoản và không gọi AI.
Không tự chạy seed này khi migration hay khi mở màn hình.

Màn hình hiển thị chung toàn bộ dữ liệu, không có công tắc hoặc nhãn phân biệt mẫu/thật.
`is_demo` chỉ là metadata nội bộ để script chạy lại an toàn, không sửa nhật ký ngoài seed.
Thống kê dùng cửa sổ 24 giờ; nhật ký liệt kê tối đa 50 mục mới nhất.
Dữ liệu mẫu sẽ ra khỏi thống kê sau 24 giờ; chạy lại script nếu cần trình diễn lại.
API thống kê cũ `app_monitor_request_stats` cũng bao gồm toàn bộ dữ liệu.

Chỉ database owner/service role có thể ghi dữ liệu mẫu. Người dùng đăng nhập chỉ
ghi được lỗi thật của chính mình, admin mới đọc được nhật ký. Không lưu thông điệp
lỗi, stack trace, nội dung chat, ảnh hay dữ liệu sức khỏe.

## Kiểm tra

```powershell
npm run typecheck
node --test tests/systemMonitor.test.cjs tests/systemMonitoringUi.test.cjs
node --test scripts/test-system-monitor-db.cjs
```

Khi triển khai, áp dụng migration trước, triển khai lại `system-monitor`, rồi chạy seed.
