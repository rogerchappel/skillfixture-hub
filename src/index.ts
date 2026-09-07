import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

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

export async function loadFixtureFile(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as unknown;
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
      skill_md: portableRelativePath(skillMdPath)
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

export function validateFixtureFile(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return validationResult(
      [error("top_level", "Fixture file must be a JSON object.")],
      0,
      0,
      0
    );
  }
  const fixtureFile = input;
  if (fixtureFile.schema_version !== "1.0") {
    issues.push(error("schema_version", "schema_version must be 1.0."));
  }
  if (typeof fixtureFile.skill_name !== "string" || fixtureFile.skill_name.trim().length === 0) {
    issues.push(error("skill_name", "skill_name must be a non-empty string."));
  } else if (/\p{Cc}/u.test(fixtureFile.skill_name)) {
    issues.push(error("skill_name", "skill_name must not contain control characters or line breaks."));
  }
  if (!isRecord(fixtureFile.source)) {
    issues.push(error("source", "source must be a JSON object."));
  } else {
    for (const field of ["skill_md", "skill_yaml"] as const) {
      const value = fixtureFile.source[field];
      if (value !== undefined && typeof value !== "string") {
        issues.push(error(`source_${field}`, `source.${field} must be a string when provided.`));
      }
    }
  }
  if (!Array.isArray(fixtureFile.fixtures) || fixtureFile.fixtures.length === 0) {
    issues.push(error("fixtures", "fixtures must be a non-empty array."));
  }

  const seen = new Set<string>();
  let activate = 0;
  let doNotActivate = 0;
  const fixtures = Array.isArray(fixtureFile.fixtures) ? fixtureFile.fixtures : [];
  for (const [index, value] of fixtures.entries()) {
    if (!isRecord(value)) {
      issues.push(error("fixture", `Fixture at index ${index} must be a JSON object.`));
      continue;
    }
    const fixture = value;
    const fixtureId = typeof fixture.id === "string" ? fixture.id : undefined;
    if (!fixtureId || fixtureId.trim().length === 0) {
      issues.push(error("fixture_id", "Fixture id must be a non-empty string."));
    } else if (seen.has(fixtureId)) {
      issues.push(error("duplicate_id", `Duplicate fixture id '${fixtureId}'.`, fixtureId));
    } else {
      seen.add(fixtureId);
    }
    if (typeof fixture.prompt !== "string" || fixture.prompt.trim().length < 10) {
      issues.push(error("prompt", "Fixture prompt must be a string of at least 10 characters.", fixtureId));
    }
    if (fixture.expected_activation === "activate") {
      activate += 1;
    } else if (fixture.expected_activation === "do_not_activate") {
      doNotActivate += 1;
    } else {
      issues.push(error("expected_activation", "expected_activation must be activate or do_not_activate.", fixtureId));
    }
    if (typeof fixture.reason !== "string" || fixture.reason.trim().length < 12) {
      issues.push(error("reason", "Fixture reason must be a string of at least 12 characters.", fixtureId));
    }
    if (!isStringArray(fixture.tags)) {
      issues.push(error("tags", "Fixture tags must be an array of strings.", fixtureId));
    } else if (fixture.tags.length === 0) {
      issues.push(warn("tags", "Add tags so reviewers can group activation cases.", fixtureId));
    }
    if (!isStringArray(fixture.safety_notes)) {
      issues.push(error("safety_notes", "Fixture safety_notes must be an array of strings.", fixtureId));
    } else if (fixture.safety_notes.length === 0) {
      issues.push(warn("safety_notes", "Add safety notes for activation boundaries.", fixtureId));
    }
    if (typeof fixture.prompt === "string" && looksAmbiguous(fixture.prompt) && fixture.expected_activation === "activate") {
      issues.push(warn("ambiguous_activation", "Positive fixture prompt may be too broad or ambiguous.", fixtureId));
    }
  }

  if (activate === 0) {
    issues.push(error("missing_positive", "At least one activate fixture is required."));
  }
  if (doNotActivate === 0) {
    issues.push(error("missing_negative", "At least one do_not_activate fixture is required."));
  }
  if (!fixtures.some((fixture) => isRecord(fixture) && isStringArray(fixture.tags) && fixture.tags.includes("anti-example"))) {
    issues.push(warn("missing_anti_example", "Add at least one anti-example fixture for unsafe or out-of-scope prompts."));
  }

  return validationResult(issues, activate, doNotActivate, fixtures.length);
}

export function renderMarkdownSummary(input: unknown): string {
  const fixtureFile = requireValidFixtureFile(input);
  const validation = validateFixtureFile(fixtureFile);
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

export function summarizeJson(input: unknown): object {
  const fixtureFile = requireValidFixtureFile(input);
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
  const lines = skillText.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!/use when|when to use|trigger/i.test(line)) continue;
    const undecorated = line.replace(/^[-*\s#:]*/, "").trim();
    const headingOnly = /^(?:use when|when to use|triggers?)\s*:?$/i.test(undecorated);
    const candidate = headingOnly
      ? lines.slice(index + 1).find((nextLine) => nextLine.trim().length > 0)
      : line;
    if (!candidate) continue;
    const prose = normalizeTriggerProse(candidate);
    if (prose) return [prose];
  }
  return [];
}

function normalizeTriggerProse(triggerLine: string): string {
  return triggerLine
    .replace(/^[-*\s#:]*/, "")
    .replace(/^(?:use when|when to use|triggers?)\s*:?[\s-]*/i, "")
    .replace(/^use\s+this\s+skill\s+when\s+/i, "")
    .replace(/^(?:an?\s+)?agent\s+needs\s+to\s+/i, "")
    .replace(/^you\s+need\s+to\s+/i, "")
    .trim()
    .replace(/[.!?]+$/, "");
}

function portableRelativePath(path: string): string {
  return relative(process.cwd(), resolve(path)).split(sep).join("/");
}

function looksAmbiguous(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return [/\bhelp\b/, /\bfix\b/, /\breview\b/, /\bhandle this\b/, /\bdo the task\b/].some((pattern) => pattern.test(lower));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validationResult(
  issues: ValidationIssue[],
  activate: number,
  doNotActivate: number,
  total: number
): ValidationResult {
  const errors = issues.filter((issue) => issue.level === "error");
  return {
    ok: errors.length === 0,
    errors,
    warnings: issues.filter((issue) => issue.level === "warning"),
    counts: { activate, do_not_activate: doNotActivate, total }
  };
}

function requireValidFixtureFile(input: unknown): ActivationFixtureFile {
  const validation = validateFixtureFile(input);
  if (!validation.ok) {
    throw new Error(`Invalid fixture file: ${validation.errors.length} validation error(s). Run validate for details.`);
  }
  return input as ActivationFixtureFile;
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
