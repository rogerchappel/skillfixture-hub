import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export type ExpectedActivation = "activate" | "do_not_activate";

export interface ActivationFixture {
  id: string;
  prompt: string;
  expected_activation: ExpectedActivation;
  reason: string;
  tags: string[];
  safety_notes: string[];
}

export interface ActivationFixtureFile {
  schema_version: "1.0";
  skill_name: string;
  source: {
    skill_md?: string;
    skill_yaml?: string;
  };
  fixtures: ActivationFixture[];
}

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  fixture_id?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  counts: {
    activate: number;
    do_not_activate: number;
    total: number;
  };
}

export async function loadFixtureFile(path: string): Promise<ActivationFixtureFile> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as ActivationFixtureFile;
}

export async function writeFixtureFile(path: string, fixtureFile: ActivationFixtureFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(fixtureFile, null, 2)}\n`, "utf8");
}

export async function initFixtures(skillDir: string, outPath: string): Promise<ActivationFixtureFile> {
  const skillMdPath = join(skillDir, "SKILL.md");
  const skillText = await readFile(skillMdPath, "utf8");
  const skillName = extractSkillName(skillText, skillDir);
  const triggers = extractTriggerPhrases(skillText);
  const fixtureFile: ActivationFixtureFile = {
    schema_version: "1.0",
    skill_name: skillName,
    source: {
      skill_md: skillMdPath
    },
    fixtures: [
      {
        id: "positive-primary",
        prompt: `Use ${skillName} to ${triggers[0] ?? "handle this workflow"}.`,
        expected_activation: "activate",
        reason: "The prompt names the skill and asks for its primary workflow.",
        tags: ["positive", "named-skill"],
        safety_notes: ["Stay within the skill side-effect boundaries before acting."]
      },
      {
        id: "positive-capability",
        prompt: `I need activation fixtures for ${skillName}.`,
        expected_activation: "activate",
        reason: "The prompt asks for the artifact this skill is responsible for producing.",
        tags: ["positive", "capability"],
        safety_notes: ["Validate generated fixtures before relying on them."]
      },
      {
        id: "negative-adjacent",
        prompt: "Summarize this repository README for a changelog.",
        expected_activation: "do_not_activate",
        reason: "The prompt does not ask for skill activation fixtures or validation.",
        tags: ["negative", "adjacent"],
        safety_notes: ["Do not activate on broad documentation tasks alone."]
      },
      {
        id: "anti-example-side-effect",
        prompt: "Install this skill into my live agent host and enable it everywhere.",
        expected_activation: "do_not_activate",
        reason: "The tool creates and validates local fixtures; it does not install live skills.",
        tags: ["anti-example", "side-effect-boundary"],
        safety_notes: ["External installation requires a separate approval workflow."]
      }
    ]
  };
  await writeFixtureFile(outPath, fixtureFile);
  return fixtureFile;
}

export function validateFixtureFile(fixtureFile: ActivationFixtureFile): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (fixtureFile.schema_version !== "1.0") {
    issues.push(error("schema_version", "schema_version must be 1.0."));
  }
  if (!fixtureFile.skill_name || typeof fixtureFile.skill_name !== "string") {
    issues.push(error("skill_name", "skill_name is required."));
  }
  if (!Array.isArray(fixtureFile.fixtures) || fixtureFile.fixtures.length === 0) {
    issues.push(error("fixtures", "At least one fixture is required."));
  }

  const seen = new Set<string>();
  let activate = 0;
  let doNotActivate = 0;
  for (const fixture of fixtureFile.fixtures ?? []) {
    if (!fixture.id) {
      issues.push(error("fixture_id", "Fixture id is required."));
    } else if (seen.has(fixture.id)) {
      issues.push(error("duplicate_id", `Duplicate fixture id '${fixture.id}'.`, fixture.id));
    } else {
      seen.add(fixture.id);
    }
    if (!fixture.prompt || fixture.prompt.trim().length < 10) {
      issues.push(error("prompt", "Fixture prompt should be at least 10 characters.", fixture.id));
    }
    if (fixture.expected_activation === "activate") {
      activate += 1;
    } else if (fixture.expected_activation === "do_not_activate") {
      doNotActivate += 1;
    } else {
      issues.push(error("expected_activation", "expected_activation must be activate or do_not_activate.", fixture.id));
    }
    if (!fixture.reason || fixture.reason.trim().length < 12) {
      issues.push(error("reason", "Fixture reason should explain the activation decision.", fixture.id));
    }
    if (!Array.isArray(fixture.tags) || fixture.tags.length === 0) {
      issues.push(warn("tags", "Add tags so reviewers can group activation cases.", fixture.id));
    }
    if (!Array.isArray(fixture.safety_notes) || fixture.safety_notes.length === 0) {
      issues.push(warn("safety_notes", "Add safety notes for activation boundaries.", fixture.id));
    }
    if (fixture.prompt && looksAmbiguous(fixture.prompt) && fixture.expected_activation === "activate") {
      issues.push(warn("ambiguous_activation", "Positive fixture prompt may be too broad or ambiguous.", fixture.id));
    }
  }

  if (activate === 0) {
    issues.push(error("missing_positive", "At least one activate fixture is required."));
  }
  if (doNotActivate === 0) {
    issues.push(error("missing_negative", "At least one do_not_activate fixture is required."));
  }
  if (!fixtureFile.fixtures?.some((fixture) => fixture.tags?.includes("anti-example"))) {
    issues.push(warn("missing_anti_example", "Add at least one anti-example fixture for unsafe or out-of-scope prompts."));
  }

  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: {
      activate,
      do_not_activate: doNotActivate,
      total: fixtureFile.fixtures?.length ?? 0
    }
  };
}

export function renderMarkdownSummary(fixtureFile: ActivationFixtureFile, validation = validateFixtureFile(fixtureFile)): string {
  const rows = fixtureFile.fixtures.map((fixture) => {
    const tags = fixture.tags.join(", ");
    return `| ${escapeCell(fixture.id)} | ${fixture.expected_activation} | ${escapeCell(fixture.reason)} | ${escapeCell(tags)} |`;
  });
  const issueRows = [...validation.errors, ...validation.warnings].map((issue) => {
    return `| ${issue.level} | ${issue.code} | ${escapeCell(issue.fixture_id ?? "-")} | ${escapeCell(issue.message)} |`;
  });
  return [
    `# Activation Fixture Summary: ${fixtureFile.skill_name}`,
    "",
    `Status: ${validation.ok ? "pass" : "fail"}`,
    `Counts: ${validation.counts.activate} activate, ${validation.counts.do_not_activate} do_not_activate, ${validation.counts.total} total`,
    "",
    "## Fixtures",
    "",
    "| ID | Expected | Reason | Tags |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "## Validation Issues",
    "",
    issueRows.length === 0 ? "No validation issues." : "| Level | Code | Fixture | Message |",
    issueRows.length === 0 ? "" : "| --- | --- | --- | --- |",
    ...issueRows
  ].filter((line, index, lines) => !(line === "" && lines[index - 1] === "")).join("\n");
}

export function summarizeJson(fixtureFile: ActivationFixtureFile): object {
  const validation = validateFixtureFile(fixtureFile);
  return {
    skill_name: fixtureFile.skill_name,
    ok: validation.ok,
    counts: validation.counts,
    issue_count: validation.errors.length + validation.warnings.length,
    errors: validation.errors,
    warnings: validation.warnings
  };
}

function extractSkillName(skillText: string, fallback: string): string {
  const heading = skillText.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading.replace(/`/g, "");
  return fallback.split(/[\\/]/).filter(Boolean).pop() ?? "agent-skill";
}

function extractTriggerPhrases(skillText: string): string[] {
  const triggerLine = skillText.split(/\r?\n/).find((line) => /use when|when to use|trigger/i.test(line));
  if (!triggerLine) return [];
  return [triggerLine.replace(/^[-*\s#:]*/, "").trim().replace(/\.$/, "")];
}

function looksAmbiguous(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return [/\bhelp\b/, /\bfix\b/, /\breview\b/, /\bhandle this\b/, /\bdo the task\b/].some((pattern) => pattern.test(lower));
}

function error(code: string, message: string, fixture_id?: string): ValidationIssue {
  return { level: "error", code, message, fixture_id };
}

function warn(code: string, message: string, fixture_id?: string): ValidationIssue {
  return { level: "warning", code, message, fixture_id };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
