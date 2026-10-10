"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { shouldSkipBuild } = require("../scripts/vercel-ignore-build.cjs");

test("production main is eligible for building", () => {
  assert.equal(shouldSkipBuild({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }), false);
});

for (const [environment, branch] of [
  ["preview", "feat/phase-0-foundation"],
  ["preview", "staging"],
  ["production", "staging"],
  ["production", "feat/mcp"],
  [undefined, undefined],
  ["production", undefined],
  [undefined, "main"],
]) {
  test(`refuses build for environment ${String(environment)} and branch ${String(branch)}`, () => {
    assert.equal(shouldSkipBuild({ VERCEL_ENV: environment, VERCEL_GIT_COMMIT_REF: branch }), true);
  });
}
