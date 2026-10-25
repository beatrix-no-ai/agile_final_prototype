# Demo cheat sheet

The mock data is already in `src/data/` (40 students, schools, fees, FAS applications, parent account). Open these accounts under Admin > Students to show each case.

| Case | Student | Level | Enrolment | Balance | SBFAS |
|---|---|---|---|---|---|
| New account, just opened (age 7) | Tan Wei Jie | P1 | Enrolled | $214.35 | Not applied |
| Active, SBFAS pending | Arjun s/o Krishnan | P2 | Enrolled | $538.15 | Pending |
| Not enrolled, SBFAS approved | Muhammad Irfan bin Hakim | P2 | Not Enrolled | $497.85 | Approved |
| SBFAS rejected | Rohan s/o Pillai | P4 | Enrolled | $1,493.45 | Rejected |
| SBFAS approved | Kavitha d/o Raman | P5 | Enrolled | $2,112.80 | Approved |
| Closed at 16, balance to CPF | Ang Li Ying | Sec 4 | Enrolled | $4,436.85 | Not applied |
| Closed and not enrolled | Joel Soh Wen Jie | Sec 4 | Not Enrolled | $4,418.95 | Not applied |

Sec 4 accounts show **Not active** with a Closed date (16th birthday). All other levels show **Active** with Closed "—". Date of birth and Opened are derived mock values.

Suggested flow: HQ login > Students > open Tan Wei Jie (card) > Top up > switch to Parent portal > Overview > pay an outstanding fee.

## AI assistant (Req 8, extra)

Parent portal > button "Ask MOE Assistant" (bottom right). Mock only: canned answers, nothing leaves the browser.

- Try: "How do I pay a fee?" (one follow-up, then steps), "Check my child's balance" (redirects, never shows figures), "Am I eligible for FAS?" (declined), "Talk to a person".
- FAS auto-fill: "Apply for FAS" > pick people at home > "Skip for now" shows a blank, highlighted field > "Fill the form". The assistant never submits or ticks the consent box.
- Outage demo: open any parent page with `&ai=down` in the URL.
