import { expect, test } from "vitest";
import { initialSbfasState, sbfasReducer } from "./sbfasStore";

// The bug this guards: decisions used to live in the queue component's useState and reset when the
// user navigated away. The store keeps them for the whole session (reload still resets — no backend).
test("decisions live in the store: state carries over, the seed is never re-applied", () => {
  const s0 = initialSbfasState();
  const target = s0.apps.find((a) => a.status === "Pending")!;
  const s1 = sbfasReducer(s0, { type: "decide", id: target.id, action: "approve", draft: { justification: "", tier: target.recommendedTier } });
  expect(s1.apps.find((a) => a.id === target.id)?.status).toBe("Approved");

  // A later action (e.g. after "navigating" elsewhere) continues from the decided state.
  const s2 = sbfasReducer(s1, { type: "decide", id: target.id, action: "reject", draft: { justification: "not eligible", tier: target.recommendedTier } });
  expect(s2.apps.find((a) => a.id === target.id)?.status).toBe("Rejected");
  expect(s2.apps.find((a) => a.id === target.id)?.justification).toBe("not eligible");

  // Pure: the seed snapshot is untouched.
  expect(s0.apps.find((a) => a.id === target.id)?.status).toBe("Pending");
});
