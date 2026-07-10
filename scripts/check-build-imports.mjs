import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src'];
const errors = [];

async function walk(dir) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.astro'].includes(entry.name)) await walk(full);
      continue;
    }
    if (!/\.(astro|mjs|js|ts)$/.test(entry.name)) continue;
    const text = await fs.readFile(full, 'utf8');
    if (/from\s+['"]js-yaml['"]/.test(text) || /import\(['"]js-yaml['"]\)/.test(text)) {
      errors.push(path.relative(ROOT, full));
    }
  }
}

for (const dir of SCAN_DIRS) await walk(path.join(ROOT, dir));

if (errors.length) {
  console.error('Astro build must not import js-yaml directly. Use src/lib/simpleYaml.mjs or pre-generated JSON instead.');
  for (const file of errors) console.error(`- ${file}`);
  process.exit(1);
}

console.log('Build import guard passed: no js-yaml imports in Astro source tree.');
