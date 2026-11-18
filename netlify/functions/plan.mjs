// Netlify Function: POST /api/plan
// Calls Google Gemini with the user's event details and returns a generated plan.
// The API key lives only on the server (Netlify env var GEMINI_API_KEY).

const BASE = "https://generativelanguage.googleapis.com/v1beta";
// Preferred models, newest first. GEMINI_MODEL (env var) overrides all of them.
const PREFERRED = [
  process.env.GEMINI_MODEL,
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
].filter(Boolean);
let cachedModel = null; // remembered while the function instance stays warm

// Ask the API which models this key can use, and pick the best Flash model available.
async function discoverModel(key) {
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
  if (!r.ok) return null;
  const { models = [] } = await r.json();
  const usable = models
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
  for (const p of PREFERRED) if (usable.includes(p)) return p;
  return usable.find((n) => /flash/.test(n) && !/(lite|live|image|tts|audio|preview|exp)/.test(n))
      || usable.find((n) => /flash/.test(n))
      || usable[0] || null;
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const clip = (v, n) => String(v ?? "").slice(0, n).trim();

const blueprintSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    assumptions: { type: "STRING" },
    concept: { type: "STRING" },
    allocation: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, pct: { type: "NUMBER" }, note: { type: "STRING" } },
        required: ["name", "pct", "note"],
      },
    },
    timeline: { type: "ARRAY", items: { type: "STRING" } },
    localTips: { type: "ARRAY", items: { type: "STRING" } },
    vendorChecklist: { type: "ARRAY", items: { type: "STRING" } },
    risks: { type: "ARRAY", items: { type: "STRING" } },
    tasks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { title: { type: "STRING" }, detail: { type: "STRING" }, when: { type: "STRING" } },
        required: ["title", "detail", "when"],
      },
    },
    confidence: { type: "NUMBER" },
    confidenceReason: { type: "STRING" },
  },
  required: ["title", "assumptions", "concept", "allocation", "timeline", "localTips",
             "vendorChecklist", "risks", "tasks", "confidence", "confidenceReason"],
};

const crisisSchema = {
  type: "OBJECT",
  properties: {
    scenario: { type: "STRING" },
    first15: { type: "STRING" },
    nextHour: { type: "STRING" },
    budgetGuard: { type: "STRING" },
    communication: { type: "STRING" },
    verify: { type: "STRING" },
  },
  required: ["scenario", "first15", "nextHour", "budgetGuard", "communication", "verify"],
};

function blueprintPrompt(e) {
  return `You are an expert Indian event planner. Create a practical, specific plan for this event.

EVENT TYPE: ${e.type}
CITY: ${e.city}
GUESTS: ${e.guests}
TOTAL BUDGET: INR ${e.budget}
USER'S VISION: ${e.vision || "(none given — propose a fitting concept)"}

Rules:
- Everything must be specific to ${e.city} and to a ${e.type.toLowerCase()} of ${e.guests} guests: local climate and best seasons, typical venue styles and areas in ${e.city}, local cuisine, traffic/transport, local permissions or noise rules, and cultural customs where relevant.
- Budget allocation: 4–6 categories whose pct values sum to exactly 100, sized for this budget per guest (INR ${Math.round(e.budget / Math.max(e.guests, 1))} per head) in ${e.city}. Flag it in risks if the budget is unrealistic.
- Timeline: 5–7 bullet strings, earliest first.
- localTips: 3–5 tips that only apply to ${e.city}.
- tasks: 5–7 checklist items, "when" in short uppercase like "THIS WEEK" or "3 MONTHS".
- confidence: 0–100, how feasible the plan is with this budget and guest count; explain in confidenceReason (one sentence).
- Do not invent specific vendor names, phone numbers or exact prices. Give price ranges as estimates.`;
}

function crisisPrompt(e) {
  return `You are an event crisis manager. Generate a recovery playbook for a realistic last-minute crisis for this event.

EVENT: ${e.type} in ${e.city}, ${e.guests} guests, budget INR ${e.budget}
VISION: ${e.vision || "(not given)"}
TRACKED EXPENSES SO FAR: INR ${e.spent}
VENDORS (name — category — status): ${e.vendors || "none tracked"}

Pick one plausible crisis for this specific event and city (for example a key vendor cancelling, weather typical for ${e.city}, a venue power failure). Name it in "scenario". Keep each section to 2–3 sentences, specific to ${e.city} and this budget. In budgetGuard, use the real figures above (10% reserve = INR ${Math.round(e.budget * 0.1)}). Never invent vendor names or phone numbers.`;
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(500, { error: "Server is missing GEMINI_API_KEY" });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  const e = {
    type: ["Wedding", "Birthday", "Community"].includes(body.type) ? body.type : "Event",
    city: clip(body.city, 80),
    vision: clip(body.vision, 1000),
    budget: Number(body.budget),
    guests: Number(body.guests),
    spent: Number(body.spent) || 0,
    vendors: Array.isArray(body.vendors)
      ? body.vendors.slice(0, 20).map((v) => `${clip(v.name, 60)} — ${clip(v.category, 30)} — ${clip(v.status, 30)}`).join("; ")
      : "",
  };
  if (!e.city || !Number.isFinite(e.budget) || e.budget < 1000 || !Number.isInteger(e.guests) || e.guests < 1) {
    return json(400, { error: "Enter a valid city, budget (≥ ₹1,000) and guest count." });
  }

  const mode = body.mode === "crisis" ? "crisis" : "blueprint";
  const payload = {
    contents: [{ role: "user", parts: [{ text: mode === "crisis" ? crisisPrompt(e) : blueprintPrompt(e) }] }],
    generationConfig: {
      temperature: 0.8,
      responseMimeType: "application/json",
      responseSchema: mode === "crisis" ? crisisSchema : blueprintSchema,
    },
  };

  const callModel = (model) =>
    fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(payload),
    });

  try {
    let model = cachedModel || PREFERRED[0];
    let r = await callModel(model);
    if (r.status === 404) {
      // Model name not available for this key (renamed or retired): find one that is.
      const found = await discoverModel(key);
      if (found && found !== model) { model = found; r = await callModel(model); }
    }
    if (!r.ok) {
      const detail = await r.text();
      console.error("Gemini error", model, r.status, detail);
      return json(502, { error: `AI service error (${r.status}) using ${model}. Please try again.` });
    }
    cachedModel = model;
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    const result = JSON.parse(text);
    return json(200, { mode, model, generatedAt: new Date().toISOString(), result });
  } catch (err) {
    console.error(err);
    return json(502, { error: "Could not generate a plan right now. Please try again." });
  }
};

export const config = { path: "/api/plan" };
