# Source Policy

x_signal_source 的定位是“公开入口索引 + 高信号内容筛选”，不是全文转载库，也不是绕过平台限制的抓取器。

## 合规边界

- 不使用 X paid API。
- 不使用任何需要付费 token 的第三方数据 API。
- 不绕过登录墙、验证码、Cloudflare、人机验证、付费墙、robots/rate limit 或平台限制。
- 不保存受版权保护文章的完整正文；仅保存标题、摘要、短摘录、元数据、原始链接与本站生成的评论。
- 对 X Article、X post、Thread 的处理以“发现入口”和“来源索引”为主。
- 如果公开页面无法稳定访问，只记录链接、标题、作者、来源、fetch_status 与失败原因。
- 事实性内容优先回链官方公告、公司博客、论文、GitHub、文档、公开访谈、媒体原文或作者公开页面。

## 来源优先级

1. 官方机构、公司博客、研究页、文档、GitHub release。
2. 创始人、高管、研究负责人、产品负责人、开源维护者的一手公开表达。
3. 论文、OpenReview、arXiv、Papers with Code、Hugging Face Papers。
4. 顶级 VC、长期可信技术记者、深度播客与产品/创业长期作者。
5. 社区热榜与讨论区只作为趋势发现，不作为事实确认的唯一证据。

## X 使用方式

- X 不作为强制抓取源，不强行抓取 Article 全文。
- 保存 X 主页、公开 post、人工维护 Article/Thread 链接和外部文章中引用的 X 链接。
- 能公开访问时只提取标题、OG、描述、canonical URL、发布时间等轻量元数据。
- 不模拟登录，不批量高频请求，不规避风控。

## 去重原则

每期发布前读取 `data/archive/used_items.json`，对 canonical_url、dedupe_key、title hash、cluster_id 进行排重。旧内容可作为背景来源，但不得重复进入最新一期 selected。

## 首期兜底

第一次运行时，如果无法从公开来源抓取足够新内容，允许生成“初始来源索引 issue”，但必须明确标注它不是新闻抓取结果，不得将 mock 内容伪装为真实新闻。