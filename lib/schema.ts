// Turns the AI's per-field answer back into concrete, type-checked form values.
// (The request schema Gemini must fill is built server-side in the API route —
// see app/api/extract/route.ts. Both are derived entirely from the user's
// runtime-built fields, which is what makes the extraction "schema-driven".)
//
// This file imports no AI SDK, so it stays safe to use in the browser bundle.

import type { FormField, FieldExtraction } from "./types";

export interface CoercedField {
  /** Value to place in the form control (string for inputs, boolean for checkbox). */
  value: string | boolean;
  /** True when the field ended up blank / unchecked because nothing usable was found. */
  empty: boolean;
  confidence: FieldExtraction["confidence"];
  /** A short reason shown to the user when a value was dropped. */
  note?: string;
}

/**
 * Convert one raw AI extraction into a concrete form value, enforcing the
 * field's type. If the value is missing, the wrong type, or an invalid choice,
 * the field is left blank and flagged — matching the assessment's edge cases.
 */
export function coerceExtraction(
  field: FormField,
  raw: FieldExtraction | undefined,
): CoercedField {
  const confidence = raw?.confidence ?? "low";
  const value = raw?.value;

  if (field.type === "checkbox") {
    if (typeof value === "boolean") {
      return { value, empty: false, confidence };
    }
    return { value: false, empty: true, confidence, note: "No clear yes/no found" };
  }

  // Everything else is edited as a string in the UI.
  if (value === null || value === undefined || value === "") {
    return { value: "", empty: true, confidence, note: "Not found in document" };
  }

  if (field.type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return { value: String(value), empty: false, confidence };
    }
    // Accept a numeric-looking string, otherwise blank it.
    const n = typeof value === "string" ? Number(value.replace(/[^0-9.\-]/g, "")) : NaN;
    if (Number.isFinite(n) && value !== "") {
      return { value: String(n), empty: false, confidence };
    }
    return { value: "", empty: true, confidence, note: "No numeric value found" };
  }

  if (field.type === "date") {
    const str = String(value).trim();
    // Normalise to YYYY-MM-DD for <input type="date">.
    const parsed = normaliseDate(str);
    if (parsed) return { value: parsed, empty: false, confidence };
    return { value: "", empty: true, confidence, note: "No valid date found" };
  }

  if (field.type === "dropdown") {
    const str = String(value).trim();
    const match = field.options.find(
      (o) => o.trim().toLowerCase() === str.toLowerCase(),
    );
    if (match) return { value: match, empty: false, confidence };
    return { value: "", empty: true, confidence, note: "No matching option" };
  }

  return { value: String(value), empty: false, confidence };
}

function normaliseDate(input: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
