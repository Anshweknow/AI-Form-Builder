"use client";

import { useState } from "react";
import type { FormField } from "@/lib/types";
import FieldEditor from "./FieldEditor";
import { IconPlus } from "./icons";

interface Props {
  name: string;
  fields: FormField[];
  onNameChange: (name: string) => void;
  onAddField: () => void;
  onUpdateField: (id: string, patch: Partial<FormField>) => void;
  onRemoveField: (id: string) => void;
  onReorder: (from: number, to: number) => void;
}

export default function FormBuilder({
  name,
  fields,
  onNameChange,
  onAddField,
  onUpdateField,
  onRemoveField,
  onReorder,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleDragEnd() {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      onReorder(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <section className="card">
      <div className="card-head">
        <div className="title-group">
          <span className="step-badge">1</span>
          <div>
            <h2>Build your form</h2>
            <span className="card-sub">
              {fields.length} field{fields.length === 1 ? "" : "s"} · add, configure, reorder
            </span>
          </div>
        </div>
      </div>

      <div className="card-body">
        <div className="builder-toprow">
          <div>
            <label className="label" htmlFor="form-name">
              Form name
            </label>
            <input
              id="form-name"
              className="input"
              value={name}
              placeholder="e.g. Candidate Application"
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>
        </div>

        {fields.length === 0 ? (
          <div className="empty-hint">
            No fields yet. Add your first field to start designing the form.
          </div>
        ) : (
          <div className="field-list">
            {fields.map((field, index) => (
              <FieldEditor
                key={field.id}
                field={field}
                index={index}
                onChange={(patch) => onUpdateField(field.id, patch)}
                onRemove={() => onRemoveField(field.id)}
                isDragging={dragIndex === index}
                isOver={overIndex === index && dragIndex !== index}
                onDragStartField={setDragIndex}
                onDragEnterField={setOverIndex}
                onDragEndField={handleDragEnd}
              />
            ))}
          </div>
        )}

        <div className="add-field-row">
          <button type="button" className="btn btn-primary" onClick={onAddField}>
            <IconPlus /> Add field
          </button>
        </div>
      </div>
    </section>
  );
}
