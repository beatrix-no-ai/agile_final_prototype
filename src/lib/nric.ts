// Education Account ID = NRIC. The app only ever shows the masked form; the full value stays in the data layer.
// ASSUMPTION: mock NRICs only (generated with the standard checksum so they look real); the internal record `id` is a separate backend key.
const WEIGHTS = [2, 7, 6, 5, 4, 3, 2];
const ST_CHECK = "JZIHGFEDCBA";

/** Builds a Singapore-format NRIC: prefix S (born before 2000) or T (2000 onwards), 2-digit birth year, 5-digit serial, checksum letter. */
export function makeNric(birthYear: number, serial: number): string {
  const prefix = birthYear >= 2000 ? "T" : "S";
  const digits = String(birthYear % 100).padStart(2, "0") + String(serial % 100000).padStart(5, "0");
  const sum = [...digits].reduce((t, d, i) => t + Number(d) * WEIGHTS[i], 0) + (prefix === "T" ? 4 : 0);
  return `${prefix}${digits}${ST_CHECK[sum % 11]}`;
}

/** S1234567D -> S****567D (first letter, last three digits and the checksum letter). */
export const maskNric = (nric: string) => (nric.length === 9 ? `${nric[0]}****${nric.slice(5)}` : nric);
