import { useMemo } from "react";
import type { Movements } from "../lib/studentFas";
import { useFees } from "./feeStore";
import { useTopUp } from "./topupStore";

/** What has moved each Education Account since the start: fees paid out (fee store) and MOE top-ups paid in (top-up store). */
export function useMovements(): Movements {
  const debits = useFees().state.debits;
  const credits = useTopUp().state.credits;
  return useMemo(() => ({ debits, credits }), [debits, credits]);
}
