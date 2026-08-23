# DaoDao AI Guild（龍蝦騎士社區）技术方案

> 版本：v0.1（初稿）
> 状态：待评审
> 关联需求：[V1.0.md](./V1.0.md)
> 读者：开发执行者（AI），本文档作为施工蓝图，追求可执行、可落地、可迭代。

---

## 1. 概述与目标

### 1.1 项目背景

DaoStore 长期目标是打造 AI FDE（Field Digital Engineer）生态平台，连接 AI 解决方案提供方、FDE/龍蝦騎士、企业需求方。当前 DaoStore 开发周期较长，第一阶段先建立 **DaoDao AI Guild（龍蝦騎士社区）**，通过社区聚集 AI 实战人才、沉淀 AI 落地案例、形成 FDE 能力库。

### 1.2 产品定位

> 一个由 AI 实战专家、FDE、开发者共同打造的 AI 落地社区。

用户不是「会员」，而是「正在成长的 AI 骑士」。世界观以「龍蝦」为核心意象贯穿产品。

### 1.3 MVP 边界

**必须支持（V1 范围）：**

- 用户登录（管理员预置账号，**无自助注册**）
- 个人页面
- 发布问题 / 回答问题
- 教程发布
- 图片 / 视频 / 文件上传
- 标签分类
- 点赞 / 收藏
- 骑士等级

**暂不开发：**

- Coin 交易、自动部署、Marketplace、复杂权限、商业合同

### 1.4 成功指标（第一阶段 3 个月）

500 名社区用户、50 名活跃骑士、100 篇教程、50 个实战案例、10 个可沉淀 Solution。

### 1.5 本文档范围

本文档定义系统架构、技术选型、数据模型、API 规范、认证权限、前端架构、核心模块、部署方案、工程质量与实施计划。**不包含**具体代码实现。

---

## 2. 技术选型

### 2.1 选型总览

| 层 | 选型 | 版本 | 说明 |
|---|---|---|---|
| 后端框架 | FastAPI | ≥0.115 | 异步 API、Pydantic 校验、自动 OpenAPI |
| 语言 | Python | 3.11 | 类型注解 + 生态成熟 |
| ORM | SQLAlchemy | 2.0 | 异步引擎 + 声明式模型 |
| 迁移 | Alembic | ≥1.13 | 数据库版本管理 |
| MySQL 驱动 | asyncmy | ≥0.2 | 异步 MySQL 驱动 |
| 数据库 | MySQL | 8.0 | 与公司 DaoWord 一致 |
| 认证 | PyJWT + bcrypt | — | 无状态 JWT + 密码哈希 |
| 前端框架 | Next.js | 14（App Router） | SSR/SEO + React 生态 |
| 前端语言 | TypeScript | 5.x | 类型安全 |
| 样式 | Tailwind CSS | ≥3.4 | 原子化 CSS |
| 服务端状态 | TanStack Query | ≥5 | 客户端数据获取与缓存 |
| Markdown | react-markdown + remark-gfm + rehype-highlight | — | 教程/回答富文本渲染 |
| 反向代理 | Nginx | 1.25 | 静态文件 + 反向代理 |
| 部署 | Docker Compose | v2 | 单机编排，预留 K8s 迁移 |

### 2.2 选型理由（关键决策）

1. **前后端分离**：Next.js（SSR）负责页面渲染与 SEO；FastAPI 提供纯 JSON API。两者通过 OpenAPI 契约解耦，可独立部署、独立迭代。
2. **FastAPI 而非 Django/Flask**：异步 I/O 更适合「大量读为主的社区场景」；Pydantic 自动校验与 OpenAPI 自动生成，直接驱动前端类型生成，减少前后端联调成本；代码显式，长期迭代易保持整洁。
3. **MySQL 而非 PostgreSQL**：与公司 DaoWord（Laravel + MySQL）保持同一运维基线，降低运维与 DBA 成本。代价是全文搜索与 JSON 能力弱于 PG，MVP 阶段用 MySQL 全文索引兜底，后续可平滑接入 Elasticsearch/Meilisearch（见 §8.7）。
4. **异步 SQLAlchemy 而非同步**：与 FastAPI 异步路由匹配，避免线程池阻塞。若 `asyncmy` 在特定环境不稳定，降级方案为同步 SQLAlchemy + pymysql（FastAPI 对 `def` 端点自动跑线程池），接口层无需改动。
5. **JWT 而非服务端 Session**：前后端分离 + 单机起步，JWT 免去 Session 存储与粘性会话，横向扩展时无状态。安全权衡见 §6。

---

## 3. 系统架构

### 3.1 总体架构（前后端分离）

```
                          ┌─────────────────────────────┐
                          │         浏览器 / 客户端       │
                          └──────────────┬──────────────┘
                                         │ HTTPS
                          ┌──────────────▼──────────────┐
                          │        Nginx (反向代理)       │
                          │  /            → web (Next.js) │
                          │  /api/v1/*    → api (FastAPI) │
                          │  /media/*     → 静态文件(上传) │
                          └───────┬──────────────┬───────┘
                                  │              │
                  ┌───────────────▼───┐   ┌──────▼───────────────┐
                  │  web (Next.js)     │   │  api (FastAPI)       │
                  │  SSR 页面 + API 客户端│   │  Router → Service  │
                  │  服务端渲染/SEO     │   │   → Repository → ORM │
                  └───────────────────┘   └──────┬───────────────┘
                                                 │
                                  ┌──────────────▼───────────────┐
                                  │        MySQL 8.0             │
                                  └──────────────────────────────┘
                                  ┌──────────────────────────────┐
                                  │  文件存储卷 (上传图片/视频/log) │
                                  └──────────────────────────────┘
```

### 3.2 后端分层

```
app/
  api/            # 路由层：HTTP 入口，参数校验、鉴权、响应封装
    deps.py       # 依赖注入（当前用户、分页、权限）
  services/       # 业务逻辑层：用例编排、事务边界
  repositories/   # 数据访问层：SQLAlchemy 查询封装
  models/         # ORM 模型（表结构）
  schemas/        # Pydantic 请求/响应模型
  core/           # 配置、安全、日志、异常处理
  migrations/     # Alembic 迁移
  main.py         # 应用工厂与路由注册
```

分层原则：**路由层不写业务**，**业务层不直接拼 SQL**（通过 repository），**模型层只描述结构**。单向依赖：`api → services → repositories → models`。

### 3.3 部署拓扑（Docker Compose）

| 服务 | 镜像/构建 | 职责 | 端口映射 |
|---|---|---|---|
| nginx | nginx:1.25-alpine | 反向代理、静态文件、HTTPS 终结 | 80/443 → 宿主 |
| web | 自建（node） | Next.js SSR | 内部 3000 |
| api | 自建（python） | FastAPI | 内部 8000 |
| db | mysql:8.0 | 数据库 | 内部 3306（不暴露宿主） |

数据卷：`db_data`（MySQL 数据）、`media_data`（上传文件）。仅 nginx 暴露宿主端口，其余服务走内部网络。

---

## 4. 数据模型设计

> 命名约定：表名复数 snake_case；主键 `id` BIGINT UNSIGNED 自增；时间戳 `created_at` / `updated_at`（UTC）；软删除用 `deleted_at`（可空）。

### 4.1 核心实体与关系

```
users ─┬─< questions ──< answers
       ├─< tutorials
       ├─< solutions
       ├─< missions (发布)
       └─< attachments (上传者)

tags  >─< taggables (多态：question/tutorial/solution)

users ──< votes     (多态：question/answer/tutorial/solution)
users ──< favorites (多态)
```

### 4.2 表结构要点

**users（用户/骑士）**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | |
| username | VARCHAR(64) UNIQUE | 登录名 |
| password_hash | VARCHAR(255) | bcrypt |
| display_name | VARCHAR(64) | 展示名 |
| avatar_url | VARCHAR(512) | 头像 |
| bio | TEXT | 简介 |
| level | TINYINT | 1–5（小龍蝦→龍蝦領主） |
| reputation | INT | 声望值 |
| is_admin | BOOL | 管理员（可预置账号） |
| is_active | BOOL | 禁用开关 |
| created_at / updated_at | DATETIME | |

**questions（问题）**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | |
| author_id | BIGINT FK→users | |
| title | VARCHAR(255) | 标题 |
| description | TEXT | 问题描述 |
| scenario | VARCHAR(255) | 使用场景 |
| tools | JSON | 使用工具列表 |
| error_info | TEXT | 错误信息 |
| status | ENUM | open / resolved / closed |
| view_count | INT | 浏览数 |
| created_at / updated_at | DATETIME | |

索引：`author_id`、`status`、`created_at`。

**answers（回答）**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | |
| question_id | BIGINT FK→questions | |
| author_id | BIGINT FK→users | |
| content | TEXT | Markdown 正文 |
| is_accepted | BOOL | 是否被采纳 |
| created_at / updated_at | DATETIME | |

索引：`question_id`、`author_id`。

**tutorials（教程）**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | |
| author_id | BIGINT FK→users | |
| title | VARCHAR(255) | |
| type | ENUM | text / video / case（实战案例） |
| content | MEDIUMTEXT | Markdown |
| category | ENUM | ai_coding / agent_workshop / enterprise_ai / ai_infra |
| cover_url | VARCHAR(512) | 封面 |
| status | ENUM | draft / published |
| created_at / updated_at | DATETIME | |

索引：`type`、`category`、`author_id`。

**solutions（Solution）**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | |
| author_id | BIGINT FK→users | |
| title | VARCHAR(255) | |
| background / problem / solution / architecture / deployment / effect | TEXT | 六段式 |
| status | ENUM | draft / published |
| created_at / updated_at | DATETIME | |

**missions（任务大厅）**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | |
| title | VARCHAR(255) | 任务名称 |
| description | TEXT | 问题描述 |
| tech_requirements | JSON | 技术要求 |
| difficulty | ENUM | easy / medium / hard |
| reward | VARCHAR(255) | 预估奖励 |
| status | ENUM | open / in_progress / delivered / closed |
| creator_id | BIGINT FK→users | 发布者 |
| assignee_id | BIGINT FK→users NULL | 接单骑士 |
| created_at / updated_at | DATETIME | |

**tags + taggables（标签，多态）**

| 表 | 字段 | 说明 |
|---|---|---|
| tags | id, name UNIQUE, slug UNIQUE | 标签 |
| taggables | tag_id, target_type, target_id | 多态关联 |

**votes / favorites（点赞 / 收藏，多态）**

| 表 | 字段 | 说明 |
|---|---|---|
| votes | user_id, target_type, target_id, value(1/-1), UNIQUE(user_id,target_type,target_id) | 点赞 |
| favorites | user_id, target_type, target_id, UNIQUE(...) | 收藏 |

**attachments（附件/媒体）**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | |
| uploader_id | BIGINT FK→users | |
| kind | ENUM | image / video / file / log |
| url | VARCHAR(512) | 存储路径 |
| size | BIGINT | 字节 |
| mime_type | VARCHAR(128) | |
| target_type / target_id | 可空 | 关联内容 |
| created_at | DATETIME | |

### 4.3 设计说明

- **多态点赞/收藏**：用 `target_type + target_id` 而非多张表，减少表数量，代价是牺牲外键约束（在应用层校验）。
- **等级（level）落在 users 上**，等级规则（Lv1–Lv5）作为**代码常量/配置**而非独立表，MVP 阶段避免过度设计；若后续规则复杂再抽表。
- **声望（reputation）为冗余累计字段**，由服务层在点赞/采纳/发布等事件时原子增减；不另建流水表（MVP），需要审计时再加。
- **软删除**：内容类表加 `deleted_at`，删除即标记，保留数据可追溯。

---

## 5. API 设计规范

### 5.1 基本约定

- 前缀：`/api/v1`
- 资源路径用复数名词：`/api/v1/questions`、`/api/v1/users/{id}`
- 字段命名：请求/响应统一 **snake_case**（后端原生），前端 TS 类型由 OpenAPI 生成，避免手写。
- 方法语义：GET 读、POST 创建、PUT/PATCH 更新、DELETE 删除。
- 认证：需要登录的接口带 `Authorization: Bearer <access_token>`。

### 5.2 统一响应格式

```json
// 成功
{ "code": 0, "message": "ok", "data": { } }

// 失败
{ "code": 40101, "message": "未登录或令牌已过期", "data": null }
```

- `code = 0` 恒为成功；非 0 为业务错误码。
- HTTP 状态码与 `code` 配合：语义错误仍返回 200 + 业务码，或直接返回 4xx/5xx + 业务码。**本方案约定：一律返回 200 + 业务码**，便于前端统一处理（错误码段见下）。

### 5.3 错误码段

| 段 | 含义 | 示例 |
|---|---|---|
| 0 | 成功 | 0 |
| 40xxx | 通用/校验 | 40001 参数错误、40002 资源不存在 |
| 41xxx | 认证 | 41001 未登录、41002 令牌过期 |
| 42xxx | 权限 | 42001 无权限、42002 等级不足 |
| 50xxx | 业务规则 | 50001 已点过赞、50002 已收藏 |

### 5.4 分页

请求：`?page=1&page_size=20`（`page_size` 上限 100）。

响应：

```json
{
  "code": 0, "message": "ok",
  "data": {
    "items": [ ... ],
    "total": 128,
    "page": 1,
    "page_size": 20
  }
}
```

### 5.5 资源接口清单（v1）

| 方法 | 路径 | 说明 | 认证 |
|---|---|---|---|
| POST | /api/v1/auth/login | 登录，返回 token | 否 |
| GET | /api/v1/auth/me | 当前用户信息 | 是 |
| GET | /api/v1/users/{id} | 个人页（含统计） | 否 |
| GET | /api/v1/questions | 问题列表（筛选/标签/分页） | 否 |
| POST | /api/v1/questions | 发布问题 | 是 |
| GET | /api/v1/questions/{id} | 问题详情 | 否 |
| POST | /api/v1/questions/{id}/answers | 回答问题 | 是 |
| POST | /api/v1/questions/{id}/accept | 采纳回答 | 是（作者） |
| POST | /api/v1/answers/{id}/vote | 点赞/取消 | 是 |
| POST | /api/v1/answers/{id}/favorite | 收藏/取消 | 是 |
| GET/POST | /api/v1/tutorials | 教程列表 / 发布 | GET 否 / POST 是 |
| GET | /api/v1/tutorials/{id} | 教程详情 | 否 |
| GET/POST | /api/v1/solutions | Solution 列表 / 发布 | 同上 |
| GET/POST | /api/v1/missions | 任务列表 / 发布 | 同上 |
| POST | /api/v1/missions/{id}/take | 接单 | 是（Lv3+） |
| GET | /api/v1/tags | 标签列表 | 否 |
| POST | /api/v1/uploads | 上传文件（返回 url） | 是 |
| GET | /api/v1/leaderboard | 骑士排行榜 | 否 |

> 完整接口以 FastAPI 自动生成的 OpenAPI 为准；上表为 v1 骨架。

---

## 6. 认证与权限

### 6.1 账号体系

- **无自助注册**。账号由管理员通过**预置脚本（seed 命令）或后台页面**创建，初始密码下发后首次登录强制改密（可选，MVP 可省）。
- 账号字段：`username` + `password_hash`（bcrypt）。

### 6.2 登录流程

```
用户提交 username + password
  → 后端校验 bcrypt
  → 签发 access_token（JWT，有效期 2h）
  → 返回 { access_token, user }
```

- 令牌载荷：`{ sub: user_id, username, exp, iat }`。
- 前端存储：**httpOnly Cookie**（由 Next.js 服务端中转写入）优于 localStorage，降低 XSS 窃取风险；MVP 若实现成本高，可先用 localStorage + 短有效期 token，标注为待加固项。

### 6.3 权限模型

**角色（2 类）：**

- `is_admin=true`：管理员，可预置账号、删内容、管理任务。
- 普通用户（骑士）：默认角色。

**等级权限（Lv1–Lv5）控制能力：**

| 等级 | 能力 |
|---|---|
| Lv1 小龍蝦 | 完成登录、发布内容 |
| Lv2 銅鉗騎士 | 回答问题、发布教程 |
| Lv3 銀鉗騎士 | 认证技能、接任务 |
| Lv4 黃金騎士 | 企业交付、发布 Solution |
| Lv5 龍蝦領主 | 生态专家、社区导师 |

实现：`require_level(min_level)` 权限依赖注入，在路由层校验，业务层不重复判断。

### 6.4 中间件与依赖注入

- `get_current_user`：解析 JWT → 查库 → 注入 `current_user`。
- `require_admin` / `require_level(n)`：在 `get_current_user` 之上叠加。
- 未登录访问受保护接口 → `41001`；等级不足 → `42002`。

---

## 7. 前端架构

### 7.1 目录结构

```
web/
  app/                      # Next.js App Router
    (public)/               # 公开页面组
      page.tsx              # 首页
      questions/page.tsx
      questions/[id]/page.tsx
      tutorials/page.tsx
      tutorials/[id]/page.tsx
      solutions/page.tsx
      missions/page.tsx
      users/[id]/page.tsx
    (auth)/login/page.tsx
    admin/page.tsx
  components/               # 通用组件（Button、Card、Editor…）
  features/                 # 按业务域拆分的组件（question/、tutorial/…）
  lib/                      # API 客户端、鉴权、工具
    api/                    # 由 OpenAPI 生成的类型 + fetch 封装
    auth.ts
  hooks/                    # 自定义 hooks
  types/                    # 全局类型
  public/                   # 静态资源
```

### 7.2 渲染策略（SSR/CSR 取舍）

| 页面 | 策略 | 理由 |
|---|---|---|
| 首页、问题/教程/Solution 列表与详情 | SSR | 社区内容需 SEO |
| 个人页 | SSR（可增量） | 公开资料页 |
| 登录页 | CSR | 无 SEO 需求 |
| 发帖/发问/上传表单、点赞收藏 | CSR | 登录态交互 |

- 列表/详情页用 **Server Components + fetch** 直连后端；点赞/收藏等交互用 **TanStack Query**（客户端）做乐观更新。
- 类型安全：后端 OpenAPI → `openapi-typescript` 生成 TS 类型，前端用 `openapi-fetch` 做类型化请求，杜绝手写接口类型。

### 7.3 状态管理

- **服务端状态**（数据获取/缓存）：TanStack Query。
- **全局 UI 状态**（登录态、弹窗）：Zustand（轻量，替代 Context 重渲染）。
- **表单**：react-hook-form + zod（与后端 Pydantic 校验对齐）。

### 7.4 富文本

教程/回答正文用 Markdown 存储，前端 `react-markdown` + `remark-gfm` + `rehype-highlight` 渲染，编辑器用轻量 Markdown 编辑器（如 `@uiw/react-md-editor`）。

---

## 8. 核心模块设计

### 8.1 首页（Guild Hall）

- Hero 区：龍蝦骑士形象 + 定位文案「发现問題，召喚騎士」+ 「发布问题」「探索教程」入口。
- 信息区：最新问题、热门教程、最新 Solution、骑士排行榜、任务大厅入口。
- 数据来源：5 个聚合接口（可合并为一个 `/api/v1/home` 聚合接口减少请求）。

### 8.2 问题社区（Quest Board）

- 发布问题：标题 + 描述 + 使用场景 + 使用工具 + 错误信息 + 附件（图/文件/视频/log）。
- 回答：文字 + 图片 + 视频 + 配置文件 + Demo（统一走 Markdown + 附件）。
- 采纳机制：问题作者可采纳回答（`is_accepted`），采纳后问题置 `resolved`，回答者加声望。
- 状态流转：`open → resolved → closed`。

### 8.3 龍蝦学院（Learning Hub）

- 教程类型：文字（Markdown）/ 视频（上传 + Demo）/ 实战案例（六段式固定格式）。
- 分类归属：见 §8.4 技术分区。

### 8.4 技术分区（内容分类）

四大板块作为 `tutorials.category` 枚举 + 标签体系：

| 板块 | 内容 |
|---|---|
| AI Coding | Claude Code、Cursor、Windsurf、Copilot、Cline、Roo Code、Aider、AI Debug、AI Testing |
| Agent 工坊 | LangGraph、CrewAI、AutoGen、LlamaIndex、Semantic Kernel / Dify、Flowise、n8n、Coze、FastGPT、Langflow / OpenClaw、Hermes、Mem0、Letta |
| 企业 AI 应用 | 企业微信/飞书 Agent、Slack Bot、HR/财务/CRM/数据分析 Agent |
| AI Infra | Docker、K8s、GPU、Ollama、vLLM、模型部署、API Gateway、Monitoring |

### 8.5 龍蝦任务大厅（Mission Board）

- 任务字段：名称、描述、技术要求、难度、预估奖励、状态。
- 流程：发布 → 骑士接单（Lv3+）→ 交付 → 案例沉淀 → Solution 进入 DaoStore。
- 状态机：`open → in_progress → delivered → closed`。

### 8.6 骑士身份系统

- 身份卡：名称、等级、专长、解决问题数、发布教程数、声望。
- 等级：Lv1–Lv5（见 §6.3），升级规则在服务层统一计算。
- 排行榜：`/api/v1/leaderboard` 按声望倒序（Top 骑士 / 热门作者 / 最佳 Solution）。

### 8.7 文件上传与存储

- 支持：图片（jpg/png/webp/gif）、视频（mp4）、文件、log 文本。
- **MVP 存储**：本地卷 `media_data`，Nginx `/media/*` 直接静态服务。
- 上传流程：`POST /api/v1/uploads` → 校验类型/大小 → 落盘（按 `yyyy/mm/uuid.ext`）→ 写 `attachments` 记录 → 返回 url。
- **预留扩展**：定义 `StorageBackend` 接口（`put/get/delete/url`），本地实现 + 未来 OSS/S3 实现，切换不改业务代码。
- 约束：图片单张 ≤10MB，视频 ≤200MB（MVP），后续接对象存储 + 转码（异步任务，需引入队列）。

### 8.8 搜索

- **MVP**：MySQL 全文索引（`FULLTEXT` 于 question.title/description、tutorial.title/content）+ `LIKE` 兜底，按相关度排序。
- **演进**：内容量上来后接入 Meilisearch（轻量、中文友好）或 Elasticsearch，独立服务加入 Compose，通过 `SearchBackend` 接口替换，业务层无感。

---

## 9. 部署方案

### 9.1 Docker Compose 编排（示意）

```yaml
services:
  nginx:
    image: nginx:1.25-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./deploy/nginx.conf:/etc/nginx/conf.d/default.conf
      - media_data:/media:ro
    depends_on: [web, api]

  web:
    build: ./web
    environment: [NEXT_PUBLIC_API_BASE_URL=/api/v1]
    depends_on: [api]

  api:
    build: ./api
    environment: [DATABASE_URL, JWT_SECRET, ...]
    volumes: [media_data:/media]
    depends_on: [db]

  db:
    image: mysql:8.0
    environment: [MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD]
    volumes: [db_data:/var/lib/mysql]
    # 不映射宿主端口

volumes:
  db_data: {}
  media_data: {}
```

### 9.2 镜像构建

- 后端多阶段：`python:3.12-slim` → 安装依赖（`pip install -r requirements.txt`）→ 运行时镜像，非 root 用户运行。
- 前端多阶段：`node:20-alpine` 构建（`next build`）→ `node:20-alpine` 运行 `next start`（standalone 模式可选，减小镜像）。

### 9.3 环境变量管理

- 用 `.env` + `docker-compose.yml` 注入；敏感项（`JWT_SECRET`、`MYSQL_PASSWORD`）不进 Git，提供 `.env.example`。
- 后端用 `pydantic-settings` 集中读取校验，缺失即启动失败（fail-fast）。

### 9.4 数据备份

- MySQL：`mysqldump` 定时任务（宿主机 cron / 或独立 backup 容器），每日全量 + 保留 N 天。
- 媒体文件：`media_data` 卷定期 tar 或同步到对象存储。

### 9.5 HTTPS 与域名

- 起步 HTTP；上线前用 certbot 签发证书（Nginx 层终结 TLS）。

---

## 10. 工程质量与可持续迭代

> 目标：不是「能跑」，而是「可长期、低心智负担地迭代」。

### 10.1 代码规范

- 后端：`ruff`（lint + format）+ `mypy`（类型检查）。
- 前端：ESLint + Prettier。
- 提交信息：Conventional Commits（`feat/fix/refactor/docs/...`），单开发者亦保持，便于回溯。

### 10.2 测试

- 后端：`pytest` 单元测试（services）+ 集成测试（API 层，`httpx` + 测试数据库）。
- 前端：组件测试（Jest + React Testing Library）+ E2E（Playwright，核心流程：登录 → 发问 → 回答 → 点赞）。
- 目标：核心业务（认证、发布/回答、点赞收藏、等级计算）覆盖率 ≥ 80%。

### 10.3 CI/CD

- 平台：GitLab CI。
- 流水线：`lint → typecheck → test → build → (手动) deploy`。
- 部署：`docker compose pull && up -d`，或经 registry 推送镜像后目标机拉取。

### 10.4 数据库迁移

- Alembic 管理所有 schema 变更，`upgrade/downgrade` 成对提供；**禁止手改生产库**。

### 10.5 日志与可观测性

- 后端结构化日志（JSON），含 `request_id`、`user_id`、耗时；全局异常处理器统一捕获。
- 健康检查：`GET /api/v1/health`（返回 db 连接状态），供 Nginx/监控探活。
- 演进：接入 Sentry（错误追踪）+ Prometheus/Grafana（指标），MVP 可选。

### 10.6 配置与 12-factor

- 配置与代码分离，环境注入；无状态 API（JWT）为横向扩展留余地。

### 10.7 文档

- README（快速上手）、API 文档（OpenAPI 自动生成 + 手动补充说明）、部署文档（本文档 §9）。

---

## 11. 分阶段实施计划

> 里程碑可调整；每阶段结束即为一个可部署、可演示的增量。

| 阶段 | 内容 | 交付物 |
|---|---|---|
| **P0 脚手架** | 前后端初始化、Docker Compose、CI、Alembic、健康检查 | 可一键启动的空系统 |
| **P1 认证与用户** | 管理员预置账号、登录、JWT、个人页骨架 | 登录/登出/个人页可用 |
| **P2 问题社区** | 发问、回答、标签、点赞收藏、采纳 | 社区核心闭环 |
| **P3 龍蝦学院** | 教程发布（文字/案例）、Markdown 渲染、技术分区 | 内容沉淀能力 |
| **P4 身份系统** | 等级、声望、排行榜 | 成长激励闭环 |
| **P5 任务大厅** | 任务发布/接单/状态流转（MVP 简化） | 企业需求入口 |
| **P6 媒体与搜索** | 文件/视频上传、全文搜索、Solution 发布 | 补全 MVP 剩余项 |

依赖关系：P0 → P1 → P2 为强依赖主线；P3/P4 可与 P2 并行；P5/P6 收尾。

---

## 12. 风险与开放问题

| # | 事项 | 影响 | 决策建议 |
|---|---|---|---|
| 1 | CI 平台 | 影响 §10.3 落地 | 与现有基础设施对齐，MVP 选 GitLab CI |
| 2 | 对象存储 | 视频/大文件成本与扩展 | MVP 用本地卷 + `StorageBackend` 接口，预留 OSS |
| 3 | JWT 存储方式（httpOnly Cookie vs localStorage） | XSS 风险 | 优先 httpOnly Cookie，MVP 可暂用 localStorage 并标注 |
| 4 | 异步 MySQL 驱动稳定性（asyncmy） | 运行时可靠性 | 预研失败则回退同步 pymysql |
| 5 | 「管理员预置账号」后台形态 | 是否需要独立后台 UI | MVP 用 seed 脚本 + 简单管理页 |
| 6 | 内容审核 / 敏感词 | 社区合规 | 后续阶段，接入审核或第三方 |
| 7 | 搜索方案切换（MySQL 全文 → Meilisearch/ES） | 检索体验 | 抽象 `SearchBackend` 接口 |
| 8 | 单机扩展路径（→ K8s） | 长期容量 | 保持无状态 + 外部化存储，迁移成本可控 |
| 9 | 与 DaoStore 的数据打通（Solution 导出） | 生态闭环 | 定义 Solution 导出格式/接口，后续对接 |

---

## 附：本文档待确认清单

1. 时间线（MVP 期望多久上线，用于调整 §11 里程碑）。

> 已确认：CI 平台 = GitLab CI；对象存储 = 本地卷（`StorageBackend` 接口预留 OSS/S3）。
