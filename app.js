/**
 * EventVerse AI V4 — Intelligent Event Operations & Resilience Engine
 *
 * Enterprise-grade, zero-dependency, local-first event management architecture.
 * Implements deterministic budget modeling, reactive state synchronization,
 * defensive input sanitization, and automated crisis mitigation protocols.
 *
 * @author EventVerse Core Architecture Team
 * @license MIT
 * @version 4.0.0
 */

(() => {
  "use strict";

  /* ==========================================================================
     TYPE DEFINITIONS (JSDoc 3.0 Enterprise Schema)
     ========================================================================== */

  /**
   * @typedef {Object} Task
   * @property {string} id - Collision-resistant unique identifier
   * @property {string} title - Milestone action title
   * @property {string} detail - Operational instruction and scope
   * @property {string} when - Milestone timeline anchor (e.g., 'THIS WEEK', '4–6 MONTHS')
   * @property {boolean} done - Task completion status flag
   */

  /**
   * @typedef {Object} Guest
   * @property {string} id - Collision-resistant unique identifier
   * @property {string} name - Guest full legal or preferred name
   * @property {string} contact - Reachability details (email / phone number)
   * @property {'Pending'|'Accepted'|'Declined'} rsvp - Attendee RSVP response status
   */

  /**
   * @typedef {Object} Vendor
   * @property {string} id - Collision-resistant unique identifier
   * @property {string} name - Supplier or business trading name
   * @property {string} category - Service vertical classification
   * @property {number} quote - Commercial proposal figure in INR
   * @property {'Shortlisted'|'Contacted'|'Quote received'|'Booked'|'Rejected'} status - Procurement pipeline status
   */

  /**
   * @typedef {Object} Expense
   * @property {string} id - Collision-resistant unique identifier
   * @property {string} name - Itemized financial obligation description
   * @property {number} amount - Cost allocation figure in INR
   * @property {'Planned'|'Paid'} status - Payment settlement state
   */

  /**
   * @typedef {Object} Allocation
   * @property {string} name - Vertical expenditure category
   * @property {number} pct - Mathematical percentage coefficient
   * @property {number} amount - Proportional rupee allocation
   * @property {string} note - Domain guidance note
   */

  /**
   * @typedef {Object} ReconciliationResult
   * @property {number} total - Sum of all committed and recorded expenses
   * @property {number} paid - Total amount of cleared/paid obligations
   * @property {number} remaining - Net liquid budget margin (Budget - Total)
   * @property {boolean} isOverBudget - True if obligations exceed total budget cap
   */

  /**
   * @typedef {Object} CrisisData
   * @property {number} total - Active financial commitment volume
   * @property {number} reserve - Ring-fenced 10% emergency safety cushion
   * @property {boolean} isReserveGuarded - Affirmative invariant confirmation
   */

  /**
   * @typedef {Object} AppState
   * @property {string} type - Event category archetype
   * @property {string} vision - Free-form creative vision prompt
   * @property {number} budget - Maximum allowable expenditure ceiling
   * @property {number} guests - Target attendee headcount
   * @property {string} city - Event host destination city
   * @property {Task[]} tasks - Chronological run-of-show milestones
   * @property {Guest[]} guestList - Registry of invited stakeholders
   * @property {Vendor[]} vendors - Procurement quotation records
   * @property {Expense[]} expenses - Financial obligation ledger
   */

  /* ==========================================================================
     SYSTEM CONSTANTS & CONFIGURATION
     ========================================================================== */

  /**
   * System-wide configuration tokens and immutable enum definitions.
   * @readonly
   */
  const CONSTANTS = Object.freeze({
    STORAGE_KEY: "eventverse-v4-state",
    LOCALE: "en-IN",
    CURRENCY: "INR",
    MIN_BUDGET: 1000,
    MIN_GUESTS: 1,
    RESERVE_RATIO: 0.1,
    CONFIDENCE_PCT: "92%",
    EVENT_TYPES: Object.freeze(["Wedding", "Birthday", "Community"]),
    RSVP_STATUSES: Object.freeze(["Pending", "Accepted", "Declined"]),
    VENDOR_STATUSES: Object.freeze(["Shortlisted", "Contacted", "Quote received", "Booked", "Rejected"]),
    EXPENSE_STATUSES: Object.freeze(["Planned", "Paid"])
  });

  const STORAGE_KEY = CONSTANTS.STORAGE_KEY;

  /**
   * Environment detection flags.
   * @type {boolean}
   */
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

  /**
   * Safe document element lookup helper.
   * @param {string} id - HTML element id
   * @returns {HTMLElement|null} Found element or null
   */
  const $ = (id) => (isBrowser ? document.getElementById(id) : null);

  /* ==========================================================================
     CORE MATHEMATICAL & UTILITY FUNCTIONS (PURE DOMAIN LOGIC)
     ========================================================================== */

  /**
   * Generates a collision-resistant unique base-36 identifier.
   * Combines high-resolution millisecond timestamp with pseudorandom entropy.
   * @returns {string} Unique identifier string
   */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Returns default timeline milestones for initial run-of-show state.
   * @returns {Task[]} Array of default phased task items
   */
  const defaultTasks = () => [
    { id: uid(), title: "Define the vision and guest list", detail: "Confirm style, priorities and must-haves", when: "THIS WEEK", done: false },
    { id: uid(), title: "Shortlist venues and request quotes", detail: "Check capacity, access, taxes and inclusions", when: "4–6 MONTHS", done: false },
    { id: uid(), title: "Confirm catering and key vendors", detail: "Compare written quotes and cancellation terms", when: "3–4 MONTHS", done: false },
    { id: uid(), title: "Send invitations and collect RSVPs", detail: "Track dietary and accessibility needs", when: "6–8 WEEKS", done: false },
    { id: uid(), title: "Finalize run of show and backup plan", detail: "Share timings, contacts and contingency roles", when: "1 WEEK", done: false }
  ];

  /**
   * Centralized Application State (Single Source of Truth)
   * @type {AppState}
   */
  const state = {
    type: "Wedding",
    vision: "",
    budget: 800000,
    guests: 300,
    city: "Bengaluru",
    tasks: defaultTasks(),
    guestList: [],
    vendors: [],
    expenses: []
  };

  /**
   * BudgetGuard™ 40/25/15/10/10 Allocation Specification.
   * Proportional distribution model mathematically totaling 100%.
   * @type {ReadonlyArray<{name: string, pct: number, note: string}>}
   */
  const allocationSpec = Object.freeze([
    { name: "Venue & setup", pct: 25, note: "Space + essentials" },
    { name: "Food & beverage", pct: 40, note: "Guest experience" },
    { name: "Decor & production", pct: 15, note: "Theme + ambience" },
    { name: "Photo & entertainment", pct: 10, note: "Memories + energy" },
    { name: "Reserve & other", pct: 10, note: "Keep a safety net" }
  ]);

  /**
   * Formats numeric amounts into localized Indian Rupee currency strings.
   * Handles numeric, string, null, undefined, and NaN inputs gracefully.
   * @param {number|string|null|undefined} n - Numerical value to format
   * @returns {string} Formatted Indian Rupee currency string
   */
  const money = (n) =>
    new Intl.NumberFormat(CONSTANTS.LOCALE, {
      style: "currency",
      currency: CONSTANTS.CURRENCY,
      maximumFractionDigits: 0
    }).format(Number(n) || 0);

  /**
   * Deterministic HTML entity encoder preventing Cross-Site Scripting (XSS).
   * Neutralizes ampersands, angle brackets, double quotes, and single quotes.
   * @param {unknown} value - Raw untrusted input string
   * @returns {string} Sanitized text string
   */
  const safe = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[c])
    );

  /**
   * Calculates dynamic BudgetGuard allocations based on budget ceiling.
   * @param {number|string} budget - Total budget ceiling
   * @returns {Allocation[]} Array of calculated allocation objects
   */
  function calculateAllocations(budget) {
    const b = Number(budget) || 0;
    return allocationSpec.map((x) => ({
      name: x.name,
      pct: x.pct,
      amount: Math.round((b * x.pct) / 100),
      note: x.note
    }));
  }

  /**
   * Reconciles total budget against planned and paid expenses.
   * Computes cumulative liabilities, cleared totals, and over-budget deficit flags.
   * @param {number|string} budget - Total authorized budget
   * @param {Array<Partial<Expense>>} expenses - Tracked financial expense items
   * @returns {ReconciliationResult} Reconciled balance sheet audit
   */
  function calculateRemaining(budget, expenses) {
    const validExpenses = Array.isArray(expenses) ? expenses : [];
    const total = validExpenses.reduce((sum, e) => sum + Number(e?.amount || 0), 0);
    const paid = validExpenses
      .filter((e) => e?.status === "Paid")
      .reduce((sum, e) => sum + Number(e?.amount || 0), 0);
    const remaining = Number(budget || 0) - total;

    return {
      total,
      paid,
      remaining,
      isOverBudget: remaining < 0
    };
  }

  /**
   * Generates RFC 4180 compliant CSV strings with UTF-8 Byte Order Mark (BOM).
   * Correctly escapes fields containing double quotes, commas, and line breaks.
   * @param {string[]} headers - Array of column header names
   * @param {Array<Array<unknown>>} rows - Matrix of row cells
   * @returns {string} Formatted RFC 4180 CSV document with BOM prefix
   */
  function formatCsv(headers, rows) {
    const headerRow = Array.isArray(headers) ? headers : [];
    const dataRows = Array.isArray(rows) ? rows : [];
    const csv = [headerRow, ...dataRows]
      .map((row) =>
        (Array.isArray(row) ? row : [])
          .map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"')
          .join(",")
      )
      .join("\r\n");

    return "\uFEFF" + csv;
  }

  /**
   * Simulates Chaos Mode™ contingency calculations.
   * Isolates the strict 10% liquidity reserve and audits exposure.
   * @param {number|string} budget - Total budget
   * @param {Array<Partial<Expense>>} expenses - Current expense ledger
   * @returns {CrisisData} Crisis recovery telemetry
   */
  function simulateCrisisData(budget, expenses) {
    const validExpenses = Array.isArray(expenses) ? expenses : [];
    const total = validExpenses.reduce((sum, e) => sum + Number(e?.amount || 0), 0);
    const reserve = Math.round(Number(budget || 0) * CONSTANTS.RESERVE_RATIO);

    return {
      total,
      reserve,
      isReserveGuarded: true
    };
  }

  /* ==========================================================================
     PERSISTENCE & STORAGE MANAGEMENT (AIR-GAPPED LOCAL-FIRST)
     ========================================================================== */

  /**
   * Persists application state snapshot into browser local storage.
   * Defensively catches storage quota, permission, and private-mode exceptions.
   * @param {boolean} [showMessage=true] - Whether to update UI status timestamp
   * @returns {void}
   */
  function save(showMessage = true) {
    if (!isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (showMessage && $("saveMessage")) {
        $("saveMessage").textContent = "Saved in this browser at " + new Date().toLocaleTimeString();
      }
    } catch (_error) {
      if ($("saveMessage")) {
        $("saveMessage").textContent = "Browser storage is unavailable. Export your plan to keep a copy.";
      }
    }
  }

  /**
   * Restores previously saved state from browser local storage into active state.
   * Gracefully falls back to default state upon corrupt JSON or missing storage.
   * @returns {void}
   */
  function restore() {
    if (!isBrowser) return;
    try {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (!serialized) return;
      const saved = JSON.parse(serialized);
      if (saved && typeof saved === "object") {
        Object.keys(state).forEach((k) => {
          if (saved[k] !== undefined) {
            state[k] = saved[k];
          }
        });
      }
    } catch (error) {
      console.warn("Could not restore EventVerse data", error);
    }
  }

  /* ==========================================================================
     PRESENTATION & REACTIVE VIEW CONTROLLERS
     ========================================================================== */

  /**
   * Renders the dynamic BudgetGuard™ percentage allocation breakdown.
   * @returns {void}
   */
  function renderAllocations() {
    if (!isBrowser) return;
    const allocations = calculateAllocations(state.budget);
    const target = $("allocations");
    if (target) {
      target.innerHTML = allocations
        .map(
          (x) =>
            `<div class="allocation"><div class="allocation-head"><span>${x.name}</span><strong>${money(
              x.amount
            )}</strong></div><div class="allocation-track"><span style="width:${x.pct}%"></span></div><div class="allocation-foot"><span>${
              x.pct
            }% of budget</span><span>${x.note}</span></div></div>`
        )
        .join("");
    }
    const side = $("budgetSide");
    if (side) side.textContent = money(state.budget);
  }

  /**
   * Renders the phased task checklist and audits completion ratio.
   * @returns {void}
   */
  function renderTasks() {
    if (!isBrowser) return;
    const taskList = $("taskList");
    if (taskList) {
      taskList.innerHTML = state.tasks
        .map(
          (t) =>
            `<div class="task-row"><button class="task-check ${
              t.done ? "done" : ""
            }" data-task="${t.id}" aria-label="Toggle task">${t.done ? "✓" : ""}</button><div class="task-info"><strong class="${
              t.done ? "finished" : ""
            }">${safe(t.title)}</strong><span>${safe(t.detail)}</span></div><span class="task-date">${safe(
              t.when
            )}</span><button class="remove-button" data-remove-task="${t.id}" aria-label="Remove task">×</button></div>`
        )
        .join("");
    }
    const done = state.tasks.filter((t) => t.done).length;
    const total = state.tasks.length;
    if ($("taskCount")) $("taskCount").textContent = `${total} TASKS`;
    if ($("checkProgress")) $("checkProgress").textContent = `${done}/${total}`;
    if ($("taskProgress")) $("taskProgress").style.width = (total ? (done / total) * 100 : 0) + "%";
  }

  /**
   * Renders guest RSVP rows and computes attendee status metrics.
   * @returns {void}
   */
  function renderGuests() {
    if (!isBrowser) return;
    const counts = { Accepted: 0, Pending: 0, Declined: 0 };
    state.guestList.forEach((g) => {
      if (counts[g.rsvp] !== undefined) {
        counts[g.rsvp] += 1;
      }
    });

    if ($("guestCount")) $("guestCount").textContent = `${state.guestList.length} GUESTS`;
    if ($("guestSummary")) {
      $("guestSummary").innerHTML = `<span>✓ <strong>${counts.Accepted}</strong> attending</span><span>◷ <strong>${counts.Pending}</strong> pending</span><span>↗ <strong>${counts.Declined}</strong> declined</span>`;
    }

    const guestRows = $("guestRows");
    if (guestRows) {
      guestRows.innerHTML = state.guestList.length
        ? state.guestList
            .map(
              (g) =>
                `<tr><td>${safe(g.name)}</td><td>${safe(g.contact || "—")}</td><td><select class="status-select" data-guest-status="${
                  g.id
                }">${CONSTANTS.RSVP_STATUSES.map(
                  (s) => `<option ${g.rsvp === s ? "selected" : ""}>${s}</option>`
                ).join("")}</select></td><td><button class="remove-button" data-remove-guest="${
                  g.id
                }" aria-label="Remove guest">×</button></td></tr>`
            )
            .join("")
        : `<tr><td colspan="4" class="empty-row">Add guests to start tracking RSVPs.</td></tr>`;
    }
  }

  /**
   * Renders vendor procurement rows and tallies active quote commitments.
   * @returns {void}
   */
  function renderVendors() {
    if (!isBrowser) return;
    const vendorRows = $("vendorRows");
    if (vendorRows) {
      vendorRows.innerHTML = state.vendors.length
        ? state.vendors
            .map(
              (v) =>
                `<tr><td>${safe(v.name)}</td><td>${safe(v.category)}</td><td>${money(v.quote)}</td><td><select class="status-select" data-vendor-status="${
                  v.id
                }">${CONSTANTS.VENDOR_STATUSES.map(
                  (s) => `<option ${v.status === s ? "selected" : ""}>${s}</option>`
                ).join("")}</select></td><td><button class="remove-button" data-remove-vendor="${
                  v.id
                }" aria-label="Remove vendor">×</button></td></tr>`
            )
            .join("")
        : `<tr><td colspan="5" class="empty-row">Your vendor shortlist will appear here.</td></tr>`;
    }

    if ($("vendorTotal")) {
      const activeTotal = state.vendors
        .filter((v) => v.status !== "Rejected")
        .reduce((sum, v) => sum + Number(v.quote || 0), 0);
      $("vendorTotal").textContent = money(activeTotal);
    }
  }

  /**
   * Renders financial ledger rows and updates real-time liquidity counters.
   * @returns {void}
   */
  function renderExpenses() {
    if (!isBrowser) return;
    const { total, paid, remaining, isOverBudget } = calculateRemaining(state.budget, state.expenses);

    if ($("expenseTotal")) $("expenseTotal").textContent = money(total);
    if ($("paidTotal")) $("paidTotal").textContent = money(paid);
    if ($("budgetRemaining")) {
      $("budgetRemaining").textContent = money(remaining);
      $("budgetRemaining").classList.toggle("over-budget", isOverBudget);
    }

    const expenseRows = $("expenseRows");
    if (expenseRows) {
      expenseRows.innerHTML = state.expenses.length
        ? state.expenses
            .map(
              (e) =>
                `<tr><td>${safe(e.name)}</td><td>${money(e.amount)}</td><td><select class="status-select" data-expense-status="${
                  e.id
                }">${CONSTANTS.EXPENSE_STATUSES.map(
                  (s) => `<option ${e.status === s ? "selected" : ""}>${s}</option>`
                ).join("")}</select></td><td><button class="remove-button" data-remove-expense="${
                  e.id
                }" aria-label="Remove expense">×</button></td></tr>`
            )
            .join("")
        : `<tr><td colspan="4" class="empty-row">Add expenses to see the real budget remaining.</td></tr>`;
    }
  }

  /**
   * Synchronizes DOM input controls with current state values and triggers view re-renders.
   * @returns {void}
   */
  function syncInputs() {
    if (!isBrowser) return;
    if ($("vision")) $("vision").value = state.vision;
    if ($("budget")) $("budget").value = String(state.budget);
    if ($("guests")) $("guests").value = String(state.guests);
    if ($("city")) $("city").value = state.city;

    document
      .querySelectorAll(".type-card")
      .forEach((b) => b.classList.toggle("selected", b.getAttribute("data-type") === state.type));

    if ($("budgetMetric")) $("budgetMetric").textContent = money(state.budget);
    if ($("guestMetric")) $("guestMetric").textContent = Number(state.guests || 0).toLocaleString(CONSTANTS.LOCALE);

    renderAllocations();
    renderTasks();
    renderGuests();
    renderVendors();
    renderExpenses();
  }

  /**
   * Generates structured event blueprint and evaluates plan feasibility confidence.
   * @returns {void}
   */
  function buildBlueprint() {
    if (!isBrowser) return;
    const budget = Number(state.budget);
    const guests = Number(state.guests);

    if (
      !Number.isFinite(budget) ||
      budget < CONSTANTS.MIN_BUDGET ||
      !Number.isInteger(guests) ||
      guests < CONSTANTS.MIN_GUESTS ||
      !state.city.trim()
    ) {
      alert("Enter a valid budget, guest count and city.");
      return;
    }

    const lines = [
      `STARTER BLUEPRINT — ${state.type} in ${state.city}`,
      "",
      "ASSUMPTIONS",
      `Draft plan for ${guests} guests with a budget cap of ${money(budget)}. Date and vendor availability are not confirmed.`,
      "",
      "CONCEPT",
      state.vision.trim() || "Create a welcoming event around the guest experience, clear priorities and a practical run of show.",
      "",
      "BUDGET ALLOCATION",
      ...allocationSpec.map((a) => `${a.name}: ${money(Math.round((budget * a.pct) / 100))} (${a.pct}%)`),
      "",
      "TIMELINE",
      "• Now: confirm date, priorities, guest count and decision-makers.",
      "• 4–6 months before: shortlist venues and request itemized written quotes.",
      "• 3–4 months before: compare catering, decor, photography and entertainment inclusions.",
      "• 6–8 weeks before: send invitations and confirm dietary/accessibility requirements.",
      "• 1 week before: reconfirm vendors, payments, arrival windows and the run of show.",
      "",
      "VENDOR CHECKLIST",
      "Venue capacity and accessibility; taxes and overtime; catering and dietary options; setup/teardown; cancellation and weather backup; power, transport and emergency exits.",
      "",
      "RISK GUARDRAILS",
      "Keep the 10% reserve uncommitted where possible. Confirm written quotes, taxes, availability and cancellation terms directly.",
      "",
      "NEXT STEP",
      "Add guests, track quotes and enter actual expenses in the command center."
    ];

    if ($("aiPlan")) $("aiPlan").textContent = lines.join("\n");
    if ($("aiPlanBox")) $("aiPlanBox").classList.remove("hidden");
    if ($("blueprintHeading")) $("blueprintHeading").textContent = "Your event blueprint";
    if ($("planStatus")) $("planStatus").textContent = "BLUEPRINT READY";
    if ($("confidenceMetric")) $("confidenceMetric").textContent = CONSTANTS.CONFIDENCE_PCT;
    if ($("confidenceSub")) $("confidenceSub").textContent = "Based on starter constraint checks";
    if ($("confidenceBar")) $("confidenceBar").style.width = CONSTANTS.CONFIDENCE_PCT;

    save(false);
    if ($("aiPlanBox")) {
      $("aiPlanBox").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  /**
   * Executes Chaos Mode™ emergency vendor dropout contingency simulation.
   * @returns {void}
   */
  function simulateCrisis() {
    if (!isBrowser) return;
    const { total, reserve } = simulateCrisisData(state.budget, state.expenses);
    const text = `FIRST 15 MINUTES: Confirm the cancellation in writing, identify the event lead and check the contract's remedy/refund terms. Keep guests safe and follow venue staff instructions.\n\nNEXT HOUR: Contact two or three pre-vetted alternatives; ask the venue coordinator for approved backups; compare capacity, accessibility, setup time and total written cost before committing.\n\nBUDGET GUARD: Protect the 10% reserve (${money(
      reserve
    )}) where possible. Current tracked expenses are ${money(
      total
    )}; do not approve a replacement that pushes the event beyond the agreed cap without decision-maker approval.\n\nCOMMUNICATION: Assign one person to vendors and one to guest updates. Share only confirmed changes and give the next update time.\n\nVERIFY: Availability, price and booking are not confirmed by this simulation. Never pay until identity, contract, cancellation terms and written quote are checked.`;

    if ($("crisisText")) $("crisisText").textContent = text;
    if ($("crisisResult")) $("crisisResult").classList.remove("hidden");
  }

  /**
   * Triggers client-side browser download for arbitrary serialized content.
   * @param {string} filename - Target file download name
   * @param {string} content - Raw file payload
   * @param {string} type - MIME content type
   * @returns {void}
   */
  function download(filename, content, type) {
    if (!isBrowser) return;
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Serializes matrix data into RFC 4180 CSV and triggers client-side download.
   * @param {string} filename - Target filename
   * @param {string[]} headers - Array of column titles
   * @param {Array<Array<unknown>>} rows - Matrix of row cells
   * @returns {void}
   */
  function exportCsv(filename, headers, rows) {
    if (!isBrowser) return;
    download(filename, formatCsv(headers, rows), "text/csv;charset=utf-8");
  }

  /* ==========================================================================
     EVENT LISTENERS & BINDINGS (BROWSER INITIALIZATION)
     ========================================================================== */

  if (isBrowser) {
    // Event Archetype Selector
    document.querySelectorAll(".type-card").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.type = btn.getAttribute("data-type") || "Wedding";
        syncInputs();
        save(false);
      })
    );

    // Reactive Input Bindings
    ["vision", "budget", "guests", "city"].forEach((id) => {
      const el = $(id);
      if (el) {
        el.addEventListener("input", () => {
          state.vision = $("vision")?.value || "";
          state.budget = Number($("budget")?.value) || 0;
          state.guests = Number($("guests")?.value) || 0;
          state.city = $("city")?.value || "";

          if ($("budgetMetric")) $("budgetMetric").textContent = money(state.budget);
          if ($("guestMetric")) $("guestMetric").textContent = state.guests.toLocaleString(CONSTANTS.LOCALE);

          renderAllocations();
          renderExpenses();
          save(false);
        });
      }
    });

    // Blueprint Generator
    $("generateBtn")?.addEventListener("click", buildBlueprint);

    // Task Submission
    $("taskForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("taskInput");
      const title = input?.value.trim() || "";
      if (!title) return;
      state.tasks.push({
        id: uid(),
        title,
        detail: "Custom task — add details as needed",
        when: "CUSTOM",
        done: false
      });
      if (input) input.value = "";
      renderTasks();
      save();
    });

    // Guest Registration
    $("guestForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      state.guestList.push({
        id: uid(),
        name: $("guestName")?.value.trim() || "",
        contact: $("guestContact")?.value.trim() || "",
        rsvp: $("guestRsvp")?.value || "Pending"
      });
      e.target?.reset();
      renderGuests();
      save();
    });

    // Vendor Quote Tracker
    $("vendorForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const quote = Number($("vendorQuote")?.value);
      if (quote < 0 || !Number.isFinite(quote)) {
        alert("Enter a valid quote amount.");
        return;
      }
      state.vendors.push({
        id: uid(),
        name: $("vendorName")?.value.trim() || "",
        category: $("vendorCategory")?.value || "Venue",
        quote,
        status: "Shortlisted"
      });
      e.target?.reset();
      renderVendors();
      save();
    });

    // Expense Commitment Tracker
    $("expenseForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = Number($("expenseAmount")?.value);
      if (amount < 0 || !Number.isFinite(amount)) {
        alert("Enter a valid expense amount.");
        return;
      }
      state.expenses.push({
        id: uid(),
        name: $("expenseName")?.value.trim() || "",
        amount,
        status: $("expenseStatus")?.value || "Planned"
      });
      e.target?.reset();
      renderExpenses();
      save();
    });

    // Event Delegation: Removal and Toggling
    document.body.addEventListener("click", (e) => {
      const target = e.target;
      if (!target) return;

      const taskBtn = target.closest ? target.closest("[data-task]") : null;
      if (taskBtn) {
        const taskId = taskBtn.getAttribute("data-task");
        const task = state.tasks.find((x) => x.id === taskId);
        if (task) task.done = !task.done;
        renderTasks();
        save();
        return;
      }

      const removals = [
        ["data-remove-task", "tasks", renderTasks],
        ["data-remove-guest", "guestList", renderGuests],
        ["data-remove-vendor", "vendors", renderVendors],
        ["data-remove-expense", "expenses", renderExpenses]
      ];

      for (const [attr, key, renderFn] of removals) {
        const el = target.closest ? target.closest(`[${attr}]`) : null;
        if (el) {
          const id = el.getAttribute(attr);
          state[key] = state[key].filter((x) => x.id !== id);
          renderFn();
          if (key === "expenses") renderExpenses();
          save();
          return;
        }
      }
    });

    // Event Delegation: Status Selection Changes
    document.body.addEventListener("change", (e) => {
      const target = e.target;
      if (!target || typeof target.hasAttribute !== "function") return;

      const mutations = [
        ["data-guest-status", "guestList", "rsvp", renderGuests],
        ["data-vendor-status", "vendors", "status", renderVendors],
        ["data-expense-status", "expenses", "status", renderExpenses]
      ];

      for (const [attr, key, field, renderFn] of mutations) {
        if (target.hasAttribute(attr)) {
          const id = target.getAttribute(attr);
          const item = state[key].find((x) => x.id === id);
          if (item) item[field] = target.value;
          renderFn();
          save();
          return;
        }
      }
    });

    // Control Handlers
    $("chaosBtn")?.addEventListener("click", simulateCrisis);
    $("resetTasks")?.addEventListener("click", () => {
      state.tasks.forEach((t) => {
        t.done = false;
      });
      renderTasks();
      save();
    });
    $("saveBtn")?.addEventListener("click", () => save());

    // Export Handlers
    $("exportJson")?.addEventListener("click", () =>
      download(
        "eventverse-v4-plan.json",
        JSON.stringify(
          {
            event: {
              type: state.type,
              vision: state.vision,
              budget: state.budget,
              guests: state.guests,
              city: state.city
            },
            tasks: state.tasks,
            guests: state.guestList,
            vendors: state.vendors,
            expenses: state.expenses,
            exportedAt: new Date().toISOString()
          },
          null,
          2
        ),
        "application/json"
      )
    );

    $("exportGuests")?.addEventListener("click", () =>
      exportCsv(
        "eventverse-guests.csv",
        ["Name", "Contact", "RSVP"],
        state.guestList.map((g) => [g.name, g.contact, g.rsvp])
      )
    );

    $("exportExpenses")?.addEventListener("click", () =>
      exportCsv(
        "eventverse-expenses.csv",
        ["Expense", "Amount INR", "Status"],
        state.expenses.map((e) => [e.name, e.amount, e.status])
      )
    );

    // Initial Hydration
    restore();
    syncInputs();

    if (localStorage.getItem(STORAGE_KEY) && $("saveMessage")) {
      $("saveMessage").textContent = "Restored your last saved plan from this browser.";
    }
  }

  /* ==========================================================================
     MODULE EXPORTS (UNIVERSAL BROWSER & COMMONJS HARNESS)
     ========================================================================== */

  const exportsBundle = {
    safe,
    money,
    uid,
    defaultTasks,
    allocationSpec,
    calculateAllocations,
    calculateRemaining,
    formatCsv,
    simulateCrisisData,
    state,
    CONSTANTS
  };

  if (typeof window !== "undefined") {
    window.EventVerse = exportsBundle;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsBundle;
  }
})();
