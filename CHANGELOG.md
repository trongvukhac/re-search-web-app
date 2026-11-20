# Nhật ký phiên bản RE:SEARCH (Changelog)

Tất cả các thay đổi đáng chú ý của dự án **RE:SEARCH — Cộng đồng học thuật** được ghi nhận tại tệp này theo nguyên tắc [Semantic Versioning](https://semver.org/lang/vi/) (`MAJOR.MINOR.PATCH` hay `chính.phụ.vá`).

---

## [4.7.0] - 2026-11-20
### Thay đổi & Nâng cấp (Minor)
- **Đấu trường RE:SEARCH Arena**: Đổi tên toàn bộ hệ thống từ "Thi đua" sang "Đấu trường" (Desktop Nav, Mobile Dock, bộ lọc thông báo, banner, toast, thể lệ và tab quản trị).
- **Hero Banner Arena**: Chuẩn hoá chiều cao 3 thẻ tag (`RE:SEARCH ARENA`, `MÙA AS1`, `TUẦN 01`) đồng nhất 28px trên desktop và 24px trên mobile; đảo thứ tự MÙA đứng trước TUẦN; giảm độ mờ/tối của overlay để làm sáng ảnh bìa.
- **Bảng xếp hạng Tinh thông thần tốc**: Thống nhất icon cúp vàng 🏆 trước điểm số; đơn vị đo trên desktop là "điểm", đơn vị đo trên mobile là icon ngôi sao vàng ★.
- **Tiêu đề Bảng xếp hạng trang chủ**: Căn giữa chính xác với font Georgia, tối ưu dãn cách trên dưới gọn gàng.
- **Hệ thống phiên bản & Chân trang (Footer)**: Tích hợp chân trang toàn hệ thống thể hiện thông tin bản quyền và phiên bản `4.7.0` in nghiêng; cơ chế lưu trữ và hiển thị nhật ký cập nhật cho các phiên bản tiếp theo.

---

## [4.6.1] - 2026-11-20
### Sửa lỗi (Patch)
- Sửa lỗi phân quyền nút quản trị cộng đồng (chỉ hiển thị cho người sáng lập / quản trị viên).
- Ẩn tag cộng đồng trong feed riêng của cộng đồng đó để tránh trùng lặp.
- Khắc phục lỗi cơ chế lọc của chuông thông báo toàn hệ thống.

---

## [4.6.0] - 2026-11-20
### Thay đổi & Nâng cấp (Minor)
- Đưa cụm nút thao tác cộng đồng lên giao diện Mobile.
- Bổ sung hệ thống thông báo sự kiện cộng đồng đa kênh (bài đăng mới, vote mới, phản hồi mới, thông báo số lượng thành viên tham gia).
- Chuẩn hoá đơn vị đo mobile cho toàn bộ các bảng xếp hạng.
- Tối ưu vị trí tag cộng đồng dưới tên tác giả bài đăng.

---

## [4.5.0] - 2026-11-20
### Thay đổi & Nâng cấp (Minor)
- Độc lập hoá khối Thảo luận mới nhất trang chủ khỏi bộ lọc của Diễn đàn chung.
- Hiển thị thông tin chu kỳ thời gian chi tiết theo Tuần / Tháng / Quý cho từng bảng xếp hạng.
- Đơn vị đo điểm hoạt động và giờ tự học cho BXH Đại sứ tri thức và BXH Ong chăm chỉ.
- Mở rộng tỷ lệ hiển thị ảnh bìa mini trong bảng xếp hạng.

---

## [4.4.0] - 2026-11-19
### Thay đổi & Nâng cấp (Minor)
- Bổ sung Thẻ thành tích giữ chuỗi 365 ngày phong cách Faceted Origami đa giác tinh thể.
- Hoàn thiện thẻ thành tích 200 ngày chủ đề Giáng sinh & vũ trụ.
- Chuẩn hoá kích thước logo nhận diện thương hiệu 23px.

---

## [4.3.0] - 2026-11-19
### Thay đổi & Nâng cấp (Minor)
- Hỗ trợ định tuyến chuẩn Deep link `re/:slug` truy cập trực tiếp vào từng cộng đồng học thuật.
- Bảo mật danh tính: Ẩn MSSV của thành viên khác trong danh sách cộng đồng, hiển thị ID chuẩn 5 số.
- Tích hợp tìm kiếm đa năng OmniSearch theo từng cộng đồng riêng biệt.
- Chuẩn hoá hệ thống phông chữ thống nhất 3 font mặc định của RE:SEARCH.

---

## [4.2.0] - 2026-11-19
### Thay đổi & Nâng cấp (Minor)
- Tái cấu trúc Bảng xếp hạng trang chủ với thứ tự ưu tiên mới (3 BXH reset theo chu kỳ lên đầu).
- Bộ đếm thời gian thực realtime đếm ngược đến thời điểm làm mới chu kỳ BXH.
- Chuyển đổi danh xưng top 3 sang chuẩn Hạng 1 / Hạng 2 / Hạng 3.
- Khắc phục triệt để lỗi tương phản nền sáng chữ sáng trong Dark Mode.

---

## [4.1.0] - 2026-11-19
### Thay đổi & Nâng cấp (Minor)
- Hệ thống phân quyền cộng đồng 3 trạng thái: Công khai, Hạn chế, Riêng tư.
- Cơ chế giải tán cộng đồng dành riêng cho Quản trị viên/Người sáng lập (lưu trạng thái 30 ngày trước khi xoá vĩnh viễn).
- Đồng bộ màu sắc avatar và khung viền đại diện cho danh sách thành viên cộng đồng.

---

## [4.0.0] - 2026-11-19
### Thay đổi lớn (Major - Breaking Architecture)
- **Kiến trúc Đa cộng đồng học thuật (`re/`)**: Ra mắt mô hình cộng đồng chuyên sâu theo phong cách Reddit/Subreddit với bảng cơ sở dữ liệu mới (`communities_new`, `community_members`). Thay đổi cấu trúc API bài viết liên kết theo từng cộng đồng.
- **Hub Bảng xếp hạng trang chủ**: Đưa hệ thống vinh danh 5 bảng xếp hạng đa chiều ra trung tâm trang chủ.

---

## [3.0.0] - 2026-11-15
### Thay đổi lớn (Major - Breaking Architecture)
- **Namecard Studio & Hồ sơ cá nhân**: Hệ sinh thái Thẻ tên cá nhân hóa với tỷ lệ chuẩn 680:760, dynamic gradient aura và hệ thống thả tim thẻ tên.
- **Sự kiện Cây thông Noel 3D tương tác**: Migration toàn bộ hệ thống tọa độ vật thể sang không gian cầu 3D (`christmas_tree_ornaments_v2`), hỗ trợ LOD và gắn thiệp lời chúc đa góc nhìn.

---

## [2.0.0] - 2026-10-25
### Thay đổi lớn (Major - Breaking Architecture)
- **Không gian tự học Pomodoro Co-study**: Hệ thống phòng học trực tuyến đồng bộ trạng thái thời gian thực (`study_rooms`, `study_sessions`), bộ đếm đồng hồ cơ học và kho âm thanh thư giãn.
- **Đấu trường RE:SEARCH Arena**: Hệ thống thi đua trắc nghiệm định kỳ hàng tuần với cơ chế chống gian lận, bảng câu hỏi phân tách 2 track `main` và `free` (`competition_questions_v2`).

---

## [1.0.0] - 2026-10-01
### Bản phát hành chính thức đầu tiên (Major)
- Diễn đàn thảo luận học thuật cho lớp Phương pháp Nghiên cứu Khoa học.
- Đăng bài, bình luận, tương tác vote, kho tài liệu môn học (#TL-id).
- Hệ thống điểm danh giữ chuỗi hoạt động hàng ngày (Streak).
- Phân quyền tài khoản Sinh viên, Giảng viên và Quản trị viên.
- Triển khai chính thức trên nền tảng Fly.io.
