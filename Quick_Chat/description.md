# Mô tả chức năng của script

Tóm tắt lại là script này tạo một bảng `Quick Chat` nổi trong HaxBall, cho phép bind nhiều phím để gửi nhanh các câu chat đã chuẩn bị sẵn.

Script hỗ trợ nhiều profile khác nhau. Mỗi profile có danh sách bind riêng, nhưng khi chơi chỉ có profile đang được chọn là hoạt động. Vì vậy bạn có thể tạo nhiều bộ câu chat cho nhiều tình huống khác nhau, rồi chuyển profile khi cần.

Tool không thay đổi gameplay hay gửi lệnh đặc biệt vào server. Nó chỉ tự động điền nội dung vào ô chat của HaxBall và gửi bằng phím `Enter`, tương tự như bạn tự gõ chat thủ công.

## Giao diện ban đầu

Khi mới mở HaxBall, tool sẽ hiện dưới dạng một panel nhỏ tên `HAX QUICK CHAT`.

Trong giao diện đầy đủ, panel có các khu vực chính:

- `State`: bật/tắt toàn bộ Quick Chat và bind phím STOP.
- `Profiles`: quản lý các profile chat.
- `Binds`: danh sách các phím chat nhanh của profile hiện tại.
- `Delay (ms)`: thời gian chờ tối thiểu giữa 2 lần gửi chat.
- Dòng thông báo nhỏ ở cuối panel.

<img width="286" height="613" alt="image" src="https://github.com/user-attachments/assets/3e77c713-a7a0-453f-bad2-eed18aff8472" />

## Bật/tắt tool

Khu vực `State` dùng để bật hoặc tắt toàn bộ Quick Chat.

Nút `BẬT` / `TẮT` có chức năng:

- `BẬT`: các bind chat nhanh đang hoạt động.
- `TẮT`: các bind chat nhanh bị chặn, kể cả những tin đang chờ delay cũng sẽ không được gửi tiếp.

Bên phải có badge `STOP`, đây là phím dùng để bật/tắt tool bằng bàn phím. Mặc định khi chưa có dữ liệu trong `localStorage`, phím STOP là `/`.

Cách đổi phím STOP:

- Click vào badge phím bên cạnh chữ `STOP`.
- Bấm phím mới muốn bind.
- Bấm `ESC` để hủy.
- Double-click vào badge để xóa bind.

<img width="287" height="40" alt="image" src="https://github.com/user-attachments/assets/f7422947-66ac-411c-a86e-2fda236a4ccf" />

## Quản lý profile

Khu vực `Profiles` dùng để tạo và chọn các bộ quick chat khác nhau.

Các nút trong phần này:

- `A-Z`: sắp xếp danh sách profile theo alphabet.
- `+`: tạo profile mới.
- `✎`: đổi tên profile đang chọn.
- `✕`: xóa profile đang chọn.

Lưu ý:

- Profile `Default` không được đổi tên.
- Phải còn ít nhất 1 profile, nên không thể xóa profile cuối cùng.
- Click vào tên profile để chọn profile đó.
- Chỉ profile đang chọn mới hoạt động khi bấm phím quick chat.
- Có thể kéo thả profile bằng grip `⠿` ở bên trái để đổi thứ tự.

<img width="283" height="182" alt="image" src="https://github.com/user-attachments/assets/147d4627-4e45-4568-b3ba-3067930a0bee" />

## Danh sách bind chat nhanh

Khu vực `Binds — <tên profile>` là phần quan trọng nhất của tool.

Mỗi dòng bind gồm:

- Grip `⠿`: kéo để sắp xếp lại thứ tự bind.
- Badge phím: phím sẽ dùng để gửi chat.
- Ô nhập nội dung: câu chat sẽ được gửi.
- Nút `✕`: xóa dòng bind đó.

Nút `+ Bind` dùng để thêm một dòng bind mới.

Ví dụ mặc định của profile `Default`:

- `I`: `Chuyền!`
- `J`: `Sút đi!`
- `K`: `Đẹp quá!`
- `U`: `Gì vậy?`
- `O`: `Sao k sút?`
- `L`: `GK lên!`

Khi vào trận, nếu profile `Default` đang được chọn, bấm các phím này sẽ gửi câu chat tương ứng.

<img width="278" height="308" alt="image" src="https://github.com/user-attachments/assets/6d5b0da7-20b0-4562-b87e-ddd04e3ba11f" />

## Delay giữa các lần gửi chat

Phần `Delay (ms)` quy định thời gian chờ tối thiểu giữa 2 lần gửi chat.

Ví dụ:

- `0`: gửi ngay nếu không bị giới hạn spam.
- `500`: cách nhau ít nhất 500ms.
- `1000`: cách nhau ít nhất 1 giây.

Script cũng có cơ chế chống spam nhanh: trong khoảng 3 giây, nếu đã gửi quá nhiều tin gần nhau thì tool sẽ tự bỏ qua để tránh spam quá mức.

<img width="282" height="54" alt="image" src="https://github.com/user-attachments/assets/e5fe3fd4-1c8a-4f2c-85fc-b281c9efa6f4" />

## Chức năng thu nhỏ

Bấm nút `−` trên thanh tiêu đề để thu nhỏ tool.

Khi thu nhỏ, panel sẽ chỉ hiện:

- Tên ngắn `QC`.
- Profile hiện tại.
- Trạng thái tool: `Tool: BẬT (/)` hoặc `Tool: TẮT (/)`.
- Nút `+` để mở lại giao diện đầy đủ.

Trạng thái thu nhỏ vẫn cập nhật khi bạn bấm phím STOP đã bind. Ví dụ nếu đang thu nhỏ và bấm `/`, dòng `Tool: BẬT` sẽ đổi thành `Tool: TẮT`.

<img width="406" height="172" alt="image" src="https://github.com/user-attachments/assets/aae7d16b-6aaa-4f1b-996a-26ce3638fde9" />

## Luồng sử dụng gợi ý

1. Mở HaxBall và vào phòng.
2. Tạo hoặc chọn một profile trong `Profiles`.
3. Bấm `+ Bind` nếu muốn thêm câu chat mới.
4. Click badge phím của dòng bind và bấm phím muốn dùng.
5. Nhập nội dung chat vào ô bên cạnh.
6. Điều chỉnh `Delay (ms)` nếu muốn giới hạn tốc độ gửi.
7. Thu nhỏ panel nếu không muốn che màn hình.
8. Bấm phím đã bind trong game để gửi nhanh câu chat.

## Ghi chú về dữ liệu lưu trữ

Script lưu dữ liệu trong `localStorage`, gồm:

- Danh sách profile và bind.
- Profile đang active.
- Thứ tự profile.
- Delay.
- Trạng thái thu nhỏ/mở rộng.
- Vị trí panel.
- Trạng thái bật/tắt tool.
- Phím STOP.

Nếu muốn reset toàn bộ cấu hình, có thể xóa các key bắt đầu bằng `hax_qc_` trong `localStorage` của trang HaxBall.
