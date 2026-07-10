import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'js-yaml';

const ROOT = process.cwd();
const SOURCES_DIR = path.join(ROOT, 'data', 'sources');
const OUTPUT = path.join(ROOT, 'public', 'index-data', 'sources.json');
const EXCLUDED_FILES = new Set(['query_templates.yaml', 'blocklist.yaml']);
const LONGFORM_FILES = new Set(['podcasts.yaml', 'video_creators.yaml']);

async function readSourceFile(file) {
  const fullPath = path.join(SOURCES_DIR, file);
  const body = load(await fs.readFile(fullPath, 'utf8'));
  if (body == null) return [];
  if (!Array.isArray(body)) {
    throw new Error(`${path.relative(ROOT, fullPath)} must contain a top-level YAML array.`);
  }
  return body.filter((item) => item && typeof item === 'object');
}

async function main() {
  const files = (await fs.readdir(SOURCES_DIR))
    .filter((file) => /\.ya?ml$/i.test(file) && !EXCLUDED_FILES.has(file))
    .sort();
  const allSources = [];

  for (const file of files) {
    const entries = await readSourceFile(file);
    allSources.push(...entries.map((entry) => ({ ...entry, source_file: file })));
  }

  const sources = allSources.filter((entry) => (
    entry.homepage_url || entry.x_url || entry.blog_url || entry.github_url || entry.url
  ));
  const longformSources = allSources
    .filter((entry) => LONGFORM_FILES.has(entry.source_file))
    .map((entry) => ({ ...entry, source_id: entry.source_id || entry.id }));
  const output = {
    generated_at: new Date().toISOString(),
    source_files: files,
    sources,
    longform_sources: longformSources
  };

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Generated ${path.relative(ROOT, OUTPUT)} (${sources.length} source links, ${longformSources.length} longform sources).`);
}

await main();
