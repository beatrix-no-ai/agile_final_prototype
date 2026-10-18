import { useMemo, useState } from "react";
import { PencilSimple, Plus } from "@phosphor-icons/react";
import { HeaderActions } from "../../../components/layout/HeaderActions";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { SCHOOL_RECORDS } from "../../../data/schoolMgmt";
import { MODULES, POSITIONS, STAFF, createSchoolUser, updateSchoolUser, validateUser, type Module, type Position, type StaffAccount, type UserInput } from "../../../data/users";
import { useSession } from "../../../session";

const FORM = "user-form";
const schoolName = (code?: string) => SCHOOL_RECORDS.find((s) => s.code === code)?.name ?? "";
const EMPTY: UserInput = { schoolCode: "", name: "", email: "", position: "School Admin", modules: [] };

/** MOE HQ manages every school user; a Principal manages their own school's users and assigns their modules. */
export default function Users() {
  const { role, staff } = useSession();
  const hq = role === "hq";
  const mySchool = hq ? "" : staff?.schoolCode ?? "";
  const [, bump] = useState(0); // STAFF is mutable module data: re-render after a change
  const [school, setSchool] = useState("");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ editing: StaffAccount | null } | null>(null);
  const [notice, setNotice] = useState("");
  const [creds, setCreds] = useState<{ name: string; email: string; password: string } | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return STAFF.filter((s) => s.role === "school" && (hq ? !school || s.schoolCode === school : s.schoolCode === mySchool) && (!needle || `${s.name} ${s.email}`.toLowerCase().includes(needle)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hq, school, mySchool, q, form, notice]);

  const columns: Column<StaffAccount>[] = [
    { key: "name", header: "Name", sortable: true, render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "email", header: "Email (login)", sortable: true },
    ...(hq ? [{ key: "schoolCode", header: "School", sortable: true, render: (s: StaffAccount) => schoolName(s.schoolCode) } as Column<StaffAccount>] : []),
    { key: "title", header: "Position", sortable: true, render: (s) => <Badge tone={s.title === "Principal" ? "primary" : "neutral"}>{s.title}</Badge> },
    { key: "modules", header: "Modules", render: (s) => (s.modules.length ? <span className="flex flex-wrap gap-1">{s.modules.map((m) => <Badge key={m} tone="success">{m}</Badge>)}</span> : "None") },
    { key: "active", header: "Status", sortable: true, render: (s) => <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "Active" : "Inactive"}</Badge> },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <HeaderActions>
        <Button icon={<Plus size={18} aria-hidden />} onClick={() => setForm({ editing: null })}>Add user</Button>
      </HeaderActions>
      <div role="status" className="empty:hidden">
        {notice && <p className="rounded-control border border-line bg-surface-container-lowest px-4 py-3 text-sm font-medium">{notice}</p>}
      </div>
      <Card>
        <p className="mb-4 text-sm text-on-surface-variant">
          {hq ? "Each school has one Principal and any number of School Admins. MOE HQ creates the accounts." : "Give each School Admin the modules they can use. You can also add admins, reset passwords and deactivate accounts."}
        </p>
        <div role="group" aria-label="Filters" className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <Field label="Search by name or email">
            <input type="search" className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          {hq && (
            <Field label="School">
              <select className={inputClass} value={school} onChange={(e) => setSchool(e.target.value)}>
                <option value="">All schools</option>
                {SCHOOL_RECORDS.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div className="mt-2">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(s) => s.email}
            rowActions={(s) => <RowAction icon={<PencilSimple size={16} aria-hidden />} onClick={() => setForm({ editing: s })}>{hq || s.title !== "Principal" ? "Edit" : "View"}</RowAction>}
            pageSize={10}
            large
            empty={<EmptyState title="No users found" hint="Change the search or school filter, or add a user." />}
          />
        </div>
      </Card>
      {form && (
        <UserFormModal
          key={form.editing?.email ?? "new"}
          editing={form.editing}
          hq={hq}
          mySchool={mySchool}
          self={staff}
          onClose={() => setForm(null)}
          onDone={(msg, c) => { setNotice(msg); if (c) setCreds(c); bump((n) => n + 1); setForm(null); }}
        />
      )}
      <Modal open={!!creds} onClose={() => setCreds(null)} title="User login" footer={<Button onClick={() => setCreds(null)}>I have noted it</Button>}>
        {creds && (
          <div className="grid gap-3 text-sm">
            <p>Give these details to <strong>{creds.name}</strong>. The password is shown only once.</p>
            <dl className="grid gap-2 rounded-control border border-line bg-surface-container-low p-4">
              <div><dt className="text-[13px] text-on-surface-variant">Login email</dt><dd className="font-semibold">{creds.email}</dd></div>
              <div><dt className="text-[13px] text-on-surface-variant">One-time password</dt><dd className="font-mono text-lg font-bold">{creds.password}</dd></div>
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
}

type FormProps = {
  editing: StaffAccount | null; hq: boolean; mySchool: string; self: StaffAccount | null;
  onClose: () => void; onDone: (msg: string, creds?: { name: string; email: string; password: string }) => void;
};

function UserFormModal({ editing, hq, mySchool, self, onClose, onDone }: FormProps) {
  const [v, setV] = useState<UserInput>(editing
    ? { schoolCode: editing.schoolCode ?? "", name: editing.name, email: editing.email, position: editing.title as Position, modules: [...editing.modules] }
    : { ...EMPTY, schoolCode: hq ? "" : mySchool });
  const [active, setActive] = useState(editing?.active ?? true);
  const [reset, setReset] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateUser(v, editing ?? undefined) : {};
  // Only MOE HQ can create or reassign a Principal; a Principal's own record is read-only for them.
  const readOnly = !hq && editing?.title === "Principal";
  const isPrincipal = v.position === "Principal";
  const isSelf = !!editing && editing === self;
  const set = (k: "name" | "email") => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (m: Module) => setV((p) => ({ ...p, modules: p.modules.includes(m) ? p.modules.filter((x) => x !== m) : [...p.modules, m] }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return onClose();
    setSubmitted(true);
    if (Object.keys(validateUser(v, editing ?? undefined)).length) return;
    if (editing) {
      updateSchoolUser(editing, v, reset);
      if (!isSelf) editing.active = active;
      onDone(`${editing.name} was updated.`, reset ? { name: editing.name, email: editing.email, password: editing.password } : undefined);
    } else {
      const acct = createSchoolUser(v);
      onDone(`${acct.name} was added to ${schoolName(acct.schoolCode)}.`, { name: acct.name, email: acct.email, password: acct.password });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `${readOnly ? "" : "Edit "}${editing.name}` : "Add user"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</Button>
          {!readOnly && <Button type="submit" form={FORM}>Save user</Button>}
        </>
      }
    >
      <form id={FORM} onSubmit={submit} noValidate className="grid gap-4">
        <Field required label="School" error={errors.schoolCode} hint={hq ? undefined : "Your school"}>
          <select className={inputClass} value={v.schoolCode} disabled={!hq || !!editing} onChange={(e) => setV((p) => ({ ...p, schoolCode: e.target.value }))}>
            <option value="">Select school</option>
            {SCHOOL_RECORDS.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field required label="Name" error={errors.name}>
            <input className={inputClass} value={v.name} readOnly={readOnly} onChange={set("name")} />
          </Field>
          <Field required label="Email (login)" error={errors.email}>
            <input type="email" className={inputClass} value={v.email} readOnly={readOnly} onChange={set("email")} />
          </Field>
        </div>
        <Field required label="Position" error={errors.position} hint={hq ? "One Principal per school." : undefined}>
          <select className={inputClass} value={v.position} disabled={!hq} onChange={(e) => setV((p) => ({ ...p, position: e.target.value as Position }))}>
            {POSITIONS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <fieldset className="grid gap-1 rounded-control border border-line p-4">
          <legend className="px-1 text-[13px] font-semibold">Modules this user can use</legend>
          {MODULES.map((m) => (
            <label key={m} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" className="size-5 accent-primary" checked={isPrincipal || v.modules.includes(m)} disabled={isPrincipal || readOnly} onChange={() => toggle(m)} />
              {m}
            </label>
          ))}
          {isPrincipal && <p className="text-[13px] text-on-surface-variant">The Principal can use every module.</p>}
        </fieldset>
        {editing && !readOnly && (
          <>
            {!isSelf && (
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" className="size-5 accent-primary" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Account is active
              </label>
            )}
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" className="size-5 accent-primary" checked={reset} onChange={(e) => setReset(e.target.checked)} />
              Issue a new one-time password
            </label>
          </>
        )}
      </form>
    </Modal>
  );
}
