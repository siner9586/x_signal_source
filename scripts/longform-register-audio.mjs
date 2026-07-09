import fs from 'node:fs/promises';
import path from 'node:path';
import { LONGFORM, durationToSeconds, ensureLongformDirs, latestEpisodes, now, parseArgs, readJson, writeJson } from './longform-utils.mjs';

const args = parseArgs();
if (!args.episodeId || !args.audio) {
  console.error('Usage: node scripts/longform-register-audio.mjs --episode-id "episode-id" --audio "local_audio/file.mp3" [--subtitle "file.vtt"]');
  process.exit(1);
}
await ensureLongformDirs();
const episodes = await latestEpisodes();
const episode = episodes.find(e => e.id === args.episodeId) || { id: args.episodeId, duration: '' };
const audioPath = String(args.audio);
const stat = await fs.stat(audioPath).catch(() => null);
const manifestPath = path.join(LONGFORM, 'audio_manifest', 'audio_manifest.json');
const manifest = await readJson(manifestPath, []);
const next = Array.isArray(manifest) ? manifest.filter(x => x.episode_id !== args.episodeId) : [];
next.push({
  episode_id: args.episodeId,
  audio_path: audioPath,
  subtitle_path: args.subtitle || '',
  duration: episode.duration || '',
  duration_seconds: durationToSeconds(episode.duration),
  file_size: stat?.size || 0,
  format: path.extname(audioPath).replace('.', '') || 'unknown',
  downloaded_at: now(),
  tool: 'manual-register',
  status: 'ready'
});
await writeJson(manifestPath, next.sort((a, b) => a.episode_id.localeCompare(b.episode_id)));
console.log(`Registered audio for ${args.episodeId}: ${audioPath}`);
