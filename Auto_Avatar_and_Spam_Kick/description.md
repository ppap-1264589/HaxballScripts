# Mô tả chức năng của script

Tóm lại script này có ba chức năng:

- Cho avatar thay đổi theo hướng mũi tên mình di chuyển

- Cho avatar thay đổi liên tục theo một quy luật

- Spam macro kick

## Giao diện ban đầu

Khi mới vào game, tool sẽ nằm ở góc dưới phải màn hình, tuy nhiên có thể kéo thả ra chỗ khác tùy thích.

<img width="1366" height="638" alt="Minh họa 1" src="https://github.com/user-attachments/assets/b0aeec60-f626-4e7b-a9a0-2f98a9e113f7" />

## Giao diện thu nhỏ

<img width="351" height="95" alt="Minh họa thu nhỏ" src="https://github.com/user-attachments/assets/6a47896f-e355-4d10-b544-e594ff270791" />

Giao diện thu nhỏ chỉ hiện thông tin tóm tắt:

- `Tool`: trạng thái tool và phím STOP.
- `Avatar`: chế độ avatar hiện tại và phím toggle tương ứng.
- `Spam`: trạng thái spam và phím SPAM.
- `Next avatar`: phím bind của profile hiện tại.

Muốn chỉnh profile, bind, delay hoặc danh sách avatar thì bấm `+` để mở lại giao diện đầy đủ.

## Giao diện đầy đủ

<img width="438" height="661" alt="Minh họa 2" src="https://github.com/user-attachments/assets/978b63b9-3a26-4892-b15d-a8625f11e621" />





# Hướng dẫn giao diện đầy đủ

Giao diện đầy đủ là trạng thái panel đang mở rộng, gồm các khu vực: `State`, `Direction`, `Profiles`, `Profile`, `Avatar List`, `Spam Kick`, và dòng thông báo ở cuối panel.

## Nguyên tắc chung

- Kéo panel: giữ chuột ở thanh tiêu đề `HAXBALL AUTO AVATAR + SPAM` và kéo đến vị trí mong muốn.
- Thu nhỏ panel: bấm nút `-` ở góc phải thanh tiêu đề.
- Mở lại panel: khi panel đang thu nhỏ, bấm nút `+`.
- Dữ liệu được lưu trong `localStorage`, nên profile, bind phím, vị trí panel, delay và các tùy chỉnh vẫn được giữ sau khi reload.
- Khi đang gõ trong chat/input, script sẽ không cướp phím điều khiển chính.

## Cách bind phím

Nhiều nút trong UI có dạng badge phím, ví dụ `'`, `T`, `W`, `Q`, `H`.

- Click vào badge: bắt đầu bind phím mới.
- Bấm phím muốn gán: lưu bind mới.
- Bấm `ESC`: hủy bind đang chọn.
- Double-click vào badge: xóa bind, chuyển về `NONE`.
- Badge màu đỏ: bind đang bị trùng với một chức năng khác.
- Nếu phím bị trùng, script sẽ cảnh báo và không lưu bind đó.

Nên tránh bind trùng giữa các chức năng như `STOP`, `LIST`, `DIR`, `SPAM`, `KICK`, phím di chuyển và bind profile.

## State

<img width="427" height="43" alt="state" src="https://github.com/user-attachments/assets/1a4a25eb-da14-4671-9495-ac65348eb968" />

Khu vực `State` điều khiển trạng thái tổng của tool và chế độ avatar list tự động.

### Nút `RUN` / `STOP`

- Bấm nút này để bật/tắt toàn bộ tool.
- Khi `STOP`, các lệnh avatar, auto list, direction avatar và spam kick sẽ bị chặn/dừng.

### Nút `LIST AUTO ON` / `LIST AUTO OFF`

- Bật/tắt chế độ tự động chạy `Avatar List` của profile hiện tại.
- Khi bật, script sẽ tự động gửi avatar theo thứ tự các cell trong profile.
- Nếu profile có cell `MS`, script sẽ dừng theo khoảng delay đó trước khi tiếp tục.
- Bấm lại khi đang auto cùng profile sẽ tắt auto.

### Badge `STOP`

- Gán phím bật/tắt tool.
- Mặc định trong script là phím `'`.
- Phím này vẫn hoạt động cả khi tool đang `STOP`, để có thể bật tool lại.

### Badge `LIST`

- Gán phím bật/tắt `LIST AUTO` cho profile hiện tại.
- Mặc định trong script là phím `T`.
- Khi bật lên thì các avatar sẽ thay đổi theo đúng thứ tự đã được cài đặt.

## Direction

<img width="430" height="208" alt="Direction" src="https://github.com/user-attachments/assets/78235c5a-6b00-448d-bece-ad3073cf9495" />


Khu vực `Direction` dùng để đổi avatar theo hướng di chuyển.

### Nút `DIR ON` / `DIR OFF`

- `DIR ON`: avatar sẽ thay đổi theo phím di chuyển đang giữ.
- `DIR OFF`: tắt chế độ avatar theo hướng.
- Khi bật `DIR ON`, chế độ `LIST AUTO` sẽ được dừng để tránh xung đột avatar.
- Khi tắt direction mode, script có thể restore về `Default avatar`.

### Badge `DIR`

- Gán phím bật/tắt direction mode.
- Mặc định trong script mẫu là `W`.

### Các badge `UP`, `DOWN`, `LEFT`, `RIGHT`

- Gán phím di chuyển tùy chỉnh để script nhận biết hướng.
- Mặc định là các phím mũi tên.
- Các phím mũi tên vẫn được tính là phím di chuyển.
- Có thể bind sang phím khác nếu bạn dùng layout điều khiển riêng.

### `Avatar custom` `+` / `-`

- `+`: mở khu tùy chỉnh avatar theo hướng.
- `-`: thu gọn khu tùy chỉnh avatar theo hướng.

### `Default avatar`

- Avatar mặc định để restore khi tắt direction mode.
- Có thể nhập emoji hoặc ký tự ngắn.
- Nếu để trống, script có thể dùng lệnh clear avatar khi restore.

### `Direction avatars`

Các ô này quy định avatar ứng với từng hướng:

- `UP`
- `DOWN`
- `LEFT`
- `RIGHT`
- `UP LEFT`
- `UP RIGHT`
- `DOWN LEFT`
- `DOWN RIGHT`

Khi direction mode đang bật, thay đổi giá trị của hướng hiện tại sẽ cập nhật avatar ngay.

## Profiles

<img width="415" height="151" alt="image" src="https://github.com/user-attachments/assets/0c9edcd3-1c49-469d-a0cb-b2fe75644fa1" />

Khu vực `Profiles` quản lý các bộ avatar khác nhau.

### Nút `A-Z`

- Sắp xếp danh sách profile theo alphabet.
- Thứ tự sau khi sắp xếp sẽ được lưu.

### Nút `+`

- Tạo profile mới.
- Profile mới ban đầu chưa có cell avatar nào và bind profile là `NONE`.

### Nút `Edit`

- Đổi tên profile đang chọn.
- Profile `Default` không được đổi tên.

### Nút `x`

- Xóa profile đang chọn.
- Không thể xóa nếu chỉ còn 1 profile.
- Nếu profile đang bị `LIST AUTO`, auto sẽ bị dừng trước khi xóa.

### Danh sách profile

- Click vào tên profile: chọn profile đó làm profile hiện tại.
- Kéo grip bên trái profile: sắp xếp lại thứ tự profile.
- Badge nhỏ bên phải profile: hiện phím bind để chạy avatar tiếp theo của profile đó.
- Badge đỏ trong danh sách profile: bind profile đang trùng với chức năng/bind khác.

## Profile

<img width="432" height="142" alt="image" src="https://github.com/user-attachments/assets/b7922381-a921-4a1e-b089-c03459515a22" />

Khu vực `Profile` cấu hình profile đang chọn.

### Badge bind profile

- Gán phím để chạy avatar tiếp theo của profile hiện tại.
- Khi bấm phím này trong game, script sẽ gửi avatar tiếp theo trong `Avatar List`.
- Nếu giữ phím, script có thể tiếp tục chạy theo delay của profile.

### `Delay`

- Delay mặc định giữa các lệnh avatar liên tiếp của profile.
- Đơn vị là millisecond.
- Giá trị tối thiểu là `100ms`.
- Nếu nhập nhỏ hơn mức tối thiểu, ô input sẽ báo lỗi màu đỏ và script không lưu giá trị đó.

## Avatar List

Khu vực `Avatar List` là chuỗi cell mà profile sẽ chạy.

### Nút `+ AV`

- Thêm một cell avatar mới.
- Cell `AV` dùng để gửi lệnh `/avatar <giá trị>`.
- Giá trị có thể là emoji, ký tự, hoặc chữ ngắn tùy giới hạn của HaxBall.

### Nút `+ MS`

- Thêm một cell delay.
- Cell `MS` dùng để chèn thời gian chờ vào chuỗi avatar.
- Giá trị tối thiểu là `100ms`.

### Nút `Reset`

- Đưa con trỏ `next avatar` của profile về cell đầu tiên.
- Hữu ích khi muốn chuỗi avatar chạy lại từ đầu.

### Cell `AV`

- Nút `AV`: bấm để chuyển cell thành `MS`.
- Ô input: giá trị avatar sẽ gửi.
- Nút `x`: xóa cell.
- Grip: kéo để sắp xếp lại cell.

### Cell `MS`

- Nút `MS`: bấm để chuyển cell thành `AV`.
- Ô input: thời gian delay tính bằng ms.
- Nút `x`: xóa cell.
- Grip: kéo để sắp xếp lại cell.

## Spam Kick

<img width="429" height="70" alt="image" src="https://github.com/user-attachments/assets/2abe8fc7-0212-4053-b308-1475bd575143" />

Khu vực `Spam Kick` điều khiển chế độ lặp phím kick/action.

### Nút `SPAM ON` / `SPAM OFF`

- Bật/tắt chế độ spam kick.
- Khi `SPAM ON`, script chỉ bắt đầu spam khi bạn đang giữ phím `KICK`.
- Khi thả phím `KICK`, spam sẽ dừng.

### Badge `SPAM`

- Gán phím bật/tắt chế độ spam kick.
- Mặc định trong script mẫu là `Q`.

### Badge `KICK`

- Gán phím action/kick mà script sẽ lặp lại.
- Mặc định trong script mẫu là `X`.
- Đây là phím cần giữ khi `SPAM ON` để spam kick/action.

### `Rate (ms)`

- Tốc độ lặp phím kick/action.
- Đơn vị là millisecond.
- Giá trị tối thiểu là `10ms`.
- Nếu nhập quá nhanh, input sẽ báo lỗi màu đỏ và script không lưu giá trị đó.

## Dòng thông báo

Dòng nhỏ ở cuối panel hiện trạng thái ngắn gọn:

- Đang bind phím: `Press a key - ESC to cancel`.
- Tool đang tắt: `Stopped: avatar commands are blocked`.
- Direction mode đang bật: `Direction avatar mode is active`.
- List auto đang chạy: `List auto running: <profile>`.
- Spam kick đang armed: `Spam kick armed`.
- Lỗi bind trùng hoặc delay không hợp lệ sẽ hiện màu đỏ.

## Luồng sử dụng gợi ý

1. Tạo hoặc chọn một profile trong `Profiles`.
2. Gán phím cho profile bằng badge trong khu `Profile`.
3. Thêm các cell `AV` vào `Avatar List`.
4. Nếu cần chèn thời gian chờ riêng, thêm cell `MS`.
5. Bấm phím bind profile trong game để chạy avatar tiếp theo.
6. Bấm `Reset` nếu muốn chạy lại từ cell đầu.
7. Dùng `LIST AUTO` nếu muốn profile tự động chạy liên tục.
8. Dùng `DIR ON` nếu muốn avatar thay đổi theo hướng di chuyển.
9. Dùng `SPAM ON` và giữ phím `KICK` nếu muốn lặp action/kick.









# Một số lưu ý

- Khi bật record của hệ thống haxball lên, thì hệ thống không ghi nhận độ trễ giữa phím mình nhấn và avatar mới bị đổi. 
Nhưng do là tool làm ở phía client, nên không thể tránh khỏi việc nút mình bấm có lúc không đồng bộ với hiển thị trên màn hình của bản thân.
Cái lỗi này không thể sửa được. Thường xảy ra với server có ping 30ms trở lên




# Chat with Claude

## Câu hỏi
Một code rất hay tôi đã tối ưu thành công. Tuy nhiên có một hiện tượng thế này. 
- Đối với room tôi tự host, thì độ trễ giữa việc tôi nhấn nút và hiển thị avatar là không có gì cả
- Đối với room ping thấp, thì độ trễ vẫn có một chút nhưng vẫn chấp nhận được 
- Đối với room có ping tầm 30ms trở đi, có dấu hiệu việc tôi nhấn nút nó không đồng bộ với avatar tôi thấy trên màn hình. Khi tôi thử dùng hai trình duyệt (giống kiểu hai người chơi khác nhau) để xem xét, thì tôi thấy trình duyệt 1 hiển thị độ trễ thế nào, trình duyệt 2 thể hiện độ trễ giữa nút ấn và avatar được thay đổi y như vậy 
- Trong cả 3 trường hợp, khi tôi dùng record của hệ thống để ghi lại trận đấu, thì hệ thống đều ghi nhận đầy đủ cho tôi, không có độ trễ nào cả.

Phải chăng vấn đề này là do ping mạng? Tôi vừa mới nhờ sonet 4.6 refactor lại bộ code này, và vấn đề gặp phải vẫn vậy. Nếu không sửa được, hãy nói cho tôi biết. Nếu tối ưu được hơn, hãy code giúp tôi những chỗ nào nên sửa lại


## Trả lời:
### Phân tích vấn đề

Bạn đã mô tả rất chính xác. Đây **đúng là do ping mạng**, và đây là lý do kỹ thuật:

**Cơ chế hoạt động của `/avatar` command trong HaxBall:**

1. Client gửi lệnh `/avatar 🔴` lên server
2. Server xử lý → broadcast lại cho tất cả client (kể cả chính bạn)
3. Client hiển thị avatar mới sau khi nhận broadcast

Vì vậy độ trễ bạn thấy = **ping round-trip** (gửi lên + nhận về). Với 30ms ping → avatar thay đổi sau ~30-60ms. Đây là **network latency cố hữu**, không thể bypass bằng code client-side.

**Tại sao record không có độ trễ?** Vì replay lưu theo game tick của server — server đã có đúng thời điểm lệnh đến, nên replay hiển thị "đúng" theo góc nhìn server.

**Tại sao browser 1 và browser 2 thấy giống nhau?** Vì cả hai đều nhận broadcast từ server cùng lúc.

