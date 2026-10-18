import { expect, test } from "vitest";
import { initialSbfasState, sbfasReducer } from "./sbfasStore";
import { buildFamilyApps } from "./familySubmission";
import { SBFAS_APPLICATIONS } from "./sbfasApplications";

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

test("submitFamily appends the per-child applications and allows only one submission per session", () => {
  const s0 = initialSbfasState();
  const apps = buildFamilyApps(s0.apps, "b3", "2026-10-18", "");
  const s1 = sbfasReducer(s0, { type: "submitFamily", submittedOn: "2026-10-18", apps });
  expect(s1.apps).toHaveLength(SBFAS_APPLICATIONS.length + 2);
  expect(s1.family).toEqual({ submittedOn: "2026-10-18", appIds: ["SBFAS0013", "SBFAS0014"] });

  // A second submit while the first is undecided changes nothing.
  const again = buildFamilyApps(s1.apps, "b3", "2026-10-18", "");
  const s2 = sbfasReducer(s1, { type: "submitFamily", submittedOn: "2026-10-19", apps: again });
  expect(s2).toBe(s1);

  // Deciding one child leaves the family under review; deciding both finishes it.
  const s3 = sbfasReducer(s2, { type: "decide", id: "SBFAS0013", action: "approve", draft: { justification: "", tier: "Tier 3" } });
  expect(s3.apps.find((a) => a.id === "SBFAS0013")?.status).toBe("Approved");
  expect(s3.family?.appIds).toEqual(["SBFAS0013", "SBFAS0014"]);
});
