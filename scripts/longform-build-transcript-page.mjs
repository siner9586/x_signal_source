import path from 'node:path';
import { CONTENT, TRANSCRIPTS, clean, ensureLongformDirs, episodeSlug, latestEpisodes, listJsonFiles, now, readJson, timestampUrl, writeText } from './longform-utils.mjs';

function y(value) { return JSON.stringify(value ?? ''); }
await ensureLongformDirs();
const episodes = await latestEpisodes();
let count = 0;
for (const file of await listJsonFiles(path.join(TRANSCRIPTS, 'cleaned'))) {
  const data = await readJson(file, null);
  if (!data?.segments?.length) continue;
  const episode = episodes.find(e => e.id === data.episode_id) || data;
  const slug = episodeSlug(episode);
  const original = data.video_url || data.episode_url || data.audio_url || episode.video_url || episode.episode_url || '';
  const stats = data.stats || {};
  const chapters = data.chapters || [];
  const transcript = data.segments.map(s => `\n<a id="seg-${s.index}"></a>\n\n### [${s.start_hhmmss}](${timestampUrl(original, s.start)})\n\n${clean(s.text)}\n`).join('\n');
  const md = `---\ntitle: ${y(data.title || episode.title)}\nslug: ${slug}\nepisode_id: ${y(data.episode_id)}\nsource_name: ${y(data.source_name || episode.source_name)}\ncreator_name: ${y(data.creator_name || episode.creator_name)}\nguest_names: ${JSON.stringify(data.guest_names || episode.guest_names || [])}\nepisode_url: ${y(data.episode_url || episode.episode_url)}\nvideo_url: ${y(data.video_url || episode.video_url)}\naudio_url: ${y(data.audio_url || episode.audio_url)}\nthumbnail_url: ${y(data.thumbnail_url || episode.thumbnail_url)}\npublished_at: ${y(data.published_at || episode.published_at)}\ntranscribed_at: ${y(data.created_at || now())}\nduration_seconds: ${Number(stats.duration_seconds || data.duration_seconds || 0)}\nduration: ${y(data.duration || episode.duration || '')}\nlanguage: ${y(data.language || episode.language || '')}\nmodel: ${y(data.model || '')}\nword_count: ${Number(stats.word_count || 0)}\nchar_count: ${Number(stats.char_count || 0)}\nsegment_count: ${Number(stats.segment_count || data.segments.length)}\nchapter_count: ${Number(chapters.length)}\ntags: ${JSON.stringify(episode.tags || [])}\ntopics: ${JSON.stringify(episode.topics || episode.tags || [])}\nstatus: published\n---\n\n# ${data.title || episode.title}\n\n来源：${data.source_name || episode.source_name || ''}  \n嘉宾：${(data.guest_names || episode.guest_names || []).join(', ') || '未标注'}  \n时长：${data.duration || episode.duration || ''}  \n转录模型：${data.model || ''}  \n转录时间：${data.created_at || now()}\n\n[Watch original / 打开原视频](${original})\n\n## 章节目录\n\n${chapters.map(ch => `- [${ch.start_hhmmss} ${ch.title}](${timestampUrl(original, ch.start)})`).join('\n') || '- 暂无自动章节'}\n\n## 完整逐字稿\n${transcript}\n\n## 原始来源\n\n- 原视频：${data.video_url || episode.video_url || ''}\n- 原播客：${data.audio_url || episode.audio_url || ''}\n- 来源主页：${episode.homepage_url || ''}\n- 嘉宾：${(data.guest_names || episode.guest_names || []).join(', ')}\n- 发布时间：${data.published_at || episode.published_at || ''}\n- 本站转录时间：${data.created_at || now()}\n- 转录模型：${data.model || ''}\n- 说明：本稿为个人学习复盘用途生成，建议结合原视频/原音频阅读。\n`;
  await writeText(path.join(CONTENT, 'transcripts', `${slug}.md`), md);
  count++;
}
console.log(`Longform transcript pages: ${count} pages generated.`);
