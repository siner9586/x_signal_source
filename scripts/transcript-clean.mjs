import path from 'node:path';
import { LONGFORM, TRANSCRIPTS, clean, ensureLongformDirs, listJsonFiles, now, readJson, today, writeJson } from './longform-utils.mjs';

function wordCount(text, lang = '') {
  const t = String(text || '').trim();
  if (!t) return 0;
  if (lang.startsWith('zh')) return t.replace(/\s+/g, '').length;
  return t.split(/\s+/).filter(Boolean).length;
}
function qualityFlags(text, prev) {
  const flags = [];
  if (!text || text.length < 3) flags.push('too_short');
  if (text.length > 1200) flags.push('too_long');
  if (prev && text === prev) flags.push('repeated');
  if (/^(music|applause|laughter|\[music\]|\(music\))$/i.test(text.trim())) flags.push('unclear');
  if (/(.)\1{10,}/.test(text)) flags.push('possible_hallucination');
  return flags;
}
await ensureLongformDirs();
const files = await listJsonFiles(path.join(TRANSCRIPTS, 'raw'));
const report = { generated_at: now(), files: [], cleaned_count: 0, skipped_count: 0 };
for (const file of files) {
  const raw = await readJson(file, null);
  if (!raw?.segments?.length) { report.skipped_count++; continue; }
  const segments = [];
  let previous = '';
  for (const segment of raw.segments) {
    const text = clean(segment.text || '');
    if (!text) continue;
    const flags = qualityFlags(text, previous);
    if (flags.includes('repeated') && text.length < 80) continue;
    segments.push({
      index: segments.length,
      start: Number(segment.start || 0),
      end: Number(segment.end || segment.start || 0),
      start_hhmmss: segment.start_hhmmss || '00:00:00',
      end_hhmmss: segment.end_hhmmss || '00:00:00',
      speaker: segment.speaker || '',
      text,
      confidence: segment.confidence ?? null,
      quality_flags: flags
    });
    previous = text;
  }
  const fullText = segments.map(s => s.text).join('\n');
  const lang = raw.language || 'unknown';
  const stats = {
    segment_count: segments.length,
    word_count: wordCount(fullText, lang),
    char_count: fullText.length,
    duration_seconds: raw.duration_seconds || segments.at(-1)?.end || 0,
    estimated_reading_minutes: Math.max(1, Math.round(wordCount(fullText, lang) / (lang.startsWith('zh') ? 450 : 220)))
  };
  const cleaned = { ...raw, segments, full_text: fullText, stats, cleaned_at: now(), status: 'cleaned' };
  await writeJson(path.join(TRANSCRIPTS, 'cleaned', `${raw.episode_id}.json`), cleaned);
  report.files.push({ episode_id: raw.episode_id, segment_count: segments.length, word_count: stats.word_count, char_count: stats.char_count });
  report.cleaned_count++;
}
await writeJson(path.join(LONGFORM, 'runs', `${today()}-clean-report.json`), report);
console.log(`Transcript clean: ${report.cleaned_count} cleaned, ${report.skipped_count} skipped.`);
