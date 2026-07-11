import { NextResponse } from "next/server";
import { GoogleGenAI, Type, type Schema } from "@google/genai";

import { ACCEPTED_MIME } from "@/lib/types";
import type { FormField, ExtractionResult } from "@/lib/types";

// The Google GenAI SDK needs the Node.js runtime (not the Edge runtime).
export const runtime = "nodejs";
export const maxDuration = 60;

// Gemini accepts inline file data up to ~20 MB per request (base64 inflates the
// bytes ~33%), so cap the raw upload comfortably below that.
const MAX_BYTES = 15 * 1024 * 1024;
const DEFAULT_MODEL = "gemini-2.5-flash";

function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

export async function POST(req: Request) {
  // --- Preflight: make sure the app is actually configured. ---------------
  if (!apiKey()) {
    return NextResponse.json(
      {
        error:
          "The server is missing a GEMINI_API_KEY. Copy .env.example to .env.local, add your key, and restart.",
      },
      { status: 500 },
    );
  }

  // --- Parse the multipart request. ---------------------------------------
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read the upload. Please try again." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const schemaRaw = form.get("schema");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

  let fields: FormField[];
  try {
    fields = JSON.parse(String(schemaRaw));
  } catch {
    return NextResponse.json({ error: "The form definition was invalid." }, { status: 400 });
  }

  if (!Array.isArray(fields) || fields.length === 0) {
    return NextResponse.json(
      { error: "Build at least one form field before uploading a document." },
      { status: 400 },
    );
  }

  // --- Validate the file. -------------------------------------------------
  const mediaType = ACCEPTED_MIME[file.type] ?? mimeFromName(file.name);
  if (!mediaType) {
    return NextResponse.json(
      { error: `Unsupported file type. Please upload a PDF, PNG, JPG or JPEG.` },
      { status: 415 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json(
      { error: "That file looks empty or corrupted. Please try a different file." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is too large (max 15 MB). Please upload a smaller document." },
      { status: 413 },
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  // --- Build the schema-driven request. -----------------------------------
  // Gemini reads PDFs and images natively; the response is constrained to a
  // JSON object keyed by field id, so there's no brittle prose parsing.
  const responseSchema = buildResponseSchema(fields);
  const instructions = buildPrompt(fields);

  const ai = new GoogleGenAI({ apiKey: apiKey() });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mediaType, data: base64 } },
            { text: instructions },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema,
        maxOutputTokens: 8192,
        temperature: 0,
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json(
        { error: "The AI could not read that document. Please try a clearer file." },
        { status: 502 },
      );
    }

    let results: ExtractionResult;
    try {
      results = JSON.parse(text) as ExtractionResult;
    } catch {
      return NextResponse.json(
        { error: "The AI returned an unexpected response. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 502 });
  }
}

function mimeFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

/**
 * Build the Gemini `responseSchema`: one required property per form field
 * (keyed by field id), each an object of `{ value, confidence }`. The `value`
 * type is chosen from the field's type and is nullable so the model can leave
 * anything it can't find blank.
 */
function buildResponseSchema(fields: FormField[]): Schema {
  const properties: Record<string, Schema> = {};
  const required: string[] = [];

  for (const field of fields) {
    properties[field.id] = {
      type: Type.OBJECT,
      description: fieldGuidance(field),
      properties: {
        value: valueSchema(field),
        confidence: {
          type: Type.STRING,
          enum: ["high", "medium", "low"],
          description:
            "How sure you are this value is correct for this field. Use 'low' if you are guessing.",
        },
      },
      required: ["value", "confidence"],
      propertyOrdering: ["value", "confidence"],
    };
    required.push(field.id);
  }

  return {
    type: Type.OBJECT,
    properties,
    required,
    propertyOrdering: fields.map((f) => f.id),
  };
}

function valueSchema(field: FormField): Schema {
  switch (field.type) {
    case "number":
      return { type: Type.NUMBER, nullable: true };
    case "checkbox":
      return { type: Type.BOOLEAN, nullable: true };
    case "dropdown": {
      const options = field.options.filter((o) => o.trim().length > 0);
      if (options.length > 0) return { type: Type.STRING, enum: options, nullable: true };
      return { type: Type.STRING, nullable: true };
    }
    default:
      return { type: Type.STRING, nullable: true };
  }
}

function fieldGuidance(field: FormField): string {
  const bits: string[] = [`Label: "${field.label || "(untitled)"}"`];
  switch (field.type) {
    case "number":
      bits.push("Return a numeric value only, or null if none found.");
      break;
    case "date":
      bits.push('Return an ISO date string "YYYY-MM-DD", or null.');
      break;
    case "checkbox":
      bits.push("Return true or false, or null if unknown.");
      break;
    case "dropdown":
      bits.push(
        `Return EXACTLY one of: ${field.options
          .filter((o) => o.trim())
          .map((o) => `"${o}"`)
          .join(", ") || "(no options defined)"} — or null if none fits.`,
      );
      break;
    case "textarea":
      bits.push("Long text; multiple lines / items are fine, or null.");
      break;
    default:
      bits.push("Short text, or null.");
  }
  if (field.required) bits.push("This field is required.");
  return bits.join(" ");
}

function buildPrompt(fields: FormField[]): string {
  const lines = fields
    .map((f) => `- id "${f.id}": ${f.label || "(untitled)"} [${f.type}]`)
    .join("\n");

  return [
    "You are extracting data from the attached document to fill a form a user designed.",
    "Return a JSON object with an entry for every field id below.",
    "",
    "Fields:",
    lines,
    "",
    "Rules:",
    "- Only use information that is actually present in the document.",
    "- If a field's value is not present, or you are not confident, set value to null and confidence to \"low\". Do not guess.",
    "- Numbers must be numeric, dates must be YYYY-MM-DD, and dropdown choices must match the allowed options exactly.",
    "- Set confidence to \"high\" only when the value is stated clearly and unambiguously.",
  ].join("\n");
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/API key|API_KEY_INVALID|permission|401|403/i.test(msg)) {
    return "The GEMINI_API_KEY was rejected. Check the key in .env.local (or your host's env vars).";
  }
  if (/quota|rate|429|RESOURCE_EXHAUSTED/i.test(msg)) {
    return "The AI service is rate-limited or out of quota right now. Please wait a moment and retry.";
  }
  if (/unsupported|invalid|corrupt/i.test(msg)) {
    return "The document could not be read — it may be corrupted or password-protected.";
  }
  return "Something went wrong while extracting. Please try again.";
}
