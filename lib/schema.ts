// Turns a user-built form into a JSON Schema the AI must fill, and turns the
// AI's answer back into concrete form values. This is what makes extraction
// "schema-driven": the shape of the request is derived entirely from whatever
// fields the user configured at runtime — nothing about the fields is hardcoded.

import type { FormField, FieldExtraction } from "./types";

// A minimal JSON-schema shape. `any` here is deliberate: JSON Schema is
// recursive and open-ended, and we only build a small, known subset of it.
type JsonSchema = Record<string, unknown>;

/** The per-field `value` sub-schema, chosen from the field's type. Always nullable. */
function valueSchema(field: FormField): JsonSchema {
  switch (field.type) {
    case "number":
      return { anyOf: [{ type: "number" }, { type: "null" }] };
    case "checkbox":
      return { anyOf: [{ type: "boolean" }, { type: "null" }] };
    case "dropdown": {
      const options = field.options.filter((o) => o.trim().length > 0);
      if (options.length > 0) {
        return { anyOf: [{ type: "string", enum: options }, { type: "null" }] };
      }
      return { anyOf: [{ type: "string" }, { type: "null" }] };
    }
    case "date":
    case "text":
    case "textarea":
    default:
      return { anyOf: [{ type: "string" }, { type: "null" }] };
  }
}

function fieldGuidance(field: FormField): string {
  const bits: string[] = [`Label: "${field.label || "(untitled)"}"`];
  switch (field.type) {
    case "number":
      bits.push("Type: number. Return a numeric value only, or null if none found.");
      break;
    case "date":
      bits.push('Type: date. Return an ISO date string "YYYY-MM-DD", or null.');
      break;
    case "checkbox":
      bits.push("Type: yes/no. Return true or false, or null if unknown.");
      break;
    case "dropdown":
      bits.push(
        `Type: choice. Return EXACTLY one of: ${field.options
          .filter((o) => o.trim())
          .map((o) => `"${o}"`)
          .join(", ") || "(no options defined)"} — or null if none fits.`,
      );
      break;
    case "textarea":
      bits.push("Type: long text. Multiple lines / items are fine, or null.");
      break;
    default:
      bits.push("Type: short text, or null.");
  }
  if (field.required) bits.push("This field is required.");
  return bits.join(" ");
}

/**
 * Build the Anthropic tool the model must call. The input schema has one
 * required property per form field (keyed by field id), each an object of
 * `{ value, confidence }`. Because every field id is `required` with
 * `additionalProperties: false`, the model is forced to address every field.
 */
export function buildExtractionTool(fields: FormField[]) {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const field of fields) {
    properties[field.id] = {
      type: "object",
      description: fieldGuidance(field),
      properties: {
        value: valueSchema(field),
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
          description:
            "How sure you are this value is correct for this field. Use 'low' if you are guessing.",
        },
      },
      required: ["value", "confidence"],
      additionalProperties: false,
    };
    required.push(field.id);
  }

  return {
    name: "fill_form",
    description:
      "Record the value extracted from the document for every form field. " +
      "Leave a field's value null when the document does not clearly contain it — never guess.",
    // `strict` guarantees the returned input validates exactly against this schema.
    strict: true,
    input_schema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  };
}

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
