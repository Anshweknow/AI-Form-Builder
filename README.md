# FormFill AI — AI-Powered Form Builder & Document Autofill

> Tecnots AI Engineer assessment — **Question 1**

Design any form from scratch, upload a document (resume, invoice, ID, …), and let
Gemini read the document and fill your form in automatically. Review, edit, and save
the result.

The same app builds a job-application form, an invoice-entry form, or a medical-intake
form with **zero code changes** — the AI extraction is driven entirely by whatever
fields you configure at runtime.

---

## ✨ What it does

**1 · Dynamic form builder** — add fields, give each a label, pick a type
(single-line text, multi-line text, number, date, dropdown, checkbox), mark it
required, remove it, and reorder by drag-and-drop. The preview updates live as you build.

**2 · Document upload** — drag-and-drop or pick a PDF / PNG / JPG / JPEG (≤ 15 MB), with
a clear success confirmation and specific errors for unsupported or empty files.

**3 · Schema-driven AI extraction** — the form you built is compiled into a JSON schema
that Gemini *must* fill. Gemini reads the document (native PDF understanding + vision —
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

**Prerequisites:** Node.js 18.18+ (tested on Node 24) and a
[Google Gemini API key](https://aistudio.google.com/apikey) (free tier works).

```bash
# 1. Install dependencies
npm install

# 2. Add your API key
cp .env.example .env.local
#   then edit .env.local and set GEMINI_API_KEY=your-key

# 3. Start the dev server
npm run dev
```

Open **http://localhost:3000**.

A starter "Candidate Application" form is loaded so you can try it immediately: edit the
fields however you like, upload a résumé (or any document), and click
**Extract & autofill form**. Use **New form** to start from a blank slate.

> Production build: `npm run build && npm start`.

### Deploying to Vercel
Import the repo, and add an environment variable **`GEMINI_API_KEY`** in
**Project Settings → Environment Variables** (Production). The included
[`vercel.json`](vercel.json) pins the framework to Next.js.

---

## 🧠 How the AI extraction works

The key idea is that extraction is **schema-driven**, not hardcoded:

1. The user's fields are turned into a Gemini **`responseSchema`**
   (`app/api/extract/route.ts`). Each field becomes one required property (keyed by field
   id) of shape `{ value, confidence }`. The `value` type is chosen from the field's type
   (nullable string / number / boolean, or an `enum` for dropdowns).
2. The document is sent to Gemini as inline data (PDF or image) together with the field
   list, with `responseMimeType: "application/json"` and that schema — so the response is
   **guaranteed to be valid JSON in exactly the shape we asked for**, no brittle prose
   parsing.
3. The model is instructed to return `null` + `"low"` confidence for anything it can't
   find, so uncertain fields stay blank.
4. On the client, each raw value is **coerced and validated against its field type**
   (`coerceExtraction` in `lib/schema.ts`): a number field with no numeric value, a date
   that won't parse, or a dropdown value that isn't an allowed option is dropped and
   flagged, rather than forced into the form.

Add a field and the schema, the prompt, and the extraction all follow automatically.

---

## 🛠 Technologies & why

| Choice | Why |
| --- | --- |
| **Next.js (App Router) + React + TypeScript** | One project for UI *and* the server route that holds the API key — a single `npm run dev` runs everything. TypeScript keeps the field/extraction contracts honest end-to-end. |
| **Google Gemini (`gemini-2.5-flash`) via `@google/genai`** | Gemini reads **PDFs and images natively** — one model handles both document types with no OCR pipeline. It's fast, has a generous free tier, and supports **structured output** (`responseSchema`) for reliable, per-field JSON with confidence. |
| **`responseSchema` built at runtime** | Makes extraction genuinely schema-driven — the response shape is derived from the user's fields, so the app is form-agnostic. |
| **Hand-written CSS (no UI framework)** | Keeps the dependency/build surface tiny and reliable, while still giving a polished, responsive, light/dark-aware interface. |
| **`localStorage` for templates** | Templates are a convenience feature that doesn't need a backend or auth — local persistence is the right amount of infrastructure. |

The extraction model is configurable via the `GEMINI_MODEL` env var (e.g.
`gemini-2.5-pro` for higher accuracy).

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
  api/extract/route.ts   # Server route: builds the schema, calls Gemini, returns values
  page.tsx               # Main app state & orchestration (client)
  layout.tsx, globals.css
components/
  FormBuilder.tsx        # Field list, add field, drag-to-reorder
  FieldEditor.tsx        # A single configurable field
  DocumentUpload.tsx     # Upload + validation + confirmation
  FormPreview.tsx        # Live preview / review / edit / save
  Toolbar.tsx            # New / starter, templates, import/export
  icons.tsx
lib/
  types.ts               # Shared types
  schema.ts              # Coerce/validate the AI's values against each field type
  storage.ts             # Field/template helpers (localStorage)
```

---

## 🤔 Assumptions & trade-offs

- **API key lives server-side.** All Gemini calls go through the Next.js route handler so
  the key is never exposed to the browser.
- **Extraction is non-streaming.** The output (one structured JSON object) is small, so a
  single request is simplest and fastest. The "fields fill in one-by-one" effect is a
  client-side reveal of the already-received results — honest and smooth, without the extra
  complexity of parsing a partial stream.
- **Templates use `localStorage`, not a database.** No accounts or backend storage — the
  brief's persistence needs are per-user and local, so this keeps the app self-contained.
- **Field values are edited as strings** (except checkboxes) and validated/typed on save;
  this keeps the controlled inputs simple while still producing correctly-typed output.
- **15 MB upload cap** — Gemini accepts inline file data up to ~20 MB per request; 15 MB of
  raw file comfortably covers résumés, invoices and scans while staying under that limit.
