# DaoDao AI Guild（龍蝦騎士社區）

AI 落地社区 MVP。前后端分离：**Next.js 14（前端） + FastAPI（后端） + MySQL 8.0**，Docker Compose 单机部署。

- 需求文档：[docs/V1.0.md](docs/V1.0.md)
- 技术方案：[docs/TECH-DESIGN.md](docs/TECH-DESIGN.md)

## 目录结构

```
daostore-fde/
  api/          # FastAPI 后端
  web/          # Next.js 前端
  deploy/       # Nginx 配置
  docs/         # 需求与技术方案
  docker-compose.yml
  .gitlab-ci.yml
```

## 快速启动（Docker Compose）

```bash
# 1. 可选：配置环境变量
cp .env.example .env

# 2. 一键启动（首次会构建镜像 + 拉取 MySQL）
docker compose up -d --build

# 3. 查看日志
docker compose logs -f api
```

启动完成后：

- 前端：http://localhost
- 后端 API 文档（OpenAPI）：http://localhost/api/docs 或 http://localhost/api/v1/health
- 默认管理员账号：`admin` / `admin123`（**生产环境请立即修改**）

> 说明：api 容器启动时会自动执行 Alembic 迁移 + 幂等创建管理员账号（seed）。这是 MVP 便捷方案，后续应抽成独立 init job。

## 本地开发（不用 Docker）

### 后端

```bash
cd api
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env             # 修改 DATABASE_URL 指向本地 MySQL

alembic upgrade head
python scripts/seed_admin.py
uvicorn app.main:app --reload
```

### 前端

```bash
cd web
npm install
cp .env.example .env.local       # API_INTERNAL_URL=http://localhost:8000
npm run dev
```

## 测试

```bash
cd api
pytest -q
```

## CI

GitLab CI 流水线见 [.gitlab-ci.yml](.gitlab-ci.yml)：后端 `ruff` + `pytest`，前端 `npm run build`。

## 工程规范

- 后端：`ruff`（lint/format）+ `mypy`（类型）；分层 `api → services → repositories → models`
- 前端：TypeScript + Tailwind CSS；App Router
- 提交信息：Conventional Commits
- 数据库迁移：Alembic（禁止手改生产库）
