import path from 'node:path';
import { LONGFORM, ROOT, TRANSCRIPTS, ensureLongformDirs, episodeSlug, loadQueue, listJsonFiles, readJson, writeJson } from './longform-utils.mjs';

await ensureLongformDirs();
const queue = await loadQueue();
const byId = new Map((queue.episodes || []).map(e => [e.id, e]));
const index = [];
const seen = new Set();
for (const file of await listJsonFiles(path.join(TRANSCRIPTS, 'cleaned'))) {
  const data = await readJson(file, null);
  if (!data?.episode_id) continue;
  const episode = byId.get(data.episode_id) || data;
  const slug = episodeSlug(episode);
  index.push({
    episode_id: data.episode_id,
    title: data.title || episode.title,
    source_name: data.source_name || episode.source_name,
    creator_name: data.creator_name || episode.creator_name,
    guest_names: data.guest_names || episode.guest_names || [],
    tags: episode.tags || data.tags || [],
    topics: episode.topics || episode.tags || [],
    url: `/podcasts/${slug}/`,
    transcript_url: `/transcripts/${slug}/`,
    episode_url: data.episode_url || episode.episode_url,
    video_url: data.video_url || episode.video_url,
    published_at: data.published_at || episode.published_at,
    duration: data.duration || episode.duration,
    chapters: data.chapters || [],
    segments: (data.segments || []).map(s => ({ start: s.start_hhmmss, start_seconds: s.start, text: s.text, url: `/transcripts/${slug}/#seg-${s.index}` })),
    full_text: data.full_text || ''
  });
  seen.add(data.episode_id);
}
for (const episode of queue.episodes || []) {
  if (seen.has(episode.id)) continue;
  const slug = episodeSlug(episode);
  index.push({ episode_id: episode.id, title: episode.title, source_name: episode.source_name, creator_name: episode.creator_name, guest_names: episode.guest_names || [], tags: episode.tags || [], topics: episode.topics || episode.tags || [], url: `/podcasts/${slug}/`, transcript_url: `/transcripts/${slug}/`, episode_url: episode.episode_url, video_url: episode.video_url, published_at: episode.published_at, duration: episode.duration, chapters: [], segments: [], full_text: '' });
}
await writeJson(path.join(ROOT, 'public', 'longform-search-index.json'), index);
await writeJson(path.join(LONGFORM, 'search_index.json'), index.map(({ full_text, segments, ...rest }) => ({ ...rest, segment_count: segments.length, has_full_text: Boolean(full_text) })));
console.log(`Longform search index: ${index.length} records.`);
