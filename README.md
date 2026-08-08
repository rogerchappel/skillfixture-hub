# skillfixture-hub

`skillfixture-hub` is a local-first activation fixture toolkit for portable agent skills. It helps skill authors create positive, negative, and anti-example prompts so activation behavior can be reviewed before a skill is packaged or shipped.

## Quickstart

```bash
npm install
npm run build
node dist/cli.js validate fixtures/activation.json
node dist/cli.js summarize fixtures/activation.json --format markdown
node dist/cli.js init fixtures/example-skill --out tmp/generated-activation.json
```

Install the package to use either the CLI or its typed ESM library entrypoint:

```bash
npm install skillfixture-hub
npx skillfixture-hub validate fixtures/activation.json
```

```ts
import { validateFixtureFile } from "skillfixture-hub";

const result = validateFixtureFile(fixtureData);
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

`validate` treats parsed JSON as untrusted input. Malformed top-level values, fixture
objects, and field types produce a deterministic JSON validation result and a
nonzero exit status. `render` and `summarize` reject malformed fixture data with a
clear error directing you to `validate` for field-level details.

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

CI runs the complete release check on Node.js 20 and 24. The test command
discovers compiled `*.test.js` files without relying on shell glob expansion and
fails if compilation produces no test files.

`package:smoke` builds and installs the actual `npm pack` tarball in an isolated
consumer, verifies a root library import and the installed CLI, and fails if the
artifact is missing required release files or contains compiled test output.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Keep fixtures deterministic, add or update tests for validation behavior changes, and run `npm run release:check` before opening a pull request.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting. Do not include private prompts, proprietary skill instructions, credentials, or live agent host details in public issues.

## Support

See [SUPPORT.md](SUPPORT.md) for the supported pre-1.0 surface and the evidence to include with bug reports.
