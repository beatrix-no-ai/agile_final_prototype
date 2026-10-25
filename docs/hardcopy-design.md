# Thiết kế feature Hardcopy FAS (trường nộp hộ phụ huynh lên MOE)

> Phạm vi: School User nhập đơn giấy (hardcopy) cho phụ huynh không dùng được e-Service,
> nộp lên MOE để xét **MOEFAS**; khi rớt MOEFAS, phụ huynh nộp trực tiếp tại trường để được xét **SBFAS**.
> Cả hai luồng xét dùng lại logic đã có (band thu nhập → tự động cấp MOEFAS; queue SBFAS + review của trường).

## 1. Hiện trạng hệ thống (điều cần biết trước khi thiết kế)

### 1.1 Hai portal, một store trung tâm

- **Admin Portal** (MOE HQ / School User) và **e-Service Portal** (Parent, SingPass) cùng đọc/
  ghi từ `src/data/fasStore.tsx` — đây là "single source of truth" về quyết định FAS:
  - `apps: SbfasApplication[]` — queue SBFAS của trường (mỗi học sinh tối đa 1 đơn).
  - `moefas: Record<studentId, MoefasGrant>` — MOEFAS tự động cấp theo band (mỗi học sinh 1 grant).
- Mọi thay đổi FAS đi qua `useFasActions` (`src/data/fasActions.ts`) để store FAS và việc
  tính lại phí chưa trả của học sinh (`fees.dispatch applyFas`) luôn đổi cùng nhau.

### 1.2 Luồng e-Service hiện tại (phụ huynh tự nộp)

```
Parent (e-Service) chọn band thu nhập/person (BANDS trong familyFas.ts)
  → parentStore.submitFas → useFasActions.submitFamily → fasStore action "submitFamily"
       ├── band b1/b2 (MOEFAS Tier 1/2) → moefas[studentId] = {tier, at}   (tự động cấp)
       ├── band b3 (SBFAS)              → tạo SBFASApplication (Pending) vào queue trường
       └── band b4 (null)               → không tạo gì
```

- Guard đã có: `moefas[id] || apps.some(x => x.studentId === id)` → **1 đơn + 1 grant mỗi học sinh**.
- Gợi ý tier cho đơn mới: mapping band → index trong tier quốc gia (`PCI_OF_BAND`), rồi qua
  `sbfasRule` của từng trường (grouping → need level → suggested tier).

### 1.3 Hai "biểu diễn" của đơn gia đình đang tách rời (điểm yếu hiện tại)

| Biểu diễn | Nơi | Tính chất |
|---|---|---|
| **Live**: kết quả của submitFamily (grant/app) | `fasStore` | Thật, đổi theo thao tác |
| **Tĩnh**: trang "Family applications" của HQ | `FAMILIES` seed tĩnh trong `moefas.ts` + `matchedCondition` theo rule snapshot | Cứng, không nhận đơn mới |

Tức là: đơn parent nộp live **không xuất hiện** ở màn hình Family applications của HQ.
Feature hardcopy bắt buộc phải xử lý điểm này, vì đơn trường nộp hộ **phải hiện ở phía MOE** để HQ xem/xét.

### 1.4 ⚠️ Trên upstream đã có một bản hardcopy với ngữ nghĩa KHÁC yêu cầu này

Commit `ea5456d` (upstream/master, chưa có trong master local — hai nhánh đang phân nhánh):

- Thiết kế của nó: **hardcopy → thẳng queue SBFAS của trường, không bao giờ cấp MOEFAS**
  (`addHardcopy`: "never grants MOEFAS").
- Yêu cầu của bạn: **hardcopy → nộp lên MOE → xét MOEFAS → rớt mới được nộp trường xét SBFAS**.

Hai ngữ nghĩa này xung đột. **Cần thống nhất trong team trước khi code** (xem mục 6).
Phần tái sử dụng được từ `ea5456d`: field `source`, `PAPER_INCOME_BANDS`/`PAPER_PCI_INDEX`,
helper `suggestionOf`, cột Source + filter trong queue, UI `HardcopyEntry.tsx`.

## 2. Thiết kế đề xuất

### 2.1 Nguyên tắc

1. **Kênh nộp là thuộc tính, không phải flow riêng.** Không tạo "loại đơn" mới với logic xét riêng —
   thêm `channel`/`source` vào các record hiện có. Một engine xét MOEFAS, một queue xét SBFAS cho mọi kênh.
2. **Tách 2 entity theo 2 chủ thể**, nối bằng khóa ngoại:
   - `FamilyApplication` — phễu phía MOE (đơn gia đình nộp lên MOE, xét MOEFAS theo từng trẻ).
   - `SbfasApplication` — queue phía trường (như hiện tại), thêm `source` + `familyAppId`.
   Lý do: MOE và trường là hai actor khác nhau, view/hành động/SLA khác nhau; đây cũng là hình dạng
   quan hệ tự nhiên của dữ liệu. Không nên nhét cả hai phễu vào một record polymorphic duy nhất
   (refactor lớn, phá các component/box đã có, khó mapping sang DB thật).
3. **Hai kênh chỉ khác nhau ở ĐIỂM VÀO, không khác ở phễu.** Theo AC-029 của team
   ("Assess like online", "Goes to school queue"): đơn giấy sau khi nộp đi qua **đúng phễu**
   e-Service — xin band thu nhập từ income service → xét MOEFAS → rớt thì **tự động** vào queue
   SBFAS của trường. Khác biệt duy nhất: ai nhập (staff thay parent), thu nhập xin theo NRIC từ
   form giấy, và sau quyết định trường **ghi nhận đã báo lại phụ huynh** (AC-029-03 — phụ huynh
   không có portal nên mọi liên lạc qua trường).
4. **Điểm vào của kênh giấy là scan + OCR.** Staff quét tờ form phụ huynh đã điền, OCR trích
   trường, staff **xác nhận lại từng trường** rồi mới submit (AC-028-03 vẫn áp dụng: thiếu trường
   thì không submit được). OCR chỉ là cách nhập — không tạo entity mới, chỉ thêm thuộc tính
   `entry_mode='ocr'` + bản scan đính kèm + audit đã xác nhận.
5. **Sau khi SBFAS bị từ chối, phụ huynh được nộp đơn SBFAS MỚI tại trường.** Đơn bị từ chối
   không khóa vĩnh viễn: phụ huynh mang tờ form SBFAS khác ra trường, staff scan/nhập → tạo
   đơn SBFAS **lần thứ n+1**, nối về đơn bị từ chối trước đó (`supersedes`) để reviewer thấy
   toàn bộ lịch sử.

### 2.2 State machine (theo từng trẻ — giống cho cả 2 kênh)

```
[Điểm vào]
  e-Service: parent tự điền form online
  Hardcopy : staff SCAN tờ form → OCR trích trường → staff xác nhận (draft) → submit
        │  channel, entered_by, entry_mode(ocr|manual), income_source=homes (mặc định, 2.2.1)
        ▼
FamilyApplication(status=assessing) ──xin band từ income service (AC-023)──┐
        │   (service lỗi → status=on_hold, retry được — AC-023-02)          │
        ├── match MOEFAS tier (tier subsidy cao hơn thắng — AC-024-03)      │
        │     → moefas_grants[student] = {tier, effective_from, app_id}    │
        │     → học sinh chuyển MOEFAS Approved, phí tính lại  → KẾT THÚC   │
        │                                                                  │
        └── không match (RỚT MOE — AC-024-02)                              │
              → outcome/trẻ = "MOEFAS not granted"                         │
              → TỰ ĐỘNG tạo SbfasApplication lần 1 (Pending, SLA 10 ngày,  │
                  source=referral, familyAppId=<đơn MOE>)                  │
              → trường review (Approve/Override/Reject + reason — AC-025)  │
              → trường tick "parent notified" (AC-029-03)                  │
                     │                                                    │
                     ├── Approve/Override → SBFAS Granted → KẾT THÚC       │
                     └── REJECT (rớt SB)                                   │
                           → phụ huynh CÓ THỂ nộp đơn SBFAS MỚI tại trường:│
                              staff scan/nhập tờ SBFAS (action riêng,      │
                              guard ở dưới) → SbfasApplication lần n+1     │
                              (supersedes = đơn bị reject, kèm lý do       │
                              nộp lại) → queue review lại → có thể lặp     │
                              (chính sách chặn số lần — xem mục 5)
```

Guard:

a) **Chống trùng lúc nhập MOE** (AC-031 — "same period, paper or online", **liên kênh**):
   học sinh chưa có MOEFAS grant và chưa có đơn (FamilyApplication/ SB pending) trong chu kỳ —
   nếu trùng thì **hiện đơn đang có** thay vì tạo mới.

b) **Điều kiện nộp lại SBFAS sau khi reject** (điểm mới theo luồng đã chốt):
   1. Đơn SBFAS trước của học sinh ở trạng thái **đã có quyết định** và là **Rejected**
      (nếu còn Pending → không nhận đơn mới; nếu đã Granted → không cần).
   2. Bắt buộc nhập **lý do nộp lại** (hoàn cảnh gì thay đổi) — hiển thị cho reviewer cùng
      quyết định reject trước đó.
   3. Đơn mới `supersedes` đơn cũ; queue hiển thị "attempt 2/3/…" để reviewer thấy lịch sử;
      các guard hiện có (không trùng MOEFAS grant, một Pending duy nhất) vẫn áp dụng.

### 2.2.1 Nguồn thu nhập của đơn giấy — theo form MOE FAS thật (Sep 2025)

Form thật quy định: nếu hộ gia đình **chỉ có thu nhập từ lương/tự kinh doanh** thì KHÔNG cần điền
Section II và không nộp giấy tờ thu nhập — **MOE vẫn tự truy xuất GHI và PCI từ HOMES**
(kéo dữ liệu IRAS + CPF). Chỉ khi có *thu nhập hành chính khác chịu thuế* (tiền thuê nhà, cổ tức,
đầu tư...) gia đình mới khai bảng thành viên + thu nhập và nộp giấy tờ (NOA, CPF statement).

→ Sửa giả định trong thiết kế: `income_source` của đơn hardcopy **mặc định là `homes`** (đồng bộ tự
động như e-Service, có `incomeSyncedOn`), chỉ thành `paper_declared` khi trường tick
"hộ có thu nhập hành chính khác" và nhập bảng khai tay. Màn hình nhập vì vậy đơn giản hơn dự kiến:
trường chủ yếu nhập thông tin trẻ + người nộp; bảng hộ khẩu chỉ hiện khi có tick này.

### 2.3 Vì sao cần nâng `FamilyApplication` thành record thật trong store

- Đơn trường nộp hộ **phải hiện** ở trang Family applications của HQ → cần list live, không thể là seed tĩnh.
- Kết quả "rớt MOEFAS" phải được **lưu lại** để làm điều kiện mở khóa cho bước nhập SBFAS tại trường.
- Cần audit: ai nhập (staff), khi nào, band lấy từ tờ giấy nào.

Cách làm ít rủi ro trong prototype: thêm slice `familyApps: FamilyApplication[]` vào `fasStore`
(initial state = seed chuyển từ `FAMILIES` tĩnh, tag `channel: "e-Service"` để trang HQ vẫn demo được),
rồi cho trang HQ đọc store thay vì seed. `submitFamily` (e-Service) cũng nên ghi 1 record vào `familyApps`
để hai kênh đối xứng — việc này khép luôn điểm yếu 1.3.

### 2.4 Ánh xạ form MOE FAS thật (Sep 2025) vào màn hình nhập hardcopy

Form thật xác nhận đúng phễu thiết kế: đơn giấy được nộp **vào một trường bất kỳ** của các con
("Form submitted to: ______ (Name of school)") — nộp 1 form cho mọi trẻ ở các trường khác nhau —
trường đó nhập và chuyển MOE xét. Các section trên form → trường nhập:

| Form thật | Màn hình nhập của School User | Ghi chú data |
|---|---|---|
| **Cả tờ form (scan + OCR)** | Staff upload scan → OCR **prefill** mọi trường bên dưới → staff xác nhận/sửa từng trường rồi submit | `entry_mode='ocr'`, `ocr_verified_by/at`; bản scan trong documents. Demo tip: OCR mock chủ động sai 1 trường để thể hiện bước xác nhận |
| S.I — BC/NRIC, tên, trường, cấp của từng trẻ | Chọn học sinh từ sổ trường (mặc định); thêm trẻ ở trường khác bằng NRIC nếu cần | `family_application_children` |
| S.I — địa chỉ, email, SĐT người nộp | Nhập tay từ form | `family_applications.address/email/contact` |
| S.I — "Form submitted to" | Tự động = trường của staff nhập | `school_id` |
| S.II — bảng thành viên hộ + thu nhập | **Chỉ hiện** khi tick "hộ có thu nhập hành chính khác"; mặc định ẩn (HOMES tự lấy) | `income_source='paper_declared'` + bảng khai + documents |
| S.II — welfare home letter | Checkbox "trẻ ở welfare home (kèm thư)" | miễn bảng S.II cho trẻ đó |
| ComCare auto-grant | Checkbox "hộ đang nhận ComCare" → cấp MOEFAS luôn, không cần xét | `comcare` flag, outcome granted |
| S.IV — phương tiện đi học (public/bus/own) | Radio 3 lựa chọn (chỉ tiểu học có school bus) | `transport_mode` — lái subsidy vận chuyển |
| S.VI — khai báo + chữ ký | Hiển thị tóm tắt; ghi nhận "tờ khai đã ký trên giấy" (tên/NRIC/ngày ký) | audit `declaration_by/at` |
| Annex I ¶14 — giấy tờ nộp kèm | Danh sách file đính kèm (chỉ khi có thu nhập khai tay) | bảng documents |
| Cả tờ form (scan) | Đính kèm PDF scan tờ form gốc (US-030, AC-030: chỉ PDF, giới hạn size, trường + HQ đều mở được) | bảng documents, type='form_scan' |
| Quốc tịch SC-only (Annex I ¶2) | Guard khi chọn trẻ: chỉ Singapore Citizen | đã có field `nationality` |

Điều kiện xét MOEFAS thật (Annex I ¶5): **GHI ≤ $4,000/tháng HOẶC PCI ≤ $1,000/tháng** — một mức
duy nhất, không phân tier (MOEFAS Tier 1/2 trong prototype là ASSUMPTION đã ghi chú, giữ nguyên để
nhất quán với luồng e-Service). Các tiêu chí phụ: công dân SG, học chính quy, đi học đều
(¶2–4) — prototype có thể hiển thị dạng checklist "đã xác nhận trên form".

Hai quy tắc thời gian từ form thật nên đưa vào schema:
- **Chu kỳ theo năm học**: trợ lực có hiệu lực đến hết tháng 12, **mỗi năm học phải nộp đơn mới**
  → bảng con cần cột `cycle` (năm học); các ràng buộc "1 đơn/học sinh" là **mỗi chu kỳ**.
- **Tháng hiệu lực**: duyệt trước cuối tháng → hiệu lực từ tháng kế tiếp → grant nên lưu
  `effective_from` (tháng), không chỉ `granted_at`.

## 3. Database schema

### 3.1 ERD

```
students 1───n family_application_children n───1 family_applications
   │                                                 │ (channel, entered_by)
   │ 1                                            users (school staff, nullable)
   │
   ├── 1 (per cycle) moefas_grants ──→ family_applications.id
   │
   └── 1 (per cycle) sbfas_applications ──→ family_applications.id (nullable)
```

### 3.2 Bảng (dành cho backend thật; trong prototype là shape của store)

```sql
family_applications            -- đơn gia đình nộp lên MOE (cả 2 kênh)
  id                PK          -- FAS2026####
  channel           ENUM('eservice','hardcopy')
  school_id         FK NULL     -- hardcopy: trường nộp hộ ("Form submitted to"); eservice: NULL
  cycle             VARCHAR     -- năm học, VD '2026' (form thật: nộp lại mỗi năm, hiệu lực tới hết tháng 12)
  applicant_name, contact, email, address
  pci_band, ghi_band            -- CHỈ LƯU BAND, không lưu thu nhập chính xác (quy tắc privacy hiện có)
  income_source     ENUM('homes','paper_declared')  -- homes = HOMES/IRAS+CPF tự truy xuất (mặc định,
                                 -- kể cả đơn giấy); paper_declared = hộ có thu nhập hành chính khác, khai tay
  comcare           BOOL        -- hộ đang nhận MSF ComCare → auto-grant không cần xét (form thật)
  transport_mode    ENUM('public','school_bus','own') NULL  -- S.IV, lái subsidy vận chuyển
  declaration_by / declaration_at   -- tên/NRIC người ký tờ khai trên giấy (S.VI)
  entered_by        FK users NULL  -- staff nhập đơn giấy
  entry_mode        ENUM('manual','ocr')  -- ocr: scan → prefill → staff xác nhận (ocr_verified_by/at)
  ocr_verified_by   FK users NULL / ocr_verified_at TIMESTAMPTZ NULL
  submitted_at      TIMESTAMPTZ
  status            ENUM('draft','assessing','on_hold','assessed','closed')

family_application_children    -- kết quả xét MOEFAS theo từng trẻ
  id                PK
  application_id    FK → family_applications
  student_id        FK → students
  rule_snapshot_id  FK          -- snapshot policy lúc xét (khái niệm SNAPSHOTS đã có)
  matched_condition INT NULL    -- index điều kiện khớp; NULL = không khớp (rớt)
  outcome           ENUM('moefas_granted','moefas_not_granted')  -- rớt → tự vào queue SBFAS (AC-029-02)
  moefas_tier       NULL
  decided_at

moefas_grants                  -- đã có dưới dạng state.moefas
  student_id        PK FK      -- 1 grant/học sinh (PK đảm bảo)
  tier, granted_at
  effective_from    DATE       -- form thật: duyệt trước cuối tháng → hiệu lực từ tháng kế tiếp
  application_id    FK → family_applications
  rule_snapshot_id  FK

sbfas_applications             -- queue SBFAS hiện tại + 3 field mới
  id                PK         -- SBFAS####
  student_id        FK         -- UNIQUE trong 1 chu kỳ (partial unique index WHERE status='Pending')
  family_app_id     FK NULL    -- MỚI: đơn MOE nguồn (referral / đơn rớt)
  source            ENUM('moe_referral','school_hardcopy')   -- MỚI
  income_band, household_band, income_synced_on NULL
  risk_score, recommended_tier, sla_days, explanation
  status            ENUM('Pending','Approved','Overridden','Rejected')
  sbfas_tier, justification, decided_at
  parent_notified_at TIMESTAMPTZ NULL  -- MỚI: trường đã báo kết quả cho phụ huynh (AC-029-03)
  supersedes_id     FK → sbfas_applications NULL  -- MỚI: đơn SBFAS bị reject mà đơn này nộp lại sau
  attempt_no        INT DEFAULT 1     -- MỚI: 1 = referral đầu; 2+ = nộp lại tại trường sau reject
  reapply_reason    TEXT NULL         -- MỚI: bắt buộc khi attempt_no > 1 (hoàn cảnh thay đổi)
  entered_by        FK users NULL  -- MỚI: staff nhập (kênh hardcopy)
```

### 3.3 Ràng buộc & index

- **Bất biến nghiệp vụ** (giữ ở reducer thuần + test, DB chỉ chốt thêm):
  1. Một học sinh không giữ đồng thời MOEFAS grant và SBFAS grant (MOEFAS ưu tiên — `withFas` đã encode).
  2. **Tối đa một đơn SBFAS Pending** mỗi học sinh mỗi chu kỳ; đơn nộp lại (attempt 2+) chỉ được tạo
     khi đơn trước đã **Rejected** (decided), có `reapply_reason`, và `supersedes` đúng đơn bị reject.
  3. Đơn SBFAS **lần 1** chỉ sinh ra từ referral của một
     `family_application_children.outcome='moefas_not_granted'` cùng chu kỳ (cả hai kênh như nhau);
     luôn mang `family_app_id` truy về đơn MOE gốc.
- Index: `sbfas_applications(student_id)`, `sbfas_applications(source, status)`,
  `family_application_children(student_id, outcome)`, `family_applications(channel, status)`.
- Không lưu thu nhập chính xác — band thôi (đã là quy tắc của dự án, giữ nguyên).

## 4. Kế hoạch implement trong codebase này

**Giai đoạn 1 — Data model** (`src/data/`)
- `sbfasApplications.ts`: thêm `source`, `familyAppId?`, `parentNotifiedAt?`; port `PAPER_INCOME_BANDS`,
  `PAPER_PCI_INDEX` từ upstream; tag lại seed.
- `familyFas.ts` / file mới `familyApplications.ts`: type `FamilyApplication` + seed chuyển từ `FAMILIES`.
- `fasStore.tsx`: slice `familyApps`; các action mới (giữ reducer thuần như phong cách hiện tại):
  - `submitHardcopy { studentIds, contact, by, at, hasAdminIncome, ocr? }` → tạo FamilyApplication(channel
    hardcopy, entry_mode); chạy **cùng engine xét** như `submitFamily`: band khớp MOEFAS → ghi grant; không khớp →
    **tự tạo** SBFAS app (source "Hardcopy", `familyAppId` link, gợi ý tier qua `suggestionOf`, SLA 10 ngày).
  - `submitSbfasReapply { studentId, by, at, reason, ocr? }` → guard (mục 2.2b) → tạo SBFAS app
    attempt n+1 (`supersedes` = đơn rejected gần nhất, `reapply_reason`).
  - `notifyParent { appId, at, by }` → ghi nhận trường đã báo kết quả cho phụ huynh (AC-029-03).
  - Guard chống trùng liên kênh (mục 2.2a) mở rộng trong cả `submitFamily` lẫn `submitHardcopy`.
- `fasActions.ts`: expose các action trên qua `useFasActions` (đi qua `run()` để repricing phí);
  tách `suggestionOf` (port từ upstream).

**Giai đoạn 2 — UI phía trường** (`src/features/admin/fas/`)
- Tab mới "Hardcopy applications" trong `FasSection` (chỉ role school):
  - **Nút Scan form** (mock OCR): "upload" scan → sau ~2s các trường tự prefill (mock OCR có thể
    sai 1 trường) → staff duyệt từng trường → Submit → đi vào phễu MOE như online.
  - **Form SBFAS nộp lại**: chỉ mở cho học sinh có đơn SBFAS Rejected; bắt buộc lý do nộp lại.
  - Danh sách đơn giấy của trường: kết quả từng trẻ + tick "parent notified" + liên kết attempt trước/sau.
- Form nhập mô phỏng theo section của form thật (mục 2.4): S.I chọn trẻ + liên hệ; S.II bảng hộ khẩu
  **ẩn mặc định**, chỉ mở khi tick "có thu nhập hành chính khác" (kèm giấy tờ); ComCare checkbox;
  S.IV transport; S.VI ghi nhận tờ khai đã ký; đính kèm PDF scan tờ form (US-030, nếu làm Sprint 3).
- Queue SBFAS: cột Source + filter (port từ upstream); `ReviewModal`: thêm dòng Application source
  và (nếu attempt > 1) khối "Resubmission — reason + quyết định reject trước".

**Giai đoạn 3 — UI phía HQ** (`src/features/admin/moefas/Applications.tsx`)
- Đọc `familyApps` từ store thay vì seed tĩnh; cột/channel "Hardcopy — submitted by {school}";
  outcome trẻ rớt hiển thị "Not granted — parent may apply at the school" (kênh hardcopy)
  thay vì "Pending SBFAS review" (kênh e-Service).

**Giai đoạn 4 — Test & tài liệu**
- `fasStore.test.ts`: hardcopy → cấp MOEFAS đúng tier; hardcopy rớt → đơn SBFAS tự sinh có
  `source="Hardcopy"` + `familyAppId`; guard chống trùng **liên kênh** (online rồi paper và
  ngược lại — AC-031); `submitSbfasReapply` (chỉ sau Rejected, bắt lý do, `supersedes` đúng,
  chặn khi còn Pending); `notifyParent` ghi nhận; filter theo source.
- Câu handbook về kênh giấy (upstream đã có mẫu câu).

**Giai đoạn 5 — Đồng bộ upstream**
- master local (35 commits) và upstream đang phân nhánh và **đã chứa một bản hardcopy ngữ nghĩa khác**
  → thống nhất thiết kế trước, merge/rebase sau; giữ cùng tên field (`source`, giá trị enum) để ít conflict.

## 5. Câu hỏi cần chốt trước khi code

1. ~~SBFAS hardcopy có bắt buộc đơn MOE rớt + phụ huynh nộp lần 2 không?~~ **Đã chốt theo AC-029-02**:
   rớt MOEFAS → đơn **tự động** vào queue trường (đồng nhất e-Service). Nếu sau này muốn yêu cầu
   phụ huynh nộp tờ SBFAS riêng, chỉ cần đổi bước referral thành action nhập tay có guard.
2. **Kênh e-Service giữ auto-referral như hiện tại** — đúng AC-024-02/025, không đổi.
3. ~~Chu kỳ xét?~~ **Đã có câu trả lời từ form thật**: mỗi năm học nộp đơn mới, hiệu lực tới hết
   tháng 12 → đã thêm cột `cycle` vào schema; mọi ràng buộc "1 đơn/học sinh" tính theo chu kỳ
   (khớp AC-031 "same period").
4. **Scope trẻ ở trường khác**: form thật cho phép 1 form cho con ở nhiều trường (nộp tại 1 trường,
   trường khác tự liên hệ). Prototype có nên hỗ trợ nhập trẻ ngoài sổ trường không, hay giới hạn
   "chỉ trẻ của trường nhập" cho gọn demo? Đề xuất: giới hạn, ghi chú ASSUMPTION.
5. **Hiệu lực theo tháng** (`effective_from`, ComCare auto-grant, transport subsidy): nên đưa vào
   prototype ở mức nào? Đề xuất: chỉ lưu `effective_from` trên grant; ComCare + transport là
   "nice-to-have" nếu còn thời gian.
6. **Income service lỗi (AC-023-02)**: đơn bị hold + retry — trong prototype nên mock được trạng thái
   này để demo (thêm status `on_hold` cho FamilyApplication).
7. **Giới hạn nộp lại SBFAS sau reject**: cho vô hạn hay chặn sau N lần (đề xuất: hiển thị cảnh báo
   "attempt ≥ 3" cho reviewer nhưng vẫn cho nộp — trường tự quyết)?
8. **Nộp lại SBFAS có xét lại MOEFAS không?** Nếu hoàn cảnh thu nhập thay đổi đáng kể, family có thể
   đủ điều kiện MOEFAS — nên (a) nộp lại chỉ vào SBFAS như mô tả, hay (b) hệ thống chạy lại income
   check + xét MOEFAS trước khi vào queue SBFAS? Đề xuất cho prototype: (a), ghi chú assumption.
9. **Tính đối xứng với e-Service**: phụ huynh online bị reject SBFAS có được nộp lại không?
   Đề xuất: có (cùng guard), nhưng làm ở scope sau nếu thiếu thời gian.

## 6. Vì sao không dùng thẳng thiết kế của upstream

| | Upstream `ea5456d` | Thiết kế này (theo AC của team) |
|---|---|---|
| Đơn giấy đi đâu | Thẳng queue SBFAS trường | Lên MOE, vào phễu MOEFAS **giống hệt** đơn e-Service (AC-029-01) |
| Xét MOEFAS | Không bao giờ | Xét bằng cùng engine band→tier; band xin từ income service kèm ngày (AC-023) |
| Sau khi rớt | (không có khái niệm rớt) | Kết quả rớt được lưu; đơn **tự động** vào queue trường có link đơn MOE (AC-029-02); trường ghi nhận đã báo phụ huynh (AC-029-03) |
| Record đơn gia đình | Không có | `FamilyApplication` thật trong store (HQ thấy được, có audit) |

Giữ lại từ upstream: `source`, `PAPER_INCOME_BANDS`/`PAPER_PCI_INDEX`, `suggestionOf`,
cột Source + filter, UI `HardcopyEntry.tsx` (đổi thành 2 bước).
