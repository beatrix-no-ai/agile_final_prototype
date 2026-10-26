import type { FamilyDraft } from "../../../data/familyApplications";

// The printable pre-filled MOE FAS form (Sprint 3 refinement — Sherly's print-first flow): everything
// the registry knows is printed for the parent to CHECK; the household table and the declaration are
// left blank for the parent to fill and sign. Printed through a popup window so the app shell (sidebar,
// header, tabs) never lands on paper. Mock: real paper forms are PDF-generated; this renders the same
// content as HTML.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1512; margin: 32px auto; max-width: 760px; font-size: 13px; line-height: 1.45; }
  h1 { font-size: 17px; margin: 0; }
  .crest { width: 34px; height: 34px; border-radius: 50%; background: #8a2538; color: #fff; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; }
  header { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #8a2538; padding-bottom: 10px; }
  header .sub { font-size: 12px; color: #5e5658; margin-top: 2px; }
  .notice { background: #f8f6f6; border: 1px solid #e4dddd; border-radius: 6px; padding: 10px 12px; margin: 14px 0; }
  .notice b { color: #8a2538; }
  h2 { font-size: 13px; margin: 20px 0 8px; color: #8a2538; text-transform: uppercase; letter-spacing: 0.4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #c9bfbf; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 12px; }
  th { background: #f3eceb; font-weight: bold; }
  .blank td { height: 26px; }
  .kv { margin: 6px 0; }
  .kv b { display: inline-block; min-width: 130px; font-weight: bold; }
  .check { margin: 6px 0 2px; }
  .box { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #1a1512; margin-right: 8px; vertical-align: -2px; }
  ul { margin: 6px 0; padding-left: 18px; }
  .sign { margin-top: 26px; display: flex; gap: 40px; }
  .sign div { flex: 1; border-top: 1.5px solid #1a1512; padding-top: 5px; font-size: 12px; color: #5e5658; }
  footer { margin-top: 26px; border-top: 1px solid #e4dddd; padding-top: 8px; font-size: 11px; color: #5e5658; }
  @media print { body { margin: 0; } }
`;

/** The form as handed to the parent: registry fields pre-filled, the household table empty. */
export function draftHtml(d: FamilyDraft, schoolName: string): string {
  const rows = d.children
    .map((c) => `<tr><td>${esc(c.nric)}</td><td>${esc(c.name)}</td><td>${esc(c.school)}</td><td>${esc(c.level)}</td></tr>`)
    .join("");
  const issued = new Date(d.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `<!doctype html><html><head><meta charset="utf-8"><title>MOE FAS form · ${esc(d.id)}</title><style>${STYLE}</style></head><body>
<header><span class="crest">MOE</span><div><h1>Ministry of Education — Financial Assistance Scheme (FAS)</h1>
<div class="sub">Application form, pre-filled for the family · issued by ${esc(schoolName)} · ${esc(d.id)} · ${issued}</div></div></header>

<div class="notice"><b>For the parent / guardian:</b> this form was pre-filled by ${esc(schoolName)} from the MOE registry on ${issued}.
Check every pre-filled field. If anything is wrong, tell the school office — <b>do not amend the pre-filled fields yourself</b>.
Then fill in Section II (household income), read the declaration and sign.</div>

<h2>Section I — Particulars of the child</h2>
<table><tr><th>BC/NRIC No.</th><th>Name (Underline Surname)</th><th>Name of Current School</th><th>Current Level</th></tr>${rows}</table>
<p class="kv"><b>Parent / guardian:</b> ${esc(d.applicant)}</p>
<p class="kv"><b>Contact number:</b> ${esc(d.contact)}</p>
<p class="kv"><b>Home address:</b> ${esc(d.address)}</p>
${d.email ? `<p class="kv"><b>Email:</b> ${esc(d.email)}</p>` : ""}

<h2>Section II — Household income</h2>
<p class="kv"><b>Extra monthly money (S$):</b> ____________</p>
<p style="font-size:11px; color:#5e5658; margin: 2px 0 10px;">Income not in HOMES, e.g. rental, allowance or family support. Enter 0 if none.</p>
<p class="kv"><b>People currently living in your home:</b> ____________</p>
<p style="font-size:11px; color:#5e5658; margin: 2px 0 0;">Everyone who lives with you now, including you.</p>
<p style="font-size:12px; color:#5e5658; margin-top:10px;">The income band itself is retrieved from HOMES (IRAS + CPF) — you never need to state your exact income here.</p>

<h2>Section III — Declaration and agreement by the applicant</h2>
<ul>
<li>No child on this form receives financial assistance from more than one MOE-funded school or institution.</li>
<li>The applicant authorises monthly withdrawals from the child's Edusave account for school fees and approved expenses while on MOE FAS.</li>
<li>MOE and the schools may verify the information, reassess the household, and share the data needed to administer the scheme.</li>
<li>The information given is true — false information is an offence under Section 182 of the Penal Code 1871.</li>
</ul>
<div class="sign"><div>Signature of applicant</div><div>Name: ${esc(d.applicant)}</div><div>Date</div></div>

<footer>School use only — form issued under ${esc(d.id)} by ${esc(d.issuedBy)}. When the signed form is returned, hand it to the school
office: the staff keys it in against this draft and checks every field.</footer>
</body></html>`;
}

/** Opens the form in a print window. Returns false when the browser blocked the popup. */
export function openDraftPrint(d: FamilyDraft, schoolName: string): boolean {
  const w = window.open("", "_blank", "width=880,height=1000");
  if (!w) return false;
  w.document.write(draftHtml(d, schoolName));
  w.document.close();
  w.focus();
  w.print();
  return true;
}
