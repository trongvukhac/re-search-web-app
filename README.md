# RE:SEARCH

Web app cộng đồng học thuật cho môn Phương pháp nghiên cứu khoa học.

## Chạy cục bộ

Yêu cầu Node.js 24 trở lên (dùng SQLite tích hợp sẵn, không có thư viện bên thứ ba).

```bash
RESEARCH_INITIAL_ADMIN_EMAIL="ta@truong.edu.vn" \
RESEARCH_INITIAL_ADMIN_PASSWORD="mat-khau-toi-thieu-12-ky-tu" \
RESEARCH_INITIAL_ADMIN_NAME="Tên Trợ giảng" \
npm start
```

Mở `http://127.0.0.1:3000`. Lần khởi động đầu tiên, các biến môi trường trên tạo tài khoản TA/Admin duy nhất. Không đặt các biến này trong mã nguồn hoặc commit mật khẩu.

Tài khoản tự đăng ký qua giao diện mặc định là Sinh viên. Dữ liệu chạy cục bộ nằm trong `data/research.db` và đã được loại khỏi Git.

## Nền tảng đã có

- Mật khẩu băm bằng `scrypt`, cookie phiên `HttpOnly`, CSRF token cho thao tác ghi dữ liệu.
- Đăng ký, đăng nhập, đăng xuất và phân quyền Sinh viên / Giảng viên / TA Admin.
- Bài viết ẩn danh với cộng đồng; TA/Admin vẫn xem được chủ tài khoản.
- Bài viết, phản hồi, lượt Hữu ích, tài liệu, sổ cái Điểm đóng góp, chuỗi hoạt động và audit log trong SQLite.
- API giới hạn tần suất ở các luồng nhạy cảm và không cho tự đánh dấu nội dung của mình là Hữu ích.

## Kiểm tra

```bash
npm run check
```

Đây là máy chủ cục bộ cho giai đoạn phát triển. Trước khi triển khai công khai cần bổ sung HTTPS, email xác thực/đặt lại mật khẩu, giới hạn tần suất ở tầng hạ tầng, sao lưu cơ sở dữ liệu và quy trình quản lý tài khoản Admin.
