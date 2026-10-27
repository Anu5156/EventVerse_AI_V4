const test = require("node:test");
const assert = require("node:assert");
const {
  safe,
  money,
  calculateAllocations,
  calculateRemaining,
  formatCsv,
  simulateCrisisData,
  defaultTasks
} = require("../app.js");

test("Integration: Full End-to-End Event Lifecycle Simulation", () => {
  // Step 1: Initialize event parameters
  const budget = 1200000; // 12 Lakhs
  const guests = 450;

  // Step 2: Validate allocations
  const allocations = calculateAllocations(budget);
  assert.strictEqual(allocations.length, 5);
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  assert.strictEqual(totalAllocated, budget);

  // Step 3: Populate guest list and verify RSVP categorization
  const guestList = [
    { id: "g1", name: safe("John Doe"), contact: "john@example.com", rsvp: "Accepted" },
    { id: "g2", name: safe("Jane Smith <script>"), contact: "jane@example.com", rsvp: "Accepted" },
    { id: "g3", name: safe("Bob & Alice"), contact: "bob@example.com", rsvp: "Pending" },
    { id: "g4", name: safe("Charlie"), contact: "", rsvp: "Declined" }
  ];

  // Verify sanitization occurred
  assert.strictEqual(guestList[1].name, "Jane Smith &lt;script&gt;");
  assert.strictEqual(guestList[2].name, "Bob &amp; Alice");

  const rsvpCounts = { Accepted: 0, Pending: 0, Declined: 0 };
  guestList.forEach((g) => (rsvpCounts[g.rsvp] = (rsvpCounts[g.rsvp] || 0) + 1));
  assert.strictEqual(rsvpCounts.Accepted, 2);
  assert.strictEqual(rsvpCounts.Pending, 1);
  assert.strictEqual(rsvpCounts.Declined, 1);

  // Step 4: Populate vendor procurement quotes
  const vendors = [
    { id: "v1", name: "Grand Palace", category: "Venue", quote: 300000, status: "Booked" },
    { id: "v2", name: "Royal Caterers", category: "Catering", quote: 450000, status: "Quote received" },
    { id: "v3", name: "Elite Decorators", category: "Decor", quote: 180000, status: "Shortlisted" },
    { id: "v4", name: "Overpriced Studio", category: "Photography", quote: 200000, status: "Rejected" }
  ];

  // Verified active quote total excluding rejected
  const activeVendorTotal = vendors
    .filter((v) => v.status !== "Rejected")
    .reduce((s, v) => s + v.quote, 0);
  assert.strictEqual(activeVendorTotal, 930000);

  // Step 5: Ledger reconciliation
  const expenses = [
    { name: "Venue Advance", amount: 150000, status: "Paid" },
    { name: "Catering Advance", amount: 200000, status: "Paid" },
    { name: "Decor Booking", amount: 180000, status: "Planned" }
  ];

  const reconciliation = calculateRemaining(budget, expenses);
  assert.strictEqual(reconciliation.total, 530000);
  assert.strictEqual(reconciliation.paid, 350000);
  assert.strictEqual(reconciliation.remaining, 670000);
  assert.strictEqual(reconciliation.isOverBudget, false);

  // Step 6: Trigger Chaos Mode contingency
  const crisis = simulateCrisisData(budget, expenses);
  assert.strictEqual(crisis.reserve, 120000); // 10% of 1.2M
  assert.strictEqual(crisis.total, 530000);
  assert.strictEqual(crisis.isReserveGuarded, true);

  // Step 7: Export data tables to RFC 4180 CSV
  const csvData = formatCsv(
    ["Guest", "Contact", "RSVP"],
    guestList.map((g) => [g.name, g.contact, g.rsvp])
  );
  assert.ok(csvData.startsWith("\uFEFF"));
  assert.ok(csvData.includes('"Jane Smith &lt;script&gt;"'));
});
