import { useState } from "react";
import { Navigate } from "react-router";
import { PencilSimple, Plus } from "@phosphor-icons/react";
import { HeaderActions } from "../../../components/layout/HeaderActions";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { STAFF, saveMoeUser, validateMoeUser, type MoeUserInput, type StaffAccount } from "../../../data/users";
import { HQ_TABS } from "../../../data/nav";
import { useSession } from "../../../session";

// The MOE User tab itself comes with the admin role, not as a permission.
const GRANTABLE = HQ_TABS.filter((t) => t.to !== "/admin/moe-users");

const FORM = "moe-user-form";

/** MOE HQ admin only: manage the other MOE HQ accounts. */
export default function MoeUsers() {
  const { isHqAdmin, staff } = useSession();
  const [form, setForm] = useState<{ editing: StaffAccount | null } | null>(null);
  const [notice, setNotice] = useState("");
  if (!isHqAdmin) return <Navigate to="/admin" replace />;

  const rows = STAFF.filter((s) => s.role === "hq");
  const columns: Column<StaffAccount>[] = [
    { key: "name", header: "Name", sortable: true, render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "email", header: "Email (login)", sortable: true },
    { key: "title", header: "Role", sortable: true, render: (s) => <Badge tone={s.hqAdmin ? "primary" : "neutral"}>{s.title}</Badge> },
    { key: "hqTabs", header: "Permissions", render: (s) => (s.hqAdmin || !s.hqTabs ? "All tabs" : s.hqTabs.length ? <span className="flex flex-wrap gap-1">{GRANTABLE.filter((t) => s.hqTabs!.includes(t.to)).map((t) => <Badge key={t.to} tone="success">{t.label}</Badge>)}</span> : "None") },
    { key: "active", header: "Status", sortable: true, render: (s) => <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "Active" : "Inactive"}</Badge> },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <HeaderActions>
        <Button icon={<Plus size={18} aria-hidden />} onClick={() => setForm({ editing: null })}>Add MOE user</Button>
      </HeaderActions>
      <div role="status" className="empty:hidden">
        {notice && <p className="rounded-control border border-line bg-surface-container-lowest px-4 py-3 text-sm font-medium">{notice}</p>}
      </div>
      <Card>
        <p className="mb-4 text-sm text-on-surface-variant">MOE HQ accounts. Admins can also manage this list.</p>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(s) => s.email}
          rowActions={(s) => <RowAction icon={<PencilSimple size={16} aria-hidden />} onClick={() => setForm({ editing: s })}>Edit</RowAction>}
          pageSize={10}
          large
          empty={null}
        />
      </Card>
      {form && (
        <MoeUserModal
          key={form.editing?.email ?? "new"}
          editing={form.editing}
          isSelf={form.editing === staff}
          onClose={() => setForm(null)}
          onDone={(msg) => { setNotice(msg); setForm(null); }}
        />
      )}
    </div>
  );
}

function MoeUserModal({ editing, isSelf, onClose, onDone }: { editing: StaffAccount | null; isSelf: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const [v, setV] = useState<MoeUserInput>({ name: editing?.name ?? "", email: editing?.email ?? "", hqAdmin: !!editing?.hqAdmin, hqTabs: editing?.hqTabs ?? GRANTABLE.map((t) => t.to) });
  const [active, setActive] = useState(editing?.active ?? true);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateMoeUser(v, editing ?? undefined) : {};

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateMoeUser(v, editing ?? undefined)).length) return;
    // An admin can't demote or deactivate themselves (avoids locking everyone out).
    const acct = saveMoeUser(isSelf ? { ...v, hqAdmin: true } : v, editing ?? undefined);
    if (!isSelf) acct.active = active;
    onDone(`${acct.name} was ${editing ? "updated" : "added"}.`);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : "Add MOE user"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form={FORM}>Save user</Button></>}
    >
      <form id={FORM} onSubmit={submit} noValidate className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field required label="Name" error={errors.name}>
            <input className={inputClass} value={v.name} onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field required label="Email (login)" error={errors.email}>
            <input type="email" className={inputClass} value={v.email} onChange={(e) => setV((p) => ({ ...p, email: e.target.value }))} />
          </Field>
        </div>
        {!isSelf && (
          <>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" className="size-5 accent-primary" checked={v.hqAdmin} onChange={(e) => setV((p) => ({ ...p, hqAdmin: e.target.checked }))} />
              MOE HQ Admin (can manage MOE users)
            </label>
            {!v.hqAdmin && (
              <fieldset className="grid gap-1 rounded-control border border-line p-4">
                <legend className="px-1 text-[13px] font-semibold">Tabs this user can use</legend>
                {GRANTABLE.map((t) => (
                  <label key={t.to} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                    <input type="checkbox" className="size-5 accent-primary" checked={v.hqTabs.includes(t.to)}
                      onChange={() => setV((p) => ({ ...p, hqTabs: p.hqTabs.includes(t.to) ? p.hqTabs.filter((x) => x !== t.to) : [...p.hqTabs, t.to] }))} />
                    {t.label}
                  </label>
                ))}
              </fieldset>
            )}
            {editing && (
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" className="size-5 accent-primary" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Account is active
              </label>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
