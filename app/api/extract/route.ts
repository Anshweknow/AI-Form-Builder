import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { buildExtractionTool } from "@/lib/schema";
import { ACCEPTED_MIME } from "@/lib/types";
import type { FormField, ExtractionResult } from "@/lib/types";

// The Anthropic SDK needs the Node.js runtime (not the Edge runtime).
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — Claude's request limit is 32 MB.
const DEFAULT_MODEL = "claude-opus-4-8";

export async function POST(req: Request) {
  // --- Preflight: make sure the app is actually configured. ---------------
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "The server is missing an ANTHROPIC_API_KEY. Copy .env.example to .env.local, add your key, and restart.",
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
      { error: "That file is too large (max 25 MB). Please upload a smaller document." },
      { status: 413 },
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  // --- Build the schema-driven request. -----------------------------------
  const tool = buildExtractionTool(fields);

  // PDFs go in as a `document` block; images as an `image` block. Claude reads
  // both natively (native PDF understanding + vision) — no separate OCR step.
  const documentBlock =
    mediaType === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        };

  const instructions = buildPrompt(fields);

  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 4096,
      tools: [tool as unknown as Anthropic.Tool],
      // Force the model to answer through our schema — no free-form prose.
      tool_choice: { type: "tool", name: "fill_form" },
      messages: [
        {
          role: "user",
          // Cast at the SDK boundary: the block shapes are built dynamically
          // above but are valid document/image/text content blocks.
          content: [documentBlock, { type: "text", text: instructions }] as unknown as Anthropic.ContentBlockParam[],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The document could not be processed for safety reasons." },
        { status: 422 },
      );
    }

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === "fill_form",
    );

    if (!toolUse) {
      return NextResponse.json(
        { error: "The AI did not return any values. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ results: toolUse.input as ExtractionResult });
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

function buildPrompt(fields: FormField[]): string {
  const lines = fields
    .map((f) => `- id "${f.id}": ${f.label || "(untitled)"} [${f.type}]`)
    .join("\n");

  return [
    "You are extracting data from the attached document to fill a form a user designed.",
    "Call the `fill_form` tool exactly once, providing an entry for every field id below.",
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
  if (err instanceof Anthropic.AuthenticationError) {
    return "The ANTHROPIC_API_KEY was rejected. Check the key in .env.local.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "The AI service is rate-limited right now. Please wait a moment and retry.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    return "The document could not be read — it may be corrupted or password-protected.";
  }
  if (err instanceof Anthropic.APIError) {
    return "The AI service returned an error. Please try again.";
  }
  return "Something went wrong while extracting. Please try again.";
}
