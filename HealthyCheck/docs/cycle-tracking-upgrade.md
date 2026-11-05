# Nâng cấp theo dõi chu kỳ – HealthyCheck

## Chức năng hoàn thành

- Ghi nhận nhiều kỳ kinh thật với ngày bắt đầu, ngày kết thúc tùy chọn và ghi chú; tạo/sửa/mở lại/xóa có xác nhận. Kỳ đang mở chỉ kết thúc khi người dùng xác nhận.
- Database chặn ngày tương lai, thứ tự ngày sai, trùng ngày bắt đầu, khoảng chồng lấn và nhiều kỳ đang mở. UUID của biểu mẫu được giữ khi thử lại; cập nhật/xóa có kiểm tra phiên bản `updated_at`.
- Không tạo kỳ kinh từ dự đoán, lượng kinh hay spotting. Nhật ký lượng kinh/tâm trạng/triệu chứng tồn tại độc lập và được giữ khi chỉnh sửa/xóa kỳ kinh.
- Lịch tháng có điều hướng, chọn ngày, Hôm nay, dấu bắt đầu `▶`, ngày thực tế `●`, dự kiến `~` với viền đứt và nhật ký `•`; có nhãn trợ năng, không phụ thuộc riêng vào màu sắc.
- Nhật ký dùng nút Lưu; có thể bỏ chọn tâm trạng/triệu chứng; chống nhấn lưu liên tục; giữ bản nháp sau lỗi. NULL lượng kinh là chưa ghi nhận, khác với giá trị `none` được chọn rõ ràng. Không cho lưu ngày tương lai.
- Lịch sử được phân trang 10 kỳ; lấy thêm một hàng để hiển thị khoảng cách của kỳ cuối trang với kỳ trước.
- Cài đặt thu gọn; thống kê tính từ lịch sử là chỉ đọc, tách khỏi giá trị thủ công dự phòng. Tiếng Việt/Anh và design system sáng/tối được giữ.

## Nguồn dữ liệu và dự đoán

`menstrual_cycle_periods` chứa duy nhất các kỳ được xác nhận. Khi có lịch sử, ngày bắt đầu thực tế mới nhất luôn là mốc chính. `menstrual_cycle_settings.last_period_start` được giữ nguyên như mốc thủ công dự phòng; không được chuyển thành kỳ kinh giả, không được dùng để ghi đè lịch sử và không cho chỉnh mốc này trong UI khi đã có lịch sử. Nếu xóa toàn bộ lịch sử, mốc thủ công cũ có thể được dùng lại và được ghi rõ là ước tính thủ công.

Dự đoán lấy trung vị tối đa 6 khoảng bắt đầu–bắt đầu gần nhất; loại trùng ID/ngày nhưng không loại ngoại lệ theo độ dài. Một kỳ dùng độ dài thủ công (mặc định 28 nếu chưa đặt); hai kỳ là ước tính sơ bộ; ít nhất 3 khoảng ổn định mới được gắn độ tin cậy vừa phải. Thời lượng hành kinh dùng trung vị các kỳ đã kết thúc; không giả ngày kết thúc của kỳ đang mở.

Các hằng số trong `CYCLE_POLICY` là heuristic phục vụ theo dõi/demo, không phải bộ tiêu chuẩn chẩn đoán: chênh lệch khoảng >9 ngày hoặc khoảng ngoài 15–90 ngày làm giảm độ tin cậy và ngừng đặt nhắc tự động. Các khoảng thực tế vẫn hiển thị đầy đủ. Đây không phải mô hình dự đoán đã được kiểm định lâm sàng. Bối cảnh tham khảo: [ACOG – Abnormal Uterine Bleeding](https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding), [ACOG – Heavy Menstrual Bleeding](https://www.acog.org/womens-health/faqs/heavy-menstrual-bleeding).

Không modulo, không tự nhảy chu kỳ, không đánh dấu dự đoán đã qua thành kỳ đã xảy ra. Dự đoán quá hạn giữ nguyên mốc và hiển thị số ngày đã qua. Không hiển thị ngày rụng trứng chắc chắn; giao diện nêu rõ không dùng dự đoán cho tránh thai.

`getMyMenstrualCycleOverview()` và `getCyclePrediction()` được dùng chung bởi màn hình Cycle, Dashboard và danh sách dữ liệu sức khỏe. Sự kiện theo tài khoản làm các query đang focus cập nhật ngay; kết quả muộn bị loại sau đổi tài khoản. Nhật ký chỉ làm mới các query phụ thuộc nhật ký, không tải lại dự đoán không cần thiết.

## Migration và thao tác thủ công

Tệp mới: `supabase/migrations/20261105081604_add_confirmed_menstrual_periods.sql` (được tạo bằng Supabase CLI).

- Thêm bảng lịch sử, chỉ mục, exclusion constraint `btree_gist`, RLS theo `auth.uid()` và trigger cập nhật thời gian/giữ định danh chủ sở hữu.
- Cột `recorded_timezone` dùng múi giờ IANA của thiết bị để kiểm tra ngày địa phương tại database.
- Cho phép `menstrual_cycle_logs.flow_status` là NULL, bỏ default nhưng không sửa giá trị ở các hàng cũ.
- Không xóa/ghi đè/backfill bảng settings hoặc logs; không tạo kỳ giả từ mốc cũ.

**Đã áp dụng migration lên Supabase HealthyCheck (`fidfzjalcitearbjtzct`) ngày 05/11/2026 theo yêu cầu tiếp theo của người dùng.** Phiên bản từ xa `20261105081604`; tên file trong workspace được đồng bộ với phiên bản này. Đã xác minh bảng mới, RLS, quyền authenticated/anon, ràng buộc ngày/chồng lấn và chỉ mục một kỳ mở. Số hàng và fingerprint nội dung của settings/logs giống trước migration (0 settings, 1 nhật ký); bảng kỳ kinh mới rỗng, không tạo dữ liệu giả. Không reset database hoặc áp dụng lại migration cũ. Chưa deploy app, commit hoặc push. Chỉ cần tải lại ứng dụng. Tài khoản demo cần có giới tính nữ theo điều kiện hiển thị hiện có của HealthyCheck.

## Nhắc nhở và giới hạn

Chỉ đặt một thông báo cục bộ lúc 09:00 theo múi giờ thiết bị, trước ngày dự kiến theo số ngày đã cấu hình. Khi kỳ kinh/cài đặt đổi, hủy nhắc cũ rồi tính lại; khi tắt thông báo, mất quyền, mở kỳ kinh mới, đổi tài khoản, thiếu mốc, lịch không đều hoặc giờ nhắc đã qua thì không giữ lịch cũ/suy diễn sang kỳ xa hơn. Hàng đợi và chữ ký lịch ngăn trùng.

Web báo không hỗ trợ nhắc cục bộ. Không có push server định kỳ: người dùng cần mở ứng dụng để cập nhật thông báo sau thay đổi và cho chu kỳ tiếp theo. Chưa kiểm thử trên điện thoại Android/iOS vật lý trong phiên này; kiểm thử dùng mock native API và bản export Hermes của cả hai nền tảng.

## File tạo mới

- `supabase/migrations/20261105081604_add_confirmed_menstrual_periods.sql`
- `src/lib/menstrualCycleEvents.ts`
- `src/components/cycle/CycleMonthCalendar.tsx`
- `src/components/cycle/CycleDateField.tsx`
- `src/components/cycle/CyclePeriodEditor.tsx`
- `src/components/cycle/CycleDailyLog.tsx`
- `src/components/cycle/CycleSettings.tsx`
- `src/components/cycle/cycleStyles.ts`
- `tests/menstrualCycle.test.cjs`
- `tests/menstrualCycleService.test.cjs`
- `tests/menstrualCycleNotifications.test.cjs`
- `tests/menstrualCycleUi.test.cjs`
- `scripts/test-menstrual-cycle-db.cjs`
- `docs/cycle-tracking-upgrade.md`

## File chỉnh sửa trong tác vụ này

- `app/health/cycle.tsx`
- `app/(tabs)/index.tsx`
- `app/health/index.tsx`
- `src/lib/menstrualCycleCalculations.ts`
- `src/services/menstrualCycleService.ts`
- `src/services/menstrualCycleNotifications.ts`
- `src/contexts/NotificationInboxContext.tsx`
- `src/hooks/useHealthQuery.ts`
- `src/types/database.ts`
- `src/i18n/resources/vi.json`, `src/i18n/resources/en.json`
- `package.json` (đưa test database mới vào `test:db`)

Các thay đổi gỡ Nhịp tim/Double Support đã có từ yêu cầu trước được giữ lại, không phải phần viết lại chức năng chu kỳ.

## Kiểm thử

Trước thay đổi: 279 test ứng dụng và 8 test database qua.

Kết quả cuối:

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Qua, không có lỗi TypeScript |
| `npm run lint` | Qua, không có lỗi/cảnh báo lint |
| `npm test` | 294/294 test qua |
| `npm run test:db` | 9/9 test PostgreSQL/PGlite qua |
| Expo export Web + Android + iOS | Qua; gồm bytecode Hermes Android và iOS |
| `git diff --check` | Qua |

Các test mới bao gồm: CRUD, thử lại với cùng UUID, stale version, trùng/chồng lấn/kỳ mở, giữ dữ liệu cũ và nhật ký, RLS chủ sở hữu, thiếu lịch sử/thủ công/trung vị/chu kỳ không đều, sớm/trễ không modulo, sửa/xóa kỳ mới nhất, 29/02/đổi năm/múi giờ Việt Nam, lịch thực tế khác dự đoán, Dashboard–Cycle đồng bộ, sự kiện invalidation, đổi tài khoản và bỏ phản hồi cũ, form giữ dữ liệu sau lỗi, nút lưu chống nhấn trùng, nhắc Android/iOS không trùng và giới hạn Web.

Lượt export đầu gặp lỗi quyền ghi file tạm của Hermes trong sandbox Windows. Chạy lại với `TEMP`/`TMP` là thư mục tạm trong workspace và `--max-workers 2` đã export thành công cả ba nền tảng; không cần sửa dependency hoặc source để xử lý lỗi môi trường này.

Kiểm tra bố cục bằng React Native Web với fixture tách riêng khỏi runtime ứng dụng: 320 px tiếng Việt nền sáng và 390 px tiếng Anh nền tối; không có phần tử tràn ngang. Fixture không dùng hoặc tạo dữ liệu tài khoản thật, không thay thế kiểm thử trên thiết bị.

## Kịch bản demo đầu–cuối

1. Migration mới đã được áp dụng; đăng nhập tài khoản nữ, mở Theo dõi chu kỳ. Tài khoản mới phải hiển thị chưa có lịch sử/chưa đủ dữ liệu.
2. Mở Cài đặt; lưu chu kỳ thủ công 28 ngày, hành kinh dự kiến 5 ngày, nhắc trước 2 ngày. Có thể bật thông báo trên điện thoại và cấp quyền hệ điều hành.
3. Bấm Bắt đầu kỳ kinh, chọn ngày quá khứ, xác nhận Lưu. Kiểm tra trạng thái đang diễn ra; ứng dụng không tự điền ngày kết thúc.
4. Bấm Kết thúc kỳ kinh, chọn ngày kết thúc thật, xác nhận. Kỳ đó xuất hiện trong lịch sử với thời lượng thực tế.
5. Ví dụ tại ngày 05/11/2026: lần lượt ghi các kỳ 01–05/08, 29/08–02/09, 27/09–01/10, 26–30/10/2026. Các khoảng bắt đầu là 28, 29, 29; dự kiến kỳ tiếp theo là 24/11/2026 và độ dài ước tính 29 ngày. Dashboard và Cycle phải khớp. Nhắc 2 ngày trước dự kiến là 22/11 lúc 09:00 nếu có quyền và thời điểm này chưa qua.
6. Chuyển tháng, xem dấu ngày thực tế khác dấu dự kiến, chọn một ngày để ghi lượng kinh/tâm trạng/triệu chứng. Bỏ chọn tâm trạng; lưu. Nhập spotting không tạo kỳ mới.
7. Sửa một ngày bắt đầu, mở lại kỳ hoặc xóa sau xác nhận; kiểm tra lịch sử, dự đoán, Dashboard và lịch nhắc cùng đổi. Nhật ký ngày vẫn còn.
8. Ghi một kỳ bắt đầu hôm nay; xác nhận trạng thái đang diễn ra và nhắc cũ bị hủy. Chỉ bấm Kết thúc khi muốn xác nhận kết thúc.
9. Thử lưu ngày kết thúc trước ngày bắt đầu/khoảng chồng lấn; UI báo lỗi và giữ nội dung nhập. Thử mất mạng rồi lưu nhật ký; kết nối lại và thử lại, không phải nhập lại.
10. Đổi Việt/Anh, sáng/tối và tài khoản; không còn dữ liệu tài khoản trước. Web phải báo giới hạn nhắc, không báo đã đặt nhắc thành công.

## Kiểm tra Supabase sau áp dụng

Không phát sinh cảnh báo bảo mật mới do migration. Các cảnh báo có từ trước về quyền gọi `handle_new_user()` và tính năng kiểm tra mật khẩu rò rỉ không thuộc phạm vi tác vụ này, nên được giữ nguyên. Hướng dẫn Supabase: [quyền gọi hàm](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [kiểm tra mật khẩu](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
