// Small helpers for creating fields and persisting form templates in the
// browser's localStorage (the "Form Templates" bonus feature).

import type { FormField, FieldType, FormSchema } from "./types";

const TEMPLATES_KEY = "tecnots.formTemplates.v1";

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return "f_" + crypto.randomUUID().slice(0, 8);
  }
  return "f_" + Math.random().toString(36).slice(2, 10);
}

export function makeField(type: FieldType = "text"): FormField {
  return {
    id: makeId(),
    label: "",
    type,
    required: false,
    options: type === "dropdown" ? ["Option 1", "Option 2"] : [],
  };
}

export interface StoredTemplate extends FormSchema {
  id: string;
  savedAt: number;
}

export function loadTemplates(): StoredTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTemplate(schema: FormSchema): StoredTemplate[] {
  const templates = loadTemplates();
  const entry: StoredTemplate = {
    id: makeId(),
    name: schema.name || "Untitled form",
    fields: schema.fields,
    savedAt: Date.now(),
  };
  const next = [entry, ...templates];
  window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  return next;
}

export function deleteTemplate(id: string): StoredTemplate[] {
  const next = loadTemplates().filter((t) => t.id !== id);
  window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  return next;
}

/** Give fresh ids to imported/loaded fields so ids never collide across forms. */
export function withFreshIds(fields: FormField[]): FormField[] {
  return fields.map((f) => ({
    ...f,
    id: makeId(),
    options: Array.isArray(f.options) ? f.options : [],
  }));
}

/** A sensible starting form (the job-application example from the brief). */
export function starterFields(): FormField[] {
  const mk = (
    label: string,
    type: FieldType,
    required: boolean,
    options: string[] = [],
  ): FormField => ({ id: makeId(), label, type, required, options });

  return [
    mk("Candidate Name", "text", true),
    mk("Email Address", "text", true),
    mk("Professional Skills", "textarea", false),
    mk("Years of Experience", "number", true),
    mk("Start Date", "date", false),
    mk("Department", "dropdown", true, ["Engineering", "Design", "Sales", "Operations"]),
    mk("Agreement to Terms", "checkbox", true),
  ];
}
