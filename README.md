# x_signal_source

`x_signal_source` 是一个静态信息站点，用于每日整理公开网络上的高质量 X Articles、长帖、Thread 入口、外部深度文章、AI/科技/产品/创业/投资/研究相关信号，并形成可长期复盘的“X 高价值信号源”网站。

本次新增 `Podcast Signals / 长访谈逐字稿学习库`，在不破坏原 daily 主流程的前提下，把站点扩展为私人 AI 长访谈、播客、视频博主完整逐字稿学习系统。

- 原主线定位：公开来源索引 + 高信号候选筛选 + 证据链回链 + 静态归档
- 新增长内容定位：AI / 产品 / 创业 / 工程 / 投资 / 认知科学长访谈逐字稿学习库
- 技术栈：Astro + 静态 JSON/YAML/Markdown + Node.js scripts + Python ASR scripts
- 部署目标：GitHub Pages / Cloudflare Pages / Netlify 等静态站点平台；私人站点优先

## 为什么不使用付费 API

本项目不使用付费 API，也不使用 X paid API。原因是：

1. 降低长期维护成本，保证普通个人仓库可持续运行。
2. 避免依赖单一商业接口，优先使用公开 RSS、Atom、sitemap、blog index、GitHub、YouTube RSS、podcast feed、公开网页元数据与人工维护 seed list。
3. 长内容转录默认使用本地免费开源 ASR：`faster-whisper` 优先，`openai-whisper` 备用。
4. 遵守平台边界，不绕过登录、验证码、人机验证、付费墙、反爬机制或 rate limit。

## 合规边界

- 不使用 X paid API。
- 不使用需要付费 token 的第三方数据 API。
- 不使用商业转录服务，不要求 OpenAI API key。
- 不绕过登录墙、验证码、Cloudflare、人机验证、付费墙、反爬或平台限制。
- 不内置账号密码、cookies、token。
- 不提交 `node_modules`、模型缓存、音频、视频或超大媒体文件。
- daily 主流程只保存公开来源索引、标题、摘要、短摘录、元数据、原始链接与本站生成评论。
- `Podcast Signals` 面向私人仓库和个人学习使用，默认保存完整逐字稿，并在每篇末尾附原视频/原音频链接，便于边读边看。

## 原 daily 主流程

GitHub Actions 文件：

```text
.github/workflows/daily.yml
```

执行流程：

```text
checkout → setup node → npm install → npm run daily → npm run qa → npm run build → commit & push
```

本次升级不删除已有页面、不删除已有数据源、不改变 daily 脚本入口：

```bash
npm run collect
npm run score
npm run build:issue
npm run generate:site-data
npm run daily
npm run qa
npm run build
```

## Podcast Signals / 长访谈逐字稿学习库

页面入口：

```text
/podcasts/
/transcripts/
/creators/
/longform/
```

栏目名称：`Podcast Signals`

Slogan：`Long-form AI interviews, transcribed for deep learning.`

中文说明：聚合 AI、产品、创业、技术、投资与认知科学领域的长访谈、播客和视频博主内容，自动生成完整逐字稿、时间轴、学习笔记与原始链接，形成个人长期知识库。

### 核心能力

1. 扩充更广泛的视频博主、播客、访谈、技术频道来源。
2. 支持从 RSS、YouTube feed、Podcast feed、手动链接、公开网页中发现长内容。
3. 支持本地免费开源转录，生成完整逐字稿。
4. 每篇逐字稿自动附原视频/原音频链接，方便边读边看。
5. 生成高级、克制、适合深度阅读的全文阅读界面。
6. 支持长文检索、时间戳跳转、章节导航、标签归档、学习笔记、关键观点、引用卡片。
7. 支持批量处理队列：待抓取、待下载、待转录、待清洗、待发布、已完成。
8. 不使用付费工具，不使用收费 API，不依赖商业转录服务。
9. 默认保留完整逐字稿，默认生成完整阅读页。

## 目录结构

```text
data/sources/podcasts.yaml
data/sources/video_creators.yaml
data/sources/manual_longform_links.yaml

data/longform/episodes/
data/longform/queues/
data/longform/runs/
data/longform/audio_manifest/
data/longform/transcript_manifest/
data/longform/source_index.json
data/longform/search_index.json

data/transcripts/raw/
data/transcripts/cleaned/
data/transcripts/published/
data/transcripts/srt/
data/transcripts/vtt/
data/transcripts/txt/

content/podcasts/
content/transcripts/
content/creators/
content/longform/

public/longform-search-index.json
public/longform-data/

local_audio/        # 本地音频，不提交 Git
model_cache/        # 本地模型缓存，不提交 Git
```

## 如何新增视频博主

编辑：

```text
data/sources/video_creators.yaml
```

示例：

```yaml
- id: andrej-karpathy
  name: Andrej Karpathy
  source_type: youtube
  category: ai_engineering
  priority: 5
  language: en
  homepage_url: ""
  youtube_url: https://www.youtube.com/@AndrejKarpathy
  youtube_channel_id: ""
  youtube_feed_url: ""
  rss_url: ""
  tags: [AI, LLM, Deep Learning, Engineering]
  enabled: true
  daily_signal_enabled: false
  crawl_strategy: youtube_feed
  discovery_status: needs_channel_id
  notes: AI engineering, LLM, neural networks, coding education.
```

找不到 feed 或 channel id 时，先保留 `discovery_status: needs_manual_url` 或 `needs_channel_id`，后续手动补充。

## 如何新增播客源

编辑：

```text
data/sources/podcasts.yaml
```

示例：

```yaml
- id: lennys-podcast
  name: Lenny's Podcast
  source_type: podcast
  category: product_growth_ai
  priority: 5
  language: en
  homepage_url: https://www.lennysnewsletter.com/
  podcast_url: ""
  rss_url: ""
  youtube_url: https://www.youtube.com/@LennysPodcast
  youtube_channel_id: ""
  youtube_feed_url: ""
  tags: [Product, Growth, AI, Startup]
  enabled: true
  daily_signal_enabled: false
  crawl_strategy: rss_or_youtube_feed
  discovery_status: needs_feed_url
  notes: Product, growth, startup and AI interviews.
```

## 如何新增单条 YouTube 链接

编辑：

```text
data/sources/manual_longform_links.yaml
```

示例：

```yaml
- id: lenny-openai-codex-andrew-ambrosino
  title: Why OpenAI is merging Codex and ChatGPT and the future of knowledge work | Andrew Ambrosino
  source_name: Lenny's Podcast
  creator_name: Lenny Rachitsky
  guest_names: [Andrew Ambrosino]
  episode_url: https://youtu.be/P3KDebPTUrw?si=abkAhzMhiFwXZqhk
  video_url: https://youtu.be/P3KDebPTUrw?si=abkAhzMhiFwXZqhk
  audio_url: ""
  published_at: ""
  duration: 01:09:57
  language: en
  tags: [OpenAI, Codex, ChatGPT, Knowledge Work, Product, AI Agents]
  source_type: youtube
  status: queued
  notes: 用户指定的首个测试视频，用于完整逐字稿阅读系统验证。
```

## 完整使用流程

### 第一步：发现内容

```bash
npm run longform:discover
```

输出：

```text
data/longform/episodes/YYYY-MM-DD.json
data/longform/runs/YYYY-MM-DD-discover.json
data/longform/source_index.json
```

### 第二步：查看队列

```bash
npm run longform:queue
```

输出：

```text
data/longform/queues/current.json
```

### 第三步：下载或登记音频

本地下载公开视频音频：

```bash
node scripts/longform-download-local.mjs \
  --episode-id "lenny-openai-codex-andrew-ambrosino" \
  --audio-only \
  --write-subs \
  --write-auto-subs
```

或者登记已下载音频：

```bash
node scripts/longform-register-audio.mjs \
  --episode-id "lenny-openai-codex-andrew-ambrosino" \
  --audio "local_audio/lenny_codex.mp3"
```

`local_audio/` 已加入 `.gitignore`，不要把音频提交到仓库。

### 第四步：本地转录

```bash
python scripts/transcribe.py \
  --episode-id "lenny-openai-codex-andrew-ambrosino" \
  --audio "local_audio/lenny_codex.mp3" \
  --model "medium" \
  --language "en" \
  --output-dir "data/transcripts/raw" \
  --formats "json,txt,srt,vtt,md"
```

### 第五步：清洗、章节、页面生成

```bash
npm run longform:build
```

该命令依次运行：

```text
longform:clean → longform:chapters → longform:notes → longform:transcript-page → longform:search → longform:creators
```

### 第六步：本地预览

```bash
npm run dev
```

访问：

```text
http://localhost:4321/podcasts/
http://localhost:4321/transcripts/
```

### 第七步：构建

```bash
npm run build
```

## 新增命令

```bash
npm run longform:discover
npm run longform:normalize
npm run longform:queue
npm run longform:download
npm run longform:register-audio
npm run longform:clean
npm run longform:chapters
npm run longform:notes
npm run longform:transcript-page
npm run longform:search
npm run longform:creators
npm run longform:qa
npm run longform:build
npm run longform
npm run transcribe:local
```

## 如何全文搜索

构建后生成：

```text
public/longform-search-index.json
```

索引包含标题、来源、嘉宾、标签、章节、时间戳片段与完整逐字稿字段。`/podcasts/` 和 `/transcripts/` 页面会加载该索引，实现本地前端全文搜索。搜索结果可点击进入对应 transcript 页面和时间戳位置。

## 如何边读边看

逐字稿阅读页 `/transcripts/[slug]/` 会为 YouTube 链接解析 video id，并把每个片段时间戳转换为：

```text
https://www.youtube.com/watch?v={video_id}&t={seconds}s
```

点击时间戳即可打开原视频对应位置。页面末尾也会附原视频、原音频、来源主页、转录模型和转录时间。

## GitHub Actions

新增：

```text
.github/workflows/longform.yml
```

默认只运行：

```text
longform:discover → longform:queue → longform:build → longform:qa → build
```

Whisper 转录大模型不适合默认在 GitHub-hosted runner 跑，因此 workflow 默认不跑长音频转录。若以后使用 self-hosted runner，可在 `workflow_dispatch` 中开启：

```text
run_transcription=true
```

## QA 检查

`npm run qa` 检查 daily 主流程。

`npm run longform:qa` 检查 longform 模块：

- sources yaml 可解析。
- manual links 可解析。
- 每个 source 有 id、name、source_type、language、tags、enabled。
- 每个 episode 有 id、title、source_name、episode_url 或 video_url。
- 每个 transcript 有 title、source_name、segments、full_text。
- 每个 timestamp 可生成跳转链接。
- `local_audio/` 在 `.gitignore`。
- 不提交 mp3、mp4、m4a、wav、webm 等大文件。
- search index 可生成。
- 没有 transcript 时页面显示 EmptyState，不报错。
- 有 transcript 时必须显示完整逐字稿，不得只显示摘要。

## 首个验收样例

已加入：

```text
https://youtu.be/P3KDebPTUrw?si=abkAhzMhiFwXZqhk
```

ID：

```text
lenny-openai-codex-andrew-ambrosino
```

状态：默认 `queued`。在未提供真实音频和真实 transcript JSON 前，站点只显示待转录卡片、原视频按钮、下载命令、转录命令，不会编造逐字稿；一旦 `data/transcripts/raw/` 和 `data/transcripts/cleaned/` 中出现真实转录 JSON，`npm run longform:build` 会生成完整逐字稿阅读页。

## 常见问题

### Whisper 太慢怎么办？

先用 `small` 或 `base` 跑通流程，再对重点视频使用 `medium` 或 `large-v3`。CPU 环境优先 `small`，GPU 环境可尝试 `medium` 或 `large-v3`。

### medium 和 large-v3 如何选择？

`medium` 更适合日常批量转录，速度和质量比较均衡；`large-v3` 更适合高价值内容、中文口音复杂内容或需要更高准确率的访谈。

### 中文视频如何转录？

```bash
python scripts/transcribe.py --episode-id xxx --audio local_audio/xxx.mp3 --model medium --language zh --output-dir data/transcripts/raw --formats json,txt,srt,vtt,md
```

### 没有字幕怎么办？

先用 `longform-download-local.mjs` 下载音频，再用本地 Whisper 转录。脚本不依赖官方字幕，也不会因为没有字幕而失败。

### 如何修正错误转录？

优先编辑 `data/transcripts/cleaned/{episode_id}.json`，保留 `segments[].start`、`segments[].end` 和 `segments[].index`，只修正 ASR 错词、重复、乱码，不把逐字稿改写成摘要，然后运行：

```bash
npm run longform:build
```

### 如何重新生成页面？

```bash
npm run longform:build
```

### 如何只处理某一个 episode？

下载和转录支持 `--episode-id`。页面构建默认批量处理所有 cleaned transcript；只要只放入一个 cleaned JSON，就只生成一个。

### 如何批量处理？

```bash
npm run longform:discover
npm run longform:queue
```

再按 `data/longform/queues/current.json` 中的命令逐条下载、转录，最后运行：

```bash
npm run longform:build
```

### 为什么不把音频提交仓库？

音频和视频文件体积大，会快速膨胀 Git 仓库，并且不利于静态站部署。项目只提交结构化 metadata、transcript、notes、search index 和页面内容；音频、模型缓存、下载缓存留在本地。

### 如何添加手动章节？

编辑或新增：

```text
data/longform/chapters/{episode_id}.json
```

然后重新生成页面：

```bash
npm run longform:transcript-page
npm run longform:notes
npm run longform:search
```

### 如果来源没有 feed 怎么办？

先在 YAML 中标记：

```yaml
discovery_status: needs_manual_url
crawl_strategy: manual
```

然后把具体视频或播客单集加入 `data/sources/manual_longform_links.yaml`。
