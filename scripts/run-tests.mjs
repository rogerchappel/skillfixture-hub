import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const testRoot = "dist-test/test";

async function findTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const tests = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      tests.push(...await findTests(path));
    } else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      tests.push(path);
    }
  }

  return tests;
}

const tests = (await findTests(testRoot)).sort();
if (tests.length === 0) {
  console.error(`No compiled tests found under ${testRoot}`);
  process.exit(1);
}

console.log(`Discovered ${tests.length} compiled test file(s)`);
const result = spawnSync(process.execPath, ["--test", ...tests], { stdio: "inherit" });

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
