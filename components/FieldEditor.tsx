"use client";

import { useState } from "react";
import type { FormField, FieldType } from "@/lib/types";
import { FIELD_TYPE_LABELS } from "@/lib/types";
import { IconGrip, IconTrash, IconPlus } from "./icons";

interface Props {
  field: FormField;
  index: number;
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  // Drag-and-drop reordering (bonus). State is owned by the parent list.
  isDragging: boolean;
  isOver: boolean;
  onDragStartField: (index: number) => void;
  onDragEnterField: (index: number) => void;
  onDragEndField: () => void;
}

export default function FieldEditor({
  field,
  index,
  onChange,
  onRemove,
  isDragging,
  isOver,
  onDragStartField,
  onDragEnterField,
  onDragEndField,
}: Props) {
  // Only make the row draggable while the user is grabbing the handle, so
  // clicking into the text inputs still works normally.
  const [dragEnabled, setDragEnabled] = useState(false);

  function handleTypeChange(type: FieldType) {
    const patch: Partial<FormField> = { type };
    if (type === "dropdown" && field.options.filter((o) => o.trim()).length === 0) {
      patch.options = ["Option 1", "Option 2"];
    }
    onChange(patch);
  }

  function updateOption(i: number, value: string) {
    const options = [...field.options];
    options[i] = value;
    onChange({ options });
  }

  function addOption() {
    onChange({ options: [...field.options, `Option ${field.options.length + 1}`] });
  }

  function removeOption(i: number) {
    onChange({ options: field.options.filter((_, j) => j !== i) });
  }

  return (
    <div
      className={
        "field-editor" +
        (isDragging ? " dragging" : "") +
        (isOver ? " drag-over" : "")
      }
      draggable={dragEnabled}
      onDragStart={() => onDragStartField(index)}
      onDragEnter={() => onDragEnterField(index)}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={() => {
        setDragEnabled(false);
        onDragEndField();
      }}
    >
      <div className="field-editor-row">
        <span
          className="drag-handle"
          title="Drag to reorder"
          onMouseDown={() => setDragEnabled(true)}
          onMouseUp={() => setDragEnabled(false)}
          aria-hidden="true"
        >
          <IconGrip />
        </span>

        <div className="field-editor-main">
          <input
            className="input"
            placeholder="Field label (e.g. Candidate Name)"
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            aria-label={`Field ${index + 1} label`}
          />
          <select
            className="select"
            value={field.type}
            onChange={(e) => handleTypeChange(e.target.value as FieldType)}
            aria-label={`Field ${index + 1} type`}
          >
            {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn btn-danger-ghost"
          onClick={onRemove}
          title="Remove field"
          aria-label={`Remove field ${index + 1}`}
        >
          <IconTrash />
        </button>
      </div>

      {field.type === "dropdown" && (
        <div className="options-editor">
          <span className="label" style={{ marginBottom: 0 }}>
            Dropdown options
          </span>
          {field.options.map((opt, i) => (
            <div className="option-row" key={i}>
              <input
                className="input"
                value={opt}
                placeholder={`Option ${i + 1}`}
                onChange={(e) => updateOption(i, e.target.value)}
                aria-label={`Option ${i + 1}`}
              />
              <button
                type="button"
                className="btn btn-danger-ghost"
                onClick={() => removeOption(i)}
                disabled={field.options.length <= 1}
                title="Remove option"
              >
                <IconTrash />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={addOption} style={{ alignSelf: "flex-start" }}>
            <IconPlus /> Add option
          </button>
        </div>
      )}

      <div className="field-editor-foot">
        <label className="toggle">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          <span className="toggle-track" />
          <span>Required</span>
        </label>
      </div>
    </div>
  );
}
