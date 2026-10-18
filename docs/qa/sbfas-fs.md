# SBFAS — Đặc tả chức năng (dành cho QA)

**Phạm vi:** SBFAS (School-Based FAS — hỗ trợ tài chính cấp trường) như đã triển khai trong Admin Portal (`/admin/fas`, vai trò: School user), bao gồm cả tích hợp với phần phí.
**Nguồn sự thật:** tài liệu mô tả *bản build hiện tại* — mọi quy tắc dưới đây đều kiểm thử được ngay trên ứng dụng đã triển khai. Dữ liệu là mock, không lưu trữ (tải lại trang sẽ reset toàn bộ trạng thái).
**Liên quan:** MOEFAS dùng chung các quy tắc màn hình; xem quy tắc ưu tiên ở BR1. Tài liệu này tập trung vào SBFAS.

---

## 1. Tổng quan chức năng

| # | Chức năng | Vị trí |
|---|---|---|
| F1 | Hàng đợi duyệt SBFAS kèm xếp hạng rủi ro AI và đếm ngược SLA | FAS → bảng *SBFAS review queue* |
| F2 | Quy trình quyết định: Approve / Override / Reject kèm kiểm tra hợp lệ | Cửa sổ Review |
| F3 | Lịch sử quyết định: tab Granted và Declined | Các nút lọc phía trên bảng |
| F4 | Ngữ cảnh phí theo từng đơn: Fee payable và Account balance (top-up) | Hai cột + khối thông tin trong cửa sổ Review |
| F5 | Kết quả SBFAS phản ánh vào phí phải đóng (subsidy trên charge đã phát hành) | Fee → Student fees; modal charge |
| F6 | Ghi nhận thanh toán cho charge được giảm trợ | Modal charge → *Record a payment* |

---

## 2. Trường dữ liệu

### 2.1 Đơn SBFAS (`SbfasApplication`)

| Trường | Kiểu | Giá trị / định dạng | Ghi chú |
|---|---|---|---|
| `id` | string | `SBFASXXXX` | Số tham chiếu, sinh bởi `nextSbfasId()`: chuỗi tự tăng padding 4 chữ số tính từ số cao nhất hiện có (mock bắt đầu từ `SBFAS0001`; queue rỗng cũng bắt đầu từ `SBFAS0001`). Vượt 9999 thì chuỗi số tự dài thêm (`SBFAS10000`) — không bao giờ so khớp bằng regex cố định độ dài; sắp xếp theo giá trị số. Hiển thị dưới tên học sinh |
| `student` | string | Họ tên đầy đủ | Phải khớp chính xác hồ sơ học sinh |
| `studentId` | string | `S2026xxxx` | Liên kết đơn với tài khoản, charge và subsidy của học sinh |
| `level` | string | vd `P5`, `Sec 2` | Lấy từ hồ sơ học sinh |
| `incomeBand` | string | `Up to S$450` / `S$451 - S$700` / `S$701 - S$1,000` / `S$1,001 - S$1,500` | Chỉ hiển thị **dải** thu nhập bình quân đầu người — số thu nhập chính xác không bao giờ xuất hiện |
| `householdBand` | string | `Up to S$1,500` / `S$1,501 - S$2,500` / `S$2,501 - S$4,000` / `Above S$4,000` | Dải thu nhập **tổng hộ gia đình** (tháng). Hộ đông người có thể nằm dải hộ cao nhưng dải bình quân thấp — reviewer thấy cả hai cạnh nhau (R4) |
| `incomeSyncedOn` | date | `yyyy-mm-dd` | Lần đồng bộ dải thu nhập gần nhất từ API bên thứ ba |
| `riskScore` | number | 0–100 | Càng cao càng khó khả năng đóng phí |
| `recommendedTier` | enum | `Tier 1..4` | Tier 1 = trợ cấp cao nhất; do AI khuyến nghị |
| `slaDays` | number | Số nguyên | Số ngày làm việc **còn lại** để quyết định |
| `explanation` | string | Tự do | Giải thích của AI, hiển thị trong cửa sổ review |
| `status` | enum | `Pending` / `Approved` / `Overridden` / `Rejected` | Chỉ được set qua một quyết định |
| `sbfasTier` | enum? | `Tier 1..4` hoặc bỏ trống | Tier SBFAS được cấp; bỏ trống khi Rejected hoặc còn Pending |
| `justification` | string? | Tự do | Bắt buộc khi Override; lưu kèm quyết định |

Hằng số liên quan (R4):
- `INCOME_API_SOURCE = "MyInfo (SingPass) API"` — nguồn duy nhất của `incomeBand` / `householdBand` / `incomeSyncedOn`; trường đọc-only, school user không tự nhập (không hiển thị trên màn hình review).
- `SBFAS_TIER_RATES` — tỉ lệ subsidy theo tier: Tier 1 = 75%, Tier 2 = 65%, Tier 3 = 55%, Tier 4 = 50% (thực tế SBFAS do trường quản trong khoảng 50–75%). Hiện là dữ liệu tham chiếu, chưa điều chỉnh subsidy trên charge.

### 2.2 Hồ sơ học sinh (các trường liên quan SBFAS)

| Trường | Kiểu | Giá trị | Ghi chú |
|---|---|---|---|
| `sbfas` | enum | `Approved` / `Pending` / `Rejected` / `Not applied` | Trạng thái scheme cấp trường |
| `moefas` | enum | Tương tự | Scheme cấp MOE; xem quy tắc ưu tiên BR1 |
| `balance` | number | SGD | Số dư Education Account — là **tiền top-up**, không phải tiền FAS |
| `nationality` | enum? | `Singapore Citizen` / `Singapore PR` / `Malaysian` / `Indian` / `Filipino` / `Dual (Singapore + Malaysian)` / `Dual (Singapore + British)` | Quốc tịch học sinh, hiển thị trong cửa sổ review (R4); trẻ em có thể giữ song tịch; mặc định Singapore Citizen, có thể bỏ trống trên hồ sơ chưa làm đầy đủ |

### 2.3 Charge (tích hợp phí)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `fas` | enum? | `MOEFAS` / `SBFAS` / bỏ trống — scheme được **đóng dấu lúc phát hành** charge, subsidy của scheme đó được áp |
| `components[].subsidy` | number | Subsidy theo từng thành phần phí (SGD), tính tại thời điểm phát hành |
| `payments[]` | mảng | `{ id, on, amount, method: "Education account" \| "Card / PayNow" }` |

---

## 3. Quy tắc nghiệp vụ

### Quyết định & lịch sử

- **BR1 — Loại trừ lẫn nhau, MOEFAS trước.** Một học sinh không bao giờ nhận đồng thời cả hai scheme. Scheme hiệu lực = `moefas === "Approved" ? MOEFAS : sbfas === "Approved" ? SBFAS : không có`. Nếu dữ liệu lỡ có cả hai `Approved` thì **MOEFAS thắng và SBFAS bị bỏ qua** (không bao giờ cộng dồn).
- **BR2 — Approve.** Set `status = Approved`, `sbfasTier = recommendedTier`. Không bắt buộc lý do.
- **BR3 — Override.** Yêu cầu (a) lý do khác trắng và (b) tier **khác** với tier AI khuyến nghị — vi phạm thì chặn hành động kèm báo lỗi tại trường tương ứng. Set `status = Overridden`, `sbfasTier = tier đã chọn`.
- **BR4 — Reject.** Set `status = Rejected` và xóa `sbfasTier`. Lý do không bắt buộc.
- **BR5 — Tab lịch sử.** Granted = `Approved ∪ Overridden`. Declined = `Rejected`. Pending không nằm trong cả hai. Số đếm trên nhãn tab phải khớp nội dung bảng.
- **BR6 — Thứ tự hàng đợi.** Pending trước, sau đó đến đơn có `riskScore` cao nhất. Các dòng đã quyết giữ thứ tự rủi ro sau khối Pending.
- **BR7 — SLA.** `slaDays ≤ 0` hiển thị badge đỏ **Overdue**; `slaDays ≤ 2` tô vàng số ngày còn lại. Dòng đã quyết hiển thị *Closed* (SLA hết áp dụng).

### AI

- **BR8 — Mức rủi ro.** `score < 35 → Low`, `35 ≤ score < 70 → Medium`, `≥ 70 → High` (badge `Low|Medium|High - score`).
- **BR9 — AI chỉ mang tính tư vấn.** Cán bộ luôn có thể Approve theo khuyến nghị, Override sang tier khác (BR3), hoặc Reject. Không có gì được quyết định tự động.

### Phí & tiền

- **BR10 — Mức subsidy (theo scheme thật của MOE).** MOEFAS miễn **100%** học phí & phụ phí trên toàn quốc (áp dụng đồng bộ mọi trường công lập/trường được Chính phủ hỗ trợ). SBFAS do **từng trường tự quyết** (thường miễn 100% hoặc giảm 50–75%) — bản dựng này lấy mặc định **50%**. Mức subsidy áp dụng **khi sinh charge** cho từng thành phần phí; charge giữ nguyên subsidy đã ghi lúc phát hành dù trạng thái đổi sau đó.
- **BR10a — Gói quyền lợi đi kèm (hiện vật, không đụng vào charge).** MOE FAS còn cấp: sách giáo khoa miễn phí đầy đủ danh mục; đồng phục (2 bộ + 2 bộ PE; cấp Tiểu học thêm tất/giày); trợ cấp ăn 7 bữa/tuần (Tiểu học) / 10 bữa/tuần (Trung học); đi lại (Tiểu học: giảm 70% xe đưa đón hoặc S$21/tháng thẻ công cộng; Trung học: S$21/tháng EZ-Link/SimplyGo); miễn lệ phí thi quốc gia (PSLE / GCE N-O Level). SBFAS (nguồn: quỹ cựu học sinh, từ thiện, PTA): miễn/giảm phí, voucher sách-đồng phục, phiếu ăn/thẻ, trợ cấp một phần PLD cho học sinh trung học, tài trợ CCA/cắm trại/chuyến học tập. Các khoản này hiển thị ở trang Fees của học sinh và cửa sổ Review, **không** trừ vào charge.
- **BR10b — Thứ tự xét & hoàn tiền.** eFAS xét **MOE FAS trước**; gia đình không đạt ngưỡng thu nhập sẽ được chuyển tới hàng đợi SBFAS của trường (khớp BR1). Nếu phụ huynh được duyệt **sau khi** đã tự mua sách/đồng phục đầu năm: giữ hóa đơn/biên lai và làm thủ tục **hoàn tiền (reimbursement)** tại Văn phòng nhà trường.
- **BR11 — Subsidy ≠ top-up.** Subsidy FAS **giảm phí** gia đình phải đóng. Top-up của MOE **nạp thêm số dư Education Account**. Hai khoản được tính toán, lưu trữ và hiển thị tách biệt: cột *Fee payable* = tổng số còn nợ trên các charge chưa trả; cột *Account balance* = số dư top-up của học sinh. Không khoản nào làm thay đổi khoản kia.
- **BR12 — Trạng thái charge suy diễn.** `paid` khi thanh toán đủ phủ phần phải trả (còn `≤ S$0.005`); ngược lại `overdue` khi quá hạn `due`; còn lại `outstanding`. Trạng thái không lưu cứng — ghi nhận thanh toán có thể đổi dòng thành *paid* tức thì.
- **BR13 — Quy tắc thanh toán.** Mỗi lần ghi nhận gắn với đúng một charge; số tiền > 0, tối đa 2 chữ số thập phân, không vượt phần còn nợ. Nguồn là *Education account* (trừ số dư top-up về mặt khái niệm) hoặc *Card / PayNow* (cổng thanh toán). Cho phép trả một phần; mỗi lần ghi nhận có tham chiếu `CH-xxxx-Pn`.

---

## 4. Danh mục kiểm tra nhanh (smoke test) cho QA

1. Hàng đợi nạp 12 đơn seed; tên mọi học sinh đều link sang trang fees của học sinh đó.
2. Mở review → khối hiển thị **Fee payable** (đỏ) + **Account balance (top-ups)** + ghi chú "hai khoản khác nhau".
3. Approve một đơn High-risk → tab **Granted** +1, badge dòng là `Approved - Tier n`; Pending −1.
4. Override không có lý do → bị chặn, focus nhảy sang ô lý do. Override trùng tier khuyến nghị → bị chặn. Override hợp lệ → `Overridden - Tier n`.
5. Reject một đơn → tab **Declined** +1, badge `Rejected`.
6. Tìm một học sinh đã được SBFASapproved trong Fee → Student fees: cột FAS hiển thị `SBFAS − S$x`; modal charge hiển thị khối subsidy và ghi chú subsidy ≠ top-up.
7. Ghi nhận thanh toán cho charge đó (thử số tiền vượt phần còn nợ → bị từ chối; đúng bằng phần còn nợ → trạng thái thành *paid*, tham chiếu `CH-…-P1` xuất hiện).
8. Tải lại trang — mọi thứ reset (mock trong bộ nhớ): hàng đợi về 12 Pending.

**Vấn đề đã biết (không phải lỗi):** tier được chọn (Tier 1–4) chưa thay đổi mức subsidy (phẳng 20% — BR10); quyết định chưa ghi ngược field `sbfas` của học sinh ngay; MOEFAS auto-grant và API dải thu nhập là story riêng.
