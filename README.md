# skillfixture-hub

`skillfixture-hub` is a local-first activation fixture toolkit for portable agent skills. It helps skill authors create positive, negative, and anti-example prompts so activation behavior can be reviewed before a skill is packaged or shipped.

## Quickstart

```bash
npm install
npm run build
node dist/src/cli.js validate fixtures/activation.json
node dist/src/cli.js summarize fixtures/activation.json --format markdown
node dist/src/cli.js init fixtures/example-skill --out tmp/generated-activation.json
```

## Commands

- `init <skill-dir> --out <path>` creates a starter activation fixture file from a local `SKILL.md`.
- `validate <fixtures.json>` checks schema shape, positive and negative coverage, anti-examples, and ambiguous activation language.
- `render <fixtures.json> --format markdown --out <path>` writes a pull-request review table.
- `summarize <fixtures.json> --format json|markdown` prints review evidence to stdout.

## Fixture Schema

```json
{
  "schema_version": "1.0",
  "skill_name": "example-skill",
  "source": {
    "skill_md": "SKILL.md"
  },
  "fixtures": [
    {
      "id": "positive-primary",
      "prompt": "Use example-skill to prepare a local review packet.",
      "expected_activation": "activate",
      "reason": "The prompt names the skill and asks for its core workflow.",
      "tags": ["positive"],
      "safety_notes": ["Stay local and do not write to external services."]
    }
  ]
}
```

## Safety Notes

This project never calls LLM APIs, installs skills, edits live agent hosts, or writes to external services. Outputs are deterministic local files intended for review.

## Limitations

- YAML skill metadata is recorded only as source context in V1.
- Activation quality still depends on human review of prompts and reasons.
- The ambiguity detector is intentionally conservative and rule-based.

## Verification

```bash
npm run release:check
```

The release check runs:

```bash
npm run check
npm test
npm run smoke
npm run package:smoke
```

`package:smoke` builds the TypeScript output, runs `npm pack --dry-run`, and
fails if the packed artifact is missing the CLI, library module, activation
fixture, skill file, release notes, README, or license.
