# x_signal_source

`x_signal_source` 是一个静态信息站点，用于每日整理公开网络上的高质量 X Articles、长帖、Thread 入口、外部深度文章、AI/科技/产品/创业/投资/研究相关信号，并形成可长期复盘的“X 高价值信号源”网站。

- 项目名称：x_signal_source
- 项目定位：公开来源索引 + 高信号候选筛选 + 证据链回链 + 静态归档
- 更新频率：每天北京时间 06:12
- 技术栈：Astro + 静态 JSON/YAML/Markdown + Node.js scripts + GitHub Actions
- 部署目标：GitHub Pages / Cloudflare Pages / Netlify 等静态站点平台

## 为什么不使用付费 API

本项目不使用付费 API，也不使用 X paid API。原因是：

1. 降低长期维护成本，保证普通个人仓库可持续运行。
2. 避免依赖单一商业接口，优先使用公开 RSS、Atom、sitemap、blog index、GitHub、YouTube RSS、podcast feed、公开网页元数据与人工维护 seed list。
3. 遵守平台边界，不绕过登录、验证码、人机验证、付费墙、反爬机制或 rate limit。

## 合规边界

- 不使用 X paid API。
- 不使用需要付费 token 的第三方数据 API。
- 不绕过登录墙、验证码、Cloudflare、人机验证、付费墙、反爬或平台限制。
- 不保存完整受版权保护正文，只保存标题、摘要、短摘录、元数据、原始链接与本站生成评论。
- X 内容定位为“发现入口”和“来源索引”。事实性内容优先回链官方公告、公司博客、论文、GitHub、文档、公开访谈、媒体原文或作者公开页面。
- 公开页面抓取失败时不中断流程，只记录 `fetch_status` 与 `fetch_error`。

## 信息源分类

来源库位于 `data/sources/`：

- `x_accounts.yaml`：X 高质量账号入口。
- `external_sources.yaml`：AI 公司、产品、Infra、VC、聚合参考站等外部来源。
- `podcasts.yaml`：播客、访谈和 YouTube 长内容来源。
- `media.yaml`：深度媒体、科技媒体、商业媒体和长期作者。
- `research.yaml`：arXiv、OpenReview、Papers with Code、研究机构、技术社区。
- `query_templates.yaml`：主题词、信号词、排除词。
- `blocklist.yaml`：低质量词、低质量域名和过滤规则。
- `manual_links.yaml`：人工维护外部文章入口。
- `curated_x_articles.yaml`：人工维护 X Article 入口。
- `curated_threads.yaml`：人工维护 Thread 入口。
- `source_policy.md`：来源使用规则和合规边界。

## 抓取策略

默认流水线采用稳健、合规、轻量策略：

1. 从 source list 读取公开来源。
2. 优先使用公开 RSS / Atom / sitemap / blog index / GitHub / YouTube / podcast feed。
3. 对 X 只做公开入口索引，不强行抓取 Article 全文。
4. 对外部网页只保存标题、作者、发布时间、描述、canonical URL、OG 信息、短摘录、来源域名等轻量元数据。
5. 失败不阻断，保留链接和失败原因。
6. 没有新增内容时允许生成稳定状态页，不让 workflow 失败。
7. 第一次运行如果没有足够新内容，会生成“初始来源索引 issue”，并明确标注不是新闻抓取结果。

## 候选数据结构

候选文件保存到：

```text
data/candidates/YYYY-MM-DD.json
```

核心字段包括：

- `id`
- `canonical_url`
- `source_url`
- `source_platform`
- `source_domain`
- `content_type`
- `title`
- `author`
- `author_handle`
- `organization`
- `language`
- `published_at`
- `captured_at`
- `summary`
- `excerpt`
- `topics`
- `tags`
- `entities`
- `evidence_links`
- `engagement`
- `source_score`
- `information_density_score`
- `originality_score`
- `trend_score`
- `evidence_score`
- `heat_score`
- `site_fit_score`
- `total_score`
- `cluster_id`
- `dedupe_key`
- `status`
- `reason_selected`
- `reason_rejected`
- `fetch_status`
- `fetch_error`
- `used_in_issue`

## 评分规则

综合分为 100 分制：

```text
total_score =
source_score * 0.20 +
information_density_score * 0.20 +
originality_score * 0.15 +
trend_score * 0.15 +
evidence_score * 0.10 +
heat_score * 0.10 +
site_fit_score * 0.10
```

分层规则：

- Must Read：85–100，每期最多 8 条。
- Worth Reading：70–84，每期最多 16 条。
- Signal Watch：55–69，每期最多 20 条。
- Archive Only：40–54，只归档，不展示主页面。
- Rejected：0–39，不展示，记录原因。

热度只占 10%，不得作为唯一排序依据。页面同时保留综合排序和热度排序入口。

## 去重规则

这是刚性规则：第二期不得使用第一期内容，第三期不得使用第一期和第二期内容，后续同理。

实现方式：

1. 每条内容生成 `dedupe_key`。
2. 每次生成新一期前读取 `data/archive/used_items.json`。
3. 对 `canonical_url`、`normalized_url`、`source_url`、`title hash`、`semantic title key`、`author + title`、`cluster_id` 排重。
4. 历史已入选内容不得再次进入 selected。
5. 同一事件的多个来源合并为 topic cluster，不在同一期重复展示。
6. 旧内容可作为 background source，但不能作为最新一期主内容。

## 每日更新规则

GitHub Actions 文件：

```text
.github/workflows/daily.yml
```

cron：

```text
12 22 * * *
```

GitHub Actions 使用 UTC，北京时间/台北时间为 UTC+8，所以 22:12 UTC 对应次日 06:12 BJT/Taipei。

执行流程：

```text
checkout → setup node → npm install → npm run daily → npm run qa → npm run build → commit & push
```

commit message：

```text
chore: update x signal source for YYYY-MM-DD
```

## 本地运行方法

```bash
npm install
npm run daily
npm run qa
npm run build
npm run dev
```

单步命令：

```bash
npm run collect
npm run score
npm run build:issue
npm run generate:site-data
npm run qa
npm run build
```

## 部署说明

### GitHub Pages

1. 在仓库 Settings → Pages 中选择 GitHub Actions 或静态构建产物部署方式。
2. 构建命令：`npm run build`
3. 输出目录：`dist`

### Cloudflare Pages

- Build command：`npm run build`
- Output directory：`dist`
- Node version：20+

### Netlify

- Build command：`npm run build`
- Publish directory：`dist`
- Node version：20+

## 如何添加新的 X 账号

编辑：

```text
data/sources/x_accounts.yaml
```

字段至少包括：

```yaml
- handle: example
  display_name: Example
  category: ai_researcher
  organization: Example Org
  role: researcher
  homepage_url: https://example.com/
  x_url: https://x.com/example
  priority: 4
  language: en
  notes: 为什么这个来源值得追踪。
  tags: [research, ai]
```

不确定的个人账号必须标注 TODO，不得臆造。

## 如何添加新的外部来源

编辑：

```text
data/sources/external_sources.yaml
```

可补充 `homepage_url`、`blog_url`、`rss_url`、`docs_url`、`github_url`、`youtube_url`、`podcast_url`、`x_url`。

## 如何手动添加 curated article

编辑：

```text
data/sources/manual_links.yaml
data/sources/curated_x_articles.yaml
data/sources/curated_threads.yaml
```

只保存公开链接、标题、作者、摘要、标签和说明，不粘贴完整版权正文。

## QA 检查

`npm run qa` 至少检查：

- 必要文件存在。
- sources 可解析。
- issue 可解析。
- latest 指向真实日期。
- selected_count 与数组长度一致。
- selected 条目有 title、url、summary、reason_selected、total_score、dedupe_key、content_type。
- 本期内部 URL、dedupe_key 不重复。
- workflow cron 为 `12 22 * * *`。
- README 包含“不使用付费 API”和“合规边界”。

## 常见问题

### 为什么不是完整抓取 X Article？

因为项目遵守平台边界，不使用 X paid API，不绕过登录、验证码、反爬或付费限制。X 只作为高信号入口和公开链接索引。

### 为什么首期显示“初始来源索引”？

空仓库第一次运行时可能尚未形成真实新增候选池。为了不编造新闻，首期可以先展示来源库索引，并明确标注不是新闻抓取结果。

### 如何保证第二期不重复第一期？

每期生成后 selected 写入 `data/archive/used_items.json`。后续期生成前读取该文件并排重。

## 后续路线图

- 增加 RSS/Atom 自动解析器。
- 增加 GitHub releases/trending 轻量收集器。
- 增加 YouTube RSS 与 podcast feed 增量解析。
- 增加更细的 topic clustering。
- 增加搜索页高级筛选。
- 增加来源贡献模板和 Issue 表单。
- 增加站点 OG image 生成。
