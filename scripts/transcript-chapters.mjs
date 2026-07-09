import path from 'node:path';
import { LONGFORM, TRANSCRIPTS, clean, ensureLongformDirs, listJsonFiles, readJson, secondsToHhmmss, writeJson } from './longform-utils.mjs';

const EN_TITLES = ['Opening and Context', 'Product Work and AI', 'Codex Workflow', 'Agents and Knowledge Work', 'Teams, Trust and Adoption', 'Technical Details', 'Market and Strategy', 'Lessons and Takeaways'];
const ZH_TITLES = ['开场与背景', 'AI 对产品工作的改变', 'Codex 工作流', '智能体与知识工作', '团队、信任与采纳', '技术细节', '市场与战略', '复盘与启发'];
const KEYWORDS = ['OpenAI','Codex','ChatGPT','agent','agents','product','workflow','startup','model','LLM','developer','AI','创业','产品','模型','智能体','工作流'];
function titleFor(index, lang, text) {
  const lower = text.toLowerCase();
  if (lower.includes('codex')) return 'Codex Workflow';
  if (lower.includes('chatgpt')) return 'ChatGPT and Knowledge Work';
  if (lower.includes('agent')) return 'Agents and Workflow';
  const bank = String(lang || '').startsWith('zh') ? ZH_TITLES : EN_TITLES;
  return bank[index % bank.length];
}
function keywordsFor(text) {
  const lower = text.toLowerCase();
  return KEYWORDS.filter(k => lower.includes(k.toLowerCase())).slice(0, 8);
}
function makeChapters(data) {
  const segments = data.segments || [];
  if (!segments.length) return [];
  const duration = data.duration_seconds || segments.at(-1)?.end || 0;
  const target = duration > 3600 ? 420 : 300;
  const chapters = [];
  let startIndex = 0;
  while (startIndex < segments.length) {
    const start = segments[startIndex].start;
    let endIndex = startIndex;
    while (endIndex + 1 < segments.length && segments[endIndex + 1].start - start < target) endIndex++;
    const chunk = segments.slice(startIndex, endIndex + 1);
    const text = clean(chunk.map(s => s.text).join(' '));
    chapters.push({
      chapter_id: `ch-${String(chapters.length + 1).padStart(2, '0')}`,
      title: titleFor(chapters.length, data.language, text),
      start,
      end: chunk.at(-1)?.end || start,
      start_hhmmss: secondsToHhmmss(start),
      end_hhmmss: secondsToHhmmss(chunk.at(-1)?.end || start),
      summary: text.split(/[.!?。！？]/).filter(Boolean).slice(0, 2).join('。').slice(0, 180),
      keywords: keywordsFor(text)
    });
    startIndex = endIndex + 1;
  }
  return chapters;
}
await ensureLongformDirs();
let count = 0;
for (const file of await listJsonFiles(path.join(TRANSCRIPTS, 'cleaned'))) {
  const data = await readJson(file, null);
  if (!data?.segments?.length) continue;
  const chapters = Array.isArray(data.chapters) && data.chapters.length ? data.chapters : makeChapters(data);
  const next = { ...data, chapters, chapter_count: chapters.length };
  await writeJson(file, next);
  await writeJson(path.join(LONGFORM, 'transcript_manifest', `${data.episode_id}-chapters.json`), chapters);
  count++;
}
console.log(`Transcript chapters: ${count} files updated.`);
