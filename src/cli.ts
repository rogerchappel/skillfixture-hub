#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  initFixtures,
  loadFixtureFile,
  renderMarkdownSummary,
  summarizeJson,
  validateFixtureFile
} from "./index.js";

interface CliOptions {
  out?: string;
  format?: "json" | "markdown";
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const { positionals, options } = parseArgs(rest);

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return 0;
  }

  if (command === "init") {
    const skillDir = positionals[0];
    if (!skillDir) throw new Error("init requires a skill directory.");
    const out = options.out ?? "fixtures/activation.json";
    const fixtureFile = await initFixtures(skillDir, out);
    console.log(`Created ${out} with ${fixtureFile.fixtures.length} fixtures.`);
    return 0;
  }

  if (command === "validate") {
    const file = await loadFixtureFile(required(positionals[0], "validate requires a fixture JSON file."));
    const result = validateFixtureFile(file);
    for (const issue of [...result.errors, ...result.warnings]) {
      console.error(`${issue.level.toUpperCase()} ${issue.code}${issue.fixture_id ? ` ${issue.fixture_id}` : ""}: ${issue.message}`);
    }
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  if (command === "render" || command === "summarize") {
    const filePath = required(positionals[0], `${command} requires a fixture JSON file.`);
    const fixtureFile = await loadFixtureFile(filePath);
    const format = options.format ?? (command === "render" ? "markdown" : "json");
    const rendered = format === "markdown"
      ? renderMarkdownSummary(fixtureFile)
      : `${JSON.stringify(summarizeJson(fixtureFile), null, 2)}\n`;
    if (options.out) {
      await mkdir(dirname(options.out), { recursive: true });
      await writeFile(options.out, rendered.endsWith("\n") ? rendered : `${rendered}\n`, "utf8");
      console.log(`Wrote ${options.out}`);
    } else {
      process.stdout.write(rendered.endsWith("\n") ? rendered : `${rendered}\n`);
    }
    return 0;
  }

  throw new Error(`Unknown command '${command}'.`);
}

function parseArgs(args: string[]): { positionals: string[]; options: CliOptions } {
  const positionals: string[] = [];
  const options: CliOptions = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--out") {
      options.out = required(args[++i], "--out requires a path.");
    } else if (arg === "--format") {
      const format = required(args[++i], "--format requires json or markdown.");
      if (format !== "json" && format !== "markdown") throw new Error("--format must be json or markdown.");
      options.format = format;
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, options };
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function printHelp(): void {
  console.log(`skillfixture-hub

Usage:
  skillfixture-hub init <skill-dir> --out fixtures/activation.json
  skillfixture-hub validate <fixtures.json>
  skillfixture-hub render <fixtures.json> --format markdown --out review.md
  skillfixture-hub summarize <fixtures.json> --format json
`);
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
