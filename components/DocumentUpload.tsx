"use client";

import { useRef, useState } from "react";
import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME } from "@/lib/types";
import {
  IconUpload,
  IconFile,
  IconSparkles,
  IconCheck,
  IconAlert,
  IconInfo,
} from "./icons";

interface Props {
  fieldsExist: boolean;
  extracting: boolean;
  extractError: string | null;
  onExtract: (file: File) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isSupported(file: File): boolean {
  if (ACCEPTED_MIME[file.type]) return true;
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export default function DocumentUpload({
  fieldsExist,
  extracting,
  extractError,
  onExtract,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!isSupported(f)) {
      setFile(null);
      setLocalError(
        `"${f.name}" is not a supported file type. Please upload a PDF, PNG, JPG or JPEG.`,
      );
      return;
    }
    if (f.size === 0) {
      setFile(null);
      setLocalError("That file appears to be empty or corrupted. Please try another.");
      return;
    }
    setLocalError(null);
    setFile(f);
  }

  const disabled = !fieldsExist;

  return (
    <section className="card">
      <div className="card-head">
        <div className="title-group">
          <span className="step-badge">2</span>
          <div>
            <h2>Upload a document</h2>
            <span className="card-sub">PDF, PNG, JPG or JPEG — up to 15 MB</span>
          </div>
        </div>
      </div>

      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!fieldsExist && (
          <div className="banner banner-info">
            <IconInfo />
            <span>Build your form first — add at least one field before uploading a document.</span>
          </div>
        )}

        {!file && (
          <div
            className={"dropzone" + (over ? " over" : "") + (disabled ? " disabled" : "")}
            onClick={() => !disabled && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (!disabled) pickFile(e.dataTransfer.files?.[0]);
            }}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            onKeyDown={(e) => {
              if (!disabled && (e.key === "Enter" || e.key === " ")) inputRef.current?.click();
            }}
          >
            <div className="dropzone-icon">
              <IconUpload style={{ width: 26, height: 26 }} />
            </div>
            <div className="dropzone-title">Click to upload or drag &amp; drop</div>
            <div className="dropzone-hint">A resume, invoice, ID or any document with the data you need</div>
            <input
              ref={inputRef}
              type="file"
              className="visually-hidden"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>
        )}

        {localError && (
          <div className="banner banner-error">
            <IconAlert />
            <span>{localError}</span>
          </div>
        )}

        {file && (
          <>
            <div className="banner banner-ok">
              <IconCheck />
              <span>Uploaded successfully — ready to extract.</span>
            </div>

            <div className="file-chip">
              <IconFile style={{ width: 20, height: 20, color: "var(--accent)" }} />
              <div className="file-meta">
                <div className="file-name">{file.name}</div>
                <div className="file-size">{formatBytes(file.size)}</div>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setFile(null);
                  setLocalError(null);
                }}
                disabled={extracting}
              >
                Change
              </button>
            </div>

            {extractError && (
              <div className="banner banner-error">
                <IconAlert />
                <span>{extractError}</span>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => onExtract(file)}
              disabled={extracting}
            >
              {extracting ? (
                <>
                  <span className="spinner" /> Reading document…
                </>
              ) : (
                <>
                  <IconSparkles /> Extract &amp; autofill form
                </>
              )}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
