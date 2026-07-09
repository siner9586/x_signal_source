import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, TRANSCRIPTS, fileExistsSync, listJsonFiles, loadQueue, readAllSources, readJson, readText, readYaml, timestampUrl } from './longform-utils.mjs';

const errors = [];
const requiredFiles = [
  'data/sources/podcasts.yaml',
  'data/sources/video_creators.yaml',
  'data/sources/manual_longform_links.yaml',
  'scripts/longform-discover.mjs',
  'scripts/longform-build-queue.mjs',
  'scripts/transcribe.py',
  'scripts/transcript-clean.mjs',
  'scripts/transcript-chapters.mjs',
  'scripts/longform-build-notes.mjs',
  'scripts/longform-build-transcript-page.mjs',
  'scripts/longform-build-search-index.mjs',
  'src/pages/podcasts/index.astro',
  'src/pages/transcripts/index.astro',
  'src/pages/transcripts/[slug].astro',
  'src/components/longform/TranscriptReader.astro',
  'src/styles/longform.css'
];
for (const file of requiredFiles) if (!fileExistsSync(path.join(ROOT, file))) errors.push(`missing ${file}`);
const sources = await readAllSources();
for (const s of sources) {
  for (const field of ['source_id', 'name', 'source_type', 'language', 'tags', 'enabled']) {
    if (s[field] === undefined || s[field] === null || s[field] === '') errors.push(`source ${s.name || s.id} missing ${field}`);
  }
  if (!Array.isArray(s.tags)) errors.push(`source ${s.name || s.id} tags must be an array`);
}
const manual = await readYaml(path.join(ROOT, 'data/sources/manual_longform_links.yaml'), []);
if (!Array.isArray(manual)) errors.push('manual_longform_links.yaml must be a YAML array');
for (const item of manual) {
  if (!item.id || !item.title || !(item.episode_url || item.video_url)) errors.push(`manual link missing required fields: ${item.id || item.title}`);
}
const queue = await loadQueue();
for (const e of queue.episodes || []) {
  if (!e.id || !e.title || !e.source_name || !(e.episode_url || e.video_url)) errors.push(`episode missing required fields: ${e.id || e.title}`);
}
const cleanedFiles = await listJsonFiles(path.join(TRANSCRIPTS, 'cleaned'));
for (const file of cleanedFiles) {
  const t = await readJson(file, null);
  if (!t?.title || !t?.source_name || !Array.isArray(t?.segments) || !t?.full_text) errors.push(`bad transcript ${file}`);
  for (const s of t?.segments || []) {
    const url = timestampUrl(t.video_url || t.episode_url || '', s.start || 0);
    if (!url) errors.push(`timestamp URL failed for ${t.episode_id}`);
  }
}
const gitignore = await readText(path.join(ROOT, '.gitignore'));
if (!gitignore.includes('local_audio/')) errors.push('local_audio/ must be in .gitignore');
const forbidden = [];
async function scan(dir) {
  if (!fileExistsSync(dir)) return;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules','.git','dist','local_audio'].includes(entry.name)) await scan(full);
    if (entry.isFile() && /\.(mp3|mp4|m4a|wav|webm|mov|mkv)$/i.test(entry.name)) forbidden.push(full);
  }
}
await scan(ROOT);
if (forbidden.length) errors.push(`large media files should not be committed: ${forbidden.slice(0, 5).join(', ')}`);
if (!fileExistsSync(path.join(ROOT, 'public/longform-search-index.json'))) errors.push('search index missing; run npm run longform:search');
const pages = ['src/pages/podcasts/index.astro','src/pages/transcripts/index.astro'];
for (const p of pages) {
  const text = await readText(path.join(ROOT, p));
  if (!text.includes('EmptyState')) errors.push(`${p} must render EmptyState when no transcript exists`);
}
if (cleanedFiles.length) {
  const transcriptPage = await readText(path.join(ROOT, 'src/components/longform/TranscriptReader.astro'));
  if (!transcriptPage.includes('segment.text') && !transcriptPage.includes('full_text')) errors.push('TranscriptReader must render full transcript, not summary only');
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Longform QA passed: ${sources.length} sources, ${manual.length} manual links, ${(queue.episodes || []).length} queued episodes, ${cleanedFiles.length} cleaned transcripts.`);
