import test from "node:test";
import assert from "node:assert/strict";
import {
  renderMarkdownSummary,
  summarizeJson,
  validateFixtureFile,
  type ActivationFixtureFile
} from "../src/index.js";

const validFixture: ActivationFixtureFile = {
  schema_version: "1.0",
  skill_name: "example-skill",
  source: {
    skill_md: "SKILL.md"
  },
  fixtures: [
    {
      id: "positive-primary",
      prompt: "Use example-skill to create activation fixtures for review.",
      expected_activation: "activate",
      reason: "The prompt names the skill and asks for its core fixture workflow.",
      tags: ["positive"],
      safety_notes: ["Keep outputs local for review."]
    },
    {
      id: "negative-adjacent",
      prompt: "Summarize this README into release notes.",
      expected_activation: "do_not_activate",
      reason: "The prompt asks for documentation, not activation fixture work.",
      tags: ["negative"],
      safety_notes: ["Do not activate on broad documentation requests."]
    },
    {
      id: "anti-example-install",
      prompt: "Install this skill into my live agent host.",
      expected_activation: "do_not_activate",
      reason: "Installing live skills is outside the fixture toolkit boundary.",
      tags: ["anti-example"],
      safety_notes: ["Use a separate approval workflow for installation."]
    }
  ]
};

test("validateFixtureFile accepts balanced activation fixtures", () => {
  const result = validateFixtureFile(validFixture);

  assert.equal(result.ok, true);
  assert.equal(result.counts.activate, 1);
  assert.equal(result.counts.do_not_activate, 2);
  assert.equal(result.counts.total, 3);
});

test("validateFixtureFile flags duplicate fixture ids", () => {
  const fixtureFile: ActivationFixtureFile = {
    ...validFixture,
    fixtures: [
      validFixture.fixtures[0],
      { ...validFixture.fixtures[1], id: validFixture.fixtures[0].id }
    ]
  };

  const result = validateFixtureFile(fixtureFile);

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((issue) => issue.code === "duplicate_id"), true);
});

test("validateFixtureFile flags missing negative fixtures", () => {
  const result = validateFixtureFile({
    ...validFixture,
    fixtures: [validFixture.fixtures[0]]
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((issue) => issue.code === "missing_negative"), true);
});

test("summary renderers include status and issue counts", () => {
  const markdown = renderMarkdownSummary(validFixture);
  const summary = summarizeJson(validFixture) as { ok: boolean; issue_count: number };

  assert.match(markdown, /Status: pass/);
  assert.match(markdown, /\| positive-primary \| activate \|/);
  assert.equal(summary.ok, true);
  assert.equal(summary.issue_count, 1);
});
