# Cài đặt Healthy AI

Ứng dụng gọi `gemini-3.5-flash-lite` thông qua Supabase Edge Function `ai-chat`, dùng cấu hình Free Tier và mức suy luận tối thiểu cho phản hồi nhanh. Gemini API key chỉ được đọc ở phía Edge Function; không thêm key vào Expo variables, APK, mã nguồn frontend hoặc GitHub.

## 1. Áp dụng migration

Chạy file `frontend/supabase/migrations/20261030120000_create_ai_chat_conversations.sql` trong Supabase SQL Editor. Migration tạo bảng lịch sử chat với Row Level Security: mỗi tài khoản chỉ đọc, sửa và xóa các cuộc trò chuyện của chính mình.

## 2. Tạo và lưu Gemini key

Trong Google AI Studio, tạo key cho project dùng Gemini API Free Tier. Không liên kết billing nếu muốn giữ ứng dụng ở chế độ miễn phí. Mức quota thay đổi theo project/model; khi gặp HTTP 429, ứng dụng báo hết lượt và không đổi sang model/dịch vụ trả phí.

Trong Supabase Dashboard, vào **Edge Functions → Secrets** và thêm:

| Tên | Giá trị |
| --- | --- |
| `GEMINI_API_KEY` | Key tạo trong AI Studio |

Không gửi key qua chat hoặc thêm key thật vào file `.env`, `app.json`, EAS config hay repository.

## 3. Triển khai Edge Function

Function và cấu hình CLI của project này nằm trong `frontend/supabase`. Chạy lệnh từ thư mục `D:\APP\Nhom15\frontend`:

```powershell
Set-Location D:\APP\Nhom15\frontend
npx supabase login
# Chỉ chạy lệnh link nếu project này chưa được liên kết.
npx supabase link --project-ref <PROJECT_REF>
npx supabase functions deploy ai-chat --use-api
```

Nếu `frontend/supabase/config.toml` chưa có, chạy `npx supabase init` trong `frontend` trước. Giữ cấu hình `verify_jwt` mặc định bật cho function. `--use-api` triển khai mà không cần Docker.

Không tắt xác thực JWT cho function. Ứng dụng gọi function qua `supabase.functions.invoke`, function xác minh phiên người dùng rồi đọc dữ liệu bằng publishable key + JWT người dùng, giữ RLS hoạt động.

## 4. Dữ liệu được gửi tới AI

- Mỗi câu hỏi của tài khoản đã đăng nhập tự động kèm bản tổng hợp tối đa 7 ngày từ `step_records`, `sleep_records`, `meal_records` (nối danh mục món để tính macro) và `water_records`; không còn công tắc bật/tắt trên màn hình.
- Edge Function gửi câu hỏi, bản tổng hợp sức khỏe và tối đa 8 tin nhắn gần nhất trong cuộc trò chuyện tới Google Gemini để tạo câu trả lời.
- Không gửi email, tên, user ID, ghi chú giấc ngủ hoặc ID từng bản ghi trong phần tổng hợp.
- Nội dung câu hỏi và câu trả lời được lưu vào `ai_chat_conversations` để xem lại. RLS giới hạn lịch sử trong tài khoản; có thể xóa từng cuộc trò chuyện trong màn hình AI.

Google Gemini là dịch vụ bên ngoài và nhận câu hỏi cùng dữ liệu sức khỏe tổng hợp ở trên cho mỗi lượt gửi. Trợ lý cung cấp thông tin tham khảo, không chẩn đoán hoặc thay thế chuyên gia y tế.

## 5. Lỗi thường gặp

- `Healthy AI chưa được cấu hình`: kiểm tra `GEMINI_API_KEY` trong Secrets và triển khai `ai-chat`.
- Hết lượt miễn phí / HTTP 429: đợi quota được khôi phục rồi thử lại; ứng dụng không tự retry và không dùng dịch vụ trả phí.
- Gemini phản hồi quá lâu: function dùng model Flash-Lite, mức suy luận tối thiểu, giới hạn lịch sử gần đây và dừng chờ sau 60 giây; ứng dụng báo timeout riêng nếu vẫn chưa có phản hồi.
- Không đọc được dữ liệu sức khỏe: xác nhận migration đã chạy và các bảng sức khỏe có policy `SELECT` cho tài khoản đăng nhập.
- Lịch sử chat không lưu: kiểm tra migration `ai_chat_conversations` và RLS trong Supabase.
