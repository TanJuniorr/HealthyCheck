# HealthyCheck authentication

## Đã triển khai

- AuthProvider là nguồn trạng thái chung: session/user, khởi tạo, đăng nhập, đăng ký, đăng xuất, profile và recovery. Một listener auth, một listener AppState trên native; cleanup khi unmount. Supabase dùng AsyncStorage trên native và localStorage trên web; dữ liệu auth cũ trong SQLite localStorage được chuyển sang AsyncStorage khi đọc. Bật PKCE, dùng cơ chế điều phối refresh mặc định của supabase-js 2.118 (custom lock đã deprecated). Không lưu mật khẩu thủ công, không log credentials.
- Stack.Protected SDK 58 khóa tabs, profile, settings, health, meals, sharing, sleep và article. Khi mất phiên, history của route riêng bị loại bỏ, chuyển Login. Public auth screens chuyển Overview khi có phiên; lúc khôi phục phiên chỉ hiện loading. Welcome mở Sign Up.
- Email/password thật; email trim/lowercase, mật khẩu giữ nguyên; mật khẩu đăng ký/reset tối thiểu 8 ký tự, xác nhận trùng; khóa submission, hiển thị lỗi tiếng Việt. Không tự vào app khi đăng ký cần xác nhận email. Duplicate signup có thể trả thông báo chung theo cấu hình Supabase.
- Google OAuth dùng Supabase PKCE trên web và `expo-web-browser` trên Android/iOS. Callback giữ `flowId` của lần đăng nhập và dùng đúng verifier để đổi code lấy session. Apple và Facebook đã được bỏ khỏi màn hình đăng nhập.
- Profile và lời chào Overview dùng tài khoản hiện tại. Profile đọc hàng của user, fallback metadata/placeholder; avatar HTTPS nếu có, ngày sinh/chiều cao nếu có. Các giá trị riêng trước đây giả lập được để trống trên Profile. Mock health data ở những màn hình khác được giữ nguyên. Logout chỉ hoàn tất sau Supabase signOut thành công.
- Forgot Password gọi resetPasswordForEmail thật, thông báo chung, chặn resend 60 giây trong tiến trình. Callback đổi code bằng PKCE; SDK kiểm chứng verifier và phát PASSWORD_RECOVERY. Chỉ phiên recovery mới mở form reset. Trước updateUser(password) còn kiểm chứng user với server. Cancel hủy phiên recovery qua signOut. Callback được replace khỏi history sau xử lý, không log query.

## Cấu hình Supabase cần xác minh

Không có kết nối quản trị/SQL tới Supabase. Lần đọc schema REST bằng public key hiện tại nhận HTTP 401. Đây không phải bằng chứng schema hoặc RLS hợp lệ. Không có dữ liệu, policy, trigger hay cấu hình production nào bị thay đổi.

1. Kiểm tra frontend/.env thuộc đúng Supabase project; chỉ dùng EXPO_PUBLIC_SUPABASE_URL và EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Không đưa service role/secret vào mobile. .env đã được ngừng theo dõi Git nhưng vẫn giữ trên máy; ignore không xóa lịch sử commit cũ. .env.example để trống.
2. Authentication → URL Configuration → Redirect URLs: thêm `healthycheck://auth/callback` cho development/production build đã cài. Khi chạy trong Expo Go, `expo-linking` tạo URL dạng `exp://<host>:<port>/--/auth/callback`; thêm pattern development `exp://**/--/auth/callback`. Khi chạy web, thêm đúng URL callback của origin đang dùng. Supabase yêu cầu `redirectTo` phải khớp danh sách cho phép; Site URL là URL dự phòng, nên không để Site URL là localhost nếu người dùng đăng nhập trên điện thoại. Chỉ dùng wildcard cho môi trường phát triển, không dùng wildcard rộng trên production.
3. Scheme `healthycheck` đã tồn tại trong app.json. `oauthRedirectUrl()` dùng `Linking.createURL('/auth/callback')`: Expo Go nhận callback qua `exp://.../--/auth/callback`, bản cài dùng scheme `healthycheck`. Google Cloud Authorized redirect URI vẫn phải là callback của Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`), không phải URL `healthycheck://` hay `exp://`. Phải mở email recovery trên cùng thiết bị/cùng dữ liệu ứng dụng hoặc cùng browser origin đã gửi yêu cầu (PKCE verifier). Đổi thiết bị, xóa storage hoặc dùng lại link sẽ thất bại an toàn. Recovery authorization chỉ giữ trong RAM; nếu đóng app sau callback và trước khi đổi mật khẩu, gửi link mới.
4. Google Cloud dùng OAuth Client loại Web application. `frontend/supabase/config.toml` là cấu hình cho Supabase local; hiện không có cấu hình Google trong file đó. App `.env` đang trỏ tới Supabase hosted, nên trạng thái Google thật cần được xác minh ở Dashboard → Authentication → Providers → Google. Nếu chạy Supabase local, phải khai báo provider và secret qua biến môi trường, không commit secret vào repo.
5. Giữ reset email template sử dụng ConfirmationURL của Supabase để callback nhận authorization code. Không thay bằng URL chứa access/refresh token; app không chấp nhận implicit-token callback. Xác minh email confirmation và SMTP/rate limits trong Dashboard. Đăng ký xác nhận email xong có thể quay về Login thủ công; không cần giả lập session.
6. Chạy file auth-schema-inspection.sql (chỉ SELECT) để xác minh columns, khóa ngoại, RLS, policies và trigger auth.users. Kết quả SQL Editor chỉ dùng kiểm tra cấu trúc.

## Đề xuất database — chưa thực thi, phải đối chiếu schema trước

Repo hiện chỉ thiết lập quy ước `profiles.id = auth.users.id` và `user_id` ở các bảng health trong healthData.ts. Không có migration chứng minh schema. Profile repository dùng SELECT * theo id, chỉ đọc trường tùy chọn có kiểu phù hợp; không INSERT/UPSERT các cột đoán. Full name chắc chắn được gửi vào auth metadata; chưa xác minh persistence ở public.profiles.

- Nếu profiles.id đúng là PK/FK auth.users.id và full_name tồn tại: ưu tiên trigger AFTER INSERT trên auth.users chạy function được giới hạn search_path, lấy NEW.id và metadata full_name, INSERT ... ON CONFLICT(id) DO NOTHING. Kiểm tra trigger hiện tại trước, không tạo trigger thứ hai. Không ghi đè profile người dùng đã có. Nếu có cột NOT NULL khác, phải xử lý theo schema thật. Cần migration riêng sau review; không cung cấp DDL đoán cột trong nhiệm vụ này.
- Nếu chưa có trigger hoặc profile row bị thiếu, UI vẫn hoạt động bằng auth metadata. Việc tự tạo/backfill profile bị hoãn cho đến khi biết schema và quyền, không tuyên bố đã tạo row.
- Bật RLS cho profiles và sáu bảng health riêng; policy SELECT/UPDATE/DELETE phải ràng buộc auth.uid() với khóa owner đã xác minh; INSERT/UPDATE phải có WITH CHECK tương ứng. Với profiles, owner dự kiến là id; health dự kiến là user_id. Kiểm tra unique/FK và quyền table/schema/function phù hợp. Không dùng policy cho phép mọi authenticated đọc mọi profile. Policy permissive hiện có có thể OR với policy mới nên phải review toàn bộ.
- foods là catalogue chung: đề xuất read-only cho nhóm cần đọc; không cho client ghi nếu không có nhu cầu đã duyệt.
- healthData.ts đã dùng getUser ở thao tác private, filter owner và gắn owner ở insert. Đây chỉ là kiểm tra phía client; RLS server vẫn bắt buộc. Không sửa tính năng sức khỏe trong task này.

## Kiểm thử chấp nhận trên project test / thiết bị

Các ca dưới đây chưa được xác nhận end-to-end với database thật. Dùng hai tài khoản thử A/B và email nhận được thư, không dùng service role để chứng minh isolation.

| Ca | Thao tác | Kết quả cần xác nhận |
|---|---|---|
| 01 | Đăng ký email mới, đủ tên và password | Auth user + full_name metadata; profile row nếu trigger đã xác minh; vào Overview chỉ khi có session, còn lại yêu cầu xác nhận email |
| 02 | Đăng ký lại email có sẵn | Thông báo phù hợp hoặc generic, không profile trùng hay session trái phép |
| 03 | Login tài khoản đã xác nhận | AuthProvider nhận session, vào Overview; mở Login không quay lại form |
| 04 | Login sai / email chưa xác nhận / offline / rate limit | Lỗi dễ hiểu, vẫn ở public area, không mở route riêng |
| 05 | Đóng/mở lại app và background/foreground | Session được restore/refresh, không nháy nội dung riêng; phiên không hợp lệ về Login |
| 06 | Sign Out rồi Android Back / web Back | Session thực sự bị xóa; không quay lại private screen; offline signout không báo thành công giả |
| 07 | Chưa login, mở deep link tabs, profile, health/steps, meals/add, settings | Chuyển Login, không render dữ liệu riêng; Welcome vẫn mở được |
| 08 | Profile có dữ liệu | Đúng tên/email/avatar/ngày sinh/chiều cao của tài khoản; refresh khi focus |
| 09 | Tài khoản thiếu profile / lỗi mạng | Không crash; metadata/placeholder, loading/error riêng và retry bằng cách mở lại screen |
| 10 | Forgot Password, resend, mở email | Request thật, generic confirmation; cooldown; cùng thiết bị đổi được password sau PKCE; link sai/hết hạn/replay/khác thiết bị không mở form; login thông thường mở reset-password cũng không mở form |
| 11 | Đăng nhập Google trên thiết bị | Google quay về app, PKCE callback đổi code thành session; Apple/Facebook không hiển thị |
| 12 | A đăng nhập, gọi REST bằng JWT A nhưng yêu cầu profile/records B, thử insert/update owner B | Không thấy/sửa/ghi dữ liệu B; kiểm tra SELECT/INSERT/UPDATE/DELETE theo quyền được cấp. Đăng xuất rồi login B không hiển thị identity/profile A |

```powershell
cd frontend
npm install
npx tsc --noEmit
node --test tests/auth.test.cjs
npx expo lint
npx expo-doctor
npx expo start
```

Unit tests chạy source TypeScript với I/O được mock: validation, lỗi không rò thông tin, fallback profile, resend throttling, callback exchange lỗi/thiếu session và chia sẻ request trùng. Chúng không chứng minh email đã gửi, chính sách RLS, native lifecycle hoặc Back navigation hoạt động trên thiết bị. Cần thực hiện bảng kiểm trên.

Tài liệu API đối chiếu: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Protected routes](https://docs.expo.dev/router/advanced/protected/), [Supabase React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native), [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

## Kết quả kiểm tra trong phiên triển khai

- TypeScript: `npx tsc --noEmit` qua.
- Unit tests: 7/7 qua.
- `npx expo-doctor`: 20/20 qua sau khi cài expo-font và react-native-worklets bằng expo install; expo-font config plugin được thêm tự động. `expo install --check` báo dependencies up to date.
- `expo start`: Metro khởi động được. `expo export --platform web`: tạo bundle thành công.
- Kiểm tra browser: Welcome → Sign Up; Login rỗng báo lỗi; social buttons disabled. Deep link /(tabs), /profile, /health/steps, /meals/add đều chuyển Login. /reset-password không có recovery authorization chỉ hiện hướng dẫn, không có form đổi mật khẩu. Chưa kiểm thử login/logout tài khoản thật hoặc native device.
- `expo lint` đã chạy với cấu hình Expo tạm: phần auth không còn lỗi; toàn repo còn 2 lỗi có sẵn ở app/health/steps.tsx:176 (apostrophe JSX) và app/meals/add.tsx:58 (set-state-in-effect), cùng warning unused imports/variable. Đã bỏ cấu hình/dependency lint tự sinh khỏi thay đổi bàn giao vì repo ban đầu chưa có lint và task không yêu cầu thêm framework. Chạy expo lint trên checkout mới có thể yêu cầu cài công cụ trước.
- npm audit online báo 4 high advisories trong cây dependency có sẵn (Expo CLI/zod và node-forge). Chưa chạy audit fix hoặc downgrade SDK ngoài phạm vi task; không dùng kết quả audit offline để kết luận an toàn.
- Không kiểm chứng remote signup, gửi email, profile trigger hay RLS vì endpoint schema trả 401 và không có tài khoản test/Dashboard được kết nối.

## Danh sách tệp

Tạo mới: frontend/src/contexts/AuthContext.tsx; frontend/src/lib/authErrors.ts; frontend/src/lib/authRecovery.ts; frontend/src/lib/profileRepository.ts; frontend/app/auth/callback.tsx; frontend/app/reset-password.tsx; frontend/tests/auth.test.cjs; frontend/.env.example; docs/AUTHENTICATION.md; docs/auth-schema-inspection.sql.

Sửa: frontend/app/_layout.tsx; frontend/app/index.tsx; frontend/app/login.tsx; frontend/app/signup.tsx; frontend/app/forgot-password.tsx; frontend/app/profile.tsx; frontend/app/(tabs)/index.tsx; frontend/src/lib/supabase.ts; frontend/src/components/common/Buttons.tsx (bổ sung TextButton mà Profile đã import nhưng file cũ chưa export); frontend/package.json; frontend/package-lock.json; frontend/app.json; .gitignore. frontend/.env chỉ ngừng theo dõi Git, vẫn giữ bản cục bộ. Không chỉnh backend/ đang có sẵn dưới dạng untracked.


Cập nhật sau nhiệm vụ Data Access Layer: schema tám bảng đã được chủ dự án xác nhận và SELECT LIMIT 0 qua SDK hiện chấp nhận các cột/join. Các nhận xét HTTP 401 ở trên là kết quả lịch sử của phiên Auth trước. Xem DATA_ACCESS.md cho profile service và mức kiểm chứng mới; chưa có kiểm thử authenticated-client RLS/CRUD thật.
