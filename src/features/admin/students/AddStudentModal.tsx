import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import type { ClassRecord } from "../../../data/schoolMgmt";
import { LEVELS, type Level, type UnassignedAccount } from "../../../data/students";
import { classNamesFor } from "../../../lib/registry";
import { formatSGD } from "../../../lib/format";
import { maskNric } from "../../../lib/nric";

const EMPTY = { id: "", level: "", class: "" };
const FORM_ID = "assign-student-form";

type Props = {
  open: boolean;
  available: UnassignedAccount[];
  /** The school's classes (shared registry); `school` limits them to the signed-in school, HQ sees every school's. */
  classes: ClassRecord[];
  school?: string;
  onClose: () => void;
  onAssign: (a: UnassignedAccount, p: { level: Level; class: string }) => void;
};

/** Req 3: student accounts already exist, so the school only assigns one to a level and class. */
export default function AssignStudentModal({ open, available, classes: allClasses, school, onClose, onAssign }: Props) {
  const [v, setV] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const account = available.find((a) => a.id === v.id);
  const errors = submitted
    ? { id: account ? "" : "Select an account.", level: v.level ? "" : "Select a level.", class: v.class ? "" : "Select a class." }
    : { id: "", level: "", class: "" };
  const classes = LEVELS.includes(v.level as Level) ? classNamesFor(allClasses, v.level as Level, school) : [];
  const levels = LEVELS.filter((l) => classNamesFor(allClasses, l, school).length > 0);

  const close = () => {
    setV(EMPTY);
    setSubmitted(false);
    onClose();
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!account || !v.level || !v.class) return;
    onAssign(account, { level: v.level as Level, class: v.class });
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Assign student"
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" form={FORM_ID}>Assign student</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
        <Field required label="Education Account" error={errors.id} hint="Accounts already exist; this only assigns one to your school.">
          <select className={inputClass} value={v.id} onChange={(e) => setV({ ...v, id: e.target.value })}>
            <option value="">{available.length ? "Select account" : "No unassigned accounts"}</option>
            {available.map((a) => <option key={a.id} value={a.id}>{maskNric(a.nric)} - {a.name} ({formatSGD(a.balance)})</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field required label="Level" error={errors.level}>
            <select className={inputClass} value={v.level} onChange={(e) => setV({ ...v, level: e.target.value, class: "" })}>
              <option value="">Select level</option>
              {levels.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field required label="Class" error={errors.class}>
            <select className={inputClass} value={v.class} onChange={(e) => setV({ ...v, class: e.target.value })}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}
