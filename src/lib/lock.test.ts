import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPin, verifyPinHash, PIN_REGEX } from "./pin";

process.env.LOCK_SECRET = "test-secret";

test("PIN is exactly 6 digits", () => {
  assert.ok(PIN_REGEX.test("012345"));
  for (const bad of ["12345", "1234567", "12a456", "", " 123456"]) assert.equal(PIN_REGEX.test(bad), false);
});

test("hashPin/verifyPinHash round-trip, salted, wrong PIN rejected", async () => {
  const a = await hashPin("123456");
  const b = await hashPin("123456");
  assert.notEqual(a, b);
  assert.ok(await verifyPinHash("123456", a));
  assert.equal(await verifyPinHash("654321", a), false);
  assert.equal(await verifyPinHash("123456", "garbage"), false);
});

test("unlock cookie: valid for its user, rejects other user, tamper and expiry", async () => {
  const { signUnlock, verifyUnlock, LOCK_IDLE_MS } = await import("./lock-cookie");
  const now = 1_000_000;
  const cookie = (await signUnlock("user-1", now))!;
  assert.ok(await verifyUnlock(cookie, "user-1", now + 1000));
  assert.equal(await verifyUnlock(cookie, "user-2", now + 1000), false);
  assert.equal(await verifyUnlock(cookie + "0", "user-1", now + 1000), false);
  assert.equal(await verifyUnlock(cookie, "user-1", now + LOCK_IDLE_MS + 1), false);
  assert.equal(await verifyUnlock(undefined, "user-1", now), false);
});
