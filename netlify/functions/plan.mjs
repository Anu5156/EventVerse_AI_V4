// Netlify Function: POST /api/plan
// Calls Google Gemini with the user's event details and returns a generated plan.
// The API key lives only on the server (Netlify env var GEMINI_API_KEY).

const BASE = "https://generativelanguage.googleapis.com/v1beta";
// Models to try in order. GEMINI_MODEL (env var), if set, is tried first.
const PREFERRED = [
  process.env.GEMINI_MODEL,
  // Fast "lite" models first: they answer in seconds and are rarely overloaded on free keys.
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
].filter(Boolean);
let cachedModel = null; // remembered while the function instance stays warm

// Ask the API which text models this key can use. Returns Flash models first.
async function discoverModels(key) {
  try {
    const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
    if (!r.ok) return [];
    const { models = [] } = await r.json();
    const usable = models
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .filter((n) => /gemini/.test(n) && !/(live|image|tts|audio|embedding|robotics|computer)/.test(n));
    const flash = usable.filter((n) => /flash/.test(n) && !/(preview|exp)/.test(n));
    return [...new Set([...flash, ...usable.filter((n) => /flash/.test(n))])].slice(0, 6);
  } catch { return []; }
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

// Spell the budget out clearly so the model can't misread the number of zeros.
export const inr = (n) => `INR ${Number(n).toLocaleString("en-IN")} (₹${(Number(n) / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh)`;

export function blueprintPrompt(e) {
  return `You are an expert Indian event planner. Create a practical, specific plan for this event.

EVENT TYPE: ${e.type}
CITY: ${e.city}
GUESTS: ${e.guests}
TOTAL BUDGET: ${inr(e.budget)} — use exactly this amount
USER'S VISION: ${e.vision || "(none given — propose a fitting concept)"}

Rules:
- Everything must be specific to ${e.city} and to a ${e.type.toLowerCase()} of ${e.guests} guests: local climate and best seasons, typical venue styles and areas in ${e.city}, local cuisine, traffic/transport, local permissions or noise rules, and cultural customs where relevant.
- Budget allocation: 4–6 categories whose pct values sum to exactly 100, sized for this budget per guest (INR ${Math.round(e.budget / Math.max(e.guests, 1)).toLocaleString("en-IN")} per head) in ${e.city}. Flag it in risks if the budget is unrealistic.
- Timeline: 5–7 bullet strings, earliest first.
- localTips: 3–5 tips that only apply to ${e.city}.
- tasks: 5–7 checklist items, "when" in short uppercase like "THIS WEEK" or "3 MONTHS".
- confidence: 0–100, how feasible the plan is with this budget and guest count; explain in confidenceReason (one sentence).
- Do not invent specific vendor names, phone numbers or exact prices. Give price ranges as estimates.`;
}

export function crisisPrompt(e) {
  return `You are an event crisis manager. Generate a recovery playbook for a realistic last-minute crisis for this event.

EVENT: ${e.type} in ${e.city}, ${e.guests} guests, budget ${inr(e.budget)}
VISION: ${e.vision || "(not given)"}
TRACKED EXPENSES SO FAR: ${inr(e.spent)}
VENDORS (name — category — status): ${e.vendors || "none tracked"}

Pick one plausible crisis for this specific event and city (for example a key vendor cancelling, weather typical for ${e.city}, a venue power failure). Name it in "scenario". Keep each section to 2–3 sentences, specific to ${e.city} and this budget. In budgetGuard, use the real figures above (10% reserve = ${inr(Math.round(e.budget * 0.1))}). Never invent vendor names or phone numbers.`;
}

/** Clean and validate the request body. Returns { event } or { error }. */
export function parseEvent(body) {
  if (!body || typeof body !== "object") return { error: "Missing event details." };
  const event = {
    type: ["Wedding", "Birthday", "Community"].includes(body.type) ? body.type : "Event",
    city: clip(body.city, 80),
    vision: clip(body.vision, 1000),
    budget: Number(body.budget),
    guests: Number(body.guests),
    spent: Number(body.spent) || 0,
    vendors: Array.isArray(body.vendors)
      ? body.vendors.slice(0, 20).map((v) => `${clip(v?.name, 60)} — ${clip(v?.category, 30)} — ${clip(v?.status, 30)}`).join("; ")
      : "",
  };
  if (!event.city || !Number.isFinite(event.budget) || event.budget < 1000 || !Number.isInteger(event.guests) || event.guests < 1) {
    return { error: "Enter a valid city, budget (≥ ₹1,000) and guest count." };
  }
  return { event };
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(500, { error: "Server is missing GEMINI_API_KEY" });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  const { event: e, error } = parseEvent(body);
  if (error) return json(400, { error });

  const mode = body?.mode === "crisis" ? "crisis" : "blueprint";
  const payload = {
    contents: [{ role: "user", parts: [{ text: mode === "crisis" ? crisisPrompt(e) : blueprintPrompt(e) }] }],
    generationConfig: {
      temperature: 0.8,
      responseMimeType: "application/json",
      responseSchema: mode === "crisis" ? crisisSchema : blueprintSchema,
    },
  };

  const callModel = (model, signal) =>
    fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(payload),
      signal,
    });

  // Try models in order. If one is busy (503/429/5xx), missing (404) or too slow,
  // move to the next one, while staying inside Netlify's function time limit.
  const started = Date.now();
  const DEADLINE_MS = 24000;
  const queue = [...new Set([cachedModel, ...PREFERRED].filter(Boolean))];
  let discovered = false, lastError = "unknown";

  while (queue.length) {
    const remaining = DEADLINE_MS - (Date.now() - started);
    if (remaining < 3000) break;
    const model = queue.shift();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(remaining, 20000));
    try {
      const r = await callModel(model, ctrl.signal);
      if (r.ok) {
        const data = await r.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
        const result = JSON.parse(text);
        cachedModel = model;
        return json(200, { mode, model, generatedAt: new Date().toISOString(), result });
      }
      lastError = `${r.status} from ${model}`;
      console.error("Gemini error", model, r.status, (await r.text()).slice(0, 500));
      if (r.status === 400 || r.status === 401 || r.status === 403) break; // key/request problem: retrying won't help
      if (r.status === 404 && !discovered) {
        discovered = true;
        for (const m of await discoverModels(key)) if (!queue.includes(m) && m !== model) queue.push(m);
      }
      if (cachedModel === model) cachedModel = null;
    } catch (err) {
      lastError = err.name === "AbortError" ? `${model} timed out` : String(err.message || err);
      console.error("Gemini call failed", model, lastError);
    } finally {
      clearTimeout(timer);
    }
  }
  return json(502, { error: `The AI is busy right now (${lastError}). Please try again in a moment.` });
};

export const config = { path: "/api/plan" };
