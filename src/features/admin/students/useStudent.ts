import { useLocation, useParams } from "react-router";
import { useFas } from "../../../data/fasStore";
import { STUDENTS, type Student } from "../../../data/students";
import { withFas } from "../../../lib/studentFas";

/** Student for /admin/students/:id/...; newly assigned students are not in STUDENTS, so the list passes them via router state. SBFAS follows the FAS queue. */
export function useStudent(): Student | undefined {
  const { id } = useParams();
  const { state } = useLocation() as { state: { student?: Student } | null };
  const { state: fas } = useFas();
  const found = state?.student?.id === id ? state?.student : STUDENTS.find((s) => s.id === id);
  return found && withFas(found, fas.apps);
}
