# FS — SBFAS (School-Based FAS) — Functional Specification

**Phiên bản:** 1.0 · 2026-10-22
**Phạm vi:** tính năng SBFAS cho **school user** (tab *SBFAS review*, *SBFAS rules*, *MOEFAS Handbook* chỉ đọc) trong trang `/admin/fas`.
**Người dùng:** tài khoản role `school` (vd `alicia.tan@school.example`, `geraldine.rajaratnam@school.example` — mật khẩu demo `Sch00l-Demo-26`). MOE HQ xem queue ở chế độ chỉ đọc.

---

## 1. Tổng quan nghiệp vụ

1. MOE đặt **income band** quốc gia (GHI — tổng thu nhập hộ, PCI — thu nhập bình quân đầu người) và các tier MOEFAS.
2. **School user** nhóm các band quốc gia thành 3 mức nhu cầu **LOW / MED / HIGH**, chọn **Rank** (gói hỗ trợ của trường) cho từng mức, đặt **mức hỗ trợ từng Rank** (%, hoặc S$ cố định) và optionally **mức hỗ trợ theo từng fee component**.
3. Học sinh nộp hồ sơ → system xếp mức nhu cầu → **đề xuất Rank** → school user **Review / Approve / Override / Reject**.
5. Quy tắc Eligibility: **SBFAS chỉ dành cho Singapore Citizen** (kể cả Dual citizenship có SG). Hồ sơ non-SC hiển thị cảnh báo và phải Reject.

**Lưu trữ:** toàn bộ rule & quyết định nằm trong **bộ nhớ phiên (in-memory)** — reload trang trả về mặc định. Rule lưu theo **mã trường của user đang đăng nhập** (S001 Greenfield Secondary / S002 Riverbank Primary).

---

## 2. Tab SBFAS review

### 2.1 Stat tiles
| Field | Kiểu | Nguồn |
|---|---|---|
| Waiting for your review | số = hồ sơ Pending của trường | `status = "Pending"` |
| Granted | số | status ∈ {Approved, Overridden} |
| Declined | số | status = "Rejected" |

### 2.2 Filter chips
`All (n)` · `Pending (n)` · `Granted (n)` · `Rejected (n)` — chip Rejected dùng key nội bộ `declined`. Bấm chip lọc bảng (aria-pressed).

### 2.3 Bảng queue (phân trang 10 dòng/page)
| Column | Data field | Ghi chú QA |
|---|---|---|
| Student | `student`, `level`, `id` | link `/admin/students/{studentId}/fees`; chỉ hiện hồ sơ thuộc trường của user |
| Risk | `riskScore` (0–100) | badge High/Medium/Low – điểm |
| Income per person | `incomeBand` | text band PCI từ seed |
| Fee to pay | tính từ charges | `S$… Balance S$…` |
| Status | `status` (+ `sbfasTier`) | `Pending`/`Granted`/`Declined` ; khi có `sbfasTier` thêm `· Rank N` |
| (hàng) | — | nút **Open review** mở modal |

### 2.4 Review modal — data fields
| Field | Kiểu | Hợp lệ / Mặc định |
|---|---|---|
| Student | text + link | read-only |
| Nationality | text | từ seed; **không phải SC** → alert đỏ "*… — not eligible for MOE FAS or SBFAS (Singapore Citizens only). Reject this application.*" |
| Household income band (monthly) | text | read-only (MyInfo) |
| Per-capita income band (monthly) | text | read-only |
| Risk rating | badge | High/Medium/Low – `riskScore` |
| Suggested rank | text | `Rank N` từ `recommendedTier` |
| Fee payable / Account balance | S$ | read-only + link *view fees* |
| Why this suggestion | text | `explanation` |
| Override rank | select | option: `Rank N — <subsidy> subsidy` (+ " (suggested)" cho rank đề xuất); `<subsidy>` = `75%` hoặc khoảng `50–100%` khi có override theo component |
| Justification (required to override) | textarea | **bắt buộc khi Override** |
| Nút | — | **Reject / Override / Approve Rank N**; đóng bằng nút **X** (không có Cancel) |

**Validation quyết định** (chỉ với Override):
- Rỗng justification → *"Enter a justification to override the AI recommendation."*
- Chọn đúng rank đề xuất → *"Choose a tier different from the recommendation, or approve instead."*

**Ánh xạ trạng thái sau quyết định:** Approve → `Approved`; Override → `Overridden` (+ lưu `sbfasTier`, `justification`); Reject → `Rejected`. Hiển thị: Approved/Overridden = *Granted*, Rejected = *Declined*.

---

## 3. Tab SBFAS rules

Card: `SBFAS rules — <tên trường của user đăng nhập>`. Bố cục 2 cột: trái = 3 mức, phải = bảng Rank.

### 3.1 Mức nhu cầu LOW / MED / HIGH (mỗi khối)
| Field | Kiểu | Hợp lệ / Mặc định |
|---|---|---|
| Suggested ranks | **chips đa chọn** Rank 1..N | bấm bật/tắt; một mức chọn được **nhiều rank**; mặc định HIGH=[Rank 1], MED=[Rank 2], LOW=[Rank 3]; không chọn = mức không đề xuất |
| PCI From Tier / To Tier | select | tier quốc gia 5..8 (tier đã thuộc MOEFAS bị **loại khỏi options**); `—` = bỏ nhóm |
| GHI From Tier / To Tier | select | như trên |

**Logic đề xuất:** mức = mức "need hơn" giữa GHI và PCI của hồ sơ (`HIGH > MED > LOW`); rank đề xuất = **rank hỗ trợ cao nhất (số nhỏ nhất)** trong các rank mức đó chọn.

### 3.2 Bảng Rank (cột phải)
| Field | Kiểu | Hợp lệ / Mặc định |
|---|---|---|
| Rank | label | Rank 1..N theo thứ tự dòng |
| Subsidy basis | select | `% of fee` (mặc định) / `Fixed S$` |
| Rate | number | `%`: 0–100, tối đa 2 số thập phân; `S$`: ≥ 0; mặc định 4 rank = 100 / 75 / 50 / 25 (%) |
| Remove | nút | disable khi chỉ còn 1 rank; xóa rank → các lựa chọn mức tự dịch xuống |
| + Rank | nút | thêm Rank mới (basis %, rate rỗng) |

### 3.3 Fee component support (đa dòng)
Mỗi dòng: **Fee type** (select — fee type của trường) → **Fee component** (select — component của fee type đó; component đã chọn ở dòng khác bị ẩn) → với **từng Rank**: dropdown `Same as rank (X%)` (mặc định — theo mức chung của rank) / `% of component` (nhập 0–100) / `Fixed S$ amount` (nhập ≥ 0). Nút **+ Fee type** thêm dòng; nút **Remove** xóa dòng (khi ≥ 2 dòng).

### 3.4 Lưu / Validation
Nút **Save SBFAS rules** / **Reset**. Note thành công: *"SBFAS rules saved on {ngày} — new suggestions and decisions use these rules."*
| Điều kiện lỗi | Thông báo |
|---|---|
| Xóa hết rank | "Keep at least one rank." |
| Rate sai định dạng | "Enter a rate between 0 and 100 (max 2 decimals) for every component." (hoặc "Enter an amount of at least 0…" nếu basis S$) |
| Không nhóm band nào | "Group at least one income band into a level before saving." |
| Mức trỏ rank đã bị xóa | "Pick the rank this level suggests." |

---

## 4. Data model (QA đối chiếu storage/API)

**SbfasRule** (mỗi trường): `school` (S001/S002), `updated` (ngày), `tiers: [{tier:"Tier N", basis:"percent"|"fixed", rate:number, components?: {<tên component>: {basis, rate}}}]`, `levelTiers: {HIGH:[], MED:[], LOW:[]}` (mảng "Tier N", rỗng = không đề xuất), `grouping: {ghi:[level|null], pci:[level|null]}` theo thứ tự band quốc gia.

**SbfasApplication:** `id` (SBFAS0001–0018, trừ 0004/0006 — đã xóa vì Singapore PR), `student`, `studentId`, `level`, `incomeBand`, `householdBand`, `incomeSyncedOn`, `riskScore`, `recommendedTier` ("Tier N"), `slaDays`, `explanation`, `status` (Pending/Approved/Overridden/Rejected), sau quyết định thêm `sbfasTier`, `justification`.

**Hiển thị Rank:** nội bộ lưu "Tier N", UI hiển thị **"Rank N"** (MOE-side giữ "Tier").

---

## 5. MOEFAS Handbook (tab 3)

Chỉ đọc: giới thiệu + bảng income tiers GHI/PCI + Active MOE rule. **Không được chỉnh sửa trong scope QA của SBFAS.**

---

## 6. QA checklist

| # | Test case | Data field cần check | Expected |
|---|---|---|---|
| 1 | Đăng nhập Geraldine (S002) → /admin/fas | school của rule | Queue chỉ có học sinh Riverbank; card rules ghi "Riverbank Primary School" |
| 2 | Queue load | `status` filter chips | All=Pending số khớp stat "Waiting for your review"; chip cuối là "Rejected (n)" |
| 3 | Mở modal hồ sơ SC | nationality, suggested rank | Không có alert đỏ; "Suggested rank: Rank N" |
| 4 | Mở modal hồ sơ non-SC | nationality | Alert đỏ "…Singapore Citizens only…Reject this application." |
| 5 | Override thiếu justification | justification | Bị chặn: "Enter a justification to override…" |
| 6 | Override chọn đúng rank đề xuất | tier | Bị chặn: "Choose a tier different from the recommendation…" |
| 7 | Approve | status, sbfasTier | Hàng chuyển "Granted · Rank N"; stat Granted +1 |
| 8 | Reject | status | "Declined"; stat Declined +1 |
| 9 | Rules: bật MED = Rank 2 + Rank 3 → Save | levelTiers.MED | Cả 2 chip sáng sau khi lưu |
| 10 | Bỏ hết chip của LOW → Save | levelTiers.LOW | Cho lưu (mức không đề xuất); hồ sơ mức LOW sẽ không có suggestion |
| 11 | From/To Tier chứa MOEFAS tier | grouping | Options không chứa tier đã thuộc MOEFAS |
| 12 | Rate = 150 → Save | tiers[].rate | Bị chặn với thông báo rate 0–100 |
| 13 | Basis Fixed S$, rate = -5 → Save | tiers[].basis, rate | Bị chặn "Enter an amount of at least 0…" |
| 14 | Xóa Rank 2 (đang được MED chọn) → Save | levelTiers | Pick tự dịch (Tier 3→Tier 2); không lỗi validation |
| 15 | Fee component: Rank 1 LM = 60% → Save → mở modal | tiers[].components | Option "Rank 1 — 60–100% subsidy" |
| 16 | Fee component: Rank 2 LM = Fixed S$10 → Save → modal | components basis | Rank 2 vẫn hiển thị mức flat (S$ không trộn vào %) |
| 17 | + Fee type × 2 → chọn Supplementary Fees | rows | Dropdown component chỉ hiện component chưa dùng ở dòng khác |
| 18 | Reload trang | store | Rule/quyết định trở về mặc định (in-memory) |
| 19 | Bố cục rules | — | 2 cột: mức bên trái, bảng Rank bên phải; Fee component support full-width dưới |
| 20 | Modal không có nút Cancel | — | Chỉ X + Reject/Override/Approve |

---

*Tài liệu mô tả hành vi tại commit `f40f258`. Mọi thay đổi UI SBFAS sau này cần cập nhật FS này.*
