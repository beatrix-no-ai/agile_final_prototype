import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import type { ClassRecord } from "../../../data/schoolMgmt";
import { useRegistry } from "../../../data/registryStore";
import { LEVELS } from "../../../data/students";
import { validateClass, type ClassInput } from "../../../lib/schoolMgmt";

type Props = {
  /** Fixed for School users; HQ picks one. */
  fixedSchool?: string;
  editing: ClassRecord | null;
  all: ClassRecord[];
  enrolled: number;
  onClose: () => void;
  onSave: (c: ClassRecord) => void;
};

export default function ClassFormModal({ fixedSchool, editing, all, enrolled, onClose, onSave }: Props) {
  const { state: reg } = useRegistry();
  const [v, setV] = useState<ClassInput>(
    editing ? { ...editing, capacity: String(editing.capacity) } : { school: fixedSchool ?? "", name: "", level: "", teacher: "", room: "", capacity: "40" },
  );
  const [submitted, setSubmitted] = useState(false);
  const others = all.filter((c) => c.name !== editing?.name);
  const errors = submitted ? validateClass(v, others, enrolled) : {};
  const set = (k: keyof ClassInput) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value, ...(k === "school" ? { level: "" } : {}) }));
  const schoolType = reg.schools.find((s) => s.code === v.school)?.level;
  const levelOptions = LEVELS.filter((l) => !schoolType || (schoolType === "Primary") === l.startsWith("P"));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateClass(v, others, enrolled)).length) return;
    onSave({
      school: v.school!,
      name: v.name.trim().replace(/\s+/g, " "),
      level: v.level as ClassRecord["level"],
      teacher: v.teacher.trim(),
      room: v.room.trim(),
      capacity: Number(v.capacity),
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : "Add class"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="class-form">Save class</Button>
        </>
      }
    >
      <form id="class-form" onSubmit={submit} noValidate className="grid gap-4">
        <Field required label="School" error={errors.school}>
          <select className={inputClass} value={v.school} onChange={set("school")} disabled={!!editing || !!fixedSchool}>
            <option value="">Select school</option>
            {reg.schools.filter((s) => s.active || s.code === v.school).map((s) => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field required label="Class name" error={errors.name}>
            <input className={inputClass} value={v.name} onChange={set("name")} />
          </Field>
          <Field required label="Level" error={errors.level}>
            <select className={inputClass} value={v.level} onChange={set("level")} disabled={!!editing}>
              <option value="">Select level</option>
              {levelOptions.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field required label="Form teacher" error={errors.teacher}>
          <input className={inputClass} value={v.teacher} onChange={set("teacher")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field required label="Room" error={errors.room}>
            <input className={inputClass} value={v.room} onChange={set("room")} />
          </Field>
          <Field required label="Capacity" error={errors.capacity}>
            <input className={inputClass} inputMode="numeric" value={v.capacity} onChange={set("capacity")} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
