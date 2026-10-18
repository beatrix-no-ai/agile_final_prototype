import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import type { SchoolRecord } from "../../../data/schoolMgmt";
import { principalOf } from "../../../data/users";
import { nextSchoolId, validateSchool, type SchoolInput } from "../../../lib/schoolMgmt";

const EMPTY: SchoolInput = { code: "", name: "", level: "", address: "", principal: "", email: "", phone: "", userName: "", userEmail: "" };
export const SCHOOL_TYPES = ["Primary", "Secondary"] as const;
type Props = { open: boolean; editing: SchoolRecord | null; all: SchoolRecord[]; onClose: () => void; onSave: (s: SchoolRecord, user: { name: string; email: string; resetPassword: boolean }) => void };

export default function SchoolFormModal({ open, editing, all, onClose, onSave }: Props) {
  const account = editing && principalOf(editing.code);
  const [v, setV] = useState<SchoolInput>(editing ? { ...editing, userName: account?.name ?? "", userEmail: account?.email ?? "" } : EMPTY);
  const [reset, setReset] = useState(false);
  const [active, setActive] = useState(editing?.active ?? true);
  const [submitted, setSubmitted] = useState(false);
  const code = editing?.code ?? nextSchoolId(all);
  const others = all.filter((s) => s.code !== editing?.code);
  const errors = submitted ? validateSchool({ ...v, code }, others, true) : {};
  const set = (k: keyof SchoolInput) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateSchool({ ...v, code }, others, true)).length) return;
    onSave({
      code,
      name: v.name.trim().replace(/\s+/g, " "),
      level: v.level as SchoolRecord["level"],
      address: v.address.trim(),
      principal: v.principal.trim(),
      email: v.email.trim(),
      phone: v.phone.replace(/\s/g, ""),
      students: editing?.students ?? 0,
      active,
    }, { name: v.userName!.trim(), email: v.userEmail!.trim(), resetPassword: reset });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : "Add school"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="school-form">Save school</Button>
        </>
      }
    >
      <form id="school-form" onSubmit={submit} noValidate className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="School ID" hint={editing ? undefined : "Generated automatically on save"}>
            <input className={`${inputClass} cursor-not-allowed bg-surface-container-high text-on-surface-variant`} value={code} readOnly disabled />
          </Field>
          <Field required label="School type" error={errors.level}>
            <select className={inputClass} value={v.level} onChange={set("level")}>
              <option value="">Select type</option>
              {SCHOOL_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field required label="School name" error={errors.name}>
          <input className={inputClass} value={v.name} onChange={set("name")} />
        </Field>
        <Field required label="Address" error={errors.address}>
          <input className={inputClass} value={v.address} onChange={set("address")} />
        </Field>
        <Field required label="Principal" error={errors.principal}>
          <input className={inputClass} value={v.principal} onChange={set("principal")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field required label="Contact email" error={errors.email}>
            <input type="email" className={inputClass} value={v.email} onChange={set("email")} />
          </Field>
          <Field required label="Contact phone" error={errors.phone} hint="8 digits, e.g. 61234567">
            <input type="tel" className={inputClass} value={v.phone} onChange={set("phone")} />
          </Field>
        </div>
        <fieldset className="grid gap-4 rounded-control border border-line p-4 sm:grid-cols-2">
            <legend className="px-1 text-[13px] font-semibold">Principal account (one per school)</legend>
            <Field required label="Name" error={errors.userName}>
              <input className={inputClass} value={v.userName} onChange={set("userName")} />
            </Field>
            <Field required label="Email (login)" error={errors.userEmail} hint={editing ? "Changing this changes the login." : "A one-time password is generated after saving."}>
              <input type="email" className={inputClass} value={v.userEmail} onChange={set("userEmail")} />
            </Field>
            <p className="text-[13px] text-on-surface-variant sm:col-span-2">Other School Admins and their modules are managed on the User page.</p>
            {editing && (
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm sm:col-span-2">
                <input type="checkbox" className="size-5 accent-primary" checked={reset} onChange={(e) => setReset(e.target.checked)} />
                Issue a new one-time password
              </label>
            )}
          </fieldset>
        {editing && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-primary" checked={active} onChange={(e) => setActive(e.target.checked)} />
            School is active
          </label>
        )}
        {editing && editing.active && !active && (
          <p role="status" className="rounded-control border border-line bg-surface-container-lowest px-3 py-2 text-[13px]">
            Inactive blocks new student assignment, top-ups and new fee charges.
          </p>
        )}
      </form>
    </Modal>
  );
}
