import path from 'node:path';
import { TRANSCRIPTS, ensureLongformDirs, listJsonFiles, readJson, writeJson } from './longform-utils.mjs';

await ensureLongformDirs();
let count = 0;
for (const file of await listJsonFiles(path.join(TRANSCRIPTS, 'cleaned'))) {
  const data = await readJson(file, null);
  if (!data?.segments?.length) continue;
  await writeJson(path.join(TRANSCRIPTS, 'published', `${data.episode_id}-segments.json`), data.segments.map(s => ({ index: s.index, start: s.start, end: s.end, start_hhmmss: s.start_hhmmss, text: s.text })));
  count++;
}
console.log(`Transcript segment export: ${count} files.`);
