import path from 'node:path';
import { DATA, hash, readAllSources, readYaml, writeJson } from './longform-utils.mjs';

const sources = await readAllSources();
const manual = await readYaml(path.join(DATA, 'sources', 'manual_longform_links.yaml'), []);
const normalized = {
  generated_at: new Date().toISOString(),
  source_count: sources.length,
  manual_count: Array.isArray(manual) ? manual.length : 0,
  sources: sources.map(s => ({
    source_id: s.source_id || s.id || hash(s.name),
    name: s.name,
    source_type: s.source_type || 'mixed',
    category: s.category || 'uncategorized',
    priority: Number(s.priority || 3),
    language: s.language || 'unknown',
    enabled: s.enabled !== false,
    crawl_strategy: s.crawl_strategy || 'manual',
    discovery_status: s.discovery_status || 'needs_manual_url',
    tags: s.tags || [],
    homepage_url: s.homepage_url || '',
    youtube_url: s.youtube_url || '',
    rss_url: s.rss_url || ''
  }))
};
await writeJson(path.join(DATA, 'longform', 'source_index.json'), normalized.sources);
console.log(`Longform normalize: ${normalized.source_count} sources, ${normalized.manual_count} manual links.`);
