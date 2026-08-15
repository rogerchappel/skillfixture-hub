import process from 'node:process';
import { readFileSync } from 'node:fs';

const tag = process.argv[2];
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expectedTag = `v${version}`;

if (tag !== expectedTag) {
  console.error(`Release tag ${JSON.stringify(tag)} does not match package version ${JSON.stringify(expectedTag)}.`);
  process.exit(1);
}

console.log(`Release tag ${tag} matches package version ${version}.`);
