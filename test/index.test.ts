import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initFixtures,
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

test("initFixtures turns trigger prose into a grammatical primary prompt", async () => {
  const directory = mkdtempSync(join(tmpdir(), "skillfixture-hub-init-"));
  const skillDirectory = join(directory, "example-skill");
  const outputPath = join(directory, "activation.json");
  mkdirSync(skillDirectory, { recursive: true });
  writeFileSync(join(skillDirectory, "SKILL.md"), [
    "# Example Research Skill",
    "",
    "Use when an agent needs to turn a local research brief into source-backed notes."
  ].join("\n"));

  try {
    const fixtureFile = await initFixtures(skillDirectory, outputPath);
    assert.equal(fixtureFile.fixtures[0].prompt, "Use Example Research Skill to turn a local research brief into source-backed notes.");
    assert.doesNotMatch(fixtureFile.fixtures[0].prompt, /to (?:Use when|When to use|Trigger)/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("validateFixtureFile rejects control characters in skill_name", () => {
  for (const skillName of ["Demo\n## Injected", "Demo\rInjected", "Demo\tInjected"]) {
    const input = { ...validFixture, skill_name: skillName };
    const result = validateFixtureFile(input);
    assert.equal(result.ok, false);
    assert.equal(result.errors.some((issue) => issue.code === "skill_name"), true);
    assert.throws(() => renderMarkdownSummary(input), /Invalid fixture file/);
  }
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

test("validateFixtureFile reports non-object top-level values", () => {
  for (const input of [null, 42, "fixture", []]) {
    const result = validateFixtureFile(input);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map((issue) => issue.code), ["top_level"]);
  }
});

test("validateFixtureFile reports malformed fixture field types without throwing", () => {
  const result = validateFixtureFile({
    schema_version: "1.0",
    skill_name: "example-skill",
    source: { skill_md: 3 },
    fixtures: [
      {
        id: 7,
        prompt: 42,
        expected_activation: false,
        reason: { text: "bad" },
        tags: "bad",
        safety_notes: null
      },
      null,
      {
        id: "arrays",
        prompt: ["not", "text"],
        expected_activation: "activate",
        reason: false,
        tags: ["valid", 1],
        safety_notes: {}
      }
    ]
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((issue) => issue.code),
    [
      "source_skill_md",
      "fixture_id",
      "prompt",
      "expected_activation",
      "reason",
      "tags",
      "safety_notes",
      "fixture",
      "prompt",
      "reason",
      "tags",
      "safety_notes",
      "missing_negative"
    ]
  );
});

test("summary renderers reject invalid values with a clear validation error", () => {
  assert.throws(() => renderMarkdownSummary({ fixtures: [] }), /Invalid fixture file: \d+ validation error/);
  assert.throws(() => summarizeJson(null), /Invalid fixture file: 1 validation error/);
});

test("validate CLI emits structured JSON and exits nonzero for malformed schema data", () => {
  const directory = mkdtempSync(join(tmpdir(), "skillfixture-hub-test-"));
  const fixturePath = join(directory, "malformed.json");
  writeFileSync(fixturePath, JSON.stringify({
    schema_version: "1.0",
    skill_name: "example",
    source: {},
    fixtures: [{
      id: "bad",
      prompt: 42,
      expected_activation: "activate",
      reason: false,
      tags: "bad",
      safety_notes: null
    }]
  }));

  try {
    const validation = spawnSync(process.execPath, ["dist-test/src/cli.js", "validate", fixturePath], {
      encoding: "utf8"
    });
    assert.equal(validation.status, 1);
    const result = JSON.parse(validation.stdout) as { ok: boolean; errors: Array<{ code: string }> };
    assert.equal(result.ok, false);
    assert.deepEqual(
      result.errors.slice(0, 4).map((issue) => issue.code),
      ["prompt", "reason", "tags", "safety_notes"]
    );
    assert.doesNotMatch(validation.stderr, /TypeError/);

    const summary = spawnSync(process.execPath, ["dist-test/src/cli.js", "summarize", fixturePath], {
      encoding: "utf8"
    });
    assert.equal(summary.status, 1);
    assert.match(summary.stderr, /Invalid fixture file.*Run validate for details/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("compiled CLI normalizes triggers and rejects multiline Markdown metadata", () => {
  const directory = mkdtempSync(join(tmpdir(), "skillfixture-hub-cli-metadata-"));
  const skillDirectory = join(directory, "demo");
  const generatedPath = join(directory, "generated.json");
  const malformedPath = join(directory, "malformed.json");
  mkdirSync(skillDirectory, { recursive: true });
  writeFileSync(join(skillDirectory, "SKILL.md"), "# Demo Skill\n\nWhen to use: You need to prepare fixture evidence.\n");
  writeFileSync(malformedPath, JSON.stringify({ ...validFixture, skill_name: "Demo\n## Injected" }));

  try {
    const init = spawnSync(process.execPath, ["dist-test/src/cli.js", "init", skillDirectory, "--out", generatedPath], { encoding: "utf8" });
    assert.equal(init.status, 0, init.stderr);
    const generated = JSON.parse(readFileSync(generatedPath, "utf8")) as ActivationFixtureFile;
    assert.equal(generated.fixtures[0].prompt, "Use Demo Skill to prepare fixture evidence.");

    const render = spawnSync(process.execPath, ["dist-test/src/cli.js", "render", malformedPath, "--format", "markdown"], { encoding: "utf8" });
    assert.equal(render.status, 1);
    assert.match(render.stderr, /Invalid fixture file/);
    assert.doesNotMatch(render.stdout, /## Injected/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CLI rejects unknown options, duplicate options, and extra operands", () => {
  const cli = (args: string[]) => spawnSync(process.execPath, ["dist-test/src/cli.js", ...args], {
    encoding: "utf8"
  });
  const cases = [
    [["validate", "fixtures/activation.json", "--bogus"], /Unknown option '--bogus'/],
    [["validate", "fixtures/activation.json", "extra.json"], /accepts exactly one operand/],
    [["init", "fixtures/example-skill", "extra", "--out", "tmp/out.json"], /accepts exactly one operand/],
    [["render", "fixtures/activation.json", "--format", "json", "--format", "markdown"], /--format may only be specified once/],
    [["summarize", "fixtures/activation.json", "--out", "a", "--out", "b"], /--out may only be specified once/],
    [["validate", "fixtures/activation.json", "--out", "result.json"], /--out is not valid for validate/]
  ] as const;

  for (const [args, expected] of cases) {
    const result = cli([...args]);
    assert.equal(result.status, 1, args.join(" "));
    assert.match(result.stderr, /^Usage error:/);
    assert.match(result.stderr, expected);
  }
});
