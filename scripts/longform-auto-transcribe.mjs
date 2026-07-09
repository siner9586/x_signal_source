import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const QUEUE_PATH = path.join(ROOT, 'data/longform/queues/current.json');
const RAW_DIR = path.join(ROOT, 'data/transcripts/raw');
const AUDIO_DIR = path.join(ROOT, 'local_audio');
const RUN_DIR = path.join(ROOT, 'data/longform/runs');

const MAX_ITEMS = Number(process.env.LONGFORM_AUTO_TRANSCRIBE_ITEMS || 1);
const SUBTITLE_LANGS = process.env.LONGFORM_SUBTITLE_LANGS || 'en.*,en,zh.*,zh-Hans,zh-Hant,zh';
const WHISPER_MODEL = process.env.LONGFORM_WHISPER_MODEL || 'base';
const WHISPER_LANGUAGE = process.env.LONGFORM_WHISPER_LANGUAGE || 'auto';
const DEVICE = process.env.LONGFORM_WHISPER_DEVICE || 'cpu';
const COMPUTE_TYPE = process.env.LONGFORM_WHISPER_COMPUTE_TYPE || 'int8';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());

const ensure = (p) => fs.mkdir(p, { recursive:true });
const exists = async (p) => !!(await fs.access(p).then(() => true).catch(() => false));
const readJson = async (p, d = null) => (await exists(p)) ? JSON.parse(await fs.readFile(p, 'utf8')) : d;
const writeJson = async (p, d) => { await ensure(path.dirname(p)); await fs.writeFile(p, JSON.stringify(d, null, 2) + '\n'); };
const stamp = () => new Date().toISOString();
const slug = (s='') => String(s).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96) || 'episode';

function run(cmd, args, options = {}) {
  console.log(`$ ${cmd} ${args.map(a => /\s/.test(String(a)) ? JSON.stringify(a) : a).join(' ')}`);
  const r = spawnSync(cmd, args, { cwd:ROOT, encoding:'utf8', stdio:['ignore', 'pipe', 'pipe'], ...options });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return { status:r.status ?? 1, stdout:r.stdout || '', stderr:r.stderr || '' };
}

async function listFiles(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes:true }).catch(() => [])) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(p));
    else out.push(p);
  }
  return out;
}

function timeToSeconds(t='') {
  const parts = String(t).replace(',', '.').split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(t) || 0;
}

function secondsToHhmmss(sec = 0) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return [h, m, ss].map(v => String(v).padStart(2, '0')).join(':');
}

function cleanSubtitleText(text='') {
  return String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\{\\an\d+\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseVtt(vtt='') {
  const lines = String(vtt).replace(/^\uFEFF/, '').split(/\r?\n/);
  const segments = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const m = line.match(/((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})/);
    if (!m) { i++; continue; }
    const start = timeToSeconds(m[1]);
    const end = timeToSeconds(m[2]);
    i++;
    const textLines = [];
    while (i < lines.length && lines[i].trim() !== '') {
      const t = lines[i].trim();
      if (!/^(NOTE\b|STYLE\b|REGION\b)/i.test(t)) textLines.push(t);
      i++;
    }
    const text = cleanSubtitleText(textLines.join(' '));
    if (text && text !== segments.at(-1)?.text) {
      segments.push({
        index:segments.length,
        start,
        end:Math.max(end, start + 0.25),
        start_hhmmss:secondsToHhmmss(start),
        end_hhmmss:secondsToHhmmss(Math.max(end, start + 0.25)),
        speaker:'',
        text,
        confidence:null
      });
    }
    i++;
  }
  return segments;
}

function episodeUrl(ep) {
  return ep.video_url || ep.episode_url || ep.url || ep.audio_url || '';
}

async function subtitleToRawTranscript(ep, subtitlePath) {
  const text = await fs.readFile(subtitlePath, 'utf8');
  const segments = parseVtt(text);
  if (!segments.length) throw new Error(`No subtitle segments parsed from ${subtitlePath}`);
  const raw = {
    episode_id: ep.id,
    slug: ep.slug || slug(ep.title || ep.id),
    title: ep.title || ep.id,
    source_name: ep.source_name || '',
    creator_name: ep.creator_name || ep.author || '',
    guest_names: ep.guest_names || [],
    episode_url: ep.episode_url || ep.url || '',
    video_url: ep.video_url || '',
    audio_url: ep.audio_url || '',
    thumbnail_url: ep.thumbnail_url || '',
    published_at: ep.published_at || '',
    duration: ep.duration || '',
    language: ep.language || 'auto',
    model: 'youtube-subtitle-or-auto-caption',
    engine: 'yt-dlp-subtitle-first',
    device: 'github-actions',
    compute_type: 'none',
    created_at: stamp(),
    duration_seconds: Math.ceil(segments.at(-1)?.end || ep.duration_seconds || 0),
    source_subtitle_file: path.relative(ROOT, subtitlePath),
    segments,
    full_text: segments.map(s => s.text).join('\n')
  };
  await writeJson(path.join(RAW_DIR, `${ep.id}.json`), raw);
  return { engine:'subtitle', segments:segments.length, raw_path:path.join(RAW_DIR, `${ep.id}.json`) };
}

async function findSubtitle(episodeId) {
  const files = await listFiles(AUDIO_DIR);
  return files
    .filter(f => path.basename(f).startsWith(episodeId) && /\.(vtt|srt)$/i.test(f))
    .sort((a,b) => {
      const score = (f) => /\.en[-.]|\.en\.|\.en-US\.|\.en-GB\./i.test(f) ? 0 : /zh|Hans|Hant/i.test(f) ? 1 : 2;
      return score(a) - score(b) || a.localeCompare(b);
    })[0] || '';
}

async function findAudio(episodeId) {
  const files = await listFiles(AUDIO_DIR);
  return files.find(f => path.basename(f).startsWith(episodeId) && /\.(mp3|m4a|webm|opus|wav|aac|flac)$/i.test(f)) || '';
}

async function downloadSubtitle(ep) {
  const url = episodeUrl(ep);
  if (!url) return { ok:false, error:'missing episode url' };
  const out = path.join(AUDIO_DIR, `${ep.id}.%(ext)s`);
  const args = [
    '--skip-download',
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs', SUBTITLE_LANGS,
    '--sub-format', 'vtt/best',
    '--no-playlist',
    '--output', out,
    url
  ];
  const r = run('yt-dlp', args);
  const subtitle = await findSubtitle(ep.id);
  return { ok:!!subtitle, subtitle, status:r.status, error:subtitle ? '' : (r.stderr || r.stdout || 'subtitle not found') };
}

async function downloadAudio(ep) {
  const url = episodeUrl(ep);
  if (!url) return { ok:false, error:'missing episode url' };
  const out = path.join(AUDIO_DIR, `${ep.id}.%(ext)s`);
  const args = [
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '5',
    '--no-playlist',
    '--output', out,
    url
  ];
  const r = run('yt-dlp', args);
  const audio = await findAudio(ep.id);
  return { ok:!!audio, audio, status:r.status, error:audio ? '' : (r.stderr || r.stdout || 'audio not found') };
}

async function whisper(ep, audio) {
  const args = [
    'scripts/transcribe.py',
    '--episode-id', ep.id,
    '--audio', path.relative(ROOT, audio),
    '--model', WHISPER_MODEL,
    '--language', WHISPER_LANGUAGE,
    '--device', DEVICE,
    '--compute-type', COMPUTE_TYPE,
    '--output-dir', 'data/transcripts/raw',
    '--formats', 'json,txt,srt,vtt,md'
  ];
  const r = run('python', args);
  if (r.status !== 0) throw new Error(`Whisper failed for ${ep.id}`);
  return { engine:'whisper', raw_path:path.join(RAW_DIR, `${ep.id}.json`) };
}

async function processEpisode(ep) {
  await ensure(RAW_DIR);
  await ensure(AUDIO_DIR);
  const rawPath = path.join(RAW_DIR, `${ep.id}.json`);
  if (await exists(rawPath)) return { episode_id:ep.id, status:'skipped', reason:'raw transcript exists' };

  let subtitleError = '';
  const sub = await downloadSubtitle(ep);
  if (sub.ok) {
    try {
      const converted = await subtitleToRawTranscript(ep, sub.subtitle);
      return { episode_id:ep.id, status:'transcribed', method:'subtitle', subtitle:path.relative(ROOT, sub.subtitle), ...converted };
    } catch (err) {
      subtitleError = String(err?.message || err);
      console.warn(`Subtitle parse failed for ${ep.id}; falling back to Whisper: ${subtitleError}`);
    }
  }

  const audio = await downloadAudio(ep);
  if (!audio.ok) return { episode_id:ep.id, status:'failed', method:'audio-download', subtitle_error:subtitleError, error:audio.error };

  const converted = await whisper(ep, audio.audio);
  return { episode_id:ep.id, status:'transcribed', method:'whisper', subtitle_error:subtitleError, audio:path.relative(ROOT, audio.audio), ...converted };
}

async function main() {
  await ensure(RUN_DIR);
  const queue = await readJson(QUEUE_PATH, { episodes:[] });
  const episodes = (queue.episodes || [])
    .filter(ep => ep?.id && (ep.transcript_status !== 'ready' || ep.status === 'queued'))
    .slice(0, MAX_ITEMS);

  const report = { generated_at:stamp(), max_items:MAX_ITEMS, subtitle_langs:SUBTITLE_LANGS, whisper_model:WHISPER_MODEL, items:[] };
  if (!episodes.length) {
    report.message = 'No queued episodes need transcription.';
    await writeJson(path.join(RUN_DIR, `${TODAY}-auto-transcribe.json`), report);
    console.log(report.message);
    return;
  }

  for (const ep of episodes) {
    try {
      report.items.push(await processEpisode(ep));
    } catch (err) {
      report.items.push({ episode_id:ep.id, status:'failed', error:String(err?.message || err) });
    }
  }

  await writeJson(path.join(RUN_DIR, `${TODAY}-auto-transcribe.json`), report);
  const failed = report.items.filter(i => i.status === 'failed');
  if (failed.length && failed.length === report.items.length) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(report, null, 2));
}

await main();
