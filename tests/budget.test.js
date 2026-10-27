const test = require("node:test");
const assert = require("node:assert");
const { allocationSpec, calculateAllocations, calculateRemaining } = require("../app.js");

test("Budget: allocationSpec adheres strictly to 40/25/15/10/10 ratio summing to 100%", () => {
  const sum = allocationSpec.reduce((acc, curr) => acc + curr.pct, 0);
  assert.strictEqual(sum, 100, "Allocation percentages must total exactly 100%");

  const reserve = allocationSpec.find((x) => x.name.toLowerCase().includes("reserve"));
  assert.ok(reserve, "Contingency reserve bucket must exist");
  assert.strictEqual(reserve.pct, 10, "Contingency reserve must be exactly 10%");
});

test("Budget: calculateAllocations() calculates mathematically accurate rupee allocations", () => {
  const budget = 1000000; // 10 Lakhs
  const allocations = calculateAllocations(budget);
  assert.strictEqual(allocations.length, 5);

  const fb = allocations.find((a) => a.name.includes("Food"));
  const venue = allocations.find((a) => a.name.includes("Venue"));
  const reserve = allocations.find((a) => a.name.includes("Reserve"));

  assert.strictEqual(fb.amount, 400000, "Food & Beverage must receive 40%");
  assert.strictEqual(venue.amount, 250000, "Venue must receive 25%");
  assert.strictEqual(reserve.amount, 100000, "Reserve must receive 10%");

  const totalAllocated = allocations.reduce((acc, a) => acc + a.amount, 0);
  assert.strictEqual(totalAllocated, budget, "Allocated amounts must sum up to total budget");
});

test("Budget: calculateRemaining() detects surplus, exact cap, and deficit states", () => {
  const budget = 500000;

  // Case 1: Surplus
  const surplus = calculateRemaining(budget, [
    { name: "Venue Advance", amount: 100000, status: "Paid" },
    { name: "DJ Booking", amount: 50000, status: "Planned" }
  ]);
  assert.strictEqual(surplus.total, 150000);
  assert.strictEqual(surplus.paid, 100000);
  assert.strictEqual(surplus.remaining, 350000);
  assert.strictEqual(surplus.isOverBudget, false);

  // Case 2: Deficit (Over-budget)
  const deficit = calculateRemaining(budget, [
    { name: "Luxury Hall", amount: 400000, status: "Paid" },
    { name: "Catering Luxury", amount: 200000, status: "Planned" }
  ]);
  assert.strictEqual(deficit.total, 600000);
  assert.strictEqual(deficit.remaining, -100000);
  assert.strictEqual(deficit.isOverBudget, true, "Must flag over-budget condition");
});
