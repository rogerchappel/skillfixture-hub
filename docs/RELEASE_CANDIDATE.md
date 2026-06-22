# Release Candidate Notes

## 0.1.0

Initial public build with:

- Local-first TypeScript CLI.
- Canonical activation fixture JSON format.
- Starter fixture generation from `SKILL.md`.
- Validation for positive, negative, anti-example, and ambiguous activation coverage.
- Markdown and JSON summaries for review evidence.
- Fixture-backed tests and smoke commands.

## Verification Checklist

- `npm test`
- `npm run check`
- `npm run build`
- `npm run smoke`
- `bash scripts/validate.sh`

## Verification Results

Recorded on 2026-06-22:

- `npm test`: pass, 4 tests.
- `npm run check`: pass.
- `npm run build`: pass.
- `npm run smoke`: pass, fixture validation returned `ok: true` with no warnings.
- `bash scripts/validate.sh`: pass, including generated fixture CLI smoke.
