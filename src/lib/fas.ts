// ASSUMPTION: risk thresholds (<35 Low, <70 Medium, else High) are invented; confirm with MOE.
export function riskLevel(score: number): "Low" | "Medium" | "High" {
  return score < 35 ? "Low" : score < 70 ? "Medium" : "High";
}
