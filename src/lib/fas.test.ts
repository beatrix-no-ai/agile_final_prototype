import { expect, test } from "vitest";
import { riskLevel } from "./fas";

test("riskLevel", () => {
  expect(riskLevel(18)).toBe("Low");
  expect(riskLevel(34)).toBe("Low");
  expect(riskLevel(35)).toBe("Medium");
  expect(riskLevel(54)).toBe("Medium");
  expect(riskLevel(70)).toBe("High");
  expect(riskLevel(89)).toBe("High");
});
