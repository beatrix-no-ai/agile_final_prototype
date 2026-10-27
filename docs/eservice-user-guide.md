# MOE e-Service: Parent User Guide

> **Purpose.** This guide is the single source of truth for the parent e-Service *and* for the MOE Assistant (chatbot).
> Part A is written for parents. Part B maps it to the chatbot so answers can be checked, extended and tuned.
>
> **Rule for maintainers:** if a screen changes, update Part A first, then the matching answer in `src/data/assistant.ts`.
> Every section has an ID (e.g. `[PAY-01]`). Chatbot answers should cite the section ID they come from.
>
> Based on the prototype as of 26 Oct 2026. Items marked *(assumption)* are mock behaviour that still needs a business decision.

---

## Part A — Parent guide

### [GEN-01] What the e-Service is

The e-Service is the parent and guardian portal for MOE school fees. In it you can:

- see what you owe for each child and pay it,
- see each child's Education Account balance and transactions,
- apply for Financial Assistance (FAS) for the whole family,
- keep your contact details up to date.

The menu on the left has five pages: **Overview**, **Payments**, **Transactions**, **Financial Assistance Scheme** and **Settings**.

### [GEN-02] Your children

Children appear automatically once their Education Account is opened (at age 7). You do not add them yourself. If a child is missing, the portal shows "No children linked". Contact the school or MOE (see [HELP-01]).

---

### [OV-01] Overview page

The first page after sign-in. From top to bottom:

| Card | What it shows |
|---|---|
| **Amount to pay** | The total of all unpaid and overdue invoices, how many there are, and how many are overdue (in red). A **Pay now** button pays all of them. |
| Education Account note | How much the children's Education Accounts will cover automatically, and how much is left to pay by card or bank. |
| **Next payment due** | The earliest upcoming due date and the amount due that day. |
| **Paid this year** | Total of invoices already paid. |
| **Invoices to pay** | Up to 5 open invoices, overdue first. Each has its own **Pay** button. |
| **Your children** | Per child: level, school, Education Account balance, amount to pay, and a badge: *Paid up*, *Payment due* or *Overdue*. |
| **Financial assistance (FAS)** | Your application status: *Not started*, *In progress*, *Pending*, *Granted* or *Declined*. |
| **Recent transactions** | The last 5 account movements. |
| **Your details** | Name, contact number and mailing address. |

---

### [PAY-01] How paying works (the one rule)

There is **one way to pay**, and you do not need to choose a method:

1. Each child's **Education Account is used first**, but only for that child's own invoices.
2. **Whatever is left** is paid by **card or bank** through the payment gateway.
3. **Part payment is possible:** you can pay only some of your invoices, and if a child's Education Account balance covers only part of an invoice, the account pays that part and the rest goes by card or bank.

If the Education Account covers everything, no card or bank payment is needed.

### [PAY-02] Paying fees, step by step

1. Open **Payments**.
2. Tick the invoice(s) you want to pay, or tick **Select all unpaid and overdue**.
3. Check the **Payment summary** on the right (on a phone, the total is in the bar at the bottom). It shows:
   - the total per child,
   - **From Education Account**,
   - **By card or bank**.
4. Press **Pay** (or **Pay now** on a phone).
5. The **Confirm your payment** window shows the total and the split again. Press **Pay $X** (or **Confirm payment** if the account covers it all). Press **Cancel** to go back without paying.
6. Wait for *Processing payment*. Do not close the window.
7. You see **Payment successful**. Press **Done**. A green message at the top confirms the amount and number of invoices, and the payment appears in **Transactions**.

You can also pay from the Overview: **Pay now** (all open invoices) or **Pay** next to one invoice.

### [PAY-03] Reading the invoice list

- Invoices are sorted **overdue first**, then **unpaid by due date**, then **Already paid** (greyed out, cannot be ticked).
- Each row shows the fee name, the child, the invoice number, the amount and a due line, for example *Due in 19 days*, *Due today* or *Overdue by 12 days*.
- Amounts are what you still owe **after any FAS subsidy**.
- The **Education Account balances** box at the top shows each child's balance and, once you tick invoices, "Using $X for this payment".

### [PAY-04] When a payment fails

You see **Payment not completed — The gateway declined this payment**.

- **Nothing was charged** and your invoices are unchanged.
- Press **Try again** to go back to the confirmation, or **Close**.

### [PAY-05] Overdue invoices

An invoice is *overdue* when its due date has passed and it is not paid. It is shown in red on the Overview and Payments pages. Pay it the same way as any other invoice ([PAY-02]).

---

### [ACC-01] Education Account balance

Each child has their own Education Account. You can see the balance:

- on **Overview**, under **Your children**,
- at the top of **Payments**, under **Education Account balances**.

The balance goes down when it is used to pay that child's invoices, and up when MOE tops it up or a refund is made. A child's balance is never used for a sibling's fees.

### [TX-01] Transactions page

The **Transactions** page has two tabs at the top: **Transactions** and **Invoices**.

**Transactions tab** — the full record of top-ups, payments and refunds of your children's Education Accounts, and the fees paid by card, newest first. Columns: **Date, Description, Student, Method, Amount**.

- Credits (top-ups, refunds) show in green with **+**.
- Payments show with **−** and read "Payment for *fee name*".
- **Method** is *Education account*, *Card* or *MOE top-up*.
- When one invoice is paid partly from the account and partly by card, it appears as **two rows**. Only the *Education account* row changes the balance.

### [TX-02] Filtering transactions

Above the list you can narrow it down with:

| Filter | Options |
|---|---|
| **Child** | All children, or one child |
| **Transaction type** | All types, Top-ups and refunds, Payments |
| **From** / **To** | A date range (either end can be left blank) |

If nothing matches you see "No transactions found". Change or clear a filter to see more.

### [TX-03] Paid invoices and invoice details

**Invoices tab** — the fee invoices of your children that are **fully paid**, latest due date first. Each row shows the fee name, child, original due date, invoice number, a **Paid** badge and the amount. Use the **Child** filter to show one child only. (Unpaid invoices are on **Payments**, see [PAY-03].)

Press **View details** to open the invoice:

- **Header:** Ministry of Education, invoice number and status.
- **Bill to:** Parent/Guardian of *child*, school, level and class.
- **Bill date** (when it was issued) and **Due date**.
- **Details of charges:** each fee item with **Amount**, **Subsidy** (FAS), **Paid** and **Outstanding**.
- **Payments:** each payment made on the invoice, with date and method (Education account or Card / PayNow).

Close it with the **×** button or Esc. There is no PDF download yet.

---

### [FAS-01] What FAS is

The Financial Assistance Scheme helps lower-income families with school fees. There are two schemes:

- **MOEFAS** — granted **automatically** when the household meets the criteria. School and miscellaneous fees are waived in full.
- **SBFAS** (school-based) — for families not in a MOEFAS band. **Your child's school decides.** If granted, a percentage of each school fee is waived.

**MOEFAS takes precedence:** SBFAS is only considered if MOEFAS is not granted, so a child never gets both.

**One application covers all your children.**

### [FAS-02] Your household and income band

The **Household** card lists you, your spouse and your children, plus your **household income band**.

- The band comes from **HOMES**. MOE only receives a **band** (e.g. "$1,001 – $1,500 per person"), never your exact income.
- The card shows when it was last synced.

*(assumption)* Current bands: up to $750 per person (MOEFAS Tier 1), $751–$1,000 (MOEFAS Tier 2), $1,001–$1,500 (SBFAS), above $1,500 (not eligible for either).

### [FAS-03] Applying for FAS, step by step

1. Open **Financial Assistance Scheme**.
2. Check the **Household** card.
3. Press **Start FAS application**.
4. Fill in **Your FAS application**:

   | Field | Required | What to enter |
   |---|---|---|
   | Extra monthly money (S$) | Yes | Income not in HOMES, e.g. rental, allowance, family support. Enter **0** if none. |
   | People currently living in your home | Yes | Everyone who lives with you now, including you. Whole number 1–20. |
   | Contact number | Yes | Singapore number, e.g. +65 9123 4567. Pre-filled from your profile. |
   | Mailing address | Yes | Pre-filled from your profile. |
   | Anything else the bursar should know? | No | Free text. |
   | Supporting documents | No | Payslips, retrenchment letter, medical bills. PDF, JPG or PNG, up to 5 MB each. |

5. Read the **Declaration**.
6. Tick the **consent** box (agreeing to MOE retrieving your income band from HOMES and sharing the application with your children's schools). The **Submit application** button stays disabled until you tick it.
7. Press **Submit application**.

Need help? Press **Help me fill this in** and the MOE Assistant will ask two questions and pre-fill the form ([BOT-03]).

### [FAS-04] Form errors

If something is missing or wrong, the form jumps to the first problem and shows a message:

| Message | Fix |
|---|---|
| Enter an amount in dollars, or 0 if none. | Type a number such as 0, 300 or 250.50. |
| Enter a whole number from 1 to 20. | Type the number of people, no decimals. |
| Enter a valid Singapore number, e.g. +65 9123 4567. | 8 digits starting with 3, 6, 8 or 9, optional +65. |
| Enter a mailing address. | Fill in the address. |
| Tick the box to consent before submitting. | Tick the consent box. |

### [FAS-05] Tracking your application

The **Application status** tracker has three steps:

1. **Prepare info** — in progress once you start the form.
2. **Submission** — done when you submit. The reference number (e.g. FAS-2026-0418) and date appear.
3. **Disbursement** — starts after MOE reviews the application; done when every child's result is decided.

After submitting, **Result per child** shows one of:

| Badge | Meaning |
|---|---|
| **MOEFAS Tier 1/2 – Granted** | Granted automatically. School and miscellaneous fees waived in full. |
| **SBFAS – Pending** | Your child's school is deciding. |
| **SBFAS – Granted** | A percentage of each school fee is waived. Unpaid invoices are updated automatically. |
| **SBFAS – Declined** | The school did not grant SBFAS (a reason may be shown). |
| **Not eligible** | Income band is above both schemes. Speak to the school if your situation has changed. |

Overall status on the Overview: **Pending** while any child waits on the school, otherwise **Granted** if at least one child got assistance, otherwise **Declined**.

You can only submit one family application. Once submitted there is nothing more to fill in.

---

### [SET-01] Updating your details

1. Open **Settings**.
2. On **Your details**, press **Edit**.
3. Change any of: **Residential address**, **Mailing address**, **Contact number**.
4. Press **Save changes**. You see *Details updated*.

Rules:

- Addresses must include the **6-digit postal code**.
- Contact number: Singapore number, 8 digits starting with 3, 6, 8 or 9 (optional +65; spaces and hyphens are ignored).
- **Name and NRIC/FIN cannot be changed here.** They come from SingPass.

*(assumption)* Which fields parents may edit is still an open question.

---

### [HELP-01] Talking to a person

Press **Talk to a person** at the bottom of the MOE Assistant, or ask it to. *(assumption — contact not confirmed)*
MOE Customer Service: 1800 000 0000, Monday to Friday, 8.30am to 5.30pm.

---

## Part B — Chatbot reference

### [BOT-01] What the assistant may and may not do

| Does | Does not |
|---|---|
| Explain how to use the portal (paying, account, transactions, details, FAS). | Read or state account figures (balances, amounts owed, eligibility, grant amounts). It points to the page instead. |
| Link to the right page. | Answer anything outside the portal. It offers *Talk to a person*. |
| Pre-fill the FAS form from the profile plus two answers. | Submit the form, tick the consent box, or upload documents. |
| Ask **at most one** follow-up before answering. | Accept ID numbers or bank details. If the user types an NRIC-like value or a 12+ digit number, it refuses and does not repeat it. |
| Cite a source on every factual answer. | Guess. If no intent matches it gives the out-of-scope reply. |

Interface rules: header says *AI · English*; banner warns "AI can make mistakes… Don't type ID numbers or bank details"; each answer has 👍/👎 rating; **New chat** resets; if the assistant is down (`?ai=down`), it says so and offers *Try again* and *Fill in the form myself*.

### [BOT-02] Intent map

Each intent → the answer key in `src/data/assistant.ts` → the guide section it must agree with.

| Intent | Answer key | Guide section | Example user phrasings (use as test cases) |
|---|---|---|---|
| How to pay | `pay` | PAY-01, PAY-02 | "How do I pay a fee?", "pay school fees", "where do I pay the bill" |
| Payment method / not enough balance | `payShort` | PAY-01 | "Can I pay by PayNow?", "my account balance is too low", "pay by card" |
| Payment failed | `payFailed` | PAY-04 | "payment failed", "my payment didn't go through", "card declined" |
| What do I owe | `outstanding` | PAY-03, PAY-05 | "what do I have to pay", "outstanding fees", "unpaid invoices" |
| Balance | `balance` | ACC-01 | "check my child's balance", "how much money is in the education account" |
| Transactions / receipts | `transactions` | TX-01, TX-02, TX-03 | "transaction history", "can I get a receipt", "statement", "show my paid invoices", "filter by date" |
| Update details | `details` | SET-01 | "update my address", "change phone number", "mailing address" |
| FAS status | `fasStatus` | FAS-05 | "FAS status", "where is my FAS application", "FAS result" |
| FAS eligibility | `fasEligibility` | FAS-01 | "am I eligible for FAS?", "how much FAS will I get" |
| Apply for FAS (guided) | flow in `engine.ts` | FAS-03 | "Apply for FAS", "help me fill the FAS form" |
| FAS already submitted | `fasSubmitted` | FAS-05 | "apply for FAS" after submission |
| Human | `HUMAN` | HELP-01 | "talk to a person", "I want to complain", "contact MOE" |
| Out of scope | `outOfScope()` | BOT-01 | "what's the weather", "school holidays" |

### [BOT-03] Guided FAS fill (conversation script)

1. User asks to apply → if already submitted, reply `fasSubmitted` and stop.
2. Bot: "I'll use the details already on your profile and only ask for what is missing…"
3. Q1: "How many people live in your home now, including you?" — chips: (children + 1), (children + 2), (children + 3). Invalid → "Please give a whole number from 1 to 20."
4. Q2: "Is there other monthly money that MOE would not already have…?" — chips: *None* (→ 0), *Skip for now* (→ blank). Invalid → "Please type an amount in dollars (for example 300)…"
5. Bot shows a **draft card**: each field labelled *From your answer*, *From your profile* or *Missing, please fill*.
6. User presses **Fill the form** → form opens pre-filled; filled fields tagged *AI-filled, please check*; blank fields highlighted.
7. Bot: "Please check every field, tick the consent box yourself and press Submit… I can't submit for you."

"start over", "cancel" or "stop" during the flow restarts it.

### [BOT-04] Gaps found — questions this guide answers but the bot can't yet

Use these to extend `ANSWERS` and the router. Each line: question → guide section → suggested fix.

| # | Parent question | Guide | Current bot behaviour | Suggested fix |
|---|---|---|---|---|
| G1 | "My child isn't showing" | GEN-02 | Out of scope | Add `missingChild` answer → HELP-01. |
| G2 | "What does overdue mean?" | PAY-05 | Out of scope | Add `overdue` answer. |
| G3 | "Why does one payment show twice in Transactions?" | TX-01 | `transactions` (partly covers) | Add the two-row explanation. |
| G4 | "Can my son's account pay my daughter's fees?" | ACC-01 | Routes to `balance` or `pay` by keyword luck | Add explicit line; already in `payShort`, route "sibling/other child" there. |
| G5 | "What documents do I need for FAS?" | FAS-03 | Starts the FAS fill flow (any "fas" message does) | Route "document/upload/payslip" to a `fasDocs` answer before `startFas`. |
| G6 | "What is HOMES / why do you need my income?" | FAS-02 | Starts the FAS flow | Add `fasHomes` answer. |
| G7 | "What's the difference between MOEFAS and SBFAS?" | FAS-01 | Starts the FAS flow | Add `fasSchemes` answer. |
| G8 | "How is my FAS subsidy applied to my fees?" | FAS-05, PAY-03 | "subsid" → starts the FAS flow | Route subsidy + fee/invoice to a short answer. |
| G9 | "Can I change my FAS application after submitting?" | FAS-05 | `fasSubmitted` if submitted, else starts flow | Decide policy, then add answer. |
| G10 | "Why can't I change my name?" | SET-01 | `details` only if "profile/update my" appears | Add "name", "nric" keywords to `details`. |
| G11 | "Why is the Submit button greyed out?" | FAS-03 step 6 | Out of scope | Add `fasConsent` answer. |
| G12 | Non-English questions | — | Out of scope (English only) | Decide language support. |

**Router pitfall:** any message containing "fas" or "subsid" that is not about status/eligibility starts the guided fill (`engine.ts` `route`). Add specific FAS-info intents *above* that branch.

### [BOT-05] How to refine the bot with this guide

1. **Ground every answer.** Each `ANSWERS` entry's `source` should name a guide ID (e.g. `"Help: Paying fees [PAY-02]"`). An answer with no matching section is either wrong or the guide is missing something.
2. **Test from the phrasings column.** Each example in [BOT-02] is a test case for `engine.test.ts`: input → expected answer key.
3. **Close gaps.** Work through [BOT-04]; for each, write the answer from the guide text, add keywords to `route`, add a test.
4. **Review 👎 ratings.** For each downvoted answer: is the guide wrong (fix Part A), the answer wrong (fix `assistant.ts`), or the routing wrong (fix `engine.ts`)?
5. **Keep it short.** Answers should be 1–3 sentences plus steps. Copy wording from Part A so the bot and the screen say the same thing.
6. **If moving to a real LLM:** feed Part A as the retrieval corpus (one chunk per `[ID]` section), feed [BOT-01] as the system-prompt rules, and keep [BOT-02] phrasings as the evaluation set.

### [BOT-06] Open questions to resolve with the business

- Human escalation contact and hours (HELP-01, AI-07).
- Which profile fields parents may edit (SET-01).
- Real income bands and tier cut-offs (FAS-02).
- Whether invoices should be downloadable as PDF (TX-03).
- Whether a submitted FAS application can be amended or withdrawn (G9).
- Languages to support (G12).
