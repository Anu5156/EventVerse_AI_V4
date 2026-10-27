const test = require("node:test");
const assert = require("node:assert");
const { formatCsv } = require("../app.js");

test("CSV: formatCsv() prefixes UTF-8 Byte Order Mark (BOM)", () => {
  const csv = formatCsv(["Name", "Status"], [["Alice", "Accepted"]]);
  assert.ok(csv.startsWith("\uFEFF"), "CSV must include UTF-8 BOM for Excel compatibility");
});

test("CSV: formatCsv() escapes embedded quotes and commas per RFC 4180", () => {
  const headers = ["Guest", "Notes"];
  const rows = [
    ['Dr. Smith, Jr.', 'Special "VIP" table'],
    ['Simple', 'No notes']
  ];
  const csv = formatCsv(headers, rows);
  assert.ok(csv.includes('"Dr. Smith, Jr."'), "Commas must be enclosed in quotes");
  assert.ok(csv.includes('"Special ""VIP"" table"'), "Embedded quotes must be doubled");
});

test("CSV: formatCsv() utilizes standard CRLF line breaks", () => {
  const csv = formatCsv(["A"], [["B"], ["C"]]);
  assert.ok(csv.includes("\r\n"), "Must use RFC 4180 CRLF line terminators");
});
