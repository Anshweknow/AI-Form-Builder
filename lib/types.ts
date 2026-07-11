// Shared types used across the client and the extraction API route.

export type FieldType =
  | "text" // single-line text
  | "textarea" // multi-line text
  | "number"
  | "date"
  | "dropdown"
  | "checkbox";

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** Only meaningful for `dropdown`. */
  options: string[];
}

/** A form the user has designed — the unit we save, export and import. */
export interface FormSchema {
  name: string;
  fields: FormField[];
}

export type Confidence = "high" | "medium" | "low";

/** What the AI returns for a single field. */
export interface FieldExtraction {
  /** null means "not found / not confident" — the field is left blank. */
  value: string | number | boolean | null;
  confidence: Confidence;
}

export type ExtractionResult = Record<string, FieldExtraction>;

export interface ExtractApiResponse {
  results?: ExtractionResult;
  /** Human-readable error for the UI (never a raw stack trace). */
  error?: string;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Single line text",
  textarea: "Multi-line text",
  number: "Number",
  date: "Date",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
};

export const ACCEPTED_MIME: Record<string, string> = {
  "application/pdf": "application/pdf",
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
};

export const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];
