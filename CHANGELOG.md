# Nhật ký phiên bản RE:SEARCH (Changelog)

Tất cả các thay đổi đáng chú ý của dự án **RE:SEARCH — Cộng đồng học thuật** được ghi nhận tại tệp này theo nguyên tắc [Semantic Versioning](https://semver.org/lang/vi/) (`MAJOR.MINOR.PATCH` hay `chính.phụ.vá`).

---

## [5.0.2] - 2026-11-28
### Bản vá v5.0.2: Sửa lỗi Sổ tay khám phá, Phòng tự học, Arena & Giao diện Mobile
- **Phòng tự học (Hình nền & Hệ thống âm thanh)**:
  - Loại bỏ 4 hình nền cũ (`Thư viện Đêm mưa`, `Gác mái Hoa anh đào`, `Đại sảnh Hoàng kim`, `Nhà gỗ Mùa đông`), giữ an toàn mặc định cho tài khoản từng chọn.
  - Sửa lỗi phát & nối lại luồng âm thanh proxy (`/api/audio/`): theo dõi đầy đủ chuyển hướng GitHub/Azure, thử lại khi gặp lỗi HTTP >= 400, khôi phục player lỗi và giữ nguyên vị trí phát hiện tại (`currentTime`) khi bật/tắt từng âm thanh hoặc nút Bật/Tắt tất cả thay vì tua lại từ đầu.
- **Đấu trường Arena**:
  - Sửa lỗi `Áo choàng tiên tri`: trả về chính xác nội dung câu hỏi (`questionText`) và đáp án đã chọn sai (`selectedOption`), phân biệt rõ với trạng thái `"Hết giờ"` và chặn chọn lại phương án sai cũ.
  - Khắc phục giao diện quản lý câu hỏi Arena Admin: hiển thị, giữ bản nháp và lưu đầy đủ 4 đáp án (`A/B/C/D`) cùng gợi ý (`hint`).
  - Áp dụng quy tắc riêng tuần `23/11 – 29/11/2026`: giới hạn Chặng 1 & Chặng 2 còn tối đa 1 lượt thi, tự động xóa lượt 2 và đồng bộ kết quả từ lượt 1; giữ nguyên 2 lượt ở Chặng 3 và các tuần tiếp theo.
  - Chuyển mốc chốt và trao điểm hoạt động cả 3 Chặng sang thời điểm Tổng kết tuần (Chủ Nhật `12:00`), bảo toàn đầy đủ cơ chế làm bù giữa tuần.
- **Bảng xếp hạng Cộng đồng**:
  - Phân tách chu kỳ: chỉ bảng **Tinh thông thần tốc** reset theo **Mùa** (`Mùa AS1`), hai bảng **Đại sứ tri thức** và **Ong chăm chỉ** reset theo **Quý** dương lịch.
- **Giao diện, Điều hướng & Quà tặng Admin**:
  - Cập nhật biểu tượng tab **Sổ tay khám phá** trên thanh điều hướng kính mờ thu gọn (`compact`).
  - Căn chỉnh banner trang chủ trên Mobile chuẩn tỷ lệ `16:9` (`object-fit: cover`), loại bỏ hoàn toàn khoảng đen dư thừa.
  - Bổ sung giao diện trống yêu cầu đăng nhập cho **Tài khoản Khách** tại `#handbook`.
  - Bổ sung công cụ Admin tặng Chìa khoá hoặc Vật phẩm số lượng tùy chọn kèm thông báo **Quà tặng từ RE:SEARCH** với nút nhận quà trực tiếp `Nhận x<số lượng> <Tên vật phẩm>`.

---

## [4.7.14] - 2026-11-24
### Tinh chỉnh thẩm mỹ Bảng xếp hạng, Cụm đếm ngược thông minh, Cố định chiều cao 11 vị trí & Ẩn footer giao diện sâu
- **Tiêu đề Bảng xếp hạng màu trắng sáng nổi bật**:
  - Chuyển màu chữ tiêu đề Bảng xếp hạng sang trắng sáng (`#ffffff`) kèm bóng đổ mờ ảo để hiển thị tương phản sắc nét trên toàn bộ các nền tối và nghệ thuật; bỏ in đậm (`font-weight: 400`) theo phong cách serif thanh thoát.
- **Di chuyển và rút gọn thông minh cụm đếm ngược "Làm mới sau"**:
  - Di chuyển cụm đếm ngược từ chân bảng xếp hạng lên cạnh bên phải nhãn chu kỳ Tuần/Tháng/Quý.
  - Thu gọn tiền tố thành "Làm mới sau ..."; trên điện thoại (Mobile) tự động ẩn tiền tố và chỉ hiển thị giá trị thời gian.
  - Định dạng hiển thị tối đa 2 đơn vị thời gian thông minh: `X ngày Y giờ` (nếu còn ngày); `X giờ Y phút` (nếu còn 0 ngày); và `X phút Y giây` (khi còn 0 ngày 0 giờ).
- **Tăng độ đục nhãn chu kỳ & thời gian trên giao diện sáng**:
  - Tăng độ đục nền cho nhãn chu kỳ (xanh dương) và nhãn làm mới (xanh lá) ở giao diện sáng kèm `backdrop-filter: blur(8px)` giúp chữ đọc rõ nét trên nền ảnh mà vẫn giữ hiệu ứng trong suốt tinh tế.
- **Cố định chiều cao chuẩn 11 vị trí (Fixed Height)**:
  - Cố định chiều cao thống nhất cho khu vực bảng xếp hạng tương ứng với chuẩn 11 vị trí (Top 3 bục vinh danh bên trái, 8 dòng Top 4 - 10 và thứ hạng cá nhân bên phải với chiều cao 468px), loại bỏ hoàn toàn hiện tượng co giật kích thước "lúc ngắn lúc dài" và đảm bảo dòng thứ hạng cá nhân cuối cùng không bị cắt xén.
- **Tối ưu tỷ lệ 2 nửa Desktop & Scale Top 3**:
  - Kéo gọn danh sách Top 10 bên phải một mức vừa phải (`1.22fr` / `0.78fr`) và phóng lớn bục vinh danh Top 3 lên kích thước nổi bật hơn (`--mini-scale: 0.33` cho Hạng 1 và `0.285` cho Hạng 2 & 3).
- **Ẩn Footer toàn trang ở các giao diện sâu**:
  - Tự động ẩn thanh chân trang (`#siteFooter`) khi người dùng đang ở các giao diện tác vụ sâu: xem chi tiết bài đăng, trang trí cây thông Noel, hoặc đọc tài liệu; chỉ hiển thị footer ở các trang ngoài cấp cao.
- **Đồng bộ phiên bản v4.7.14 toàn diện (Version Synchronization)**:
  - Cập nhật số hiệu `4.7.14` đồng nhất trên toàn hệ thống (`package.json`, `server.js`, `app.js`, `index.html`, admin badge và changelog).

---

## [4.7.13] - 2026-11-24
### Nâng cấp giao diện Bảng xếp hạng: Bố cục 2 nửa Desktop, Lật xem Kỳ trước/Kỳ này & Hình nền nghệ thuật
- **Bố cục 2 nửa tối ưu không gian chiều dọc trên máy tính (Desktop Split Layout)**:
  - Chia tách bảng xếp hạng trang chủ trên desktop thành 2 nửa cân xứng: Nửa trái là Bục vinh danh Top 3 (`podium`), Nửa phải là Danh sách Top 4 - 10 cùng dòng thứ hạng cá nhân (`capsule rows`).
  - Tiết kiệm hơn 50% diện tích chiều dọc màn hình máy tính so với thiết kế dàn dọc trước đó.
  - Thiết bị di động (Mobile) được giữ nguyên vẹn 100% bố cục dạng cột ban đầu.
- **Nút chuyển đổi duy nhất xem dữ liệu "Kỳ trước" / "Kỳ này" (Cycle Toggle)**:
  - Bổ sung nút duy nhất (không icon) đặt ngay cạnh chi tiết chu kỳ (ở góc phải hàng chọn Tuần/Tháng/Quý).
  - Bấm "Kỳ trước" để lật xem dữ liệu của tuần trước, tháng trước hoặc quý trước; nút tự động chuyển thành "Kỳ này".
  - Bấm "Kỳ này" để quay về chu kỳ hiện tại một cách tức thời, không tải lại trang.
  - Áp dụng đầy đủ cho cả 3 bảng xếp hạng có cơ chế luân phiên (Đại sứ tri thức, Tinh thông thần tốc, Ong chăm chỉ).
- **Hình nền nghệ thuật theo chủ đề sáng/tối và thiết bị (Artistic Adaptive Backgrounds)**:
  - Tích hợp 4 phiên bản hình nền nghệ thuật riêng biệt cho Desktop Sáng/Tối và Mobile Sáng/Tối.
  - Cơ chế scale hình nền neo ở cạnh dưới (`background-position: center bottom`), nếu dư tỉ lệ sẽ cắt xén ở cạnh trên, không scale trung tâm.
- **Đồng bộ phiên bản v4.7.13 toàn diện (Version Synchronization)**:
  - Cập nhật số hiệu `4.7.13` trên toàn bộ hệ thống (`package.json`, `server.js`, `app.js`, `index.html`, admin badge và changelog).

---

## [4.7.12] - 2026-11-23
### Nâng cấp hiển thị thời gian Bảng xếp hạng Ong chăm chỉ
- **Hiển thị đầy đủ giờ và phút tự học linh hoạt**:
  - Tích hợp số phút thực tế vào điểm số thời gian học tập (ví dụ: `10g 9p tự học` trên máy tính và `10g 9p` trên điện thoại di động).
  - Đối với thời lượng dưới 1 giờ (< 60 phút): tự động rút gọn chỉ hiển thị số phút (ví dụ: `40p tự học` trên máy tính và `40p` trên điện thoại di động, thay vì `0g 40p`).
  - Đối với số giờ chẵn (phút = 0): hiển thị gọn gàng (ví dụ: `1g tự học`, `1g`).
- **Bảo toàn số phút trong dữ liệu API máy chủ**:
  - Cập nhật các endpoint BXH Ong chăm chỉ theo chu kỳ và toàn thời gian trả về đầy đủ `totalMinutes` và `score` theo phút, không làm tròn mất số lẻ.
- **Đồng bộ phiên bản v4.7.12 toàn diện (Version Synchronization)**:
  - Cập nhật số hiệu `4.7.12` trên toàn bộ hệ thống (`package.json`, `server.js`, `app.js`, `index.html`, admin badge và changelog).

---

## [4.7.11] - 2026-11-23
### Chuẩn hoá cơ chế reset Bảng xếp hạng theo chu kỳ
- **Xoá bỏ cơ chế Fallback toàn thời gian khi qua giờ reset**:
  - Loại bỏ hoàn toàn khối truy vấn dự phòng `if (rows.length < 3)` ở cả 3 bảng xếp hạng chu kỳ (Đại sứ tri thức, Tinh thông thần tốc, Ong chăm chỉ).
  - Khi qua mốc reset (00:00 thứ Hai cho Tuần, ngày 01 cho Tháng, đầu Quý cho Quý), điểm số của chu kỳ mới được tính độc lập và chính xác từ 0.
  - Tích hợp tính năng hiển thị thông tin thứ hạng cá nhân (`currentUserEntry`) theo chu kỳ cho mọi sinh viên.
- **Tối ưu hoá tính toán mốc thời gian chu kỳ (Timezone-Independent Thresholds)**:
  - Cập nhật hàm tính toán mốc thời gian bắt đầu chu kỳ theo giờ Việt Nam (UTC+7) chuẩn xác và độc lập với múi giờ của máy chủ (Fly.io UTC hoặc môi trường máy tính cá nhân).
- **Đồng bộ phiên bản v4.7.11 toàn diện (Version Synchronization)**:
  - Cập nhật số hiệu `4.7.11` trên `package.json`, `server.js`, `app.js`, `index.html`, admin badge và changelog.

---

## [4.7.10] - 2026-11-22
### Hoàn thiện & Tối ưu giao diện Xác thực (#login)
- **Tối ưu triệt để hiển thị trên Mobile (Full Mobile Responsiveness)**:
  - Khắc phục lỗi Grid 2 cột trên điện thoại khiến khung kính mờ bị thu hẹp còn 50% bề ngang; chuyển đổi sang Flexbox trải rộng 100% chiều ngang màn hình ôm trọn nội dung.
  - Tối ưu khoảng không gian nền phía trên và thanh điều hướng góc, cuộn chạm tự nhiên và mượt mà.
- **Tái cấu trúc bố cục Đăng nhập / Tạo tài khoản (Top-Tabs & Content Centering)**:
  - Đưa 2 nút chuyển đổi "Đăng nhập / Tạo tài khoản" lên sát mép trên đầu khung kính mờ với khoảng cách tối thiểu, thẩm mỹ cao.
  - Toàn bộ khối nội dung chính (Tiêu đề, các trường nhập liệu, nút thao tác) được bao bọc trong `.auth-form-center-body` và căn giữa tuyệt đối theo trục dọc cho cả trạng thái Đăng nhập lẫn Tạo tài khoản mới.
- **Tinh giản Đăng nhập xã hội (Single Google Sign-In)**:
  - Lược bỏ các nút đăng nhập Microsoft và Apple ID theo yêu cầu; nâng cấp nút Đăng nhập với Google thành viên thuốc trắng thanh lịch toàn chiều rộng.
- **Căn chỉnh nút Điều hướng**:
  - Đẩy nút "Quay lại đăng nhập" tại giao diện Khôi phục mật khẩu lên cao hơn (`top: 10px`), tạo khoảng không gian thanh thoát cho form nhập mã OTP.
- **Đồng bộ phiên bản v4.7.10 toàn diện (Version Synchronization)**:
  - Cập nhật số hiệu `4.7.10` trên toàn bộ hệ thống (`package.json`, `server.js`, `app.js`, `index.html`, admin badge và changelog).

---

## [4.7.6] - 2026-11-21
### Sửa lỗi & Hoàn thiện (Hotfix)
- **Khắc phục triệt để lỗi tái diễn tràn ngang giao diện Mobile (Mobile Horizontal Overflow Lockdown)**:
  - Khắc phục lỗi cú pháp CSS bị sót ngoặc nhọn ngắt quãng khiến khai báo `.page` không nhận diện đầy đủ.
  - Bổ sung `flex-wrap: wrap; gap: 8px;` cho khối nút `.hero-actions`, triệt tiêu dãn cách quá khổ (~500px) gây phình to `.home-hero` trên màn hình điện thoại (390px).
  - Áp dụng triệt để `overflow-x: hidden !important; width: 100% !important; max-width: 100vw !important;` trên `html`, `body`, `main`, `.page`, `.home-hero` và `contain: paint` trên dải đèn Giáng sinh, khoá cứng khung nhìn di động 100% không thể kéo trượt ngang.
- **Căn chỉnh hoàn hảo Avatar và Tiểu sử (Bio) trên Namecard (Namecard Avatar & Bio Vertical Alignment)**:
  - Dời khối avatar (`.namecard-avatar-wrap`) sang phải đúng 10px (`margin-left: 10px;`) theo yêu cầu.
  - Căn lề tiểu sử (`.namecard-bio`) thẳng hàng 100% theo trục dọc với mép trái của avatar (`margin: 14px 0 0 10px; width: calc(100% - 10px); box-sizing: border-box;`), bảo đảm toạ độ X của avatar và bio hoàn toàn trùng khớp (sai lệch 0px).
- **Tự động thu gọn tên trên thanh điều hướng khi không đủ khoảng trống (Responsive Nav Collision Auto-Collapse)**:
  - Nâng cấp thuật toán phát hiện va chạm thanh điều hướng: đo đạc chính xác chiều rộng thực tế của logo `.brand`, thanh liên kết `.desktop-nav` và cụm người dùng `.header-actions`.
  - Khi tên người dùng quá dài hoặc chiều ngang cửa sổ không đủ khoảng hở an toàn (ít nhất 24px), thanh điều hướng tự động thu gọn phần tên người dùng về avatar tối giản (`is-chip-collapsed`) hệt như trạng thái khi cuộn xuống trang, loại bỏ hoàn toàn hiện tượng các nút đè lên nhau.
- **Đồng bộ phiên bản v4.7.6 toàn diện (Version Synchronization)**:
  - Đồng bộ số hiệu `4.7.6` trên `package.json`, máy chủ `server.js`, `app.js`, chân trang `index.html`, huy hiệu quản trị và danh sách chọn phiên bản sửa nhật ký.

---

## [4.7.5] - 2026-11-21
### Sửa lỗi & Hoàn thiện (Hotfix)
- **Hiệu chuẩn triệt tiêu khoảng hở cạnh trên/dưới khung Namecard (Snug Frame Calibration)**:
  - Phân tích pixel alpha thực tế và tính toán lại toàn bộ toạ độ inset cho 5 bộ khung nghệ thuật (`gold`, `phep_mau_mua_dong`, `thung_lung_suong_thu`, `thien_ha_huyen_ao`, `pha_le_hoang_gia`).
  - Khắc phục triệt để hiện tượng khung nghệ thuật bị dãn cách xa hoặc hở viền ở mép trên/dưới, ôm khít 100% đường viền canvas 680×760 với 0 pixel khoảng hở.
- **Ghim cố định thanh Header trên Mobile (Screen-Fixed Mobile Header)**:
  - Chuyển thanh header trên mobile sang `position: fixed !important; top: 0; width: 100%; z-index: 1000;` và thay thế `overflow-x: hidden` trên `html/body/main` thành `overflow-x: clip;` để không phá vỡ cơ chế cuộn.
  - Cụm điều hướng phía trên (logo, avatar, thông báo, tìm kiếm, menu) luôn ghim cố định theo màn hình khi người dùng cuộn xuống trang.
- **Khắc phục thanh điều hướng bài viết (Post Detail Action Bar)**:
  - Khôi phục container `#postDetail .post-detail-top-nav-slot` dạng khối riêng biệt (`min-height: 48px; margin-bottom: 18px;`), tách rời rõ ràng khỏi thẻ tiêu đề bài viết thay vì dính chặt đè lên tiêu đề.
  - Neo thanh công cụ (Quay lại, chép link, lưu bài viết) cố định mượt mà khi cuộn trang cả trên mobile (`position: sticky`) lẫn desktop (docked floating glass header), không bao giờ bị biến mất khi lướt đọc bài viết.
- **Khôi phục bố cục Avatar & Bio trên Namecard (Namecard Layout Restoration)**:
  - Khôi phục `padding: 0;` cho `.namecard-bio` và đưa `.namecard-body` về khoảng cách lề chuẩn `padding: 0 28px 90px;` đồng bộ với `.namecard-header`.
  - Giữ khoảng cách an toàn rộng rãi giúp avatar và tiểu sử không bị co cụm hay che khuất bởi các chi tiết trang trí của khung viền.
- **Ngăn chặn triệt để chồng chéo trên thanh điều hướng Desktop (Nav Overlap Prevention)**:
  - Tối ưu thuật toán đo đạc kích thước và phát hiện va chạm: tự động thu gọn chip tài khoản người dùng về avatar tối giản (`is-chip-collapsed`) khi tên hiển thị quá dài hoặc chiều ngang màn hình không đủ khoảng hở an toàn.

---

## [4.7.4] - 2026-11-21
### Sửa lỗi & Hoàn thiện (Hotfix)
- **Đồng nhất số phiên bản toàn diện (Version Number Synchronization)**:
  - Đồng bộ hoá triệt để toàn bộ hệ thống về phiên bản `4.7.4` trên `package.json`, máy chủ `server.js` (header `X-App-Version`), client `app.js` (`window.APP_VERSION`), chân trang `index.html` và nhật ký phiên bản.
  - Khắc phục lỗi hiển thị cứng `v4.7.1` tại thanh thông báo popup cập nhật phiên bản: chuyển sang hiển thị động chính xác phiên bản đích đang triển khai (`v${targetVersion}`).
  - Khắc phục lỗi hiển thị cứng `v4.7.0` tại trang Quản trị (Admin Settings) và bổ sung bộ chọn phiên bản (`<select id="adminChangelogVersionSelect">`), cho phép Quản trị viên linh hoạt chọn xem và chỉnh sửa nhật ký của bất kỳ phiên bản nào (`v4.7.4`, `v4.7.3`, `v4.7.2`, `v4.7.1`, `v4.7.0`).
- **Hiệu chuẩn kích thước khung Namecard chuẩn xác (Precision Frame Scaling)**:
  - Khắc phục triệt để hiện tượng khung nghệ thuật bị phóng to đột biến hoặc lơ lửng ngoài mép thẻ do toạ độ inset âm quá đà.
  - Tái hiệu chuẩn bộ thông số inset cân bằng chuẩn (`-44px` đến `-54px`) ôm khít vừa vặn viền bo cong 60px của Namecard Canvas (680×760) cũng như Namecard mini cho cả 5 khung: *Kỷ nguyên hoàng kim* (`gold`), *Phép màu mùa đông* (`phep_mau_mua_dong`), *Thung lũng sương thu* (`thung_lung_suong_thu`), *Thiên hà huyền ảo* (`thien_ha_huyen_ao`) và *Pha lê hoàng gia* (`pha_le_hoang_gia`).

---

## [4.7.3] - 2026-11-21
### Sửa lỗi & Hoàn thiện (Hotfix)
- **Khắc phục triệt để lỗi tràn ngang trên Mobile**: Chuẩn hoá thuộc tính `overflow-x: hidden`, `width: 100%`, `max-width: 100vw` và `min-width: 0` trên các phần tử gốc `html`, `body`, `main`, `#home`, `.page` và dải trang trí lễ hội, triệt tiêu hoàn toàn thanh cuộn ngang trên điện thoại di động (chiều rộng cố định chuẩn 390px).
- **Cố định chân trang (Footer) sát đáy trên Mobile**: Loại bỏ khoảng hở chết (dead space 170px) bên dưới footer trên thiết bị di động bằng cách chuyển `padding-bottom: 0` cho `body` và neo chân trang trực tiếp chạm đáy màn hình với khoảng đệm nội bộ an toàn trên dock điều hướng.
- **Hiệu chuẩn kích thước khung Namecard (Snug Fit Scaling)**: Đo đạc và hiệu chuẩn lại toạ độ inset cho 5 bộ khung nghệ thuật (`gold`, `thung_lung_suong_thu`, `thien_ha_huyen_ao`, `pha_le_hoang_gia`, `phep_mau_mua_dong`) ôm khít chính xác vào viền bo tròn 60px của Namecard Canvas (680x760), khắc phục triệt để hiện tượng khung bị lệch, che lấp chữ hoặc lơ lửng ngoài mép thẻ.
- **Tối ưu thanh điều hướng Mobile (Header Controls)**: Đưa 2 nút Tìm kiếm đa năng (⌘K) và Chuông thông báo ra ngoài thanh header trên mobile, bố trí trực quan nằm ngay bên trái avatar người dùng, đồng thời loại bỏ các mục trùng lặp trong menu thao tác nhanh.
- **Chống va chạm thanh điều hướng Desktop**: Hoàn thiện thuật toán nhận diện kích thước và neo vị trí dock, tự động thu gọn tên người dùng khi chiều ngang hẹp hoặc tên hiển thị dài, đảm bảo không bao giờ xảy ra va chạm hay đè chữ giữa các tab điều hướng và chip tài khoản.

---

## [4.7.2] - 2026-11-21
### Sửa lỗi & Hoàn thiện (Patch)
- **Hệ thống khung và ảnh bìa Namecard theo chuỗi**:
  - Bổ sung 3 theme mới: *Thung lũng sương thu* (chuỗi 100 ngày), *Thiên hà huyền ảo* (chuỗi 200 ngày), *Pha lê hoàng gia* (chuỗi 365 ngày).
  - Cập nhật, thay thế khung nghệ thuật chất lượng cao cho *Kỷ nguyên hoàng kim* (`gold`) và *Phép màu mùa đông* (`phep_mau_mua_dong`).
  - Đồng bộ tỷ lệ hiển thị chuẩn xác trên sân khấu Namecard gốc (680x760), thẻ Namecard mini và xem trước trong Namecard Studio.
- **Thanh điều hướng Desktop (Navigation Bar Collision Detection)**:
  - Tự động nhận diện trường hợp tên hiển thị người dùng quá dài dẫn đến nguy cơ va chạm hoặc thiếu khoảng hở với thanh điều hướng chính.
  - Thu gọn tên người dùng (`is-chip-collapsed`) về trạng thái avatar tròn tối giản mượt mà tương tự như khi cuộn trang, giữ trọn vẹn bố cục cân đối và không bị chồng lấn.
- **Cố định chân trang (Sticky Page Footer)**:
  - Tối ưu cấu trúc `flex-direction: column` và `min-height: 100vh` cho khung trang toàn hệ thống, đảm bảo chân trang luôn neo cố định tại đáy màn hình trên mọi trang, kể cả khi nội dung ngắn.
- **Thử thách học tập**: Cập nhật tiêu đề biểu ngữ trong modal chi tiết chuỗi thành *"Thử thách học tập bền bỉ cùng &ldquo;RE:SEARCH&rdquo;"*.

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
