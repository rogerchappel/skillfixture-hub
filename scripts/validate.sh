#!/usr/bin/env bash
set -euo pipefail

npm run check
npm test
npm run smoke
node dist/src/cli.js init fixtures/example-skill --out tmp/generated-activation.json
node dist/src/cli.js validate tmp/generated-activation.json
