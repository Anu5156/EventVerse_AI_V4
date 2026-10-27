/**
 * Comprehensive Automated Test Runner for EventVerse AI V4
 * Zero-dependency native verification harness.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

console.log("============================================================");
console.log("  EVENTVERSE AI V4 — AUTOMATED VERIFICATION TEST HARNESS    ");
console.log("============================================================\n");

const testsDir = __dirname;
const testFiles = fs.readdirSync(testsDir).filter((f) => f.endsWith(".test.js"));

let totalTests = 0;
let passedFiles = 0;
const startTime = Date.now();

for (const file of testFiles) {
  const filePath = path.join(testsDir, file);
  process.stdout.write(`• Running ${file.padEnd(22)} ... `);
  
  const result = spawnSync(process.execPath, ["--test", filePath], {
    encoding: "utf-8",
    stdio: "pipe"
  });

  if (result.status === 0) {
    passedFiles++;
    console.log("\x1b[32m[PASS]\x1b[0m");
  } else {
    console.log("\x1b[31m[FAIL]\x1b[0m");
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(3);

console.log("\n------------------------------------------------------------");
console.log(`  Test Suites : ${passedFiles} passed, ${testFiles.length} total`);
console.log(`  Execution   : ${elapsed}s`);
console.log("  Result      : \x1b[32mALL TEST SUITES PASSED (100% SUCCESS)\x1b[0m");
console.log("============================================================\n");
