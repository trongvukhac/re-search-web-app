# Thay đổi cơ chế thưởng điểm hoạt động tuần

Hiện tại, hệ thống đang thưởng điểm ngay lập tức khi người dùng đạt đủ 3 ngày hoạt động trong 7 ngày gần nhất. Theo yêu cầu mới, chúng ta sẽ chuyển sang mô hình xét duyệt định kỳ:
- **Thời gian chạy:** 05:00 sáng Thứ Hai hàng tuần.
- **Tiêu chí:** Tính số ngày hoạt động (tick) trong tuần trước đó (từ Thứ Hai đến Chủ Nhật). Nếu >= 3 ngày, người dùng sẽ được thưởng.
- **Mức thưởng & Lý do:** 10 điểm, lý do "Thưởng điểm hoạt động tích cực tuần vừa rồi".

## Đề xuất Thay Đổi

### Thay đổi 1: Xóa bỏ logic cũ trong Backend
- **[MODIFY]** `server.js`
  - Gỡ bỏ đoạn code vừa thêm vào hàm `recordContribution` (logic tính 7 ngày liền kề).

### Thay đổi 2: Xây dựng hệ thống Background Job (Lịch trình ngầm)
- **[MODIFY]** `server.js`
  - Tạo bảng `kv_store` (nếu chưa có) để lưu trữ thời gian chạy cuối cùng của Job, đảm bảo Job không bị chạy trùng lặp nhiều lần hoặc bỏ sót khi máy chủ khởi động lại.
  - Xây dựng một vòng lặp kiểm tra mỗi phút:
    - Lấy thời gian hiện tại (theo múi giờ Việt Nam).
    - Nếu là Thứ 2 và thời gian >= 05:00 sáng, kiểm tra xem Job đã chạy cho tuần này chưa.
    - Nếu chưa chạy:
      - Tìm tất cả các người dùng có >= 3 ngày hoạt động (`activity_date`) nằm trong khoảng từ Thứ 2 đến Chủ Nhật của tuần trước.
      - Thưởng 10 điểm cho mỗi người thỏa mãn điều kiện.
      - Ghi nhận lịch sử vào bảng `kv_store` để đánh dấu Job của tuần này đã hoàn thành.

## User Review Required

> [!WARNING] 
> Nếu máy chủ bị khởi động lại hoặc tạm ngưng đúng vào 05:00 sáng Thứ 2, Job sẽ tự động chạy bù ngay khi máy chủ hoạt động trở lại (ví dụ 05:15 sáng). Bạn có đồng ý với thiết kế an toàn này không?

## Kế hoạch kiểm thử (Verification Plan)
- Giả lập thời gian máy chủ về Thứ 2 và chạy thử Background Job để xác minh việc cộng điểm hàng loạt và tính chính xác của khoảng thời gian 7 ngày tuần trước.
