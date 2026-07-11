# FormFill AI — AI-Powered Form Builder & Document Autofill

> Tecnots AI Engineer assessment — **Question 1**

Design any form from scratch, upload a document (resume, invoice, ID, …), and let
Claude read the document and fill your form in automatically. Review, edit, and save
the result.

The same app builds a job-application form, an invoice-entry form, or a medical-intake
form with **zero code changes** — the AI extraction is driven entirely by whatever
fields you configure at runtime.

---

## ✨ What it does

**1 · Dynamic form builder** — add fields, give each a label, pick a type
(single-line text, multi-line text, number, date, dropdown, checkbox), mark it
required, remove it, and reorder by drag-and-drop. The preview updates live as you build.

**2 · Document upload** — drag-and-drop or pick a PDF / PNG / JPG / JPEG (≤ 25 MB), with
a clear success confirmation and specific errors for unsupported or empty files.

**3 · Schema-driven AI extraction** — the form you built is compiled into a JSON schema
that Claude *must* fill. Claude reads the document (native PDF understanding + vision —
no separate OCR step), extracts a value for every field, and populates the form. Fields
it can't find or isn't sure about are left blank rather than guessed.

**4 · Review & save** — every field is pre-filled and editable, each shows an AI
confidence badge, required fields still empty are highlighted at a glance, and you can
save the completed form (output shown as JSON).

### Bonus features included
- **Confidence indicators** — every extracted field shows High / Medium / Low confidence.
- **Real-time extraction display** — fields populate one-by-one as results come in.
- **Drag-and-drop reordering** of fields in the builder.
- **Form templates** — save a form to `localStorage` and reload it later.
- **Export / import** the form structure as a JSON file.

---

## 🚀 Run it locally

**Prerequisites:** Node.js 18.18+ (tested on Node 24) and an
[Anthropic API key](https://console.anthropic.com/).

```bash
# 1. Install dependencies
npm install

# 2. Add your API key
cp .env.example .env.local
#   then edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Start the dev server
npm run dev
```

Open **http://localhost:3000**.

A starter "Candidate Application" form is loaded so you can try it immediately: edit the
fields however you like, upload a résumé (or any document), and click
**Extract & autofill form**.

> Production build: `npm run build && npm start`.

---

## 🧠 How the AI extraction works

The magic is that extraction is **schema-driven**, not hardcoded:

1. The user's fields are turned into an Anthropic **tool** (`lib/schema.ts`).
   Each field becomes one required property (keyed by field id) of shape
   `{ value, confidence }`. The `value` sub-schema is chosen from the field's type
   (nullable string / number / boolean, or an `enum` for dropdowns).
2. The document is sent to Claude as a native `document` (PDF) or `image` block, together
   with the field list, and the model is **forced** to answer by calling that tool
   (`app/api/extract/route.ts`). Because every field is `required` with
   `additionalProperties: false` and `strict: true`, the response validates exactly
   against the schema — no brittle prose parsing.
3. The model is instructed to return `null` + `"low"` confidence for anything it can't
   find, so uncertain fields stay blank.
4. On the client, each raw value is **coerced and validated against its field type**
   (`coerceExtraction`): a number field with no numeric value, a date that won't parse,
   or a dropdown value that isn't an allowed option is dropped and flagged, rather than
   forced into the form.

Add a field and the schema, the prompt, and the extraction all follow automatically.

---

## 🛠 Technologies & why

| Choice | Why |
| --- | --- |
| **Next.js (App Router) + React + TypeScript** | One project for UI *and* the server route that holds the API key — a single `npm run dev` runs everything. TypeScript keeps the field/extraction contracts honest end-to-end. |
| **Claude (`claude-opus-4-8`) via the Anthropic SDK** | Claude reads **PDFs and images natively** — one model handles both document types with no OCR pipeline. **Tool use + strict schema** gives reliable, structured, per-field output with confidence. |
| **Structured tool call built at runtime** | Makes extraction genuinely schema-driven — the request shape is derived from the user's fields, so the app is form-agnostic. |
| **Hand-written CSS (no UI framework)** | Keeps the dependency/build surface tiny and reliable, while still giving a polished, responsive, light/dark-aware interface. |
| **`localStorage` for templates** | Templates are a convenience feature that doesn't need a backend or auth — local persistence is the right amount of infrastructure. |

The extraction model is configurable via the `ANTHROPIC_MODEL` env var (e.g.
`claude-sonnet-5` for a faster/cheaper option).

---

## ✅ Edge cases handled

| Situation | Behaviour |
| --- | --- |
| Required field has no matching data | Left blank and highlighted red for manual completion |
| Upload attempted before any fields exist | Upload is blocked with a message to build the form first |
| Unsupported / corrupted / empty file | Specific, human-readable error; the user is asked to try again |
| Number field with no numeric value found | Left blank with a "No numeric value found" note |
| AI not confident about a value | Value left blank (not a guess) and flagged Low / Empty |
| AI returns a dropdown value that isn't an option, or an unparseable date | Dropped and flagged, never forced into the field |
| Try to save with required fields empty | Save is blocked and the empty required fields are called out |

---

## 📁 Project structure

```
app/
  api/extract/route.ts   # Server route: builds the schema, calls Claude, returns values
  page.tsx               # Main app state & orchestration (client)
  layout.tsx, globals.css
components/
  FormBuilder.tsx        # Field list, add field, drag-to-reorder
  FieldEditor.tsx        # A single configurable field
  DocumentUpload.tsx     # Upload + validation + confirmation
  FormPreview.tsx        # Live preview / review / edit / save
  Toolbar.tsx            # Templates, import/export, starter form
  icons.tsx
lib/
  types.ts               # Shared types
  schema.ts              # Build the extraction tool + coerce/validate results
  storage.ts             # Field/template helpers (localStorage)
```

---

## 🤔 Assumptions & trade-offs

- **API key lives server-side.** All Claude calls go through the Next.js route handler so
  the key is never exposed to the browser.
- **Extraction is non-streaming.** The output (a single structured tool call) is small, so
  a single request is simplest and fastest. The "fields fill in one-by-one" effect is a
  client-side reveal of the already-received results — honest and smooth, without the extra
  complexity of parsing a partial tool-call stream.
- **Templates use `localStorage`, not a database.** No accounts or backend storage — the
  brief's persistence needs are per-user and local, so this keeps the app self-contained.
- **Field values are edited as strings** (except checkboxes) and validated/typed on save;
  this keeps the controlled inputs simple while still producing correctly-typed output.
- **25 MB upload cap** (Claude's request limit is 32 MB) — comfortably covers résumés,
  invoices and scans.
