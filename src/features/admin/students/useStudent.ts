import { useParams } from "react-router";
import { useFas } from "../../../data/fasStore";
import { useFees } from "../../../data/feeStore";
import { useRegistry } from "../../../data/registryStore";
import type { Student } from "../../../data/students";
import { withBalance, withFas } from "../../../lib/studentFas";

/**
 * Student for /admin/students/:id/..., looked up in the shared registry.
 * FAS follows the FAS decisions, and the balance follows what has been paid out of the Education Account.
 */
export function useStudent(): Student | undefined {
  const { id } = useParams();
  const { state: reg } = useRegistry();
  const { state: fas } = useFas();
  const { state: fees } = useFees();
  const found = reg.students.find((s) => s.id === id);
  return found && withBalance(withFas(found, fas), fees.debits);
}
