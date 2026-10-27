const test = require("node:test");
const assert = require("node:assert");
const { simulateCrisisData } = require("../app.js");

test("Chaos: simulateCrisisData() isolates exact 10% reserve from total budget", () => {
  const budget = 800000;
  const expenses = [{ name: "Hall", amount: 200000, status: "Paid" }];
  const crisis = simulateCrisisData(budget, expenses);

  assert.strictEqual(crisis.reserve, 80000, "10% contingency reserve must be exactly 80,000");
  assert.strictEqual(crisis.total, 200000, "Active liability must be accurately extracted");
  assert.strictEqual(crisis.isReserveGuarded, true, "Emergency reserve must be flagged as guarded");
});

test("Chaos: handles edge case of zero budget or zero expenses gracefully", () => {
  const crisis = simulateCrisisData(0, []);
  assert.strictEqual(crisis.reserve, 0);
  assert.strictEqual(crisis.total, 0);
  assert.strictEqual(crisis.isReserveGuarded, true);
});
