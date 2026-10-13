import test from "node:test";
import assert from "node:assert/strict";
import { registerOptionalBrowserTools } from "../lib/optional-browser-tools.ts";

const definition = { name: "test_tool", title: "Test", description: "Test", inputSchema: {}, execute: () => ({ ok: true }) };
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("an unavailable browser integration is harmless", async () => {
  const stop = registerOptionalBrowserTools(undefined, [definition]);
  await settle();
  assert.doesNotThrow(stop);
});

test("synchronous registration errors do not escape into the page", async () => {
  const stop = registerOptionalBrowserTools({ registerTool() { throw new Error("unsupported"); } }, [definition]);
  await settle();
  assert.doesNotThrow(stop);
});

test("rejected asynchronous registrations do not cause unhandled rejection", async () => {
  const stop = registerOptionalBrowserTools({ registerTool() { return Promise.reject(new Error("unsupported")); } }, [definition]);
  await settle();
  stop();
});

test("throwing method getters are contained", async () => {
  const stop = registerOptionalBrowserTools({ get registerTool() { throw new Error("security restriction"); } }, [definition]);
  await settle();
  stop();
});

test("successful registration executes and unregisters correctly", async () => {
  let registration;
  let signal;
  const removed = [];
  const stop = registerOptionalBrowserTools({ registerTool(tool, options) { registration = tool; signal = options.signal; }, unregisterTool(name) { removed.push(name); } }, [definition]);
  await settle();
  assert.deepEqual(registration.execute({}), { ok: true });
  stop();
  await settle();
  assert.equal(signal.aborted, true);
  assert.deepEqual(removed, ["test_tool"]);
});

test("unmounted effects never register stale tools", async () => {
  let count = 0;
  const stop = registerOptionalBrowserTools({ registerTool() { count += 1; } }, [definition]);
  stop();
  await settle();
  assert.equal(count, 0);
});

test("cleanup rejection is contained", async () => {
  const stop = registerOptionalBrowserTools({ registerTool() {}, unregisterTool() { return Promise.reject(new Error("already removed")); } }, [definition]);
  await settle();
  stop();
  await settle();
});
