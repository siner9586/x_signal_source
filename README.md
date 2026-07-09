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
3. 长内容转录优先使用公开视频字幕/自动字幕；字幕不可用时使用免费开源 ASR：`faster-whisper` 优先，`openai-whisper` 可作为本地备用。
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

长内容来源均应设置：

```yaml
daily_signal_enabled: false
```

`daily` pipeline 会跳过这类来源，避免 Podcast / YouTube / 长访谈来源污染原每日信号抓取。

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
3. 支持 GitHub Actions 云端自动转录：字幕优先，Whisper 兜底。
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

local_audio/        # 临时音频/字幕下载目录，不提交 Git
model_cache/        # 模型缓存，不提交 Git
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
  source_id: lennys-podcast
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

## 自动转录与更新

当前推荐方案：**GitHub Actions 自动转录**。

文件：

```text
.github/workflows/longform.yml
scripts/longform-auto-transcribe.mjs
scripts/transcribe.py
```

定时：北京时间 / 台北时间每天 07:42 自动触发。

自动流程：

```text
checkout
→ setup node
→ setup python
→ install ffmpeg
→ install yt-dlp + faster-whisper
→ npm run longform:discover
→ npm run longform:queue
→ npm run longform:auto-transcribe
→ npm run longform:queue
→ npm run longform:build
→ npm run longform:qa
→ npm run build
→ commit & push
```

自动转录策略：

```text
1. 优先用 yt-dlp 抓取公开视频字幕 / 自动字幕。
2. 若字幕存在：直接将 VTT 转为 data/transcripts/raw/{episode_id}.json。
3. 若字幕不存在：下载音频到 local_audio/，再用 faster-whisper 免费开源转录。
4. 清洗、分章、学习笔记、完整逐字稿页面和搜索索引随后自动生成。
5. 音频、字幕临时文件、模型缓存不会提交到 Git。
```

默认每次只处理 1 条 queued episode，避免 GitHub-hosted runner 超时或资源消耗过大：

```text
LONGFORM_AUTO_TRANSCRIBE_ITEMS=1
LONGFORM_WHISPER_MODEL=base
LONGFORM_WHISPER_DEVICE=cpu
LONGFORM_WHISPER_COMPUTE_TYPE=int8
```

也可以在 GitHub Actions 页面手动运行 `Longform Podcast Signals`，设置：

```text
run_transcription=true
max_items=1
whisper_model=base / small / medium
```

## 手动命令备用

即使不用本地，也保留命令方便调试。

发现内容：

```bash
npm run longform:discover
```

查看队列：

```bash
npm run longform:queue
```

云端/本地自动转录当前队列：

```bash
npm run longform:auto-transcribe
```

清洗、章节、页面生成：

```bash
npm run longform:build
```

本地预览：

```bash
npm run dev
```

访问：

```text
http://localhost:4321/podcasts/
http://localhost:4321/transcripts/
```

构建：

```bash
npm run build
```

## 新增命令

```bash
npm run longform:discover
npm run longform:normalize
npm run longform:queue
npm run longform:auto-transcribe
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

Daily 主流程：

```text
.github/workflows/daily.yml
```

Longform 自动转录与页面生成：

```text
.github/workflows/longform.yml
```

`longform.yml` 默认每天自动跑：

```text
longform:discover → longform:queue → longform:auto-transcribe → longform:build → longform:qa → build
```

如果字幕可用，通常不需要 Whisper；如果字幕不可用，才会走 `faster-whisper` CPU 兜底。

## QA 检查

`npm run qa` 检查 daily 主流程。

`npm run longform:qa` 检查 longform 模块：

- sources yaml 可解析。
- manual links 可解析。
- 每个 source 有 id、name、source_type、language、tags、enabled。
- 每个 episode 有 id、title、source_name、episode_url 或 video_url。
- 自动转录脚本存在。
- `longform.yml` 已接入 `yt-dlp`、`faster-whisper`、`npm run longform:auto-transcribe`。
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

明天的 `Longform Podcast Signals` workflow 会自动尝试处理该队列条目：先抓字幕；若无字幕，再下载音频并用 `faster-whisper` 转录。成功后会自动生成 raw transcript、cleaned transcript、学习笔记、完整阅读页与全文搜索索引。

## 可选替代方案比较

### GitHub Actions

优点：无需本地机器、无需额外服务器、已和仓库提交部署天然集成、免费额度足够小批量字幕/轻量转录。

缺点：CPU 转录长视频可能慢；公开平台下载偶尔受网络、地区或平台限制影响。

### Self-hosted runner

优点：最稳定、可用你自己的 Mac mini / 云主机 / GPU 机器跑 Whisper，速度更快，可持久缓存模型。

缺点：需要维护机器，仍然属于“有一台长期在线的执行环境”。

### 低价云服务器 / GPU worker

优点：可控、速度更快、适合批量转录。

缺点：不是零成本，需要部署、密钥、存储和运维。

### Hugging Face Spaces / Modal / RunPod / Fly / Render

优点：适合把转录服务拆出去。

缺点：免费额度、休眠、资源限制或计费策略不稳定；还要处理仓库回写、队列、失败重试与密钥。

综合当前目标：**不想本地执行、尽量零成本、直接自动更新站点**，优先使用 GitHub Actions 是最合适的方案。

## 常见问题

### Whisper 太慢怎么办？

默认云端使用 `base` + `cpu` + `int8` 兜底。若字幕可用，不走 Whisper。若你后续使用 self-hosted runner 或 GPU，可把 `whisper_model` 改成 `small`、`medium` 或 `large-v3`。

### 没有字幕怎么办？

`longform-auto-transcribe.mjs` 会下载音频并调用 `faster-whisper` 兜底，不需要你本地下载。

### 中文视频如何转录？

默认字幕语言包含：

```text
en.*,en,zh.*,zh-Hans,zh-Hant,zh
```

Whisper 兜底默认 `language=auto`，会自动识别。

### 如何修正错误转录？

优先编辑 `data/transcripts/cleaned/{episode_id}.json`，保留 `segments[].start`、`segments[].end` 和 `segments[].index`，只修正 ASR 错词、重复、乱码，不把逐字稿改写成摘要，然后运行：

```bash
npm run longform:build
```

### 为什么不把音频提交仓库？

音频和视频文件体积大，会快速膨胀 Git 仓库，并且不利于静态站部署。项目只提交结构化 metadata、transcript、notes、search index 和页面内容；音频、模型缓存、下载缓存只作为 workflow 临时文件存在。

### 如果来源没有 feed 怎么办？

先在 YAML 中标记：

```yaml
discovery_status: needs_manual_url
crawl_strategy: manual
```

然后把具体视频或播客单集加入 `data/sources/manual_longform_links.yaml`。
