import path from 'node:path';
import { CONTENT, TRANSCRIPTS, clean, ensureLongformDirs, episodeSlug, latestEpisodes, listJsonFiles, now, readJson, timestampUrl, writeText } from './longform-utils.mjs';

function yamlString(value) { return JSON.stringify(String(value || '').replace(/"/g, '\\"')); }
function topKeywords(text, tags = []) {
  const words = String(text || '').toLowerCase().match(/[a-z][a-z0-9+-]{2,}|[\u4e00-\u9fa5]{2,}/g) || [];
  const stop = new Set(['the','and','you','that','for','this','with','are','from','about','have','what','when','where','how','into','there','they','your','我们','他们','这个','一个','就是','因为','所以']);
  const map = new Map();
  for (const w of words) if (!stop.has(w)) map.set(w, (map.get(w) || 0) + 1);
  return [...new Set([...tags, ...[...map.entries()].sort((a,b)=>b[1]-a[1]).map(([w])=>w)])].slice(0, 16);
}
function bullets(data) {
  const segs = data.segments || [];
  const step = Math.max(1, Math.floor(segs.length / 10));
  return segs.filter((_, i) => i % step === 0).slice(0, 10).map(s => `${s.start_hhmmss} ${clean(s.text).slice(0, 160)}`);
}
await ensureLongformDirs();
const episodes = await latestEpisodes();
let count = 0;
for (const file of await listJsonFiles(path.join(TRANSCRIPTS, 'cleaned'))) {
  const data = await readJson(file, null);
  if (!data?.segments?.length) continue;
  const episode = episodes.find(e => e.id === data.episode_id) || data;
  const slug = episodeSlug(episode);
  const keywords = topKeywords(data.full_text, episode.tags || data.tags || []);
  const points = bullets(data);
  const original = data.video_url || data.episode_url || data.audio_url || episode.video_url || episode.episode_url || '';
  const chapters = data.chapters || [];
  const md = `---\ntitle: ${yamlString(data.title || episode.title)}\nslug: ${slug}\nsource_name: ${yamlString(data.source_name || episode.source_name)}\ncreator_name: ${yamlString(data.creator_name || episode.creator_name)}\nguest_names: ${JSON.stringify(data.guest_names || episode.guest_names || [])}\nepisode_url: ${yamlString(data.episode_url || episode.episode_url)}\nvideo_url: ${yamlString(data.video_url || episode.video_url)}\naudio_url: ${yamlString(data.audio_url || episode.audio_url)}\ntranscript_url: /transcripts/${slug}/\ntranscribed_at: ${yamlString(data.created_at || now())}\nmodel: ${yamlString(data.model || '')}\ntags: ${JSON.stringify(episode.tags || [])}\nstatus: published\n---\n\n# ${data.title || episode.title}\n\n## 来源卡片\n\n- 来源：${data.source_name || episode.source_name || ''}\n- 嘉宾：${(data.guest_names || episode.guest_names || []).join(', ') || '未标注'}\n- 时长：${episode.duration || ''}\n- 原视频/原音频：${original}\n\n[Watch original / 打开原视频](${original})\n\n## 本期为什么值得看\n\n这是一条由 Podcast Signals 本地转录流水线生成的长访谈学习笔记。规则引擎从完整逐字稿中提取时间轴、关键词、观点线索和复盘入口，便于边读边看。\n\n## 完整时间轴\n\n${chapters.map(ch => `- [${ch.start_hhmmss}](${timestampUrl(original, ch.start)}) ${ch.title}`).join('\n') || '- 暂无章节，请先运行 npm run longform:chapters'}\n\n## 10 条核心观点\n\n${points.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n## 高频关键词\n\n${keywords.map(k => `\`${k}\``).join(' ')}\n\n## 人名 / 公司 / 产品实体\n\n${[...(data.guest_names || []), data.source_name, ...keywords.filter(k => /openai|codex|chatgpt|github|google|anthropic/i.test(k))].filter(Boolean).map(e => `- ${e}`).join('\n')}\n\n## 对我的启发\n\n- 把长访谈当作一手语境材料，而不是只看二手摘要。\n- 结合时间戳回到原视频核对语气、上下文和细节。\n- 将关键片段沉淀为后续写作、产品判断和项目复盘素材。\n\n## 可行动事项\n\n- 二刷章节目录中与 AI Agent、产品工作流、知识工作相关的片段。\n- 复制关键段落引用，加入个人知识库。\n- 根据原视频链接补充手动章节或纠正 ASR 误差。\n\n## 值得二刷的时间点\n\n${(chapters.length ? chapters : data.segments.slice(0, 8)).slice(0, 8).map(ch => `- [${ch.start_hhmmss || '00:00:00'}](${timestampUrl(original, ch.start || 0)}) ${ch.title || clean(ch.text).slice(0, 60)}`).join('\n')}\n\n## 相关主题\n\n${(episode.topics || episode.tags || []).map(t => `- ${t}`).join('\n')}\n\n## 完整逐字稿\n\n[Read full transcript / 阅读完整逐字稿](/transcripts/${slug}/)\n\n## 原始来源\n\n- 原视频：${data.video_url || episode.video_url || ''}\n- 原播客：${data.audio_url || episode.audio_url || ''}\n- 来源主页：${episode.homepage_url || ''}\n- 本站转录模型：${data.model || ''}\n- 转录时间：${data.created_at || now()}\n`;
  await writeText(path.join(CONTENT, 'podcasts', `${slug}.md`), md);
  count++;
}
console.log(`Longform notes: ${count} note pages generated.`);
