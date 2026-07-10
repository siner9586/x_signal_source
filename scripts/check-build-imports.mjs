import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SCAN_DIRS = ['src'];
const FORBIDDEN_IMPORTS = [
  /\bfrom\s*['"]js-yaml['"]/,
  /\bimport\s*['"]js-yaml['"]/,
  /\bimport\s*\(\s*['"]js-yaml['"]\s*\)/,
  /\brequire\s*\(\s*['"]js-yaml['"]\s*\)/
];

async function walk(dir, root, errors) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.astro'].includes(entry.name)) await walk(full, root, errors);
      continue;
    }
    if (!/\.(astro|mjs|js|ts)$/.test(entry.name)) continue;
    const text = await fs.readFile(full, 'utf8');
    if (FORBIDDEN_IMPORTS.some((pattern) => pattern.test(text))) errors.push(path.relative(root, full));
  }
}

export async function assertNoBuildImports(root = process.cwd()) {
  const errors = [];
  for (const dir of SCAN_DIRS) await walk(path.join(root, dir), root, errors);
  if (errors.length) {
    const detail = errors.map((file) => `- ${file}`).join('\n');
    throw new Error(`Astro build must not import js-yaml directly. Astro pages must read generated JSON, not YAML.\n${detail}`);
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await assertNoBuildImports();
    console.log('Build import guard passed: no js-yaml imports in Astro source tree.');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
