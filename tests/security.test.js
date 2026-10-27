const test = require("node:test");
const assert = require("node:assert");
const { safe } = require("../app.js");

test("Security: safe() neutralizes direct <script> injection attacks", () => {
  const payload = '<script>alert("XSS")</script>';
  const sanitized = safe(payload);
  assert.ok(!sanitized.includes("<script>"), "Must strip raw opening script tag");
  assert.ok(!sanitized.includes("</script>"), "Must strip raw closing script tag");
  assert.strictEqual(sanitized, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
});

test("Security: safe() neutralizes event handler injections in HTML tags", () => {
  const payload = '<img src="x" onerror="alert(document.cookie)">';
  const sanitized = safe(payload);
  assert.ok(!sanitized.includes("<img"), "Must not render unescaped opening angle bracket");
  assert.ok(!sanitized.includes('">'), "Must escape closing quotes and brackets");
  assert.strictEqual(sanitized, '&lt;img src=&quot;x&quot; onerror=&quot;alert(document.cookie)&quot;&gt;');
});

test("Security: safe() handles null, undefined, empty, and numeric types safely", () => {
  assert.strictEqual(safe(null), "");
  assert.strictEqual(safe(undefined), "");
  assert.strictEqual(safe(""), "");
  assert.strictEqual(safe(12345), "12345");
});

test("Security: safe() escapes single quotes and ampersands", () => {
  assert.strictEqual(safe("AT&T 'VIP'"), "AT&amp;T &#39;VIP&#39;");
});
