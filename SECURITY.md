# Security Policy

## Supported Versions

`skillfixture-hub` is a pre-1.0 local-first toolkit. Security fixes are accepted for the current `main` branch and the latest npm pre-release line.

## Reporting a Vulnerability

Please use GitHub private vulnerability reporting when available, or open a minimal public issue that asks for a private contact path without including sensitive details.

Include:

- The affected command or library API.
- A minimal redacted fixture file.
- Whether private prompts, skill instructions, or host paths were exposed.

Do not include credentials, private prompts, proprietary skill instructions, or live agent host configuration in public issues.

## Scope

The project reads local skill and fixture files, validates activation examples, and writes deterministic local outputs. Reports about unsafe fixture handling, package contents, path handling, or misleading validation results are in scope. Installing or enabling live skills is outside this package.
