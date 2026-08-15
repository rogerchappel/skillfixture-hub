import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const requiredFiles = [
  'dist/cli.js',
  'dist/index.js',
  'dist/index.d.ts',
  'fixtures/activation.json',
  'docs/RELEASE_CANDIDATE.md',
  'SKILL.md',
  'CHANGELOG.md',
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'SUPPORT.md',
];

const result = spawnSync('npm', ['pack', '--json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const [pack] = JSON.parse(result.stdout);
const packedFiles = new Set(pack.files.map((file) => file.path));
const missingFiles = requiredFiles.filter((file) => !packedFiles.has(file));
const testArtifacts = [...packedFiles].filter((file) =>
  file.startsWith('dist/test/') || file.startsWith('dist-test/') || /(?:^|\/)test\.d\.ts$/.test(file)
);

if (missingFiles.length > 0 || testArtifacts.length > 0) {
  if (missingFiles.length > 0) {
    console.error(`Package smoke failed; missing files: ${missingFiles.join(', ')}`);
  }
  if (testArtifacts.length > 0) {
    console.error(`Package smoke failed; packed test artifacts: ${testArtifacts.join(', ')}`);
  }
  rmSync(pack.filename, { force: true });
  process.exit(1);
}

const consumer = mkdtempSync(join(tmpdir(), 'skillfixture-hub-consumer-'));
const tarball = resolve(pack.filename);
const outputDirectory = process.env.PACKAGE_SMOKE_OUTPUT_DIR
  ? resolve(process.env.PACKAGE_SMOKE_OUTPUT_DIR)
  : undefined;

try {
  const install = spawnSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
    cwd: consumer,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (install.status !== 0) {
    process.stderr.write(install.stderr);
    process.exit(install.status ?? 1);
  }

  const rootImport = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    "import { validateFixtureFile } from 'skillfixture-hub'; if (typeof validateFixtureFile !== 'function') process.exit(1);",
  ], { cwd: consumer, encoding: 'utf8' });
  if (rootImport.status !== 0) {
    process.stderr.write(rootImport.stderr);
    process.exit(rootImport.status ?? 1);
  }

  const cli = spawnSync(join(consumer, 'node_modules', '.bin', 'skillfixture-hub'), [
    'validate',
    join(consumer, 'node_modules', 'skillfixture-hub', 'fixtures', 'activation.json'),
  ], { cwd: consumer, encoding: 'utf8' });
  if (cli.status !== 0) {
    process.stderr.write(cli.stderr);
    process.exit(cli.status ?? 1);
  }

  console.log(`Package smoke passed for ${pack.filename} (${pack.files.length} files): root import and CLI verified.`);
  if (outputDirectory) {
    mkdirSync(outputDirectory, { recursive: true });
    const artifact = join(outputDirectory, pack.filename);
    renameSync(tarball, artifact);
    console.log(`Verified package artifact retained at ${artifact}.`);
  }
} finally {
  rmSync(consumer, { recursive: true, force: true });
  rmSync(tarball, { force: true });
}
