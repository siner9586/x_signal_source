import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data');
const TZ = 'Asia/Shanghai';
const WEIGHTS = { source_score: .20, information_density_score: .20, originality_score: .15, trend_score: .15, evidence_score: .10, heat_score: .10, site_fit_score: .10 };
const TOPICS = ['AI Agent','AI Coding','Reasoning Models','Multimodal','AI Search','AI Browser','AI Infra','Open Source','Startups','Product','Investment','Research','Robotics','Safety','中文 AI 观点'];
const BLOCK_WORDS = ['giveaway','airdrop','meme','gm','follow me','retweet to win','crypto alpha','100x','抽奖','互关','空投','暴富','割韭菜','无脑转发','速成','玄学'];

const ensureDir = async p => fs.mkdir(p, { recursive: true });
const exists = async p => !!(await fs.access(p).then(()=>true).catch(()=>false));
const readJson = async (p, fallback) => exists(p).then(ok => ok ? fs.readFile(p,'utf8').then(JSON.parse) : fallback);
const writeJson = async (p, data) => { await ensureDir(path.dirname(p)); await fs.writeFile(p, JSON.stringify(data, null, 2) + '\n'); };
const hash = s => crypto.createHash('sha256').update(String(s || '').trim().toLowerCase()).digest('hex').slice(0,16);
const todayBJT = () => new Intl.DateTimeFormat('en-CA',{ timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
const nowIso = () => new Date().toISOString();
const normalizeUrl = u => { try { const x = new URL(u); x.hash=''; ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref'].forEach(k=>x.searchParams.delete(k)); return x.toString().replace(/\/$/,''); } catch { return u || ''; } };
const domainOf = u => { try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ''; } };
const loadYaml = async p => yaml.load(await fs.readFile(p, 'utf8')) || [];

function inferType(url, category='') {
  const d = domainOf(url);
  if (d.includes('x.com') || d.includes('twitter.com')) return 'x_article';
  if (d.includes('github.com')) return 'github_repo';
  if (d.includes('arxiv.org') || d.includes('openreview.net') || category.includes('research')) return 'paper';
  if (category.includes('podcast') || d.includes('youtube.com') || d.includes('spotify')) return 'podcast_episode';
  if (category.includes('media')) return 'media_report';
  if (category.includes('company') || category.includes('official')) return 'company_blog';
  return 'external_article';
}
function scoreSource(entry) { const p = Number(entry.priority || 3); return Math.min(100, 45 + p * 10 + (entry.category||'').includes('official') * 10); }
function keywordScore(text, words, base=40) { const t = text.toLowerCase(); const hits = words.filter(w => t.includes(String(w).toLowerCase())).length; return Math.min(100, base + hits * 12); }
function buildCandidate(entry, issueDate, sourceFile) {
  const url = normalizeUrl(entry.url || entry.homepage_url || entry.x_url || entry.blog_url || entry.rss_url || '');
  const title = entry.title || entry.display_name || entry.name || entry.organization || domainOf(url) || 'Untitled source';
  const text = `${title} ${entry.notes || ''} ${(entry.tags||[]).join(' ')}`;
  const content_type = inferType(url, entry.category || sourceFile);
  const evidence = [entry.homepage_url, entry.blog_url, entry.rss_url, entry.github_url, entry.youtube_url, entry.podcast_url, entry.x_url, entry.url].filter(Boolean).map(normalizeUrl);
  const c = {
    id: `cand_${hash(url + title)}`,
    canonical_url: url,
    source_url: url,
    source_platform: domainOf(url).includes('x.com') ? 'x' : 'web',
    source_domain: domainOf(url),
    content_type,
    title,
    subtitle: entry.notes || '',
    author: entry.author || entry.display_name || entry.name || '',
    author_handle: entry.handle || '',
    author_role: entry.role || '',
    organization: entry.organization || entry.name || '',
    language: entry.language || 'en',
    published_at: entry.published_at || issueDate,
    captured_at: nowIso(),
    summary: entry.summary || `${title} 是当前信息源库中的高信号公开入口，本期作为初始来源索引收录，用于后续从公开 RSS、博客、GitHub、播客和网页元数据持续发现新内容。`,
    excerpt: entry.notes || '仅索引公开链接，不保存受版权保护的完整正文。',
    raw_text_available: false,
    topics: entry.topics || TOPICS.filter(t => text.toLowerCase().includes(t.toLowerCase())).slice(0,3),
    tags: entry.tags || [entry.category || 'source'],
    entities: [entry.organization || entry.name || entry.display_name].filter(Boolean),
    mentioned_companies: entry.organization ? [entry.organization] : [],
    mentioned_people: entry.role ? [entry.display_name || entry.name].filter(Boolean) : [],
    mentioned_products: [], mentioned_papers: [], mentioned_repos: evidence.filter(u=>domainOf(u).includes('github.com')),
    evidence_links: [...new Set(evidence)],
    engagement: { likes:0,reposts:0,replies:0,bookmarks:0,views:0,comments:0,stars:0,score:0 },
    source_score: scoreSource(entry),
    information_density_score: keywordScore(text, ['research','blog','github','paper','benchmark','docs','deep dive','framework','复盘','方法论'], 42),
    originality_score: keywordScore(text, ['official','founder','researcher','maintainer','creator','原创','作者'], 38),
    trend_score: keywordScore(text, ['agent','coding','reasoning','multimodal','infra','startup','investment','AI Agent','AI 编程'], 45),
    evidence_score: Math.min(100, 45 + evidence.length * 9),
    heat_score: 40,
    site_fit_score: keywordScore(text, ['AI','agent','coding','startup','research','product','investment','infra','模型','智能体'], 50),
    total_score: 0, rank: 0,
    cluster_id: `${(entry.category || 'source').replace(/[^a-z0-9]+/gi,'_').toLowerCase()}_${hash(title).slice(0,8)}`,
    dedupe_key: hash(`${normalizeUrl(url)}|${title}|${entry.handle || ''}`),
    status: 'candidate',
    reason_selected: '', reason_rejected: '',
    fetch_status: 'source_index_only', fetch_error: '',
    first_seen_issue: issueDate, last_seen_issue: issueDate, used_in_issue: null
  };
  c.total_score = Math.round(Object.entries(WEIGHTS).reduce((sum,[k,w]) => sum + c[k] * w, 0));
  if (!c.topics.length) c.topics = ['AI Signal'];
  return c;
}
async function readSourceEntries() {
  const dir = path.join(DATA, 'sources');
  const files = ['external_sources.yaml','x_accounts.yaml','podcasts.yaml','media.yaml','research.yaml','manual_links.yaml','curated_x_articles.yaml','curated_threads.yaml'];
  const entries = [];
  for (const f of files) if (await exists(path.join(dir,f))) {
    const body = await loadYaml(path.join(dir,f));
    const arr = Array.isArray(body) ? body : Object.values(body).flat();
    arr.filter(Boolean).forEach(e => entries.push({...e, _source_file:f}));
  }
  return entries;
}
async function collect() {
  const issueDate = todayBJT();
  const entries = await readSourceEntries();
  const candidates = entries.map(e => buildCandidate(e, issueDate, e._source_file)).filter(c => c.canonical_url && !BLOCK_WORDS.some(w => (c.title + c.summary).toLowerCase().includes(w.toLowerCase())));
  const out = path.join(DATA, 'candidates', `${issueDate}.json`);
  await writeJson(out, { issue_date: issueDate, generated_at: nowIso(), candidates });
  return { issueDate, candidates };
}
async function score() {
  const issueDate = todayBJT();
  const p = path.join(DATA, 'candidates', `${issueDate}.json`);
  const data = await readJson(p, {issue_date:issueDate,candidates:[]});
  data.candidates.sort((a,b) => b.total_score - a.total_score).forEach((c,i)=>c.rank=i+1);
  await writeJson(p, data); return data;
}
function layerOf(s){ if(s>=85) return 'must_read'; if(s>=70) return 'worth_reading'; if(s>=55) return 'signal_watch'; if(s>=40) return 'archive_only'; return 'rejected'; }
async function buildIssue() {
  const issueDate = todayBJT();
  const cand = await readJson(path.join(DATA,'candidates',`${issueDate}.json`), {candidates:[]});
  const usedPath = path.join(DATA,'archive','used_items.json');
  const used = await readJson(usedPath, []);
  const usedKeys = new Set(used.flatMap(u => [u.canonical_url, u.dedupe_key, u.cluster_id, hash(u.title||'')].filter(Boolean)));
  const buckets = { must_read:[], worth_reading:[], signal_watch:[], archive_only:[], rejected:[] };
  let duplicates = 0; const seen = new Set();
  for (const item of cand.candidates) {
    const keys = [item.canonical_url, item.dedupe_key, item.cluster_id, hash(item.title)].filter(Boolean);
    if (keys.some(k => usedKeys.has(k)) || keys.some(k => seen.has(k))) { duplicates++; item.status='archived'; item.reason_rejected='历史或本期重复，按去重规则不再入选。'; buckets.archive_only.push(item); continue; }
    keys.forEach(k=>seen.add(k));
    const layer = layerOf(item.total_score);
    item.status = layer === 'rejected' ? 'rejected' : (layer === 'archive_only' ? 'archived' : 'selected');
    item.reason_selected = item.status === 'selected' ? `核心信号：${item.title} 提供了可追踪的公开入口与证据链，适合观察 ${item.topics.slice(0,2).join(' / ')} 的后续变化。` : '';
    item.reason_rejected = item.status === 'rejected' ? '综合评分低于展示阈值或与站点主题匹配不足。' : '';
    buckets[layer].push(item);
  }
  buckets.must_read = buckets.must_read.slice(0,8); buckets.worth_reading = buckets.worth_reading.slice(0,16); buckets.signal_watch = buckets.signal_watch.slice(0,20);
  const selected = [...buckets.must_read, ...buckets.worth_reading, ...buckets.signal_watch];
  selected.forEach(i => i.used_in_issue = issueDate);
  const clusters = selected.map(i => ({ cluster_id:i.cluster_id, title:i.title, summary:i.summary, primary_source:i.canonical_url, supporting_sources:i.evidence_links, related_x_posts:i.evidence_links.filter(u=>domainOf(u).includes('x.com')), related_articles:i.evidence_links.filter(u=>!domainOf(u).includes('x.com')), entities:i.entities, tags:i.tags, score:i.total_score, selected_item_id:i.id }));
  const issue = { metadata:{ issue_date:issueDate, generated_at:nowIso(), timezone:TZ, sources_scanned:(await readSourceEntries()).length, candidates_count:cand.candidates.length, selected_count:selected.length, duplicates_blocked:duplicates, fetch_failures:0, initial_source_index:true }, summary:{ one_liner:'本期为初始来源索引：先建立可合规追踪的 X 与外部高信号入口，再由每日流水线增量筛选新内容。', trends:['AI Agent','AI Coding','AI Infra','Research','Startup / Investment'], watch_next:['公开 RSS 与博客新增内容','GitHub releases 与 trending','人工维护 X Article / Thread seed list','播客长访谈中的一手判断'] }, must_read:buckets.must_read, worth_reading:buckets.worth_reading, signal_watch:buckets.signal_watch, hot_rank:selected.slice().sort((a,b)=>b.heat_score-a.heat_score).slice(0,20), clusters, sources:[...new Set(selected.map(i=>i.source_domain))] };
  await writeJson(path.join(DATA,'issues',`${issueDate}.json`), issue);
  await fs.writeFile(path.join(ROOT,'content','issues',`${issueDate}.md`), `---\ndate: ${issueDate}\ntitle: X Signal Source ${issueDate}\n---\n\n${issue.summary.one_liner}\n`);
  const newUsed = [...used, ...selected.map(i=>({item_id:i.id, canonical_url:i.canonical_url, dedupe_key:i.dedupe_key, title:i.title, issue_date:issueDate, cluster_id:i.cluster_id, used_as:i.status}))];
  await writeJson(usedPath, newUsed);
  return issue;
}
async function generateSiteData() {
  await ensureDir(path.join(ROOT,'public','index-data'));
  const dir = path.join(DATA,'issues'); const files = (await fs.readdir(dir).catch(()=>[])).filter(f=>f.endsWith('.json')).sort();
  const issues = [];
  for (const f of files) { const x = await readJson(path.join(dir,f), null); if (x) issues.push({date:x.metadata.issue_date, selected_count:x.metadata.selected_count, candidates_count:x.metadata.candidates_count, must_read_count:x.must_read.length, generated_at:x.metadata.generated_at}); }
  const latestDate = issues.at(-1)?.date || todayBJT();
  const latest = await readJson(path.join(dir,`${latestDate}.json`), null);
  await writeJson(path.join(ROOT,'public','index-data','latest.json'), latest || {});
  await writeJson(path.join(ROOT,'public','index-data','issues.json'), issues.reverse());
  const search = latest ? [...latest.must_read,...latest.worth_reading,...latest.signal_watch].map(i=>({title:i.title,url:i.canonical_url,summary:i.summary,tags:i.tags,author:i.author,source:i.source_domain,date:latest.metadata.issue_date,score:i.total_score})) : [];
  await writeJson(path.join(ROOT,'public','index-data','search.json'), search);
}
async function qa() {
  const required = ['package.json','README.md','astro.config.mjs','.github/workflows/daily.yml','data/sources/source_policy.md','src/pages/index.astro','src/pages/sources.astro','src/pages/about.astro'];
  const missing = [];
  for (const r of required) if (!(await exists(path.join(ROOT,r)))) missing.push(r);
  const issues = await readJson(path.join(ROOT,'public','index-data','latest.json'), null);
  const errors = [...missing.map(m=>`missing ${m}`)];
  if (issues) {
    const selected = [...(issues.must_read||[]),...(issues.worth_reading||[]),...(issues.signal_watch||[])];
    if ((issues.metadata?.selected_count||0) !== selected.length) errors.push('selected_count mismatch');
    for (const i of selected) ['title','canonical_url','summary','reason_selected','total_score','dedupe_key','content_type'].forEach(k=>{ if (i[k] === undefined || i[k] === null || i[k] === '') errors.push(`item ${i.id} missing ${k}`); });
    const urls = new Set(), keys = new Set();
    for (const i of selected) { if (urls.has(i.canonical_url)) errors.push(`duplicate url ${i.canonical_url}`); urls.add(i.canonical_url); if(keys.has(i.dedupe_key)) errors.push(`duplicate key ${i.dedupe_key}`); keys.add(i.dedupe_key); }
  }
  const workflow = await fs.readFile(path.join(ROOT,'.github/workflows/daily.yml'),'utf8').catch(()=> '');
  if (!workflow.includes('12 22 * * *')) errors.push('cron is not 12 22 * * *');
  const readme = await fs.readFile(path.join(ROOT,'README.md'),'utf8').catch(()=> '');
  if (!readme.includes('不使用付费 API') || !readme.includes('合规边界')) errors.push('README compliance missing');
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('QA passed');
}
async function daily(){ await collect(); await score(); await buildIssue(); await generateSiteData(); await qa(); }
await ensureDir(path.join(ROOT,'content','issues'));
const cmd = process.argv[2] || 'daily';
if (cmd === 'collect') await collect();
else if (cmd === 'score') await score();
else if (cmd === 'build-issue') await buildIssue();
else if (cmd === 'generate-site-data') await generateSiteData();
else if (cmd === 'qa') await qa();
else if (cmd === 'daily') await daily();
else throw new Error(`Unknown command ${cmd}`);
