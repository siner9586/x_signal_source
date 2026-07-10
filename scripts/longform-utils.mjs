import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as yaml from 'js-yaml';

export const ROOT = process.cwd();
export const DATA = path.join(ROOT, 'data');
export const LONGFORM = path.join(DATA, 'longform');
export const TRANSCRIPTS = path.join(DATA, 'transcripts');
export const CONTENT = path.join(ROOT, 'content');

export const now = () => new Date().toISOString();
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const ensure = (p) => fs.mkdir(p, { recursive: true });
export const exists = async (p) => !!(await fs.access(p).then(() => true).catch(() => false));
export const readText = async (p, fallback = '') => (await exists(p)) ? fs.readFile(p, 'utf8') : fallback;
export const writeText = async (p, text) => { await ensure(path.dirname(p)); await fs.writeFile(p, text); };
export const readJson = async (p, fallback = null) => {
  if (!(await exists(p))) return fallback;
  return JSON.parse(await fs.readFile(p, 'utf8'));
};
export const writeJson = async (p, data) => { await writeText(p, JSON.stringify(data, null, 2) + '\n'); };
export const readYaml = async (p, fallback = []) => {
  if (!(await exists(p))) return fallback;
  const data = yaml.load(await fs.readFile(p, 'utf8'));
  return data || fallback;
};
export const writeYaml = async (p, data) => { await writeText(p, yaml.dump(data, { lineWidth: 120, noRefs: true })); };
export const hash = (s) => crypto.createHash('sha256').update(String(s || '').trim().toLowerCase()).digest('hex').slice(0, 16);
export const slugify = (s) => String(s || 'untitled').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96) || `episode-${hash(s)}`;
export const clean = (s = '') => String(s).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
export const normalizeUrl = (u = '') => {
  try {
    const x = new URL(u);
    x.hash = '';
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref','si'].forEach(k => x.searchParams.delete(k));
    return x.toString().replace(/\/$/, '');
  } catch { return u || ''; }
};
export const domain = (u = '') => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const parseArgs = (argv = process.argv.slice(2)) => {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    const arg = raw.replace(/^–/, '--');
    if (!arg.startsWith('--')) { out._.push(raw); continue; }
    const key = arg.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith('--') || next.startsWith('–')) out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
};
export const secondsToHhmmss = (value = 0) => {
  const s = Math.max(0, Math.floor(Number(value) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(x => String(x).padStart(2, '0')).join(':');
};
export const durationToSeconds = (duration = '') => {
  if (typeof duration === 'number') return duration;
  const parts = String(duration || '').split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(duration) || 0;
};
export function youtubeVideoId(url = '') {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.replace(/^\//, '').split('/')[0];
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop() || '';
  } catch {}
  return '';
}
export function timestampUrl(url = '', seconds = 0) {
  const id = youtubeVideoId(url);
  if (id) return `https://www.youtube.com/watch?v=${id}&t=${Math.max(0, Math.floor(seconds))}s`;
  try { const u = new URL(url); u.hash = `t=${Math.max(0, Math.floor(seconds))}`; return u.toString(); } catch { return url; }
}
export function episodeSlug(episode = {}) {
  return episode.slug || slugify(`${episode.source_name || episode.sourceName || 'source'}-${episode.title || episode.id || ''}`);
}
export async function listJsonFiles(dir) {
  if (!(await exists(dir))) return [];
  return (await fs.readdir(dir)).filter(f => f.endsWith('.json')).map(f => path.join(dir, f));
}
export async function latestJsonFile(dir) {
  const files = await listJsonFiles(dir);
  return files.sort().at(-1) || '';
}
export async function readAllSources() {
  const dir = path.join(DATA, 'sources');
  const files = ['podcasts.yaml', 'video_creators.yaml'];
  const out = [];
  for (const file of files) {
    const entries = await readYaml(path.join(dir, file), []);
    if (Array.isArray(entries)) entries.forEach(e => out.push({ ...e, source_file: file, source_id: e.source_id || e.id }));
  }
  return out;
}
export async function latestEpisodes() {
  const latest = await latestJsonFile(path.join(LONGFORM, 'episodes'));
  if (!latest) return [];
  const body = await readJson(latest, []);
  return Array.isArray(body) ? body : body.episodes || [];
}
export async function loadQueue() {
  return await readJson(path.join(LONGFORM, 'queues', 'current.json'), { generated_at: now(), episodes: [], counts: {} });
}
export async function ensureLongformDirs() {
  const dirs = [
    'data/longform/episodes','data/longform/queues','data/longform/runs','data/longform/audio_manifest','data/longform/transcript_manifest',
    'data/transcripts/raw','data/transcripts/cleaned','data/transcripts/published','data/transcripts/srt','data/transcripts/vtt','data/transcripts/txt','data/transcripts/notes',
    'content/podcasts','content/transcripts','content/creators','content/longform','public'
  ];
  await Promise.all(dirs.map(d => ensure(path.join(ROOT, d))));
}
export function fileExistsSync(p) { return fss.existsSync(p); }
