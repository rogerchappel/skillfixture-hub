import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";
import { strict as assert } from "node:assert";

const cli = resolve("dist/cli.js");
const fixture = resolve("fixtures/activation.json");

function run(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

test("smoke validation accepts the checked-in activation fixture", () => {
  const result = run("validate", fixture);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).ok, true);
});

test("smoke markdown summary renders fixture headings and content", () => {
  const result = run("summarize", fixture, "--format", "markdown");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^# Activation Fixture Summary/m);
  assert.match(result.stdout, /fixture/i);
});
