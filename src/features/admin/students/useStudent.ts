import { useLocation, useParams } from "react-router";
import { useFas } from "../../../data/fasStore";
import { useFees } from "../../../data/feeStore";
import { STUDENTS, type Student } from "../../../data/students";
import { withBalance, withFas } from "../../../lib/studentFas";

/**
 * Student for /admin/students/:id/...; newly assigned students are not in STUDENTS, so the list passes them via router state.
 * FAS follows the FAS decisions, and the balance follows what has been paid out of the Education Account.
 */
export function useStudent(): Student | undefined {
  const { id } = useParams();
  const { state } = useLocation() as { state: { student?: Student } | null };
  const { state: fas } = useFas();
  const { state: fees } = useFees();
  const found = state?.student?.id === id ? state?.student : STUDENTS.find((s) => s.id === id);
  return found && withBalance(withFas(found, fas), fees.debits);
}
