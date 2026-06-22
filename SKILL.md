# skillfixture-hub

Use this skill when an agent needs to generate, validate, or summarize activation fixtures for a portable agent skill.

## Required Inputs

- A local `SKILL.md` when generating starter fixtures.
- A local activation fixture JSON file when validating or summarizing.
- Optional review destination for rendered Markdown output.

## Side-Effect Boundaries

- Read and write local files only.
- Do not install, approve, enable, or modify live skills.
- Do not call external services or LLM APIs.
- Do not treat generated starter fixtures as sufficient without review.

## Approval Requirements

Human approval is required before using fixture results to change production skill routing, live agent configuration, or marketplace listings.

## Examples

```bash
skillfixture-hub init ./my-skill --out fixtures/activation.json
skillfixture-hub validate fixtures/activation.json
skillfixture-hub summarize fixtures/activation.json --format markdown
```

## Validation Workflow

1. Generate or edit activation fixtures locally.
2. Run `skillfixture-hub validate`.
3. Render a Markdown summary for the pull request.
4. Confirm positive, negative, and anti-example coverage before shipping.
