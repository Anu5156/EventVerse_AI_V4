const test = require("node:test");
const assert = require("node:assert");
const { safe, money, uid, defaultTasks } = require("../app.js");

test("Unit: uid() generates unique, non-empty base-36 identifiers", () => {
  const id1 = uid();
  const id2 = uid();
  assert.strictEqual(typeof id1, "string");
  assert.strictEqual(typeof id2, "string");
  assert.ok(id1.length >= 8);
  assert.notStrictEqual(id1, id2, "Identifiers must be unique");
});

test("Unit: defaultTasks() returns 5 phased milestones with valid schema", () => {
  const tasks = defaultTasks();
  assert.strictEqual(tasks.length, 5);
  const ids = new Set();
  tasks.forEach((t) => {
    assert.ok(t.id, "Task must have an id");
    assert.ok(t.title, "Task must have a title");
    assert.ok(t.when, "Task must have a milestone timeline anchor");
    assert.strictEqual(t.done, false, "Task must start uncompleted");
    ids.add(t.id);
  });
  assert.strictEqual(ids.size, 5, "All task ids must be mutually unique");
});

test("Unit: money() formats currency with Indian Rupee standards", () => {
  const zero = money(0);
  const lakh = money(800000);
  const invalid = money("abc");
  assert.ok(zero.includes("0"), "Zero formatted correctly");
  assert.ok(lakh.includes("8,00,000"), "Formatted with en-IN numbering format");
  assert.ok(invalid.includes("0"), "Gracefully falls back to 0 on NaN");
});
