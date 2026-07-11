"use client";

import type { FormField, Confidence } from "@/lib/types";
import { IconCheck, IconAlert, IconInfo } from "./icons";

export interface FieldMeta {
  confidence: Confidence;
  empty: boolean;
  note?: string;
}

interface Props {
  fields: FormField[];
  values: Record<string, string | boolean>;
  meta: Record<string, FieldMeta>;
  justFilled: Set<string>;
  extractedOnce: boolean;
  submitted: boolean;
  showRequiredErrors: boolean;
  resultJson: string | null;
  onValueChange: (id: string, value: string | boolean) => void;
  onSubmit: () => void;
  onReset: () => void;
}

function isFilled(field: FormField, value: string | boolean | undefined): boolean {
  if (field.type === "checkbox") return value === true;
  return String(value ?? "").trim() !== "";
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export default function FormPreview({
  fields,
  values,
  meta,
  justFilled,
  extractedOnce,
  submitted,
  showRequiredErrors,
  resultJson,
  onValueChange,
  onSubmit,
  onReset,
}: Props) {
  const requiredFields = fields.filter((f) => f.required);
  const missingRequired = requiredFields.filter((f) => !isFilled(f, values[f.id]));
  const lowConfidence = extractedOnce
    ? fields.filter((f) => meta[f.id] && !meta[f.id].empty && meta[f.id].confidence === "low").length
    : 0;

  return (
    <section className="card">
      <div className="card-head">
        <div className="title-group">
          <span className="step-badge">3</span>
          <div>
            <h2>Review &amp; save</h2>
            <span className="card-sub">Live preview · edit any value · then save</span>
          </div>
        </div>
      </div>

      <div className="card-body">
        {fields.length === 0 ? (
          <div className="empty-hint">Your form preview will appear here as you add fields.</div>
        ) : (
          <>
            {(extractedOnce || missingRequired.length > 0) && (
              <div className="review-summary">
                <span className="summary-stat">
                  <span className={"dot " + (missingRequired.length === 0 ? "dot-ok" : "dot-warn")} />
                  <span>
                    <strong>{requiredFields.length - missingRequired.length}</strong> / {requiredFields.length}{" "}
                    required complete
                  </span>
                </span>
                {extractedOnce && lowConfidence > 0 && (
                  <span className="summary-stat">
                    <strong>{lowConfidence}</strong> low-confidence value{lowConfidence === 1 ? "" : "s"} to check
                  </span>
                )}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
            >
              {fields.map((field) => {
                const value = values[field.id];
                const m = meta[field.id];
                const filled = isFilled(field, value);
                const highlightMissing =
                  (extractedOnce || showRequiredErrors) && field.required && !filled;

                return (
                  <div
                    key={field.id}
                    className={
                      "preview-field" +
                      (highlightMissing ? " missing-required" : "") +
                      (justFilled.has(field.id) ? " just-filled" : "")
                    }
                  >
                    <div className="preview-field-head">
                      <span className="preview-field-label">
                        {field.label || <em style={{ color: "var(--text-faint)" }}>Untitled field</em>}
                        {field.required && <span className="req-star" title="Required">*</span>}
                      </span>
                      {extractedOnce && m && <ConfidenceBadge meta={m} />}
                    </div>

                    <FieldControl field={field} value={value} onChange={(v) => onValueChange(field.id, v)} />

                    {extractedOnce && m?.empty && m.note && (
                      <div className="field-note">
                        <IconAlert style={{ width: 13, height: 13 }} />
                        {m.note}
                      </div>
                    )}
                    {highlightMissing && !(extractedOnce && m?.empty && m.note) && (
                      <div className="field-note" style={{ color: "var(--danger)" }}>
                        <IconAlert style={{ width: 13, height: 13 }} />
                        Required field — please complete
                      </div>
                    )}
                  </div>
                );
              })}

              {submitted ? (
                <div style={{ marginTop: 16 }}>
                  <div className="banner banner-ok">
                    <IconCheck />
                    <span>Form saved successfully.</span>
                  </div>
                  {resultJson && <pre className="result-json">{resultJson}</pre>}
                  <div className="submit-row">
                    <button type="button" className="btn" onClick={onReset}>
                      Edit again
                    </button>
                  </div>
                </div>
              ) : (
                <div className="submit-row">
                  <button type="submit" className="btn btn-primary">
                    <IconCheck /> Save form
                  </button>
                  {showRequiredErrors && missingRequired.length > 0 && (
                    <span className="field-note" style={{ color: "var(--danger)", marginTop: 0 }}>
                      <IconInfo style={{ width: 13, height: 13 }} />
                      {missingRequired.length} required field{missingRequired.length === 1 ? "" : "s"} still empty
                    </span>
                  )}
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </section>
  );
}

function ConfidenceBadge({ meta }: { meta: FieldMeta }) {
  if (meta.empty) {
    return <span className="badge badge-empty">Empty</span>;
  }
  return (
    <span className={"badge badge-" + meta.confidence}>{CONFIDENCE_LABEL[meta.confidence]} confidence</span>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  const strValue = typeof value === "string" ? value : "";

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          className="textarea"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label}
        />
      );
    case "number":
      return (
        <input
          className="input"
          type="number"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label}
        />
      );
    case "date":
      return (
        <input
          className="input"
          type="date"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "dropdown":
      return (
        <select className="select" value={strValue} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {field.options
            .filter((o) => o.trim())
            .map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
        </select>
      );
    case "checkbox":
      return (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.label || "Yes"}</span>
        </label>
      );
    default:
      return (
        <input
          className="input"
          type="text"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label}
        />
      );
  }
}
