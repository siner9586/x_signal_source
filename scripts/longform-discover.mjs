import path from 'node:path';
import { DATA, LONGFORM, clean, domain, ensureLongformDirs, hash, normalizeUrl, now, readAllSources, readYaml, today, writeJson } from './longform-utils.mjs';

const FETCH_TIMEOUT_MS = Number(process.env.LONGFORM_FETCH_TIMEOUT_MS || 7000);
const MAX_FETCH_SOURCES = Number(process.env.LONGFORM_MAX_FETCH_SOURCES || 36);

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? clean(m[1]) : '';
}
function attr(block, name) {
  return block.match(new RegExp(`${name}=["']([^"']+)["']`, 'i'))?.[1] || '';
}
function parseFeed(text, source) {
  const blocks = [...text.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(m => m[0]);
  const atom = blocks.length ? [] : [...text.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(m => m[0]);
  return [...blocks, ...atom].slice(0, 12).map((block) => {
    const atomLink = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || '';
    const rawLink = tag(block, 'link') || atomLink || tag(block, 'guid');
    const title = tag(block, 'title');
    const description = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content:encoded') || tag(block, 'content');
    const published = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date');
    const enclosure = block.match(/<enclosure[^>]+>/i)?.[0] || '';
    return episodeFromSource(source, {
      title,
      description,
      url: absolutize(rawLink, source.rss_url || source.youtube_feed_url || source.homepage_url),
      audio_url: attr(enclosure, 'url'),
      published_at: published,
      thumbnail_url: tag(block, 'media:thumbnail') || ''
    });
  }).filter(e => e.title && (e.episode_url || e.video_url || e.audio_url));
}
function absolutize(href = '', base = '') {
  try { return normalizeUrl(new URL(href, base).toString()); } catch { return normalizeUrl(href); }
}
function parseOg(text, source) {
  const meta = (prop) => text.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'))?.[1] || '';
  const title = clean(meta('og:title') || text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || source.name);
  const description = clean(meta('og:description') || meta('description') || source.notes || '');
  const url = normalizeUrl(meta('og:url') || source.homepage_url || source.youtube_url || source.podcast_url || source.rss_url || '');
  const image = meta('og:image') || '';
  return title ? [episodeFromSource(source, { title, description, url, thumbnail_url: image })] : [];
}
async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'x-signal-source-longform/0.1', 'accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9,*/*;q=0.8' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, text: (await res.text()).slice(0, 180000), content_type: res.headers.get('content-type') || '' };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  } finally { clearTimeout(timer); }
}
function asArray(value) { return Array.isArray(value) ? value : value ? [value] : []; }
function episodeFromSource(source, item) {
  const title = clean(item.title || source.name || 'Untitled longform episode');
  const episodeUrl = normalizeUrl(item.url || source.episode_url || source.video_url || source.youtube_url || source.podcast_url || source.homepage_url || '');
  const id = item.id || `${source.source_id || source.id || hash(source.name)}-${hash(title + episodeUrl)}`;
  const isVideo = (source.source_type === 'youtube') || domain(episodeUrl).includes('youtube') || domain(episodeUrl).includes('youtu.be');
  return {
    id,
    slug: source.slug || undefined,
    source_id: source.source_id || source.id || '',
    source_name: source.source_name || source.name || '',
    creator_name: source.creator_name || source.name || '',
    guest_names: asArray(source.guest_names),
    title,
    description: clean(item.description || source.notes || ''),
    summary: clean(item.description || source.notes || '').slice(0, 480),
    episode_url: episodeUrl,
    video_url: normalizeUrl(item.video_url || source.video_url || (isVideo ? episodeUrl : '')),
    audio_url: normalizeUrl(item.audio_url || source.audio_url || ''),
    canonical_url: episodeUrl,
    thumbnail_url: item.thumbnail_url || source.thumbnail_url || '',
    published_at: item.published_at || source.published_at || '',
    duration: source.duration || item.duration || '',
    language: source.language || 'unknown',
    tags: asArray(source.tags),
    topics: asArray(source.topics || source.tags).slice(0, 8),
    entities: [...asArray(source.guest_names), source.source_name || source.name].filter(Boolean),
    source_type: source.source_type || 'mixed',
    content_type: isVideo ? 'longform_video' : 'longform_audio',
    status: source.status || 'queued',
    audio_status: 'missing',
    transcript_status: 'missing',
    notes_status: 'missing',
    page_status: 'missing',
    dedupe_key: hash(`${episodeUrl}|${title}`),
    created_at: now(),
    updated_at: now()
  };
}
function manualEpisode(item) {
  return episodeFromSource({ ...item, source_id: item.source_id || item.id, name: item.source_name, source_type: item.source_type || 'manual' }, item);
}
function discoveryUrls(source) {
  const urls = [];
  const push = (u) => { if (u && !urls.includes(u)) urls.push(u); };
  push(source.rss_url);
  push(source.youtube_feed_url);
  if (source.youtube_channel_id) push(`https://www.youtube.com/feeds/videos.xml?channel_id=${source.youtube_channel_id}`);
  if (['webpage_metadata','sitemap'].includes(source.crawl_strategy)) push(source.homepage_url);
  return urls.filter(Boolean);
}

await ensureLongformDirs();
const d = today();
const sources = (await readAllSources()).filter(s => s.enabled !== false);
const manual = await readYaml(path.join(DATA, 'sources', 'manual_longform_links.yaml'), []);
const episodes = [];
const failures = [];
for (const item of manual) episodes.push(manualEpisode(item));
let fetched = 0;
for (const source of sources.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))) {
  const urls = discoveryUrls(source);
  if (!urls.length) {
    failures.push({ source_id: source.source_id || source.id, source_name: source.name, status: source.discovery_status || 'needs_manual_url', error: 'No rss_url, youtube_feed_url, youtube_channel_id or webpage metadata URL.' });
    continue;
  }
  for (const url of urls) {
    if (fetched >= MAX_FETCH_SOURCES) break;
    fetched++;
    const got = await fetchText(url);
    if (!got.ok) { failures.push({ source_id: source.source_id || source.id, source_name: source.name, url, error: got.error }); continue; }
    const parsed = /<(rss|feed|rdf)\b/i.test(got.text) ? parseFeed(got.text, source) : parseOg(got.text, source);
    episodes.push(...parsed);
  }
}
const unique = [];
const seen = new Set();
for (const e of episodes) {
  if (seen.has(e.dedupe_key)) continue;
  seen.add(e.dedupe_key);
  unique.push(e);
}
await writeJson(path.join(LONGFORM, 'episodes', `${d}.json`), { issue_date: d, generated_at: now(), episodes: unique });
await writeJson(path.join(LONGFORM, 'runs', `${d}-discover.json`), { issue_date: d, generated_at: now(), source_count: sources.length, manual_count: manual.length, fetched_sources: fetched, episode_count: unique.length, failures });
await writeJson(path.join(LONGFORM, 'source_index.json'), sources.map(s => ({ source_id: s.source_id || s.id, name: s.name, category: s.category, source_type: s.source_type, language: s.language, priority: s.priority, enabled: s.enabled, crawl_strategy: s.crawl_strategy, discovery_status: s.discovery_status, tags: s.tags || [], homepage_url: s.homepage_url || '', youtube_url: s.youtube_url || '', rss_url: s.rss_url || '' })));
console.log(`Longform discover: ${unique.length} episodes, ${failures.length} source notes.`);
