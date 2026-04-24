# Mô tả chức năng của script

Tóm tắt lại là script này sẽ viết lại trường 'geo' trong localStorage thông qua console của trình duyệt, với mục đích là đánh lừa frontend của hệ thống Haxball, khiến các room gần với vị trí bạn đã override hiện lên đầu danh sách phòng

Thực ra nó không fake hẳn địa chỉ IP của bạn sang một nước khác được. Muốn fake IP thì phải dùng phần mềm chuyên dụng khác.

## Giao diện ban đầu

Khi mới vào game, tool sẽ trông như thế này

<img width="1366" height="284" alt="ảnh 1" src="https://github.com/user-attachments/assets/e558cfc0-2273-457e-93be-297b1352d5c6" />

Đây là vị trí (theo mình) là hợp lý nhất vì nó đỡ vướng các nút bấm khác trong game

## Chọn vị trí muốn override

Các địa điểm được cài đặt theo mặc định.

<img width="223" height="311" alt="ảnh 2" src="https://github.com/user-attachments/assets/4be2d481-1802-49ca-a817-ca4b7fd4a556" />

Nếu muốn thêm một số địa chỉ khác thì thêm trực tiếp vào trong code luôn, bằng cách viết thêm các địa chỉ và tọa độ tương ứng (Có lẽ sau này sẽ update thêm tính năng "thêm địa chỉ" trên giao diện để trông thân thiện hơn)

<img width="927" height="116" alt="image" src="https://github.com/user-attachments/assets/a8df0f8f-8b54-4aef-8f07-eb3fce0f93b2" />

## Chức năng thu nhỏ

Trông nó nhỏ gọn ở phần biên trên của trình duyệt.

<img width="116" height="38" alt="image" src="https://github.com/user-attachments/assets/f1304690-6a27-41df-8d8a-8c4badcdaef4" />

## Chức năng kéo thả đi chỗ khác

Giao diện của tool có thể kéo ra chỗ khác nếu thấy chỗ đặt tool mặc định trông hơi vướng.

<img width="1366" height="539" alt="image" src="https://github.com/user-attachments/assets/c1618274-e017-40b0-9c41-f977e4c1af32" />

## Đánh lừa frontend của haxball.com

Khi bạn override trường geo sang một vị trí khác, thì hệ thống sẽ ưu tiên xếp các phòng gần với vị trí 'geo' bạn đã fake hơn lên đầu danh sách phòng

<img width="1366" height="534" alt="ảnh 3" src="https://github.com/user-attachments/assets/33c98fe3-adf1-435f-8562-40fdb971cef7" />

Đồng thời bạn cũng sẽ đổi được cái lá cờ của mình khi join vào một phòng nào đó. 

Thông thường thì khi chơi haxball bằng một trình duyệt ở Việt Nam, bạn sẽ có lá cờ Việt Nam. Nhưng chả hạn, giờ bạn đổi trường 'geo' của bạn đi sang nước Anh rồi, nên giờ bạn sẽ có lá cờ nước Anh trong phòng chờ.

<img width="1366" height="497" alt="cờ nước khác" src="https://github.com/user-attachments/assets/1adc9ade-a67c-4664-b4d9-207155be7901" />


# Một số lưu ý

- Khi bạn dùng "Vị trí browser", có một số trình duyệt sẽ không dùng vị trí thật tại chỗ bạn đang ngồi. Có thể nó sẽ chọn một vị trí khác để làm "vị trí browser".
Chả hạn, nếu bạn dùng trình duyệt Brave, và bạn đang ngồi ở Hà Nội, thì cái gọi là "vị trí browser" do script lấy được khi gọi hàm 'navigator.geolocation' có thể sẽ là vị trí ở một khu vực khác, chả hạn là Đà Nẵng.
Cái này thì khả năng là do trình duyệt can thiệp vào chứ không phải là do script bị lỏ đâu.



# Chat with Google AI Studio

## Câu hỏi
Cuối cùng cũng có một code hoàn chỉnh!

Tôi thắc mắc như này: Suy cho cùng đây là một tool để override trực tiếp trường geo nằm trong localStorage thông qua console đúng không? 
Tuy nhiên sau khi tôi override như vậy, haxball hiển thị những room gần với tôi 
(chả hạn, khi tôi chuyển sang sân Old Trafford, có mấy room của nước ngoài hiện lên đầu bảng trước). 
Như vậy là thực ra tôi chỉ thay đổi được cách hệ thống nhận diện vị trí của tôi, chứ không thay đổi được địa chỉ IP thực tế của tôi?


## Trả lời:
Bạn đã hiểu ra vấn đề một cách **chính xác 100%**. Sự suy luận của bạn hoàn toàn chuẩn xác về mặt bản chất kỹ thuật của Web và Mạng!

Để làm rõ hơn, tôi sẽ phân tích rạch ròi giữa **Toạ độ (Geolocation)** và **Địa chỉ IP**, cũng như tác động thực tế của nó trong Haxball:

### 1. Cái tool này thực chất làm gì? (Đánh lừa giao diện Frontend)
*   **Sắp xếp danh sách phòng:** Haxball mặc định lấy tọa độ của bạn (thông qua `navigator.geolocation` hoặc lưu trong `localStorage.geo`), sau đó dùng công thức toán học để tính khoảng cách từ bạn đến máy chủ (Host) của các phòng. Phòng nào khoảng cách càng gần -> Xếp lên đầu.
*   **Tác dụng của Tool:** Tool này **đánh lừa trình duyệt**, ép nó báo cáo rằng bạn đang ở UK. Do đó, code Frontend của Haxball tin rằng bạn ở UK và đẩy các phòng ở Châu Âu lên đầu danh sách cho bạn xem.

### 2. Sự thật về Địa chỉ IP (Bản chất mạng Backend)
*   **IP không thể bị thay đổi bằng JavaScript:** Địa chỉ IP là do Nhà cung cấp dịch vụ mạng (VNPT, Viettel, FPT...) cấp phát. Nó nằm ở tầng mạng (Network Layer) của kết nối internet. Mã JavaScript chạy trên trình duyệt (Tampermonkey) **hoàn toàn không có quyền hạn và khả năng** can thiệp vào tầng mạng này.
*   **Bạn vẫn đang dùng mạng từ Việt Nam:** Dù toạ độ có chỉ bạn ở Sao Hỏa, thì khi dữ liệu game truyền đi, nó vẫn bắt nguồn từ cục Router Wi-Fi nhà bạn tại Việt Nam, mang theo địa chỉ IP thật của bạn.

### 3. Điều này có ý nghĩa gì khi bạn chơi Haxball?
Việc chỉ đổi Toạ độ mà không đổi IP mang lại những hệ quả sau:

*   **Về mặt Ping (Độ trễ):** Ping của bạn **KHÔNG HỀ GIẢM**. Nếu bạn fake sang Old Trafford (UK) và vào một phòng ở UK, dữ liệu vẫn phải bơi qua cáp quang biển từ VN sang UK. Ping của bạn vẫn sẽ ở mức 200ms - 300ms (rất lag).
*   **Về việc vượt rào (Bypass) các phòng bị khóa:**
    *   ✅ **Vượt qua được:** Nếu chủ phòng (Host) dùng code Haxball API để kick người chơi dựa trên *khoảng cách* (VD: `if (player.distance > 1000km) kick()`), tool của bạn sẽ **qua mặt được** hoàn toàn.
    *   ❌ **KHÔNG vượt qua được:** Nếu chủ phòng dùng các dịch vụ API bên ngoài (như IP-API, GeoIP) để check *địa chỉ IP thật* của bạn (VD: thấy IP Việt Nam là ban luôn), thì tool này **vô tác dụng**.

### Tổng kết:
Tool `Geo-Overrider` này là một công cụ **Fake Location (Toạ độ/GPS)** chứ **không phải là VPN (Mạng riêng ảo)**. 

*   Nó rất hữu ích nếu bạn muốn: Thay đổi danh sách phòng hiển thị để tìm phòng nước ngoài dễ hơn, hoặc lách qua các host nghiệp dư chỉ dùng bộ lọc khoảng cách mặc định của Haxball.
*   Nếu bạn muốn thay đổi địa chỉ IP thật để giảm Ping (đổi routing) hoặc lách luật cấm IP quốc gia, bạn bắt buộc phải dùng các phần mềm can thiệp ở tầng mạng như **VPN (NordVPN, ExpressVPN...), Warp 1.1.1.1, hoặc Proxy.**
