/**
 * The API stores and returns UTC ("…+00:00"). The UI works in the viewer's local time, so these
 * helpers convert at the boundary: local calendar days <-> UTC instants.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of a moment in the viewer's local timezone. */
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Start (00:00) or end (23:59:59.999) of a local calendar day, as a UTC ISO instant. */
export const dayStartUtc = (day: string) => new Date(`${day}T00:00:00`).toISOString();
export const dayEndUtc = (day: string) => new Date(`${day}T23:59:59.999`).toISOString();

/** A UTC ISO instant back to the local "YYYY-MM-DD" (for date inputs). */
export const isoToLocalDay = (iso?: string) => (iso ? localDay(new Date(iso)) : "");

/** A datetime-local input value ("YYYY-MM-DDTHH:MM", local) as a UTC ISO instant. */
export const localInputToUtc = (value: string) => new Date(value).toISOString();
