import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { HeaderActions } from "../../../components/layout/HeaderActions";
import { ChalkboardTeacher, PencilSimple, Plus } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { useRegistry } from "../../../data/registryStore";
import type { SchoolRecord } from "../../../data/schoolMgmt";
import { assignPrincipal, usersOfSchool } from "../../../data/users";
import SchoolFormModal, { SCHOOL_TYPES } from "./SchoolFormModal";

export default function SchoolMaintenance() {
  const navigate = useNavigate();
  const { state: reg, dispatch } = useRegistry();
  const schools = reg.schools;
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ editing: SchoolRecord | null } | null>(null);
  const [notice, setNotice] = useState("");

  // Memoised: DataTable goes back to page 1 whenever the rows reference changes.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return schools.filter((s) => (!type || s.level === type) && (!needle || `${s.code} ${s.name} ${s.email}`.toLowerCase().includes(needle)));
  }, [schools, type, q]);
  const save = (s: SchoolRecord, principalEmail: string) => {
    const exists = schools.some((x) => x.code === s.code);
    dispatch({ type: "saveSchool", record: s });
    const acct = assignPrincipal(s.code, principalEmail);
    setNotice(`${s.name} was ${exists ? "updated" : "added"}. ${acct.name} is now the Principal.`);
  };

  const columns: Column<SchoolRecord>[] = [
    { key: "code", header: "ID", sortable: true },
    { key: "name", header: "School", sortable: true, render: (s) => (<><span className="font-medium">{s.name}</span><span className="block text-[13px] text-on-surface-variant">{s.level}</span></>) },
    { key: "principal", header: "Principal", sortable: true },
    { key: "users", header: "Users", render: (s) => { const u = usersOfSchool(s.code); return u.length ? u.map((x) => x.title === "Principal" ? `${x.name} (Principal)` : x.name).join(", ") : "Not assigned"; } },
    { key: "email", header: "Contact", sortable: true, render: (s) => (<>{s.email}<span className="block text-[13px] text-on-surface-variant">{s.phone}</span></>) },
    { key: "students", header: "Students", sortable: true, align: "right", render: (s) => s.students.toLocaleString("en-SG") },
    { key: "active", header: "Status", sortable: true, render: (s) => <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "Active" : "Inactive"}</Badge> },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <HeaderActions>
        <Button icon={<Plus size={18} aria-hidden />} onClick={() => setForm({ editing: null })}>Add school</Button>
      </HeaderActions>
      <div role="status" className="empty:hidden">
        {notice && <p className="rounded-control border border-line bg-surface-container-lowest px-4 py-3 text-sm font-medium">{notice}</p>}
      </div>
      <Card>
        <div role="group" aria-label="Filters" className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <Field label="Search by ID or name">
            <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <Field label="School type">
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {SCHOOL_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-2">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(s) => s.code}
            rowActions={(s) => (<><RowAction icon={<ChalkboardTeacher size={16} aria-hidden />} onClick={() => navigate(`/admin/classes?school=${s.code}`)}>Show detail</RowAction><RowAction icon={<PencilSimple size={16} aria-hidden />} onClick={() => setForm({ editing: s })}>Edit</RowAction></>)}
            pageSize={5}
            large
            empty={<EmptyState title="No schools match" hint="Change the search or type filter." />}
          />
        </div>
      </Card>
      {form && <SchoolFormModal key={form.editing?.code ?? "new"} open editing={form.editing} all={schools} onClose={() => setForm(null)} onSave={save} />}
    </div>
  );
}
