import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { LONGFORM, ensure, ensureLongformDirs, latestEpisodes, now, parseArgs, readJson, writeJson } from './longform-utils.mjs';

const args = parseArgs();
await ensureLongformDirs();
await ensure('local_audio');
const episodes = await latestEpisodes();
const selected = args.episodeId ? episodes.filter(e => e.id === args.episodeId) : episodes.filter(e => ['queued', 'audio_missing'].includes(e.status || 'queued'));
if (!selected.length) {
  console.error(args.episodeId ? `Episode not found: ${args.episodeId}` : 'No queued episodes found. Run npm run longform:discover first.');
  process.exit(args.episodeId ? 1 : 0);
}
const ytdlp = spawnSync('yt-dlp', ['--version'], { encoding: 'utf8' });
if (ytdlp.error || ytdlp.status !== 0) {
  console.error('yt-dlp is not available. Install it locally, then rerun this command.');
  console.error('macOS: brew install yt-dlp ffmpeg');
  process.exit(1);
}
const manifestPath = path.join(LONGFORM, 'audio_manifest', 'audio_manifest.json');
const oldManifest = await readJson(manifestPath, []);
const manifest = Array.isArray(oldManifest) ? oldManifest.filter(x => !selected.some(e => e.id === x.episode_id)) : [];
for (const episode of selected) {
  const url = episode.video_url || episode.episode_url || episode.audio_url;
  if (!url) continue;
  const output = path.join('local_audio', `${episode.id}.%(ext)s`);
  const cmd = ['--ignore-errors', '--continue', '--no-playlist', '--restrict-filenames', '-o', output];
  if (args.audioOnly !== false) cmd.push('-x', '--audio-format', 'mp3');
  if (args.writeSubs) cmd.push('--write-subs');
  if (args.writeAutoSubs) cmd.push('--write-auto-subs');
  cmd.push(url);
  console.log(`yt-dlp ${cmd.map(x => JSON.stringify(x)).join(' ')}`);
  const run = spawnSync('yt-dlp', cmd, { stdio: 'inherit' });
  if (run.status !== 0) {
    console.error(`yt-dlp failed for ${episode.id}`);
    continue;
  }
  const files = (await fs.readdir('local_audio').catch(() => [])).filter(f => f.startsWith(episode.id));
  const audio = files.find(f => /\.(mp3|m4a|wav|webm|opus|aac)$/i.test(f)) || '';
  const sub = files.find(f => /\.(srt|vtt)$/i.test(f)) || '';
  const audioPath = audio ? path.join('local_audio', audio) : '';
  const stat = audioPath ? await fs.stat(audioPath).catch(() => null) : null;
  manifest.push({
    episode_id: episode.id,
    audio_path: audioPath,
    subtitle_path: sub ? path.join('local_audio', sub) : '',
    duration: episode.duration || '',
    file_size: stat?.size || 0,
    format: audio ? path.extname(audio).replace('.', '') : 'unknown',
    downloaded_at: now(),
    tool: 'yt-dlp',
    status: audioPath ? 'ready' : 'missing'
  });
}
await writeJson(manifestPath, manifest.sort((a, b) => a.episode_id.localeCompare(b.episode_id)));
console.log('Audio manifest updated.');
