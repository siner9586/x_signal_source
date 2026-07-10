import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { load } from 'js-yaml';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data');
const TZ = 'Asia/Shanghai';
const FIRST_ISSUE_DATE = '2026-06-10';
const MAX_FETCH_JOBS = 220;
const FETCH_BATCH_SIZE = 12;
const FETCH_TIMEOUT_MS = 6500;

const WEIGHTS = { source_score:.2, information_density_score:.2, originality_score:.15, trend_score:.15, evidence_score:.1, heat_score:.1, site_fit_score:.1 };
const TOPICS = ['AI Agent','AI Coding','Reasoning Models','Multimodal','AI Search','AI Infra','Open Source','Startups','Product','Investment','Research','Robotics','Safety','中文 AI 观点'];
const BAD = ['giveaway','airdrop','meme','follow me','retweet to win','crypto alpha','100x','抽奖','互关','空投','暴富','割韭菜','无脑转发','速成','玄学'];

const ensure = (p) => fs.mkdir(p, { recursive:true });
const exists = async (p) => !!(await fs.access(p).then(() => true).catch(() => false));
const rjson = async (p, d) => exists(p).then(ok => ok ? fs.readFile(p, 'utf8').then(JSON.parse) : d);
const wjson = async (p, d) => { await ensure(path.dirname(p)); await fs.writeFile(p, JSON.stringify(d, null, 2) + '\n'); };
const h = (s) => crypto.createHash('sha256').update(String(s || '').trim().toLowerCase()).digest('hex').slice(0,16);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone:TZ, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const now = () => new Date().toISOString();
const strip = (s='') => String(s).replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const decode = (s='') => strip(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const norm = (u) => { try { const x = new URL(u); x.hash = ''; ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref'].forEach(k => x.searchParams.delete(k)); return x.toString().replace(/\/$/,''); } catch { return u || ''; } };
const dom = (u) => { try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ''; } };
const absolutize = (href, base) => { try { return norm(new URL(href, base).toString()); } catch { return ''; } };
const yload = async (p) => load(await fs.readFile(p, 'utf8')) || [];

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? decode(m[1]) : '';
}

function isProbablyFeed(text, url) {
  return /<(rss|feed|rdf)\b/i.test(text) || /\.xml($|\?)/i.test(url) || /\/(rss|feed|atom)(\/|$|\?)/i.test(url);
}

function parseFeed(text, sourceUrl) {
  const blocks = [...text.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(m => m[0]);
  const atom = blocks.length ? [] : [...text.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(m => m[0]);
  return [...blocks, ...atom].map((block) => {
    const atomLink = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || '';
    const rawLink = tag(block, 'link') || atomLink || tag(block, 'guid');
    const link = absolutize(rawLink, sourceUrl);
    const title = tag(block, 'title');
    const summary = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content:encoded') || tag(block, 'content');
    const published = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date');
    return { title, url:link, summary, published_at:published };
  }).filter(x => x.url && x.title);
}

function isArticleLike(url, title='') {
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/\/$/,'');
    if (!p || p === '') return false;
    if (/(\/tag\/|\/tags\/|\/category\/|\/categories\/|\/author\/|\/page\/|\/search|\/login|\/signup|\/privacy|\/terms)/i.test(p)) return false;
    if (title.length < 10) return false;
    return /(\d{4}|news|blog|post|posts|article|articles|research|release|releases|paper|papers|podcast|episode)/i.test(p + ' ' + title);
  } catch { return false; }
}

function parseHtmlLinks(text, sourceUrl) {
  const pageTitle = decode(text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const out = [];
  const sourceDomain = dom(sourceUrl);
  for (const m of text.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = absolutize(m[1], sourceUrl);
    const title = decode(m[2]);
    if (!url || dom(url) !== sourceDomain) continue;
    if (!isArticleLike(url, title)) continue;
    out.push({ title, url, summary: pageTitle ? `${pageTitle} · ${title}` : title, published_at:'' });
    if (out.length >= 12) break;
  }
  return out;
}

function fetchUrlsFor(e) {
  if (e.daily_signal_enabled === false || e.longform_only === true) return [];
  const raw = [e.rss_url, e.feed_url, e.atom_url, e.blog_url, e.research_url, e.url, e.homepage_url].filter(Boolean).map(norm);
  const out = [];
  const push = (u) => { if (u && !out.includes(u)) out.push(u); };
  for (const u of raw) {
    push(u);
    try {
      const x = new URL(u);
      const base = x.toString().replace(/\/$/,'');
      const origin = x.origin;
      if (!/\.(xml|rss|atom)$/i.test(x.pathname)) {
        ['/feed.xml','/rss.xml','/atom.xml','/feed','/rss','/rss/'].forEach(s => push(base + s));
        ['/feed.xml','/rss.xml','/atom.xml','/feed','/rss','/rss/'].forEach(s => push(origin + s));
      }
    } catch {}
  }
  return out.slice(0, 7);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent':'x-signal-source/0.1 (+https://github.com/siner9586/x_signal_source)',
        'accept':'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return { ok:true, text:text.slice(0, 120000), content_type:res.headers.get('content-type') || '' };
  } catch (err) {
    return { ok:false, error:String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

function typeOf(url, cat='') {
  const d = dom(url);
  if (d.includes('x.com') || d.includes('twitter.com')) return 'x_article';
  if (d.includes('github.com')) return 'github_repo';
  if (d.includes('arxiv.org') || d.includes('openreview.net') || cat.includes('research')) return 'paper';
  if (cat.includes('podcast') || d.includes('youtube.com') || d.includes('spotify')) return 'podcast_episode';
  if (cat.includes('media')) return 'media_report';
  if (cat.includes('company') || cat.includes('official')) return 'company_blog';
  return 'external_article';
}

function kw(text, words, base) {
  const t = text.toLowerCase();
  return Math.min(100, base + words.filter(w => t.includes(String(w).toLowerCase())).length * 12);
}

function liveCandidate(e, item, date, sourceFile, fetchUrl) {
  const url = norm(item.url);
  const title = decode(item.title || dom(url) || 'Untitled');
  const summary = decode(item.summary || `${title} 是 ${e.name || e.display_name || dom(fetchUrl)} 当日抓取到的公开新增条目。`).slice(0, 480);
  const text = `${title} ${summary} ${e.notes || ''} ${(e.tags || []).join(' ')}`;
  const evidence = [url, fetchUrl, e.homepage_url, e.blog_url, e.x_url].filter(Boolean).map(norm);
  const c = {
    id:`cand_${h(url + title)}`,
    canonical_url:url,
    source_url:fetchUrl,
    source_fetch_url:fetchUrl,
    source_platform:dom(url).includes('x.com') ? 'x' : 'web',
    source_domain:dom(url),
    source_name:e.name || e.display_name || e.handle || '',
    source_file:sourceFile,
    source_mode:'live_fetch',
    content_type:typeOf(url, e.category || sourceFile),
    title,
    subtitle:e.notes || '',
    author:e.author || e.display_name || e.name || '',
    author_handle:e.handle || '',
    author_role:e.role || '',
    organization:e.organization || e.name || '',
    language:e.language || 'unknown',
    published_at:item.published_at || '',
    captured_at:now(),
    captured_issue:date,
    summary,
    excerpt:summary,
    raw_text_available:false,
    topics:e.topics || TOPICS.filter(t => text.toLowerCase().includes(t.toLowerCase())).slice(0,3),
    tags:e.tags || [e.category || 'source'],
    entities:[e.organization || e.name || e.display_name].filter(Boolean),
    mentioned_companies:e.organization ? [e.organization] : [],
    mentioned_people:e.role ? [e.display_name || e.name].filter(Boolean) : [],
    mentioned_products:[],
    mentioned_papers:[],
    mentioned_repos:evidence.filter(u => dom(u).includes('github.com')),
    evidence_links:[...new Set(evidence)],
    engagement:{ likes:0, reposts:0, replies:0, bookmarks:0, views:0, comments:0, stars:0, score:0 },
    source_score:Math.min(100, 45 + Number(e.priority || 3) * 10 + ((e.category || '').includes('official') ? 10 : 0)),
    information_density_score:kw(text, ['research','blog','github','paper','benchmark','docs','deep dive','framework','复盘','方法论'], 42),
    originality_score:kw(text, ['official','founder','researcher','maintainer','creator','原创','作者'], 38),
    trend_score:kw(text, ['agent','coding','reasoning','multimodal','infra','startup','investment','AI Agent','AI 编程'], 45),
    evidence_score:Math.min(100, 48 + evidence.length * 9),
    heat_score:40,
    site_fit_score:kw(text, ['AI','agent','coding','startup','research','product','investment','infra','模型','智能体'], 50),
    total_score:0,
    rank:0,
    cluster_id:`${dom(url).replace(/[^a-z0-9]+/gi,'_')}_${h(title).slice(0,8)}`,
    dedupe_key:h(`${url}|${title}`),
    status:'candidate',
    reason_selected:'',
    reason_rejected:'',
    fetch_status:'ok',
    fetch_error:'',
    first_seen_issue:date,
    last_seen_issue:date,
    used_in_issue:null
  };
  c.total_score = Math.round(Object.entries(WEIGHTS).reduce((s,[k,w]) => s + c[k] * w, 0));
  if (!c.topics.length) c.topics = ['AI Signal'];
  return c;
}

async function sources() {
  const dir = path.join(DATA, 'sources');
  const excluded = new Set(['query_templates.yaml','blocklist.yaml']);
  const files = (await fs.readdir(dir).catch(() => [])).filter(f => (f.endsWith('.yaml') || f.endsWith('.yml')) && !excluded.has(f)).sort();
  const out = [];
  for (const f of files) {
    const body = await yload(path.join(dir, f));
    const arr = Array.isArray(body) ? body : [];
    arr
      .filter(e => e && typeof e === 'object' && e.daily_signal_enabled !== false && e.longform_only !== true)
      .forEach(e => out.push({ ...e, _source_file:f }));
  }
  return out;
}

async function fetchSource(job, date) {
  const got = await fetchText(job.url);
  if (!got.ok) return { candidates:[], failure:{ url:job.url, source:job.entry.name || job.entry.display_name || '', error:got.error } };
  const items = isProbablyFeed(got.text, job.url) ? parseFeed(got.text, job.url) : parseHtmlLinks(got.text, job.url);
  const candidates = items.map(item => liveCandidate(job.entry, item, date, job.entry._source_file, job.url));
  return { candidates, failure:null };
}

async function collect() {
  const d = today();
  const entries = (await sources()).sort((a,b) => Number(b.priority || 0) - Number(a.priority || 0));
  const jobs = [];
  for (const entry of entries) {
    for (const url of fetchUrlsFor(entry)) jobs.push({ entry, url });
    if (jobs.length >= MAX_FETCH_JOBS) break;
  }
  const candidates = [];
  const failures = [];
  for (let i = 0; i < jobs.length; i += FETCH_BATCH_SIZE) {
    const batch = jobs.slice(i, i + FETCH_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(job => fetchSource(job, d)));
    for (const r of results) {
      if (r.status !== 'fulfilled') { failures.push({ error:String(r.reason || 'unknown') }); continue; }
      candidates.push(...r.value.candidates);
      if (r.value.failure) failures.push(r.value.failure);
    }
  }
  const unique = [];
  const seen = new Set();
  for (const c of candidates) {
    if (!c.canonical_url || BAD.some(w => (c.title + c.summary).toLowerCase().includes(w.toLowerCase()))) continue;
    if (seen.has(c.canonical_url) || seen.has(c.dedupe_key)) continue;
    seen.add(c.canonical_url); seen.add(c.dedupe_key);
    unique.push(c);
  }
  unique.sort((a,b) => b.total_score - a.total_score).forEach((c,i) => c.rank = i + 1);
  await wjson(path.join(DATA, 'candidates', `${d}.json`), {
    issue_date:d,
    generated_at:now(),
    source_mode:'live_fetch_only',
    fetch_jobs:jobs.length,
    fetch_failures:failures.slice(0, 80),
    candidates:unique
  });
  return { d, candidates:unique };
}

async function score() {
  const d = today();
  const p = path.join(DATA, 'candidates', `${d}.json`);
  const data = await rjson(p, { issue_date:d, candidates:[] });
  data.candidates.sort((a,b) => b.total_score - a.total_score).forEach((c,i) => c.rank = i + 1);
  await wjson(p, data);
  return data;
}

const layer = (s) => s >= 85 ? 'must_read' : s >= 70 ? 'worth_reading' : s >= 55 ? 'signal_watch' : s >= 40 ? 'archive_only' : 'rejected';

async function historyKeys(currentDate) {
  const used = (await rjson(path.join(DATA, 'archive', 'used_items.json'), [])).filter(u => u.issue_date !== currentDate);
  const keys = new Set(used.flatMap(u => [u.canonical_url, u.dedupe_key, u.cluster_id, h(u.title || '')].filter(Boolean)));
  const issueDir = path.join(DATA, 'issues');
  const files = (await fs.readdir(issueDir).catch(() => [])).filter(f => f.endsWith('.json') && f !== `${currentDate}.json`);
  for (const f of files) {
    const issue = await rjson(path.join(issueDir, f), null);
    if (!issue) continue;
    const items = [...(issue.must_read || []), ...(issue.worth_reading || []), ...(issue.signal_watch || [])];
    for (const i of items) [i.canonical_url, i.dedupe_key, i.cluster_id, h(i.title || '')].filter(Boolean).forEach(k => keys.add(k));
  }
  return keys;
}

async function buildIssue() {
  const d = today();
  const candidatePath = path.join(DATA, 'candidates', `${d}.json`);
  const data = await rjson(candidatePath, { issue_date:d, candidates:[], fetch_failures:[], fetch_jobs:0 });
  const usedPath = path.join(DATA, 'archive', 'used_items.json');
  const rawUsed = await rjson(usedPath, []);
  const hist = rawUsed.filter(u => u.issue_date !== d);
  const usedKeys = await historyKeys(d);
  const buckets = { must_read:[], worth_reading:[], signal_watch:[], archive_only:[], rejected:[] };
  let dup = 0, stale = 0;
  const seen = new Set();

  for (const item of data.candidates) {
    const isCurrentLive = item.captured_issue === d && item.source_mode === 'live_fetch' && item.fetch_status === 'ok';
    if (!isCurrentLive) {
      stale++;
      item.status = 'archived';
      item.reason_rejected = '非当日 live fetch 候选，刚性规则禁止入选。';
      buckets.archive_only.push(item);
      continue;
    }
    const keys = [item.canonical_url, item.dedupe_key, item.cluster_id, h(item.title)].filter(Boolean);
    if (keys.some(k => usedKeys.has(k)) || keys.some(k => seen.has(k))) {
      dup++;
      item.status = 'archived';
      item.reason_rejected = '历史或本期重复，按刚性去重规则不再入选。';
      buckets.archive_only.push(item);
      continue;
    }
    keys.forEach(k => seen.add(k));
    const l = layer(item.total_score);
    item.status = l === 'rejected' ? 'rejected' : l === 'archive_only' ? 'archived' : 'selected';
    item.reason_selected = item.status === 'selected'
      ? `当日新抓取且未展示过：${item.title} 来自 ${item.source_name || item.source_domain} 的公开抓取入口，证据链保留原始链接与抓取来源。`
      : '';
    item.reason_rejected = item.status === 'rejected' ? '综合评分低于展示阈值或与站点主题匹配不足。' : item.reason_rejected;
    buckets[l].push(item);
  }

  buckets.must_read = buckets.must_read.slice(0, 8);
  buckets.worth_reading = buckets.worth_reading.slice(0, 16);
  buckets.signal_watch = buckets.signal_watch.slice(0, 20);
  const selected = [...buckets.must_read, ...buckets.worth_reading, ...buckets.signal_watch];
  selected.forEach(i => i.used_in_issue = d);

  const clusters = selected.map(i => ({
    cluster_id:i.cluster_id,
    title:i.title,
    summary:i.summary,
    primary_source:i.canonical_url,
    supporting_sources:i.evidence_links,
    related_x_posts:i.evidence_links.filter(u => dom(u).includes('x.com')),
    related_articles:i.evidence_links.filter(u => !dom(u).includes('x.com')),
    entities:i.entities,
    tags:i.tags,
    score:i.total_score,
    selected_item_id:i.id
  }));

  const isFirst = d === FIRST_ISSUE_DATE;
  const noNew = selected.length === 0;
  const issue = {
    metadata:{
      issue_date:d,
      generated_at:now(),
      timezone:TZ,
      source_mode:'live_fetch_only',
      strict_new_only:true,
      sources_scanned:(await sources()).length,
      fetch_jobs:data.fetch_jobs || 0,
      candidates_count:data.candidates.length,
      selected_count:selected.length,
      duplicates_blocked:dup,
      stale_candidates_blocked:stale,
      fetch_failures:(data.fetch_failures || []).length,
      no_new_content:noNew,
      initial_source_index:isFirst
    },
    summary:{
      one_liner:isFirst
        ? '本期为初始来源索引：先建立可合规追踪的 X 与外部高信号入口，再由每日流水线增量筛选新内容。'
        : noNew
          ? '本期自动抓取未发现未展示过的新内容；按刚性规则不复用任何历史展示内容，因此不强行凑数。'
          : '本期由每日自动流水线生成：仅展示当日 live fetch 抓取、且未在历史期展示过的新内容。',
      trends:selected.length ? ['AI Agent','AI Coding','AI Infra','Research','Startup / Investment'] : [],
      watch_next:['公开 RSS / Atom / HTML 新条目','GitHub releases 与技术博客','人工维护 X Article / Thread seed list','播客长访谈中的一手判断']
    },
    must_read:buckets.must_read,
    worth_reading:buckets.worth_reading,
    signal_watch:buckets.signal_watch,
    hot_rank:selected.slice().sort((a,b) => b.heat_score - a.heat_score).slice(0,20),
    clusters,
    sources:[...new Set(selected.map(i => i.source_domain))]
  };

  await wjson(path.join(DATA, 'issues', `${d}.json`), issue);
  await ensure(path.join(ROOT, 'content', 'issues'));
  await fs.writeFile(path.join(ROOT, 'content', 'issues', `${d}.md`), `---\ndate: ${d}\ntitle: X Signal Source ${d}\n---\n\n${issue.summary.one_liner}\n`);
  await wjson(usedPath, [
    ...hist,
    ...selected.map(i => ({ item_id:i.id, canonical_url:i.canonical_url, dedupe_key:i.dedupe_key, title:i.title, issue_date:d, cluster_id:i.cluster_id, used_as:i.status, source_mode:i.source_mode }))
  ]);
  return issue;
}

async function siteData() {
  await ensure(path.join(ROOT, 'public', 'index-data'));
  const dir = path.join(DATA, 'issues');
  const files = (await fs.readdir(dir).catch(() => [])).filter(f => f.endsWith('.json')).sort();
  const idx = [];
  for (const f of files) {
    const x = await rjson(path.join(dir, f), null);
    if (x) idx.push({ date:x.metadata.issue_date, selected_count:x.metadata.selected_count, candidates_count:x.metadata.candidates_count, must_read_count:x.must_read.length, generated_at:x.metadata.generated_at, no_new_content:x.metadata.no_new_content });
  }
  const latestDate = idx.at(-1)?.date || today();
  const latest = await rjson(path.join(dir, `${latestDate}.json`), null);
  await wjson(path.join(ROOT, 'public', 'index-data', 'latest.json'), latest || {});
  await wjson(path.join(ROOT, 'public', 'index-data', 'issues.json'), idx.reverse());
  const search = latest ? [...latest.must_read, ...latest.worth_reading, ...latest.signal_watch].map(i => ({ title:i.title, url:i.canonical_url, summary:i.summary, tags:i.tags, author:i.author, source:i.source_domain, date:latest.metadata.issue_date, score:i.total_score })) : [];
  await wjson(path.join(ROOT, 'public', 'index-data', 'search.json'), search);
}

async function qa() {
  const req = ['package.json','README.md','astro.config.mjs','.github/workflows/daily.yml','data/sources/source_policy.md','src/pages/index.astro','src/pages/sources.astro','src/pages/about.astro'];
  const errors = [];
  for (const r of req) if (!(await exists(path.join(ROOT, r)))) errors.push(`missing ${r}`);
  const latest = await rjson(path.join(ROOT, 'public', 'index-data', 'latest.json'), null);
  if (latest) {
    const selected = [...(latest.must_read || []), ...(latest.worth_reading || []), ...(latest.signal_watch || [])];
    if ((latest.metadata?.selected_count || 0) !== selected.length) errors.push('selected_count mismatch');
    const urls = new Set(), keys = new Set();
    for (const i of selected) {
      for (const k of ['title','canonical_url','summary','reason_selected','total_score','dedupe_key','content_type','source_mode','captured_issue']) {
        if (i[k] === undefined || i[k] === null || i[k] === '') errors.push(`item ${i.id} missing ${k}`);
      }
      if (latest.metadata?.strict_new_only && (i.source_mode !== 'live_fetch' || i.captured_issue !== latest.metadata.issue_date)) errors.push(`item ${i.id} is not current live_fetch`);
      if (urls.has(i.canonical_url)) errors.push(`duplicate url ${i.canonical_url}`);
      urls.add(i.canonical_url);
      if (keys.has(i.dedupe_key)) errors.push(`duplicate key ${i.dedupe_key}`);
      keys.add(i.dedupe_key);
    }
  }
  const wf = await fs.readFile(path.join(ROOT, '.github/workflows/daily.yml'), 'utf8').catch(() => '');
  for (const cron of ['2,7,12,17,22,27,32,37,42,47,52,57 21-23 * * *','7,17,27,37,47,57 0-5 * * *','7,17 6 * * *']) {
    if (!wf.includes(cron)) errors.push(`missing redundant cron ${cron}`);
  }
  const readme = await fs.readFile(path.join(ROOT, 'README.md'), 'utf8').catch(() => '');
  if (!readme.includes('不使用付费 API') || !readme.includes('合规边界')) errors.push('README compliance missing');
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('QA passed');
}

async function daily() { await collect(); await score(); await buildIssue(); await siteData(); await qa(); }

await ensure(path.join(ROOT, 'content', 'issues'));
const cmd = process.argv[2] || 'daily';
if (cmd === 'collect') await collect();
else if (cmd === 'score') await score();
else if (cmd === 'build-issue') await buildIssue();
else if (cmd === 'generate-site-data') await siteData();
else if (cmd === 'qa') await qa();
else if (cmd === 'daily') await daily();
else throw new Error(`Unknown command ${cmd}`);
