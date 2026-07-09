import path from 'node:path';
import { LONGFORM, TRANSCRIPTS, durationToSeconds, ensureLongformDirs, episodeSlug, latestEpisodes, now, readJson, secondsToHhmmss, writeJson } from './longform-utils.mjs';

await ensureLongformDirs();
const episodes = await latestEpisodes();
const audioManifest = await readJson(path.join(LONGFORM, 'audio_manifest', 'audio_manifest.json'), []);
const audioByEpisode = new Map((Array.isArray(audioManifest) ? audioManifest : []).map(x => [x.episode_id, x]));
const queued = [];
for (const episode of episodes) {
  const cleaned = await readJson(path.join(TRANSCRIPTS, 'cleaned', `${episode.id}.json`), null);
  const audio = audioByEpisode.get(episode.id);
  const hasAudio = audio?.status === 'ready';
  const hasTranscript = !!cleaned?.segments?.length;
  const hasNotes = hasTranscript;
  const status = hasTranscript ? 'transcript_published' : hasAudio ? 'audio_ready' : episode.status || 'queued';
  queued.push({
    ...episode,
    slug: episodeSlug(episode),
    status,
    audio_status: hasAudio ? 'ready' : episode.audio_status || 'missing',
    transcript_status: hasTranscript ? 'ready' : episode.transcript_status || 'missing',
    notes_status: hasNotes ? 'ready' : episode.notes_status || 'missing',
    page_status: hasTranscript ? 'published' : 'pending',
    audio_path: audio?.audio_path || '',
    subtitle_path: audio?.subtitle_path || '',
    duration_seconds: cleaned?.duration_seconds || durationToSeconds(episode.duration),
    duration: episode.duration || secondsToHhmmss(cleaned?.duration_seconds || 0),
    word_count: cleaned?.stats?.word_count || 0,
    char_count: cleaned?.stats?.char_count || 0,
    segment_count: cleaned?.segments?.length || 0,
    chapter_count: cleaned?.chapters?.length || 0,
    transcript_url: hasTranscript ? `/transcripts/${episodeSlug(episode)}/` : `/transcripts/${episodeSlug(episode)}/`,
    notes_url: hasTranscript ? `/podcasts/${episodeSlug(episode)}/` : `/podcasts/${episodeSlug(episode)}/`,
    download_command: `node scripts/longform-download-local.mjs --episode-id "${episode.id}" --audio-only --write-subs --write-auto-subs`,
    register_audio_command: `node scripts/longform-register-audio.mjs --episode-id "${episode.id}" --audio "local_audio/${episode.id}.mp3"`,
    transcribe_command: `python scripts/transcribe.py --episode-id "${episode.id}" --audio "local_audio/${episode.id}.mp3" --model "medium" --language "${episode.language || 'auto'}" --output-dir "data/transcripts/raw" --formats "json,txt,srt,vtt,md"`
  });
}
const counts = queued.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
const payload = { generated_at: now(), total: queued.length, counts, episodes: queued };
await writeJson(path.join(LONGFORM, 'queues', 'current.json'), payload);
console.log(`Longform queue: ${queued.length} episodes.`);
