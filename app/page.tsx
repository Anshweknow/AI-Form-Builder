"use client";

import { useEffect, useState } from "react";

import FormBuilder from "@/components/FormBuilder";
import DocumentUpload from "@/components/DocumentUpload";
import FormPreview, { type FieldMeta } from "@/components/FormPreview";
import Toolbar from "@/components/Toolbar";
import { IconSparkles, IconCheck, IconAlert } from "@/components/icons";

import type { FormField, ExtractApiResponse } from "@/lib/types";
import { coerceExtraction } from "@/lib/schema";
import {
  makeField,
  starterFields,
  loadTemplates,
  saveTemplate,
  deleteTemplate,
  withFreshIds,
  type StoredTemplate,
} from "@/lib/storage";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Notice {
  type: "ok" | "error";
  text: string;
}

export default function Page() {
  const [formName, setFormName] = useState("Candidate Application");
  const [fields, setFields] = useState<FormField[]>([]);

  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [meta, setMeta] = useState<Record<string, FieldMeta>>({});
  const [justFilled, setJustFilled] = useState<Set<string>>(new Set());

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedOnce, setExtractedOnce] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);
  const [resultJson, setResultJson] = useState<string | null>(null);

  const [templates, setTemplates] = useState<StoredTemplate[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Seed a useful starting form + load saved templates (client-only).
  useEffect(() => {
    setFields(starterFields());
    setTemplates(loadTemplates());
  }, []);

  function flash(n: Notice) {
    setNotice(n);
    window.setTimeout(() => setNotice((cur) => (cur === n ? null : cur)), 3500);
  }

  function resetExtraction() {
    setValues({});
    setMeta({});
    setJustFilled(new Set());
    setExtractedOnce(false);
    setExtractError(null);
    setSubmitted(false);
    setShowRequiredErrors(false);
    setResultJson(null);
  }

  // --- Field editing ------------------------------------------------------
  function addField() {
    setFields((f) => [...f, makeField("text")]);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((f) => f.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function removeField(id: string) {
    setFields((f) => f.filter((field) => field.id !== id));
    setValues(({ [id]: _v, ...rest }) => rest);
    setMeta(({ [id]: _m, ...rest }) => rest);
  }

  function reorder(from: number, to: number) {
    setFields((f) => {
      const next = [...f];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function setValue(id: string, value: string | boolean) {
    setValues((v) => ({ ...v, [id]: value }));
    // Once a user edits a value, drop the AI confidence badge for that field.
    setMeta(({ [id]: _removed, ...rest }) => rest);
    setSubmitted(false);
  }

  // --- Extraction ---------------------------------------------------------
  async function handleExtract(file: File) {
    setExtracting(true);
    setExtractError(null);
    setSubmitted(false);
    setResultJson(null);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("schema", JSON.stringify(fields));

      const res = await fetch("/api/extract", { method: "POST", body });
      const data: ExtractApiResponse = await res.json();

      if (!res.ok || data.error || !data.results) {
        setExtractError(data.error ?? "Extraction failed. Please try again.");
        return;
      }

      setExtractedOnce(true);
      await revealResults(data.results);
    } catch {
      setExtractError("Could not reach the extraction service. Is the dev server running?");
    } finally {
      setExtracting(false);
    }
  }

  // Populate fields one-by-one for the "real-time extraction" effect.
  async function revealResults(results: NonNullable<ExtractApiResponse["results"]>) {
    for (const field of fields) {
      const coerced = coerceExtraction(field, results[field.id]);
      setValues((v) => ({ ...v, [field.id]: coerced.value }));
      setMeta((m) => ({
        ...m,
        [field.id]: { confidence: coerced.confidence, empty: coerced.empty, note: coerced.note },
      }));

      const id = field.id;
      setJustFilled((s) => new Set(s).add(id));
      window.setTimeout(() => {
        setJustFilled((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }, 1200);

      await sleep(160);
    }
  }

  // --- Save / submit ------------------------------------------------------
  function handleSubmit() {
    const missing = fields.filter((f) => f.required && !isFilled(f, values[f.id]));
    if (missing.length > 0) {
      setShowRequiredErrors(true);
      return;
    }

    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.id];
      const key = f.label || f.id;
      if (f.type === "checkbox") out[key] = v === true;
      else if (f.type === "number") out[key] = v === "" || v === undefined ? null : Number(v);
      else out[key] = v ?? "";
    }

    setResultJson(JSON.stringify({ form: formName, values: out }, null, 2));
    setShowRequiredErrors(false);
    setSubmitted(true);
  }

  // --- Templates ----------------------------------------------------------
  function handleSaveTemplate() {
    const next = saveTemplate({ name: formName, fields });
    setTemplates(next);
    flash({ type: "ok", text: "Template saved." });
  }

  function handleLoadTemplate(t: StoredTemplate) {
    setFormName(t.name);
    setFields(withFreshIds(t.fields));
    resetExtraction();
    flash({ type: "ok", text: `Loaded “${t.name}”.` });
  }

  function handleDeleteTemplate(id: string) {
    setTemplates(deleteTemplate(id));
  }

  // --- Import / export ----------------------------------------------------
  function handleExport() {
    const payload = JSON.stringify({ name: formName, fields }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(formName)}.form.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rawFields: unknown = Array.isArray(parsed) ? parsed : parsed.fields;
      if (!Array.isArray(rawFields) || rawFields.length === 0) {
        throw new Error("no fields");
      }
      // Keep only recognised field properties, and give fresh ids.
      const cleaned = withFreshIds(
        rawFields.map((f: Partial<FormField>) => ({
          id: "",
          label: String(f.label ?? ""),
          type: (f.type ?? "text") as FormField["type"],
          required: Boolean(f.required),
          options: Array.isArray(f.options) ? f.options.map(String) : [],
        })),
      );
      setFormName(typeof parsed.name === "string" ? parsed.name : "Imported form");
      setFields(cleaned);
      resetExtraction();
      flash({ type: "ok", text: "Form structure imported." });
    } catch {
      flash({ type: "error", text: "That file is not a valid form structure." });
    }
  }

  function handleStarter() {
    setFormName("Candidate Application");
    setFields(starterFields());
    resetExtraction();
  }

  function handleNew() {
    setFormName("");
    setFields([]);
    resetExtraction();
  }

  return (
    <main className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark">
            <IconSparkles style={{ width: 22, height: 22 }} />
          </span>
          <div>
            <h1>FormFill AI</h1>
            <p>Design any form, upload a document, and let AI fill it in.</p>
          </div>
        </div>

        <Toolbar
          canSave={fields.length > 0}
          templates={templates}
          onNew={handleNew}
          onStarter={handleStarter}
          onSaveTemplate={handleSaveTemplate}
          onLoadTemplate={handleLoadTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onExport={handleExport}
          onImportFile={handleImport}
        />
      </header>

      {notice && (
        <div
          className={"banner " + (notice.type === "ok" ? "banner-ok" : "banner-error")}
          style={{ marginBottom: 16 }}
        >
          {notice.type === "ok" ? <IconCheck /> : <IconAlert />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="workspace">
        <div className="column">
          <FormBuilder
            name={formName}
            fields={fields}
            onNameChange={setFormName}
            onAddField={addField}
            onUpdateField={updateField}
            onRemoveField={removeField}
            onReorder={reorder}
          />
        </div>

        <div className="column">
          <DocumentUpload
            fieldsExist={fields.length > 0}
            extracting={extracting}
            extractError={extractError}
            onExtract={handleExtract}
          />
          <FormPreview
            fields={fields}
            values={values}
            meta={meta}
            justFilled={justFilled}
            extractedOnce={extractedOnce}
            submitted={submitted}
            showRequiredErrors={showRequiredErrors}
            resultJson={resultJson}
            onValueChange={setValue}
            onSubmit={handleSubmit}
            onReset={() => {
              setSubmitted(false);
              setResultJson(null);
            }}
          />
        </div>
      </div>
    </main>
  );
}

function isFilled(field: FormField, value: string | boolean | undefined): boolean {
  if (field.type === "checkbox") return value === true;
  return String(value ?? "").trim() !== "";
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "form"
  );
}
