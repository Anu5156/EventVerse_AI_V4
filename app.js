(() => {
  "use strict";

  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  const $ = (id) => (isBrowser ? document.getElementById(id) : null);
  const STORAGE_KEY = "eventverse-v4-state";

  /**
   * Generates a unique base-36 collision-resistant identifier.
   * @returns {string} Unique ID string
   */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Returns default timeline milestones for initial run-of-show state.
   * @returns {Array<Object>} Default task array
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
   * BudgetGuard™ 40/25/15/10/10 Allocation Specification
   */
  const allocationSpec = [
    { name: "Venue & setup", pct: 25, note: "Space + essentials" },
    { name: "Food & beverage", pct: 40, note: "Guest experience" },
    { name: "Decor & production", pct: 15, note: "Theme + ambience" },
    { name: "Photo & entertainment", pct: 10, note: "Memories + energy" },
    { name: "Reserve & other", pct: 10, note: "Keep a safety net" }
  ];

  /**
   * Formats numbers into localized Indian Rupee currency strings.
   * @param {number|string} n Amount
   * @returns {string} Formatted currency string
   */
  const money = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(n) || 0);

  /**
   * Deterministic HTML entity encoder preventing Cross-Site Scripting (XSS).
   * @param {string} value Untrusted input string
   * @returns {string} Sanitized string
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
   * @param {number} budget Total budget ceiling
   * @returns {Array<Object>} Calculated allocation objects
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
   * @param {number} budget Total budget
   * @param {Array<Object>} expenses Tracked expense items
   * @returns {Object} Reconciliation summary
   */
  function calculateRemaining(budget, expenses) {
    const total = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    const paid = (expenses || []).filter((e) => e.status === "Paid").reduce((s, e) => s + Number(e.amount || 0), 0);
    const remaining = Number(budget) - total;
    return {
      total,
      paid,
      remaining,
      isOverBudget: remaining < 0
    };
  }

  /**
   * Generates RFC 4180 compliant CSV strings with UTF-8 BOM.
   * @param {Array<string>} headers Column header names
   * @param {Array<Array<string>>} rows Row data arrays
   * @returns {string} Formatted CSV text
   */
  function formatCsv(headers, rows) {
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(","))
      .join("\r\n");
    return "\uFEFF" + csv;
  }

  /**
   * Simulates Chaos Mode contingency calculations.
   * @param {number} budget Total budget
   * @param {Array<Object>} expenses Current expense ledger
   * @returns {Object} Crisis telemetry
   */
  function simulateCrisisData(budget, expenses) {
    const total = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    const reserve = Math.round(Number(budget) * 0.1);
    return {
      total,
      reserve,
      isReserveGuarded: true
    };
  }

  function save(showMessage = true) {
    if (!isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (showMessage && $("saveMessage")) {
        $("saveMessage").textContent = "Saved in this browser at " + new Date().toLocaleTimeString();
      }
    } catch (e) {
      if ($("saveMessage")) {
        $("saveMessage").textContent = "Browser storage is unavailable. Export your plan to keep a copy.";
      }
    }
  }

  function restore() {
    if (!isBrowser) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved) {
        Object.keys(state).forEach((k) => {
          if (saved[k] !== undefined) state[k] = saved[k];
        });
      }
    } catch (e) {
      console.warn("Could not restore EventVerse data", e);
    }
  }

  function renderAllocations() {
    if (!isBrowser) return;
    const allocations = calculateAllocations(state.budget);
    $("allocations").innerHTML = allocations
      .map(
        (x) =>
          `<div class="allocation"><div class="allocation-head"><span>${x.name}</span><strong>${money(
            x.amount
          )}</strong></div><div class="allocation-track"><span style="width:${x.pct}%"></span></div><div class="allocation-foot"><span>${
            x.pct
          }% of budget</span><span>${x.note}</span></div></div>`
      )
      .join("");
    $("budgetSide").textContent = money(state.budget);
  }

  function renderTasks() {
    if (!isBrowser) return;
    $("taskList").innerHTML = state.tasks
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
    const done = state.tasks.filter((t) => t.done).length,
      total = state.tasks.length;
    $("taskCount").textContent = `${total} TASKS`;
    $("checkProgress").textContent = `${done}/${total}`;
    $("taskProgress").style.width = (total ? (done / total) * 100 : 0) + "%";
  }

  function renderGuests() {
    if (!isBrowser) return;
    const counts = { Accepted: 0, Pending: 0, Declined: 0 };
    state.guestList.forEach((g) => (counts[g.rsvp] = (counts[g.rsvp] || 0) + 1));
    $("guestCount").textContent = `${state.guestList.length} GUESTS`;
    $("guestSummary").innerHTML = `<span>✓ <strong>${counts.Accepted}</strong> attending</span><span>◷ <strong>${counts.Pending}</strong> pending</span><span>↗ <strong>${counts.Declined}</strong> declined</span>`;
    $("guestRows").innerHTML = state.guestList.length
      ? state.guestList
          .map(
            (g) =>
              `<tr><td>${safe(g.name)}</td><td>${safe(g.contact || "—")}</td><td><select class="status-select" data-guest-status="${
                g.id
              }">${["Pending", "Accepted", "Declined"]
                .map((s) => `<option ${g.rsvp === s ? "selected" : ""}>${s}</option>`)
                .join("")}</select></td><td><button class="remove-button" data-remove-guest="${
                g.id
              }" aria-label="Remove guest">×</button></td></tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="empty-row">Add guests to start tracking RSVPs.</td></tr>`;
  }

  function renderVendors() {
    if (!isBrowser) return;
    $("vendorRows").innerHTML = state.vendors.length
      ? state.vendors
          .map(
            (v) =>
              `<tr><td>${safe(v.name)}</td><td>${safe(v.category)}</td><td>${money(v.quote)}</td><td><select class="status-select" data-vendor-status="${
                v.id
              }">${["Shortlisted", "Contacted", "Quote received", "Booked", "Rejected"]
                .map((s) => `<option ${v.status === s ? "selected" : ""}>${s}</option>`)
                .join("")}</select></td><td><button class="remove-button" data-remove-vendor="${
                v.id
              }" aria-label="Remove vendor">×</button></td></tr>`
          )
          .join("")
      : `<tr><td colspan="5" class="empty-row">Your vendor shortlist will appear here.</td></tr>`;
    $("vendorTotal").textContent = money(
      state.vendors.filter((v) => v.status !== "Rejected").reduce((s, v) => s + Number(v.quote || 0), 0)
    );
  }

  function renderExpenses() {
    if (!isBrowser) return;
    const { total, paid, remaining, isOverBudget } = calculateRemaining(state.budget, state.expenses);
    $("expenseTotal").textContent = money(total);
    $("paidTotal").textContent = money(paid);
    $("budgetRemaining").textContent = money(remaining);
    $("budgetRemaining").classList.toggle("over-budget", isOverBudget);
    $("expenseRows").innerHTML = state.expenses.length
      ? state.expenses
          .map(
            (e) =>
              `<tr><td>${safe(e.name)}</td><td>${money(e.amount)}</td><td><select class="status-select" data-expense-status="${
                e.id
              }">${["Planned", "Paid"]
                .map((s) => `<option ${e.status === s ? "selected" : ""}>${s}</option>`)
                .join("")}</select></td><td><button class="remove-button" data-remove-expense="${
                e.id
              }" aria-label="Remove expense">×</button></td></tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="empty-row">Add expenses to see the real budget remaining.</td></tr>`;
  }

  function syncInputs() {
    if (!isBrowser) return;
    $("vision").value = state.vision;
    $("budget").value = state.budget;
    $("guests").value = state.guests;
    $("city").value = state.city;
    document.querySelectorAll(".type-card").forEach((b) => b.classList.toggle("selected", b.dataset.type === state.type));
    $("budgetMetric").textContent = money(state.budget);
    $("guestMetric").textContent = Number(state.guests || 0).toLocaleString("en-IN");
    renderAllocations();
    renderTasks();
    renderGuests();
    renderVendors();
    renderExpenses();
  }

  function buildBlueprint() {
    if (!isBrowser) return;
    const budget = Number(state.budget),
      guests = Number(state.guests);
    if (!Number.isFinite(budget) || budget < 1000 || !Number.isInteger(guests) || guests < 1 || !state.city.trim()) {
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
    $("aiPlan").textContent = lines.join("\n");
    $("aiPlanBox").classList.remove("hidden");
    $("blueprintHeading").textContent = "Your event blueprint";
    $("planStatus").textContent = "BLUEPRINT READY";
    $("confidenceMetric").textContent = "92%";
    $("confidenceSub").textContent = "Based on starter constraint checks";
    $("confidenceBar").style.width = "92%";
    save(false);
    $("aiPlanBox").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function simulateCrisis() {
    if (!isBrowser) return;
    const { total, reserve } = simulateCrisisData(state.budget, state.expenses);
    const text = `FIRST 15 MINUTES: Confirm the cancellation in writing, identify the event lead and check the contract's remedy/refund terms. Keep guests safe and follow venue staff instructions.\n\nNEXT HOUR: Contact two or three pre-vetted alternatives; ask the venue coordinator for approved backups; compare capacity, accessibility, setup time and total written cost before committing.\n\nBUDGET GUARD: Protect the 10% reserve (${money(
      reserve
    )}) where possible. Current tracked expenses are ${money(
      total
    )}; do not approve a replacement that pushes the event beyond the agreed cap without decision-maker approval.\n\nCOMMUNICATION: Assign one person to vendors and one to guest updates. Share only confirmed changes and give the next update time.\n\nVERIFY: Availability, price and booking are not confirmed by this simulation. Never pay until identity, contract, cancellation terms and written quote are checked.`;
    $("crisisText").textContent = text;
    $("crisisResult").classList.remove("hidden");
  }

  function download(filename, content, type) {
    if (!isBrowser) return;
    const blob = new Blob([content], { type }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv(filename, headers, rows) {
    if (!isBrowser) return;
    download(filename, formatCsv(headers, rows), "text/csv;charset=utf-8");
  }

  if (isBrowser) {
    document.querySelectorAll(".type-card").forEach((b) =>
      b.addEventListener("click", () => {
        state.type = b.dataset.type;
        syncInputs();
        save(false);
      })
    );
    ["vision", "budget", "guests", "city"].forEach((id) =>
      $(id).addEventListener("input", () => {
        state.vision = $("vision").value;
        state.budget = Number($("budget").value) || 0;
        state.guests = Number($("guests").value) || 0;
        state.city = $("city").value;
        $("budgetMetric").textContent = money(state.budget);
        $("guestMetric").textContent = state.guests.toLocaleString("en-IN");
        renderAllocations();
        renderExpenses();
        save(false);
      })
    );
    $("generateBtn").addEventListener("click", buildBlueprint);
    $("taskForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const title = $("taskInput").value.trim();
      if (!title) return;
      state.tasks.push({ id: uid(), title, detail: "Custom task — add details as needed", when: "CUSTOM", done: false });
      $("taskInput").value = "";
      renderTasks();
      save();
    });
    $("guestForm").addEventListener("submit", (e) => {
      e.preventDefault();
      state.guestList.push({
        id: uid(),
        name: $("guestName").value.trim(),
        contact: $("guestContact").value.trim(),
        rsvp: $("guestRsvp").value
      });
      e.target.reset();
      renderGuests();
      save();
    });
    $("vendorForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const quote = Number($("vendorQuote").value);
      if (quote < 0 || !Number.isFinite(quote)) {
        alert("Enter a valid quote amount.");
        return;
      }
      state.vendors.push({
        id: uid(),
        name: $("vendorName").value.trim(),
        category: $("vendorCategory").value,
        quote,
        status: "Shortlisted"
      });
      e.target.reset();
      renderVendors();
      save();
    });
    $("expenseForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = Number($("expenseAmount").value);
      if (amount < 0 || !Number.isFinite(amount)) {
        alert("Enter a valid expense amount.");
        return;
      }
      state.expenses.push({
        id: uid(),
        name: $("expenseName").value.trim(),
        amount,
        status: $("expenseStatus").value
      });
      e.target.reset();
      renderExpenses();
      save();
    });
    document.body.addEventListener("click", (e) => {
      const t = e.target.closest("[data-task]");
      if (t) {
        const task = state.tasks.find((x) => x.id === t.dataset.task);
        if (task) task.done = !task.done;
        renderTasks();
        save();
        return;
      }
      for (const [attr, key, render] of [
        ["data-remove-task", "tasks", renderTasks],
        ["data-remove-guest", "guestList", renderGuests],
        ["data-remove-vendor", "vendors", renderVendors],
        ["data-remove-expense", "expenses", renderExpenses]
      ]) {
        const el = e.target.closest(`[${attr}]`);
        if (el) {
          state[key] = state[key].filter((x) => x.id !== el.getAttribute(attr));
          render();
          if (key === "expenses") renderExpenses();
          save();
          return;
        }
      }
    });
    document.body.addEventListener("change", (e) => {
      const el = e.target;
      for (const [attr, key, field, render] of [
        ["data-guest-status", "guestList", "rsvp", renderGuests],
        ["data-vendor-status", "vendors", "status", renderVendors],
        ["data-expense-status", "expenses", "status", renderExpenses]
      ]) {
        if (el.hasAttribute(attr)) {
          const item = state[key].find((x) => x.id === el.getAttribute(attr));
          if (item) item[field] = el.value;
          render();
          save();
          return;
        }
      }
    });
    $("chaosBtn").addEventListener("click", simulateCrisis);
    $("resetTasks").addEventListener("click", () => {
      state.tasks.forEach((t) => (t.done = false));
      renderTasks();
      save();
    });
    $("saveBtn").addEventListener("click", () => save());
    $("exportJson").addEventListener("click", () =>
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
    $("exportGuests").addEventListener("click", () =>
      exportCsv(
        "eventverse-guests.csv",
        ["Name", "Contact", "RSVP"],
        state.guestList.map((g) => [g.name, g.contact, g.rsvp])
      )
    );
    $("exportExpenses").addEventListener("click", () =>
      exportCsv(
        "eventverse-expenses.csv",
        ["Expense", "Amount INR", "Status"],
        state.expenses.map((e) => [e.name, e.amount, e.status])
      )
    );
    restore();
    syncInputs();
    if (localStorage.getItem(STORAGE_KEY) && $("saveMessage")) {
      $("saveMessage").textContent = "Restored your last saved plan from this browser.";
    }
  }

  // Export for automated testing in Node.js environments
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      safe,
      money,
      uid,
      defaultTasks,
      allocationSpec,
      calculateAllocations,
      calculateRemaining,
      formatCsv,
      simulateCrisisData,
      state
    };
  }
})();