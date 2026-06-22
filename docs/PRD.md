# PRD: skillfixture-hub

## Problem

Portable agent skills need repeatable activation checks, but fixture formats often vary from repo to repo. Reviewers need a tiny shared tool that keeps activation examples deterministic and easy to discuss in pull requests.

## Goals

- Generate starter activation fixtures from a local `SKILL.md`.
- Validate a canonical JSON schema for positive, negative, and anti-example prompts.
- Render Markdown review tables for release-candidate pull requests.
- Keep all behavior local, deterministic, and safe for public repositories.

## Non-Goals

- Calling model APIs.
- Installing skills into live hosts.
- Owning a hosted registry.

## Users

- Skill authors preparing a new public skill.
- Reviewers checking activation boundaries.
- Agents packaging skills with fixture-backed evidence.

## MVP

The V1 CLI provides `init`, `validate`, `render`, and `summarize`. It includes fixture-backed tests, smoke commands, release notes, and safety guidance.
