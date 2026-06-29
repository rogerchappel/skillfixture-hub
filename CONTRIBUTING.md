# Contributing

Thanks for helping improve `skillfixture-hub`.

## Development Setup

```sh
npm install
npm run build
npm test
npm run smoke
```

## Pull Request Checklist

- Keep fixture examples local, deterministic, and safe to publish.
- Add or update tests when validation rules, summaries, or CLI behavior changes.
- Update `README.md` when commands or schema expectations change.
- Run `npm run release:check` before opening a pull request.

## Review Notes

Include the exact verification commands you ran. Redact private prompts, proprietary skill text, credentials, and live agent host paths before sharing fixtures publicly.
