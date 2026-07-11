"use client";

import { useRef, useState } from "react";
import type { StoredTemplate } from "@/lib/storage";
import {
  IconSave,
  IconFolder,
  IconDownload,
  IconUpload,
  IconTrash,
  IconSparkles,
  IconFilePlus,
} from "./icons";

interface Props {
  canSave: boolean;
  templates: StoredTemplate[];
  onNew: () => void;
  onStarter: () => void;
  onSaveTemplate: () => void;
  onLoadTemplate: (t: StoredTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
}

export default function Toolbar({
  canSave,
  templates,
  onNew,
  onStarter,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  onExport,
  onImportFile,
}: Props) {
  const [openTemplates, setOpenTemplates] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  return (
    <div className="toolbar">
      <button type="button" className="btn btn-sm" onClick={onNew} title="Start a blank form from scratch">
        <IconFilePlus /> New form
      </button>

      <button type="button" className="btn btn-sm" onClick={onStarter} title="Load an example form">
        <IconSparkles /> Starter form
      </button>

      <button
        type="button"
        className="btn btn-sm"
        onClick={onSaveTemplate}
        disabled={!canSave}
        title="Save this form to reload later"
      >
        <IconSave /> Save template
      </button>

      <div className="popover">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setOpenTemplates((o) => !o)}
          title="Load a saved form"
        >
          <IconFolder /> Templates {templates.length > 0 && `(${templates.length})`}
        </button>
        {openTemplates && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 10 }}
              onClick={() => setOpenTemplates(false)}
            />
            <div className="popover-panel">
              {templates.length === 0 ? (
                <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 13 }}>
                  No saved templates yet. Build a form and click “Save template”.
                </div>
              ) : (
                templates.map((t) => (
                  <div
                    key={t.id}
                    className="template-item"
                    onClick={() => {
                      onLoadTemplate(t);
                      setOpenTemplates(false);
                    }}
                  >
                    <div className="t-meta">
                      <div className="t-name">{t.name}</div>
                      <div className="t-sub">
                        {t.fields.length} field{t.fields.length === 1 ? "" : "s"} ·{" "}
                        {new Date(t.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger-ghost"
                      title="Delete template"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTemplate(t.id);
                      }}
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        className="btn btn-sm"
        onClick={onExport}
        disabled={!canSave}
        title="Download the form structure as JSON"
      >
        <IconDownload /> Export
      </button>

      <button
        type="button"
        className="btn btn-sm"
        onClick={() => importRef.current?.click()}
        title="Load a form structure from a JSON file"
      >
        <IconUpload /> Import
      </button>
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
