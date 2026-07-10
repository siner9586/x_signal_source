import fs from 'node:fs/promises';
import path from 'node:path';
import { assertNoBuildImports } from './check-build-imports.mjs';

const ROOT = process.cwd();
const DAILY_GUARANTEE = 'before_08_bjt';
const BACKFILL_GUARANTEE = 'daily_backfill_guard_0750_bjt';
const exists = async (p) => !!(await fs.access(p).then(() => true).catch(() => false));
const read = async (p) => fs.readFile(path.join(ROOT, p), 'utf8').catch(() => '');
const rjson = async (p, fallback = null) => {
  const full = path.join(ROOT, p);
  if (!(await exists(full))) return fallback;
  return JSON.parse(await fs.readFile(full, 'utf8'));
};

const errors = [];
try {
  await assertNoBuildImports(ROOT);
} catch (error) {
  errors.push(error.message);
}
const requiredFiles = [
  'package.json',
  'README.md',
  'astro.config.mjs',
  '.github/workflows/daily.yml',
  '.github/workflows/daily-backfill.yml',
  'data/sources/source_policy.md',
  'src/pages/index.astro',
  'src/pages/sources.astro',
  'src/pages/about.astro',
  'src/pages/issues/latest.astro',
  'src/pages/issues/[date].astro',
  'src/layouts/BaseLayout.astro',
  'src/components/ItemCard.astro'
];

for (const file of requiredFiles) {
  if (!(await exists(path.join(ROOT, file)))) errors.push(`missing ${file}`);
}

const wf = await read('.github/workflows/daily.yml');
const expectedCrons = [
  "2,7,12,17,22,27,32,37,42,47,52,57 21-23 * * *",
  "7,17,27,37,47,57 0-5 * * *",
  "7,17 6 * * *"
];
for (const cron of expectedCrons) {
  if (!wf.includes(cron)) errors.push(`missing redundant cron ${cron}`);
}
const backfill = await read('.github/workflows/daily-backfill.yml');
if (DAILY_GUARANTEE !== 'before_08_bjt') errors.push('daily guarantee marker corrupted');
if (BACKFILL_GUARANTEE !== 'daily_backfill_guard_0750_bjt') errors.push('backfill guarantee marker corrupted');
if (!wf.includes('push:')) errors.push('daily workflow must include push self-heal trigger');
if (!backfill.includes("50 23 * * *")) errors.push('daily backfill must run at 07:50 BJT/Taipei');
if (!backfill.includes('npm run daily')) errors.push('daily backfill must force generate missing issue');
if (!backfill.includes('group: daily-x-signal-source')) errors.push('daily and backfill workflows must share one concurrency group');
if (wf.includes('git pull --rebase || true') || backfill.includes('git pull --rebase || true')) errors.push('workflow must commit before rebasing and must not ignore a rebase failure');
if (!wf.includes('Hard requirement: Beijing/Taipei latest issue should be generated before 08:00')) errors.push('daily workflow must document before-08:00 update guarantee');
if (!wf.includes("node-version: '22.16.0'") && !wf.includes('node-version: "22.16.0"')) errors.push('workflow must use Node 22.16.0');
if (!wf.includes('Remote idempotency guard')) errors.push('missing remote idempotency guard');
if (!wf.includes('gh api "repos/${GITHUB_REPOSITORY}/contents/${ISSUE_FILE}?ref=${GITHUB_REF_NAME}"')) errors.push('missing remote issue existence check');
if (!wf.includes('steps.guard.outputs.exists != \'true\'')) errors.push('pipeline steps must be guarded by idempotency output');

const pkg = await rjson('package.json', {});
if (!pkg.scripts?.daily?.includes('build:issue')) errors.push('daily script must generate issue data');
if (pkg.scripts?.qa !== 'node scripts/qa.mjs') errors.push('qa script must point to scripts/qa.mjs');
if (!String(pkg.engines?.node || '').includes('22.16.0')) errors.push('package engines must require Node 22.16.0 or newer');

const sourceData = await rjson('public/index-data/sources.json', null);
if (!sourceData || !Array.isArray(sourceData.sources) || !Array.isArray(sourceData.longform_sources)) {
  errors.push('generated source JSON is missing or invalid; run npm run generate:source-data');
}

const latest = await rjson('public/index-data/latest.json', null);
if (latest) {
  const selected = [...(latest.must_read || []), ...(latest.worth_reading || []), ...(latest.signal_watch || [])];
  if ((latest.metadata?.selected_count || 0) !== selected.length) errors.push('selected_count mismatch');
  const urls = new Set();
  const keys = new Set();
  for (const item of selected) {
    for (const field of ['title', 'canonical_url', 'summary', 'total_score', 'dedupe_key', 'content_type']) {
      if (item[field] === undefined || item[field] === null || item[field] === '') errors.push(`item ${item.id || item.title} missing ${field}`);
    }
    if (urls.has(item.canonical_url)) errors.push(`duplicate url ${item.canonical_url}`);
    urls.add(item.canonical_url);
    if (keys.has(item.dedupe_key)) errors.push(`duplicate key ${item.dedupe_key}`);
    keys.add(item.dedupe_key);
    if (latest.metadata?.strict_new_only && (item.source_mode !== 'live_fetch' || item.captured_issue !== latest.metadata.issue_date)) {
      errors.push(`item ${item.id || item.title} is not current live_fetch`);
    }
  }
}

const readme = await read('README.md');
if (!readme.includes('不使用付费 API') || !readme.includes('合规边界')) errors.push('README compliance missing');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('QA passed');
