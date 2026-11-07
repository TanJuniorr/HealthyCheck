# Hướng dẫn tải và chạy Healthy Check

## 1. Cài công cụ cần thiết

- Cài Git.
- Cài Node.js bản LTS (npm được cài kèm).
- Cài Expo Go trên điện thoại để mở ứng dụng khi phát triển.

## 2. Tải project lần đầu

Mở PowerShell hoặc Terminal tại thư mục muốn lưu project, rồi chạy:

```bash
git clone https://github.com/TanJuniorr/HealthyCheck.git
cd HealthyCheck/HealthyCheck
npm ci
```

Thư mục `HealthyCheck/HealthyCheck` là thư mục ứng dụng, nơi có `package.json`.

## 3. Đặt file `.env`

Đặt file `.env` đã được cung cấp vào thư mục ứng dụng, cùng cấp với `package.json`:

```text
HealthyCheck/
├── .env
├── package.json
└── app.json
```

Nếu `.env` đã nằm đúng chỗ thì bỏ qua bước này. File `.env` không được tải từ Git vì chứa cấu hình riêng và đã được loại khỏi phiên bản commit.

Nội dung file .env
EXPO_PUBLIC_SUPABASE_URL=https://fidfzjalcitearbjtzct.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YQjQ5Biqr46atX0DgW7cnw_1mG0_Hxb


## 4. Chạy ứng dụng

Đảm bảo Terminal đang ở thư mục chứa `package.json`, sau đó chạy:

```bash
npm start
```

- **Android/iOS:** mở Expo Go, quét mã QR hiển thị trong Terminal hoặc trình duyệt.
- **Web:** nhấn `w` trong Terminal đang chạy Expo.
- Điện thoại và máy tính nên kết nối cùng mạng Wi-Fi.

Nếu muốn khởi động lại và xóa cache Metro:

```bash
npx expo start --clear
```

## 5. Cập nhật project đã tải trước đó

Mở Terminal tại thư mục repo Git (thư mục ngoài cùng có thư mục `.git`), rồi chạy:

```bash
git pull
cd HealthyCheck
npm ci
npm start
```

Nếu Terminal đã ở trong thư mục ứng dụng `HealthyCheck/`, chỉ cần chạy:

```bash
git pull
npm ci
npm start
```

## Lưu ý

- `npm ci` cài đúng các package theo `package-lock.json`; chạy lại lệnh này sau khi pull để đồng bộ dependency.
- Một số chức năng dùng camera, cảm biến hoặc thông báo có thể cần **development build** thay vì Expo Go.
- `npm start` chạy ứng dụng qua Expo development server; đây chưa phải file APK cài độc lập.
