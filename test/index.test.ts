import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdownSummary, summarizeJson, validateFixtureFile, type ActivationFixtureFile } from "../src/index.js";

const validFixture: ActivationFixtureFile = {
  schema_version: "1.0",
  skill_name: "Example Skill",
  source: { skill_md: "SKILL.md" },
  fixtures: [
    {
      id: "yes",
      prompt: "Use Example Skill to validate activation fixtures.",
      expected_activation: "activate",
      reason: "The prompt names the skill and fixture validation task.",
      tags: ["positive"],
      safety_notes: ["Only validate local files."]
    },
    {
      id: "no",
      prompt: "Draft a customer follow-up email.",
      expected_activation: "do_not_activate",
      reason: "The prompt is unrelated to skill activation fixtures.",
      tags: ["negative", "anti-example"],
      safety_notes: ["Do not activate on unrelated writing tasks."]
    }
  ]
};

test("validates balanced activation fixtures", () => {
  const result = validateFixtureFile(validFixture);
  assert.equal(result.ok, true);
  assert.equal(result.counts.activate, 1);
  assert.equal(result.counts.do_not_activate, 1);
});

test("flags missing negative fixtures", () => {
  const result = validateFixtureFile({
    ...validFixture,
    fixtures: [validFixture.fixtures[0]]
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((issue) => issue.code === "missing_negative"), true);
});

test("renders markdown review table", () => {
  const markdown = renderMarkdownSummary(validFixture);
  assert.match(markdown, /Activation Fixture Summary/);
  assert.match(markdown, /\| yes \| activate \|/);
});

test("summarizes validation as json-friendly data", () => {
  const summary = summarizeJson(validFixture) as { ok: boolean; counts: { total: number } };
  assert.equal(summary.ok, true);
  assert.equal(summary.counts.total, 2);
});
