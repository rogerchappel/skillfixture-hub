# Orchestration

## Agent Flow

1. Read the target skill's `SKILL.md`.
2. Run `skillfixture-hub init <skill-dir> --out fixtures/activation.json` if no fixture file exists.
3. Edit prompts, reasons, tags, and safety notes with the skill author.
4. Run `skillfixture-hub validate fixtures/activation.json`.
5. Run `skillfixture-hub render fixtures/activation.json --format markdown --out docs/activation-review.md`.
6. Attach the rendered table to a release-candidate pull request.

## Failure Handling

- Treat validation errors as release blockers.
- Treat warnings as review prompts unless the repository policy says otherwise.
- Do not mutate live skill routing based solely on generated fixtures.

## External Actions

No external writes are part of V1. Publishing, marketplace changes, and production activation require separate explicit approval.
