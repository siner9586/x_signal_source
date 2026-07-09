import path from 'node:path';
import { CONTENT, episodeSlug, ensureLongformDirs, loadQueue, readAllSources, writeText } from './longform-utils.mjs';

function front(value) { return JSON.stringify(value ?? ''); }
await ensureLongformDirs();
const sources = await readAllSources();
const queue = await loadQueue();
const counts = new Map();
for (const episode of queue.episodes || []) {
  const key = episode.source_id || episode.source_name;
  counts.set(key, (counts.get(key) || 0) + 1);
}
let count = 0;
for (const source of sources) {
  const slug = episodeSlug({ source_name: source.name, title: source.source_id || source.id });
  const md = `---\ntitle: ${front(source.name)}\nslug: ${slug}\nsource_id: ${front(source.source_id || source.id)}\nsource_type: ${front(source.source_type)}\nlanguage: ${front(source.language)}\ncategory: ${front(source.category)}\npriority: ${Number(source.priority || 0)}\ntags: ${JSON.stringify(source.tags || [])}\nstatus: ${front(source.discovery_status || 'tracked')}\n---\n\n# ${source.name}\n\n${source.notes || 'Longform source tracked by Podcast Signals.'}\n\n- 类型：${source.source_type}\n- 语言：${source.language}\n- 优先级：${source.priority}\n- 抓取策略：${source.crawl_strategy}\n- 发现状态：${source.discovery_status || ''}\n- 已收录 episode：${counts.get(source.source_id || source.id) || 0}\n\n## Links\n\n- Homepage: ${source.homepage_url || ''}\n- YouTube: ${source.youtube_url || ''}\n- RSS: ${source.rss_url || ''}\n`;
  await writeText(path.join(CONTENT, 'creators', `${slug}.md`), md);
  count++;
}
console.log(`Longform creators: ${count} pages generated.`);
