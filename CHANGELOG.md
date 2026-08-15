# Changelog

## Unreleased

- Add a tag/version-gated npm trusted-publishing workflow with provenance.
- Retain the smoke-tested package tarball in CI for non-publishing review and document current package availability.
- Discover compiled tests consistently across supported Node.js versions and verify release checks on Node.js 20 and 24.
- Publish explicit ESM and TypeScript declaration entrypoints for library consumers.
- Exclude compiled tests from the package and verify the installed tarball's root import and CLI.
- Add release-readiness checks for CI and package contents.
- Add fixture-backed validation tests plus security, contribution, and support policy docs to the packed release surface.
