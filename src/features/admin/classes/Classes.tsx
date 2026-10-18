import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { HeaderActions } from "../../../components/layout/HeaderActions";
import { PencilSimple, Plus, UsersThree } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { useRegistry } from "../../../data/registryStore";
import { schoolCodeFor } from "../../../data/users";
import { useSession } from "../../../session";
import type { ClassRecord } from "../../../data/schoolMgmt";
import { LEVELS } from "../../../data/students";
import ClassFormModal from "./ClassFormModal";

type Row = ClassRecord & { students: number };

export default function Classes() {
  const { state: reg, dispatch } = useRegistry();
  const classes = reg.classes;
  const count = (name: string) => reg.students.filter((s) => s.class === name).length;
  const navigate = useNavigate();
  const { role } = useSession();
  const hq = role === "hq";
  const mySchool = schoolCodeFor(role);
  // HQ can arrive from the School page with ?school=S001 preset.
  const [params, setParams] = useSearchParams();
  const school = hq ? params.get("school") ?? "" : mySchool ?? "";
  const setSchool = (code: string) => setParams(code ? { school: code } : {}, { replace: true });
  const [level, setLevel] = useState("");
  const [form, setForm] = useState<{ editing: ClassRecord | null } | null>(null);
  const [notice, setNotice] = useState("");

  const rows: Row[] = useMemo(
    () => classes.filter((c) => (!school || c.school === school) && (!level || c.level === level)).map((c) => ({ ...c, students: count(c.name) })),
    [classes, level, school, reg.students],
  );
  const save = (c: ClassRecord) => {
    const exists = form?.editing != null;
    dispatch({ type: "saveClass", editing: form?.editing?.name ?? null, record: c });
    setNotice(`${c.name} was ${exists ? "updated" : "added"}.`);
  };

  const columns: Column<Row>[] = [
    ...(hq ? [{ key: "school", header: "School", sortable: true, render: (c: Row) => reg.schools.find((s) => s.code === c.school)?.name ?? c.school } as Column<Row>] : []),
    { key: "name", header: "Class", sortable: true, render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "level", header: "Level", sortable: true },
    { key: "teacher", header: "Form teacher", sortable: true },
    { key: "room", header: "Room", sortable: true },
    {
      key: "capacity",
      header: "Capacity",
      sortable: true,
      align: "right",
      render: (c) =>
        c.students >= c.capacity ? <Badge tone="warning">{c.students} / {c.capacity} full</Badge> : <span className="tabular-nums">{c.students} / {c.capacity}</span>,
    },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {!hq && (
        <HeaderActions>
          <Button icon={<Plus size={18} aria-hidden />} onClick={() => setForm({ editing: null })}>Add class</Button>
        </HeaderActions>
      )}
      <div role="status" className="empty:hidden">
        {notice && <p className="rounded-control border border-line bg-surface-container-lowest px-4 py-3 text-sm font-medium">{notice}</p>}
      </div>
      <Card>
        <div className="grid gap-4 sm:grid-cols-[repeat(2,minmax(0,16rem))_auto_1fr] sm:items-end">
          {hq && (
            <Field label="School">
              <select className={inputClass} value={school} onChange={(e) => { setSchool(e.target.value); setLevel(""); }}>
                <option value="">All schools</option>
                {reg.schools.map((s) => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Level">
            <select className={inputClass} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All levels</option>
              {LEVELS.filter((l) => { const kind = reg.schools.find((s) => s.code === school)?.level; return !kind || (kind === "Primary") === l.startsWith("P"); }).map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Button className="justify-self-start" variant="secondary" disabled={!level && !(hq && school)} onClick={() => { setLevel(""); if (hq) setSchool(""); }}>Reset filters</Button>
        </div>
        <div className="mt-2">
          <DataTable columns={columns} rows={rows} rowKey={(c) => c.name} rowActions={(c) => (<><RowAction icon={<UsersThree size={16} aria-hidden />} onClick={() => navigate(`/admin/students?class=${encodeURIComponent(c.name)}`)}>View students</RowAction>{!hq && <RowAction icon={<PencilSimple size={16} aria-hidden />} onClick={() => setForm({ editing: c })}>Edit</RowAction>}</>)} pageSize={10} large empty={<EmptyState title="No classes found" hint={hq ? "Change the school or level." : "Add a class or change the school or level."} />} />
        </div>
      </Card>
      {form && !hq && (
        <ClassFormModal
          fixedSchool={mySchool}
          key={form.editing?.name ?? "new"}
          editing={form.editing}
          all={classes}
          enrolled={form.editing ? count(form.editing.name) : 0}
          onClose={() => setForm(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
