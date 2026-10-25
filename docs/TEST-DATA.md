# Database demo để test

Toàn bộ dữ liệu seed của app — dùng để tra cứu khi test. Nguồn thật nằm trong code (`src/data/*.ts`); bản JSON thô kèm theo: `docs/test-data.json`.

| Môi trường | URL |
|---|---|
| **Production (Vercel)** | https://education-account-mock.vercel.app |
| Local dev | `npm run dev` → http://localhost:5173 (môi trường tôi hay chạy: :5199) |

> ⚠️ **State là in-memory**: tải lại trang (F5) = mọi đơn đã nộp/quyết định bị reset về seed gốc. Riêng **Income tiers** và **FAS rules** (màn MOE HQ) lưu trong localStorage nên giữ nguyên qua reload.

## 1. Đăng nhập

Vào `/signin`. Tab **School or MOE staff** điền email + password (màn hình có nút click-to-fill từng tài khoản). Tab **Parent or guardian** bấm "Log in with SingPass" → QR mock tự chạy hết 3 bước là vào.

| Tài khoản | Email | Password | Vai trò |
|---|---|---|---|
| Alicia Tan | `alicia.tan@school.example` | `Sch00l-Demo-26` | Principal — **Greenfield Secondary (S001, cấp 2)** |
| Marcus Ong | `marcus.ong@school.example` | `Sch00l-Admin-26` | School Admin — Greenfield (S001) |
| Priya Nair | `priya.nair@school.example` | `Sch00l-Top-26` | School Admin — Greenfield (S001) |
| Geraldine Rajaratnam | `geraldine.rajaratnam@school.example` | `Sch00l-Demo-26` | School Admin — **Riverbank Primary (S002, cấp 1)** |
| Daniel Lim | `daniel.lim@moe.example` | `HqOfficer-Demo-26` | **MOE HQ Officer** (nhìn toàn hệ thống) |
| Rachel Lim | SingPass `S****567A` | — | Phụ huynh (e-Service portal) — 2 con: Ethan Lim Jun Hao (P5, Riverbank) + Chloe Lim Wen Xin (Sec 2, Greenfield) |

## 2. Hai trường được gán học sinh

Mỗi tài khoản school user **chỉ thấy học sinh trường mình** (queue SBFAS, hardcopy đều lọc theo trường của trẻ):

- **S001 Greenfield Secondary School** — toàn bộ Sec 1–4
- **S002 Riverbank Primary School** — toàn bộ P1–P6

(Còn S003–S012 chỉ là danh sách trường rỗng cho phần quản lý trường/lớp.)

## 3. Bảng học sinh (44 em — NRIC tra cứu khi nhập form giấy)

NRIC dưới đây là mã thật do hệ thống sinh (đúng checksum) — gõ chính xác vậy vào Section I của form hardcopy là hệ thống match được trẻ.

### Greenfield Secondary (đăng nhập Alicia/Marcus/Priya)

| NRIC | Học sinh | Lớp | Class | Status | Balance | SBFAS seed | MOEFAS seed |
|---|---|---|---|---|---|---|---|
| T1203000I | Adrian Pereira | Sec 2 | Sec 2 Aspire | Active | 3.468,10 | Not applied | Not applied |
| T1003137G | Ang Li Ying | Sec 4 | Sec 4 Aspire | Active | 4.436,85 | Not applied | Not applied |
| T1003548H | Bernice Seah Xin Rong | Sec 4 | Sec 4 Bright | Active | 4.502,60 | Not applied | Not applied |
| T1203685F | Chloe Lim | Sec 2 | Sec 2 Bright | Active | 540,25 | Not applied | Not applied |
| **T1203822J** | **Chloe Lim Wen Xin** | **Sec 2** | **Sec 2 Aspire** | Active | 100,00 | Not applied | Not applied |
| T1104370J | Deepa d/o Govindasamy | Sec 3 | Sec 3 Bright | Active | 4.058,70 | Not applied | Not applied |
| T1004918G | Farhan bin Ahmad | Sec 4 | Sec 4 Aspire | Active | 4.379,30 | Not applied | Approved |
| T1205055G | Foo Mei Ling | Sec 2 | Sec 2 Aspire | Active | 3.512,75 | Not applied | Not applied |
| T1105466D | Imran Shah bin Zulkifli | Sec 3 | Sec 3 Aspire | Active | 3.921,00 | Approved | Not applied |
| T1005740F | Joel Soh Wen Jie | Sec 4 | Sec 4 Bright | Inactive | 4.418,95 | Not applied | Not applied |
| T1305877B | Jonathan Lau Kai Xiang | Sec 1 | Sec 1 Bright | Active | 2.993,40 | Approved | Not applied |
| T1206151F | Kwok Yong Sheng | Sec 2 | Sec 2 Bright | Active | 3.541,25 | **Rejected** | Not applied |
| T1106562C | Marcus Heng Zhe Yu | Sec 3 | Sec 3 Bright | Active | 3.874,15 | Not applied | Not applied |
| T1306836J | Mohamed Danish bin Yusof | Sec 1 | Sec 1 Aspire | Active | 2.947,85 | Pending | Pending |
| T1207110D | Nadia binte Jamal | Sec 2 | Sec 2 Bright | Inactive | 3.395,90 | Approved | Not applied |
| T1107795H | Rachel Chia Wen Hui | Sec 3 | Sec 3 Aspire | Active | 3.987,45 | Not applied | Not applied |
| T1308069G | Shreya d/o Nair | Sec 1 | Sec 1 Bright | Active | 3.086,30 | Not applied | Not applied |
| T1308617B | Tay Jing Wen | Sec 1 | Sec 1 Aspire | Active | 3.014,60 | Not applied | Not applied |

### Riverbank Primary (đăng nhập Geraldine)

| NRIC | Học sinh | Lớp | Class | Status | Balance | SBFAS seed | MOEFAS seed |
|---|---|---|---|---|---|---|---|
| T1503274F | Aqil Zafran bin Salleh | P5 | P5 Respect | Inactive | 1.895,35 | Pending | Not applied |
| T1803411A | Arjun s/o Krishnan | P2 | P2 Integrity | Active | 538,15 | Pending | Not applied |
| T1603959J | Chloe Wong Shu Ting | P4 | P4 Harmony | Inactive | 1.604,10 | Not applied | Not applied |
| T1804096J | Chua Jia Hui | P2 | P2 Respect | Active | 612,40 | Not applied | Not applied |
| **T1504233D** | **Daniel Koh Jun Wei** | **P5** | **P5 Integrity** | Active | 1.978,20 | Pending | Not applied |
| **T1504507D** | **Ethan Lim** | **P5** | **P5 Integrity** | Active | 320,50 | Not applied | Not applied |
| **T1504644E** | **Ethan Lim Jun Hao** | **P5** | **P5 Integrity** | Active | 0,00 | Not applied | Not applied |
| T1704781C | Ethan Teo Kai Ming | P3 | P3 Resilience | Active | 1.127,05 | Not applied | Not applied |
| T1605192B | Goh Yu Xuan | P4 | P4 Courage | Active | 1.568,90 | Not applied | Not applied |
| T1605329A | Haziq bin Abdullah | P4 | P4 Harmony | Active | 1.431,60 | Not applied | Approved |
| T1405603Z | Isabelle Ng Pei Shan | P6 | P6 Care | Active | 2.641,15 | Not applied | Not applied |
| T1506014F | Kavitha d/o Raman | P5 | P5 Respect | Active | 2.112,80 | Pending | Not applied |
| T1406288I | Lee Zhi Hao | P6 | P6 Resilience | Inactive | 2.552,00 | Not applied | Not applied |
| T1906425A | Lim Xin Yi | P1 | P1 Harmony | Active | 242,60 | Not applied | Not applied |
| T1806699D | Meera d/o Ramasamy | P2 | P2 Integrity | Active | 574,50 | Pending | Not applied |
| T1806973Z | Muhammad Irfan bin Hakim | P2 | P2 Respect | Inactive | 497,85 | Approved | Not applied |
| T1907247E | Nur Aisyah binte Rahman | P1 | P1 Harmony | Active | 187,90 | Approved | Not applied |
| T1407384H | Nurul Huda binte Ismail | P6 | P6 Resilience | Active | 2.469,25 | Approved | Not applied |
| T1707521C | Ong Zi Han | P3 | P3 Care | Active | 1.043,20 | Not applied | Not applied |
| T1707658I | Priya d/o Subramaniam | P3 | P3 Care | Active | 986,75 | Not applied | Approved |
| T1607932J | Rohan s/o Pillai | P4 | P4 Courage | Active | 1.493,45 | **Rejected** | Not applied |
| T1508206I | Sim Hui Min | P5 | P5 Integrity | Active | 2.036,55 | Not applied | Not applied |
| T1708343G | Siti Nurhaliza binte Osman | P3 | P3 Resilience | Active | 902,30 | Pending | Not applied |
| T1908480E | Tan Wei Jie | P1 | P1 Courage | Active | 214,35 | Not applied | Approved |
| T1408754G | Vikram s/o Chandran | P6 | P6 Resilience | Active | 2.503,70 | Approved | Not applied |
| T1408891H | Yeo Rui En | P6 | P6 Care | Active | 2.587,90 | Not applied | Not applied |

**In đậm** = mấy em hay dùng nhất khi test (xem §5). Lưu ý: **Chloe Lim** và **Ethan Lim** (không có tên đệm) là 2 em khác với **Chloe Lim Wen Xin** / **Ethan Lim Jun Hao** — dễ nhầm khi gõ NRIC.

## 4. Dữ liệu seed sẵn trong hệ thống

### Queue SBFAS review (16 đơn, toàn bộ Pending)

Đơn do MOE referral xuống; trường chỉ thấy đơn của học sinh mình. SLA = ngày làm việc còn lại (0 = trễ).

| Mã | Học sinh | Trường | Band (per person) | Risk | Tier gợi ý | SLA |
|---|---|---|---|---|---|---|
| SBFAS0001 | Kavitha d/o Raman | Riverbank | Up to $450 | 89 | Tier 1 | 1 |
| SBFAS0002 | Foo Mei Ling | Greenfield | Up to $450 | 82 | Tier 1 | 2 |
| SBFAS0003 | Ethan Teo Kai Ming | Riverbank | $451–$700 | 76 | Tier 2 | **0 (trễ)** |
| SBFAS0005 | Yeo Rui En | Riverbank | $701–$1,000 | 54 | Tier 3 | 4 |
| SBFAS0007 | Marcus Heng Zhe Yu | Greenfield | $1,001–$1,500 | 36 | Tier 4 | 7 |
| SBFAS0008 | Goh Yu Xuan | Riverbank | $1,001–$1,500 | 28 | Tier 4 | 5 |
| SBFAS0009 | Lim Xin Yi | Riverbank | $1,001–$1,500 | 18 | Tier 4 | 8 |
| SBFAS0010 | Adrian Pereira | Greenfield | $1,001–$1,500 | 12 | Tier 4 | 9 |
| SBFAS0011 | Sim Hui Min | Riverbank | $451–$700 | 63 | Tier 2 | 2 |
| SBFAS0012 | Arjun s/o Krishnan | Riverbank | $451–$700 | 68 | Tier 2 | 4 |
| SBFAS0013 | Meera d/o Ramasamy | Riverbank | Up to $450 | 85 | Tier 1 | 3 |
| SBFAS0014 | Siti Nurhaliza binte Osman | Riverbank | $701–$1,000 | 47 | Tier 3 | 6 |
| SBFAS0015 | Aqil Zafran bin Salleh | Riverbank | $451–$700 | 72 | Tier 2 | 1 |
| SBFAS0016 | Mohamed Danish bin Yusof | Greenfield | $701–$1,000 | 45 | Tier 3 | 7 |
| SBFAS0017 | Deepa d/o Govindasamy | Greenfield | $451–$700 | 66 | Tier 2 | 5 |
| SBFAS0018 | Daniel Koh Jun Wei | Riverbank | $701–$1,000 | 52 | Tier 3 | 3 |

(Đơn do bạn nộp thêm sẽ tiếp mã SBFAS0019, 0020, …)

### Đơn gia đình đã có trên MOE HQ (màn Applications của HQ)

| Mã | Phụ huynh | Trẻ | Kết quả |
|---|---|---|---|
| FAS20260001 | Rachel Lim | Ethan Lim Jun Hao + Chloe Lim Wen Xin | MOEFAS Granted (cả 2 trẻ) |
| FAS20260002 | Nur Aisyah Binte Abdullah | Adam Muhammad | SBFAS review (không đạt MOEFAS) |
| FAS20260004 | Michelle Tan | Lucas Tan Wei Jie + Emma Tan Hui Min | Mixed outcomes (1 granted, 1 xuống SBFAS) |

(Đơn hardcopy trường nộp sẽ tiếp mã FAS20260005, 0006, …)

### Fee catalogue (MOE)

Tuition $100 (School fee) · Standard miscellaneous $20 · Examination $30 · Supplementary miscellaneous $10. Tier SBFAS: Tier 1 = 100% · Tier 2 = 75% · Tier 3 = 50% · Tier 4 = 25%.

## 5. Form giấy demo — 2 mẫu khi bấm "Upload form PDF" (demo OCR)

### Mẫu 1 · SBFAS band — gia đình Chua (referral xuống queue trường)

| Trường | Giá trị OCR điền sẵn |
|---|---|
| Parent/guardian name (điền sẵn ở Section VI — phần ký; form thật không thu thập tên ở Section I) | Benson Chua |
| Contact | +65 8112 9743 |
| Address | Blk 315 Ang Mo Kio Ave 3, #07-221, Singapore 560315 |
| Email | benson.chua@example.com |
| Trẻ 1 | **T1504644E** — Ethan Lim Jun Hao · Riverbank Primary School · P5 (ở Greenfield login sẽ tag *Other school*) |
| Trẻ 2 | **T1203822J** — Chloe Lim Wen Xin · Greenfield Secondary Schoo (OCR đọc thiếu "l" — sửa tay được) · Sec 2 (*Your school*) |
| Section II | Benson Chua (Father, 44, Employed, gross 2.600, other 0) + Jenny Chua (Mother, 41, Self-employed, gross 1.900, other 120) → band **$1,001–$1,500/person** → referral SBFAS |
| Transport | Public transport |
| Note | Second child entering Sec 1 next year; household income dropped after May. |

### Mẫu 2 · MOEFAS band — gia đình Seah (MOE grant ngay khi submit, không vào queue)

| Trường | Giá trị OCR điền sẵn |
|---|---|
| Parent/guardian name (Section VI — phần ký) | Catherine Seah |
| Contact | +65 9722 4085 |
| Address | Blk 418 Jurong West St 42, #11-107, Singapore 650418 |
| Email | catherine.seah@example.com |
| Trẻ | **T1003548H** — Bernice Seah Xin Rong · Greenfield Secondary School · Sec 4 (*Your school* khi login Greenfield; trẻ không có đơn seeded) |
| Section II | Catherine Seah (Mother, 41, Self-employed, gross 1.300, other 90) → GHI 1.390 ÷ 2 = **S$695/person** → band **Up to $750/person** → **MOEFAS Tier 1 grant ngay khi submit** |
| Transport | Public transport |
| Note | Father passed away in June; the mother runs a hawker stall and also declared dividend income. |

## 6. Kịch năng đã có + kịch bản test nhanh

1. **Flow 1 — form giấy lần đầu**: Alicia → FAS → Hardcopy applications → *Upload form PDF · SBFAS band* → sửa gì cần → *Review the form* (trang đóng băng) → *Submit* (mặc định đi MOE). Kết quả: Chloe vào queue Greenfield, Ethan vào queue Riverbank; tab **Applications** thấy FAS20260005 — bấm vào dòng để xem chi tiết form như đã nộp. Dùng nút *Upload form PDF · MOEFAS band* để demo ngược lại: đơn của Catherine Seah (Bernice Seah Xin Rong, Sec 4) được **MOEFAS Tier 1 grant ngay khi submit** — không tạo đơn trong queue, badge "MOEFAS granted · Tier 1" hiện ở tab Applications và góc nhìn MOE.
2. **Flow 2 — đơn SBFAS mới sau khi bị từ chối**: ở SBFAS review, Reject một đơn (ghi justification) → Hardcopy → New form → *Scan* → Section VII chọn **"Submit to this school's SBFAS review queue"** → nhập *What changed* → bỏ dòng trẻ không đủ điều kiện (ví dụ Ethan còn Pending sẽ bị chặn) → Review → Submit → đơn attempt 2 vào queue + Applications ghi FAS2026xxxx kiểu "New SBFAS request".
3. **Quyết định trong queue**: SBFAS review → Open review → Approve / Override rank / Reject (cần justification). Xem phí được giảm ngay ở Student → Fees.
4. **Báo kết quả cho phụ huynh**: tự động — khi trường quyết (hoặc MOE grant ngay khi nộp), kết quả được gửi SMS/email cho phụ huynh; không cần thao tác thủ công (feature Tell the parent đã bỏ).
5. **Parent e-Service**: Rachel Lim (SingPass) → nộp đơn FAS online cho 2 con, xem invoices, thanh toán.
6. **MOE HQ**: Daniel Lim → Income tiers, FAS rules (FASR26100001 Active), Applications, budgets.

## 7. Vị trí data trong code (sửa seed thì sửa đây)

| Data | File |
|---|---|
| Học sinh + NRIC | `src/data/students.ts` (ROWS + makeNric) |
| Tài khoản | `src/data/users.ts` (STAFF, PARENT) |
| Queue SBFAS seed | `src/data/sbfasApplications.ts` |
| Đơn gia đình seed + tiers/rules | `src/data/moefas.ts` |
| Form OCR demo | `src/features/admin/fas/HardcopyEntry.tsx` (OCR_DEMO) |
| Trường/phân cấp | `src/data/schools.ts`, `src/data/schoolMgmt.ts` |
