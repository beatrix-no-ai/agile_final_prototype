import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Eye, UsersThree } from "@phosphor-icons/react";
import { AssumptionTag } from "../../../components/ui/AssumptionTag";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { useRegistry } from "../../../data/registryStore";
import type { School } from "../../../data/schools";
import { useSession } from "../../../session";
import { filterSchools } from "./logic";

export default function SchoolRegistry() {
  const { startSimulation } = useSession();
  const { state: reg } = useRegistry();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  // Memoised: DataTable resets to page 1 whenever the rows reference changes.
  const rows = useMemo(() => filterSchools(reg.schools, q), [reg.schools, q]);

  const simulate = (as: "school" | "parent", name?: string) => {
    startSimulation(as, name);
    navigate(as === "school" ? "/admin" : "/parent");
  };

  const columns: Column<School>[] = [
    { key: "code", header: "ID", sortable: true },
    { key: "name", header: "School", sortable: true, render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "level", header: "Level", sortable: true },
    { key: "students", header: "Students", sortable: true, align: "right", render: (s) => s.students.toLocaleString("en-SG") },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-on-surface-variant">
          View the system exactly as a School user or a Parent sees it. Simulation is read-only: nothing you do is saved.
        </p>
        <div className="flex items-center gap-3">
          <AssumptionTag>open question</AssumptionTag>
          <Button icon={<UsersThree size={18} aria-hidden />} onClick={() => simulate("parent")}>
            Simulate as Parent
          </Button>
        </div>
      </div>

      <Card title="School registry">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Search schools" className="w-full max-w-sm">
            <input
              type="search"
              className={inputClass}
              placeholder="School name or code"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(s) => s.code}
            rowActions={(s) => <RowAction icon={<Eye size={16} aria-hidden />} onClick={() => simulate("school", s.name)}>Simulate as School</RowAction>}
            empty={
              <EmptyState
                title="No schools match this search"
                hint="Check the spelling or search by school ID instead."
                action={<Button variant="secondary" onClick={() => setQ("")}>Clear search</Button>}
              />
            }
          />
        </div>
      </Card>
    </div>
  );
}
