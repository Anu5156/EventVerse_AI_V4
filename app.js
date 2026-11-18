/**
 * EventVerse AI V4 — front-end logic.
 *
 * Two parts:
 *  1. Pure helper functions (no DOM). Exported for the Node tests and as window.EventVerse.
 *  2. The browser app (DOM). Calls the Gemini-backed server function at /api/plan to
 *     generate the event blueprint and the crisis playbook from the user's own inputs.
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------------
  // 1. Pure helpers
  // ---------------------------------------------------------------------------

  const API_URL = "/api/plan";
  const STORAGE_KEY = "eventverse-v5-state";
  const EVENT_TYPES = ["Wedding", "Birthday", "Community"];

  /** Starting budget split shown before the AI has generated a plan (sums to 100). */
  const allocationSpec = Object.freeze([
    { name: "Venue & setup", pct: 25, note: "Space + essentials" },
    { name: "Food & beverage", pct: 40, note: "Guest experience" },
    { name: "Decor & production", pct: 15, note: "Theme + ambience" },
    { name: "Photo & entertainment", pct: 10, note: "Memories + energy" },
    { name: "Reserve & other", pct: 10, note: "Keep a safety net" }
  ]);

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function defaultTasks() {
    return [
      { id: uid(), title: "Define the vision and guest list", detail: "Confirm style, priorities and must-haves", when: "THIS WEEK", done: false },
      { id: uid(), title: "Shortlist venues and request quotes", detail: "Check capacity, access, taxes and inclusions", when: "4–6 MONTHS", done: false },
      { id: uid(), title: "Confirm catering and key vendors", detail: "Compare written quotes and cancellation terms", when: "3–4 MONTHS", done: false },
      { id: uid(), title: "Send invitations and collect RSVPs", detail: "Track dietary and accessibility needs", when: "6–8 WEEKS", done: false },
      { id: uid(), title: "Finalize run of show and backup plan", detail: "Share timings, contacts and contingency roles", when: "1 WEEK", done: false }
    ];
  }

  const money = (n) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);

  const safe = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /** Rupee amount per category. Rounding leftovers go to the last category so the total equals the budget. */
  function calculateAllocations(budget, spec = allocationSpec) {
    const total = Math.max(0, Math.round(Number(budget) || 0));
    const rows = spec.map((a) => ({ ...a, amount: Math.round((total * a.pct) / 100) }));
    if (rows.length) {
      const diff = total - rows.reduce((s, r) => s + r.amount, 0);
      rows[rows.length - 1].amount += diff;
    }
    return rows;
  }

  function calculateRemaining(budget, expenses) {
    const list = Array.isArray(expenses) ? expenses : [];
    const total = list.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const paid = list.filter((e) => e.status === "Paid").reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const remaining = (Number(budget) || 0) - total;
    return { total, paid, remaining, isOverBudget: remaining < 0 };
  }

  /** Budget figures the crisis playbook is built around (10% reserve kept aside). */
  function simulateCrisisData(budget, expenses) {
    const { total } = calculateRemaining(budget, expenses);
    return { reserve: Math.round((Number(budget) || 0) * 0.1), total, isReserveGuarded: true };
  }

  /** RFC 4180 CSV with a UTF-8 BOM so Excel opens Indian text correctly. */
  function formatCsv(headers, rows) {
    const line = (row) => row.map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(",");
    return "﻿" + [headers, ...rows].map(line).join("\r\n");
  }

  /** Clean up the AI's budget split: keep valid rows, rescale so it sums to exactly 100. */
  function normalizeAllocation(list) {
    const clean = (Array.isArray(list) ? list : [])
      .filter((a) => a && a.name && Number(a.pct) > 0)
      .slice(0, 8);
    const sum = clean.reduce((s, a) => s + Number(a.pct), 0);
    if (!clean.length || !sum) return allocationSpec.map((a) => ({ ...a }));
    const rows = clean.map((a) => ({
      name: String(a.name),
      note: String(a.note || ""),
      pct: Math.round((Number(a.pct) / sum) * 1000) / 10
    }));
    const drift = Math.round((100 - rows.reduce((s, r) => s + r.pct, 0)) * 10) / 10;
    rows[0].pct = Math.round((rows[0].pct + drift) * 10) / 10;
    return rows;
  }

  /** Validate the intake form. Returns an error message, or "" when valid. */
  function validateEvent(ev) {
    const budget = Number(ev.budget);
    const guests = Number(ev.guests);
    if (!String(ev.city || "").trim()) return "Enter the event city.";
    if (!Number.isFinite(budget) || budget < 1000) return "Enter a budget of at least ₹1,000.";
    if (!Number.isInteger(guests) || guests < 1) return "Enter a whole number of guests (at least 1).";
    return "";
  }

  /** The JSON body sent to /api/plan — built only from what the user entered. */
  function buildPlanRequest(mode, s) {
    return {
      mode: mode === "crisis" ? "crisis" : "blueprint",
      type: EVENT_TYPES.includes(s.type) ? s.type : "Wedding",
      city: String(s.city || "").trim(),
      vision: String(s.vision || "").trim(),
      budget: Number(s.budget),
      guests: Number(s.guests),
      spent: calculateRemaining(s.budget, s.expenses).total,
      vendors: (s.vendors || []).map((v) => ({ name: v.name, category: v.category, status: v.status }))
    };
  }

  /** Turn the AI's blueprint JSON into the readable text shown on the page. */
  function blueprintText(plan, s, allocation) {
    const list = (arr) => (Array.isArray(arr) ? arr : []).map((x) => "• " + x);
    return [
      plan.title || `${s.type} in ${s.city}`,
      "",
      "ASSUMPTIONS", plan.assumptions || "",
      "",
      "CONCEPT", plan.concept || "",
      "",
      "BUDGET ALLOCATION",
      ...calculateAllocations(s.budget, allocation).map((a) => `${a.name}: ${money(a.amount)} (${a.pct}%)${a.note ? " — " + a.note : ""}`),
      "",
      `LOCAL TIPS FOR ${String(s.city).toUpperCase()}`, ...list(plan.localTips),
      "",
      "TIMELINE", ...list(plan.timeline),
      "",
      "VENDOR CHECKLIST", ...list(plan.vendorChecklist),
      "",
      "RISK GUARDRAILS", ...list(plan.risks)
    ].join("\n");
  }

  function crisisText(c) {
    return `SCENARIO: ${c.scenario}\n\nFIRST 15 MINUTES: ${c.first15}\n\nNEXT HOUR: ${c.nextHour}\n\nBUDGET GUARD: ${c.budgetGuard}\n\nCOMMUNICATION: ${c.communication}\n\nVERIFY: ${c.verify}`;
  }

  const api = {
    API_URL, STORAGE_KEY, EVENT_TYPES, allocationSpec,
    uid, defaultTasks, money, safe,
    calculateAllocations, calculateRemaining, simulateCrisisData, formatCsv,
    normalizeAllocation, validateEvent, buildPlanRequest, blueprintText, crisisText
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.EventVerse = api;

  // ---------------------------------------------------------------------------
  // 2. Browser app (only runs on the dashboard page)
  // ---------------------------------------------------------------------------
  if (typeof document === "undefined" || !document.getElementById("generateBtn")) return;

  const $ = (id) => document.getElementById(id);
  const state = {
    type: "Wedding", vision: "", budget: 800000, guests: 300, city: "Bengaluru",
    allocation: allocationSpec.map((a) => ({ ...a })),
    tasks: defaultTasks(), guestList: [], vendors: [], expenses: [], lastPlan: null
  };

  function save(showMessage = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (showMessage) $("saveMessage").textContent = "Saved in this browser at " + new Date().toLocaleTimeString();
    } catch (e) {
      $("saveMessage").textContent = "Browser storage is unavailable. Export your plan to keep a copy.";
    }
  }
  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved) Object.keys(state).forEach((k) => { if (saved[k] !== undefined) state[k] = saved[k]; });
    } catch (e) { console.warn("Could not restore EventVerse data", e); }
  }

  async function callAI(mode) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPlanRequest(mode, state))
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }
  function setBusy(btn, busy, label) {
    btn.dataset.label = btn.dataset.label || btn.textContent;
    btn.disabled = busy;
    btn.setAttribute("aria-busy", String(busy));
    btn.textContent = busy ? label : btn.dataset.label;
  }

  function renderAllocations() {
    $("allocations").innerHTML = calculateAllocations(state.budget, state.allocation).map((x) =>
      `<div class="allocation"><div class="allocation-head"><span>${safe(x.name)}</span><strong>${money(x.amount)}</strong></div><div class="allocation-track"><span style="width:${Math.min(100, x.pct)}%"></span></div><div class="allocation-foot"><span>${x.pct}% of budget</span><span>${safe(x.note)}</span></div></div>`).join("");
    $("budgetSide").textContent = money(state.budget);
  }
  function renderTasks() {
    $("taskList").innerHTML = state.tasks.map((t) =>
      `<div class="task-row"><button class="task-check ${t.done ? "done" : ""}" data-task="${safe(t.id)}" aria-label="Toggle task: ${safe(t.title)}" aria-pressed="${t.done}">${t.done ? "✓" : ""}</button><div class="task-info"><strong class="${t.done ? "finished" : ""}">${safe(t.title)}</strong><span>${safe(t.detail)}</span></div><span class="task-date">${safe(t.when)}</span><button class="remove-button" data-remove-task="${safe(t.id)}" aria-label="Remove task: ${safe(t.title)}">×</button></div>`).join("");
    const done = state.tasks.filter((t) => t.done).length, total = state.tasks.length;
    $("taskCount").textContent = `${total} TASKS`;
    $("checkProgress").textContent = `${done}/${total}`;
    $("taskProgress").style.width = (total ? (done / total) * 100 : 0) + "%";
  }
  function renderGuests() {
    const counts = { Accepted: 0, Pending: 0, Declined: 0 };
    state.guestList.forEach((g) => (counts[g.rsvp] = (counts[g.rsvp] || 0) + 1));
    $("guestCount").textContent = `${state.guestList.length} GUESTS`;
    $("guestSummary").innerHTML = `<span>✓ <strong>${counts.Accepted}</strong> attending</span><span>◷ <strong>${counts.Pending}</strong> pending</span><span>↗ <strong>${counts.Declined}</strong> declined</span>`;
    $("guestRows").innerHTML = state.guestList.length
      ? state.guestList.map((g) => `<tr><td>${safe(g.name)}</td><td>${safe(g.contact || "—")}</td><td><select class="status-select" data-guest-status="${safe(g.id)}" aria-label="RSVP for ${safe(g.name)}">${["Pending", "Accepted", "Declined"].map((s) => `<option ${g.rsvp === s ? "selected" : ""}>${s}</option>`).join("")}</select></td><td><button class="remove-button" data-remove-guest="${safe(g.id)}" aria-label="Remove guest ${safe(g.name)}">×</button></td></tr>`).join("")
      : `<tr><td colspan="4" class="empty-row">Add guests to start tracking RSVPs.</td></tr>`;
  }
  function renderVendors() {
    $("vendorRows").innerHTML = state.vendors.length
      ? state.vendors.map((v) => `<tr><td>${safe(v.name)}</td><td>${safe(v.category)}</td><td>${money(v.quote)}</td><td><select class="status-select" data-vendor-status="${safe(v.id)}" aria-label="Status for ${safe(v.name)}">${["Shortlisted", "Contacted", "Quote received", "Booked", "Rejected"].map((s) => `<option ${v.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></td><td><button class="remove-button" data-remove-vendor="${safe(v.id)}" aria-label="Remove vendor ${safe(v.name)}">×</button></td></tr>`).join("")
      : `<tr><td colspan="5" class="empty-row">Your vendor shortlist will appear here.</td></tr>`;
    $("vendorTotal").textContent = money(state.vendors.filter((v) => v.status !== "Rejected").reduce((s, v) => s + Number(v.quote || 0), 0));
  }
  function renderExpenses() {
    const r = calculateRemaining(state.budget, state.expenses);
    $("expenseTotal").textContent = money(r.total);
    $("paidTotal").textContent = money(r.paid);
    $("budgetRemaining").textContent = money(r.remaining);
    $("budgetRemaining").classList.toggle("over-budget", r.isOverBudget);
    $("expenseRows").innerHTML = state.expenses.length
      ? state.expenses.map((e) => `<tr><td>${safe(e.name)}</td><td>${money(e.amount)}</td><td><select class="status-select" data-expense-status="${safe(e.id)}" aria-label="Status for ${safe(e.name)}">${["Planned", "Paid"].map((s) => `<option ${e.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></td><td><button class="remove-button" data-remove-expense="${safe(e.id)}" aria-label="Remove expense ${safe(e.name)}">×</button></td></tr>`).join("")
      : `<tr><td colspan="4" class="empty-row">Add expenses to see the real budget remaining.</td></tr>`;
  }
  function setConfidence(value, reason) {
    const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    $("confidenceMetric").textContent = v + "%";
    $("confidenceSub").textContent = reason || "AI feasibility estimate";
    $("confidenceBar").style.width = v + "%";
  }
  function showBlueprint(saved, scroll = true) {
    $("aiPlan").textContent = blueprintText(saved.result, state, state.allocation) +
      `\n\n— Generated by ${saved.model} at ${new Date(saved.generatedAt).toLocaleString()}`;
    $("aiPlanBox").classList.remove("hidden");
    $("blueprintHeading").textContent = "Your event blueprint";
    $("planStatus").textContent = "AI BLUEPRINT READY";
    setConfidence(saved.result.confidence, saved.result.confidenceReason);
    if (scroll) $("aiPlanBox").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function syncInputs() {
    $("vision").value = state.vision; $("budget").value = state.budget; $("guests").value = state.guests; $("city").value = state.city;
    document.querySelectorAll(".type-card").forEach((b) => {
      const on = b.dataset.type === state.type;
      b.classList.toggle("selected", on);
      b.setAttribute("aria-checked", String(on));
    });
    $("budgetMetric").textContent = money(state.budget);
    $("guestMetric").textContent = Number(state.guests || 0).toLocaleString("en-IN");
    renderAllocations(); renderTasks(); renderGuests(); renderVendors(); renderExpenses();
    if (state.lastPlan) showBlueprint(state.lastPlan, false);
  }

  async function buildBlueprint() {
    const problem = validateEvent(state);
    if (problem) { alert(problem); return; }
    const btn = $("generateBtn");
    setBusy(btn, true, "Generating with AI…");
    $("planStatus").textContent = "AI IS PLANNING…";
    try {
      const data = await callAI("blueprint");
      const p = data.result;
      state.allocation = normalizeAllocation(p.allocation);
      if (Array.isArray(p.tasks) && p.tasks.length) {
        const custom = state.tasks.filter((t) => t.when === "CUSTOM");
        state.tasks = [
          ...p.tasks.slice(0, 8).map((t) => ({ id: uid(), title: String(t.title), detail: String(t.detail || ""), when: String(t.when || "").toUpperCase(), done: false })),
          ...custom
        ];
      }
      state.lastPlan = data;
      renderAllocations(); renderTasks(); showBlueprint(data); save(false);
    } catch (err) {
      // No fallback text: if the AI fails we say so, we never show canned output.
      $("aiPlan").textContent = "Could not generate a plan: " + err.message;
      $("aiPlanBox").classList.remove("hidden");
      $("planStatus").textContent = "AI ERROR — TRY AGAIN";
    } finally {
      setBusy(btn, false);
    }
  }

  async function simulateCrisis() {
    const problem = validateEvent(state);
    if (problem) { alert(problem); return; }
    const btn = $("chaosBtn");
    setBusy(btn, true, "Simulating with AI…");
    $("crisisResult").classList.remove("hidden");
    $("crisisText").textContent = "Thinking through a crisis for your event…";
    try {
      const { result } = await callAI("crisis");
      $("crisisText").textContent = crisisText(result);
    } catch (err) {
      $("crisisText").textContent = "Could not generate a playbook: " + err.message;
    } finally {
      setBusy(btn, false);
    }
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  document.querySelectorAll(".type-card").forEach((b) => b.addEventListener("click", () => { state.type = b.dataset.type; syncInputs(); save(false); }));
  ["vision", "budget", "guests", "city"].forEach((id) => $(id).addEventListener("input", () => {
    state.vision = $("vision").value; state.budget = Number($("budget").value) || 0;
    state.guests = Number($("guests").value) || 0; state.city = $("city").value;
    $("budgetMetric").textContent = money(state.budget);
    $("guestMetric").textContent = state.guests.toLocaleString("en-IN");
    renderAllocations(); renderExpenses(); save(false);
  }));
  $("generateBtn").addEventListener("click", buildBlueprint);
  $("chaosBtn").addEventListener("click", simulateCrisis);
  $("taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $("taskInput").value.trim(); if (!title) return;
    state.tasks.push({ id: uid(), title, detail: "Custom task — add details as needed", when: "CUSTOM", done: false });
    $("taskInput").value = ""; renderTasks(); save();
  });
  $("guestForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.guestList.push({ id: uid(), name: $("guestName").value.trim(), contact: $("guestContact").value.trim(), rsvp: $("guestRsvp").value });
    e.target.reset(); renderGuests(); save();
  });
  $("vendorForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const quote = Number($("vendorQuote").value);
    if (quote < 0 || !Number.isFinite(quote)) { alert("Enter a valid quote amount."); return; }
    state.vendors.push({ id: uid(), name: $("vendorName").value.trim(), category: $("vendorCategory").value, quote, status: "Shortlisted" });
    e.target.reset(); renderVendors(); save();
  });
  $("expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = Number($("expenseAmount").value);
    if (amount < 0 || !Number.isFinite(amount)) { alert("Enter a valid expense amount."); return; }
    state.expenses.push({ id: uid(), name: $("expenseName").value.trim(), amount, status: $("expenseStatus").value });
    e.target.reset(); renderExpenses(); save();
  });
  document.body.addEventListener("click", (e) => {
    const t = e.target.closest("[data-task]");
    if (t) { const task = state.tasks.find((x) => x.id === t.dataset.task); if (task) task.done = !task.done; renderTasks(); save(); return; }
    for (const [attr, key, render] of [["data-remove-task", "tasks", renderTasks], ["data-remove-guest", "guestList", renderGuests], ["data-remove-vendor", "vendors", renderVendors], ["data-remove-expense", "expenses", renderExpenses]]) {
      const el = e.target.closest(`[${attr}]`);
      if (el) { state[key] = state[key].filter((x) => x.id !== el.getAttribute(attr)); render(); save(); return; }
    }
  });
  document.body.addEventListener("change", (e) => {
    const el = e.target;
    for (const [attr, key, field, render] of [["data-guest-status", "guestList", "rsvp", renderGuests], ["data-vendor-status", "vendors", "status", renderVendors], ["data-expense-status", "expenses", "status", renderExpenses]]) {
      if (el.hasAttribute(attr)) { const item = state[key].find((x) => x.id === el.getAttribute(attr)); if (item) item[field] = el.value; render(); save(); return; }
    }
  });
  $("resetTasks").addEventListener("click", () => { state.tasks.forEach((t) => (t.done = false)); renderTasks(); save(); });
  $("saveBtn").addEventListener("click", () => save());
  $("exportJson").addEventListener("click", () => download("eventverse-plan.json", JSON.stringify({
    event: { type: state.type, vision: state.vision, budget: state.budget, guests: state.guests, city: state.city },
    allocation: state.allocation, aiPlan: state.lastPlan, tasks: state.tasks, guests: state.guestList,
    vendors: state.vendors, expenses: state.expenses, exportedAt: new Date().toISOString()
  }, null, 2), "application/json"));
  $("exportGuests").addEventListener("click", () => download("eventverse-guests.csv", formatCsv(["Name", "Contact", "RSVP"], state.guestList.map((g) => [g.name, g.contact, g.rsvp])), "text/csv;charset=utf-8"));
  $("exportExpenses").addEventListener("click", () => download("eventverse-expenses.csv", formatCsv(["Expense", "Amount INR", "Status"], state.expenses.map((x) => [x.name, x.amount, x.status])), "text/csv;charset=utf-8"));

  restore();
  syncInputs();
  if (localStorage.getItem(STORAGE_KEY)) $("saveMessage").textContent = "Restored your last saved plan from this browser.";
})(typeof window !== "undefined" ? window : null);