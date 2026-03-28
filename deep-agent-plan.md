# Deep Agent 项目落地规划文档

> **方案 A：尽可能复用官方能力**
>
> 本文档面向 Deep Agent 项目落地开发，基于官方 `deepagents` 包构建，优先复用官方与生态能力，最大限度减少自研工作量。

---

## 目录

1. [项目目标与范围](#1-项目目标与范围)
2. [技术选型](#2-技术选型)
3. [目录结构规划](#3-目录结构规划)
4. [分阶段实施计划](#4-分阶段实施计划)
5. [功能页面规划](#5-功能页面规划)
6. [依赖与环境变量](#6-依赖与环境变量)
7. [风险与约束](#7-风险与约束)

---

## 1. 项目目标与范围

### 1.1 项目目标

基于阿里云官方 `deepagents` 包，构建一套可本地运行、支持多应用场景的 Deep Agent 应用平台。目标是：

- 复用官方 `deepagents` 提供的 Agent 流程编排、工具调用、记忆管理等能力；
- 减少底层 Agent 框架自研，聚焦业务场景与集成层开发；
- 在 Windows + Docker Desktop 环境下可快速启动与演示。

### 1.2 保留的应用场景

| 场景 | 描述 | 优先级 |
|------|------|--------|
| **知识库问答** | 基于 Milvus 向量检索 + 通义千问模型，支持文档上传与语义问答 | P0（首版） |
| **代码助手** | 利用模型代码能力，支持代码生成、解释与调试 | P0（首版） |
| **数据分析** | 上传结构化数据，借助 Agent 工具链完成分析与图表生成 | P1（首版后期） |
| **通用多工具工作流** | 支持用户自定义工具组合，完成复杂任务分解与执行 | P1（首版后期） |

### 1.3 能力复用策略

#### 优先复用官方 `deepagents` 包的能力

- Agent 生命周期管理（创建、运行、终止）
- 工具注册与调用（Tool Calling / Function Calling）
- 对话历史与上下文管理（Memory/History）
- 流式输出（Streaming）
- 多步推理与规划（ReAct / Plan-and-Execute）

#### 需要自行实现的能力

- Milvus 向量检索工具（封装为 `deepagents` Tool 接口）
- DashScope 模型适配层（通义千问各版本自由切换）
- 文件上传与知识库管理 API
- 任务运行记录持久化（PostgreSQL）
- 前端页面（对话、知识库管理、任务记录、设置）

#### 暂不纳入首版 / 后续增强

| 能力 | 说明 |
|------|------|
| 多 Agent 协作（Multi-Agent） | 官方包当前支持程度有限，后续增强 |
| Agent 可视化流程图编辑 | 需较大前端自研成本，后续增强 |
| 本地模型（Ollama）接入 | 首版聚焦 DashScope，后续扩展 |
| 细粒度权限与多租户 | 首版单用户，后续增强 |
| 语音输入/输出 | 暂不纳入首版 |

---

## 2. 技术选型

| 层次 | 技术 | 说明 |
|------|------|------|
| **后端框架** | FastAPI | 轻量、异步、与 Python AI 生态兼容性好 |
| **Agent 核心** | 官方 `deepagents` 包 | 复用官方编排与工具调用能力 |
| **模型接入** | DashScope（通义千问） | 支持 qwen-max / qwen-plus / qwen-turbo 自由切换 |
| **向量数据库** | Milvus | 知识库语义检索 |
| **关系数据库** | PostgreSQL | 用户数据、任务记录、知识库元信息 |
| **缓存** | Redis | 会话缓存、任务队列 |
| **前端** | React / Next.js（按需） | 优先复用官方或开源 Chat UI 组件，必要时自建 |
| **部署** | Windows + Docker Desktop | 本地开发与演示环境 |
| **容器编排** | Docker Compose | 管理多服务依赖 |

> **前端说明：** 优先评估官方 `deepagents` 是否提供前端 UI 或可嵌入的 Chat 组件。若官方已提供，则直接复用；若无，则基于 Next.js + 开源 Chat UI（如 `chatbot-ui` 或 `OpenWebUI`）快速搭建。

---

## 3. 目录结构规划

```
deep-agent/
├── backend/                        # FastAPI 后端
│   ├── app/
│   │   ├── main.py                 # FastAPI 入口
│   │   ├── config.py               # 环境配置加载
│   │   ├── agents/                 # Agent 相关
│   │   │   ├── __init__.py
│   │   │   ├── factory.py          # Agent 实例工厂（复用 deepagents）
│   │   │   ├── tools/              # 自定义工具
│   │   │   │   ├── milvus_search.py   # Milvus 检索工具
│   │   │   │   ├── code_exec.py       # 代码执行工具（沙盒）
│   │   │   │   └── data_analysis.py   # 数据分析工具
│   │   ├── api/                    # REST API 路由
│   │   │   ├── chat.py             # 对话接口
│   │   │   ├── knowledge.py        # 知识库管理接口
│   │   │   ├── tasks.py            # 任务记录接口
│   │   │   └── settings.py         # 系统设置接口
│   │   ├── models/                 # 数据库模型（SQLAlchemy）
│   │   │   ├── conversation.py
│   │   │   ├── knowledge_base.py
│   │   │   └── task.py
│   │   ├── services/               # 业务逻辑层
│   │   │   ├── embedding.py        # 文档向量化（DashScope Embedding）
│   │   │   ├── milvus_client.py    # Milvus 操作封装
│   │   │   └── dashscope_client.py # DashScope 模型客户端
│   │   └── utils/                  # 公共工具函数
│   ├── tests/                      # 单元测试 & 集成测试
│   ├── requirements.txt            # Python 依赖
│   └── Dockerfile                  # 后端镜像
├── frontend/                       # React/Next.js 前端（按需）
│   ├── src/
│   │   ├── pages/                  # 页面
│   │   │   ├── chat/               # 对话页
│   │   │   ├── knowledge/          # 知识库管理页
│   │   │   ├── tasks/              # 任务记录页
│   │   │   └── settings/           # 设置页
│   │   ├── components/             # 通用组件
│   │   └── services/               # API 调用封装
│   ├── package.json
│   └── Dockerfile
├── infra/                          # 基础设施配置
│   ├── docker-compose.yml          # 本地全量服务编排
│   ├── docker-compose.dev.yml      # 开发环境覆盖配置
│   ├── milvus/                     # Milvus 初始化配置
│   ├── postgres/                   # PostgreSQL 初始化脚本
│   └── redis/                      # Redis 配置
├── docs/                           # 项目文档
│   ├── api.md                      # API 接口文档
│   ├── architecture.md             # 架构说明
│   └── quickstart.md               # 快速启动指南
├── .env.example                    # 环境变量示例
├── .gitignore
└── deep-agent-plan.md              # 本规划文档
```

---

## 4. 分阶段实施计划

### 第一阶段：本地开发环境与基础服务打通

**目标：** 确保 Docker Compose 能在 Windows + Docker Desktop 上正常启动所有基础服务，FastAPI 后端可运行。

**产出物：**

- `infra/docker-compose.yml`：包含 PostgreSQL、Redis、Milvus 服务
- `backend/` 基础骨架：FastAPI `main.py`、配置加载、健康检查接口
- `.env.example`：完整环境变量模板

**验收标准：**

```bash
# 启动服务
docker-compose up -d

# 验证
curl http://localhost:8000/health   # 返回 {"status": "ok"}
# PostgreSQL、Redis、Milvus 容器均正常运行
```

---

### 第二阶段：基于 `deepagents` 的最小可运行 Agent

**目标：** 集成官方 `deepagents` 包，实现最简单的单轮/多轮对话 Agent，通过 FastAPI 接口可调用。

**产出物：**

- `backend/app/agents/factory.py`：使用 `deepagents` 创建 Agent 实例
- `backend/app/api/chat.py`：`POST /api/chat`（支持流式输出）
- DashScope 模型接入（`qwen-plus` 默认）

**验收标准：**

```bash
# 调用对话接口
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "你好，介绍一下你自己", "stream": false}'

# 期望返回 Agent 回复文本
```

---

### 第三阶段：接入 Milvus 知识库与 DashScope 模型切换

**目标：** 实现文档上传、向量化存储、语义检索，并将检索结果注入 Agent 上下文；支持多版本通义千问模型切换。

**产出物：**

- `backend/app/services/embedding.py`：文档分块 + DashScope Embedding
- `backend/app/services/milvus_client.py`：Milvus Collection 管理与检索
- `backend/app/agents/tools/milvus_search.py`：封装为 `deepagents` Tool
- `backend/app/api/knowledge.py`：上传、列表、删除知识库接口
- 模型切换接口：支持通过参数指定 `model_name`

**验收标准：**

```bash
# 上传文档
curl -X POST http://localhost:8000/api/knowledge/upload \
  -F "file=@sample.pdf" \
  -F "kb_name=test_kb"

# 知识库问答
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "文档里说了什么？", "kb_name": "test_kb", "model": "qwen-max"}'
```

---

### 第四阶段：增加前端页面与任务可视化

**目标：** 构建基础前端页面，支持可视化对话、知识库管理与任务运行记录查看。

**产出物：**

- 对话页（`/chat`）：支持流式显示、历史记录
- 知识库管理页（`/knowledge`）：上传、列表、删除
- 任务记录页（`/tasks`）：历史运行记录与状态
- 设置页（`/settings`）：模型切换、API Key 配置
- 前端 Docker 镜像与 `docker-compose` 集成

**验收标准：**

- 浏览器打开 `http://localhost:3000`，能完成完整的对话流程；
- 知识库上传后可在对话中检索到内容。

---

### 第五阶段：扩展到四大应用场景

**目标：** 在已有基础上，补充代码助手、数据分析、通用多工具工作流场景。

**产出物：**

- 代码助手模式：系统提示词配置 + 代码高亮展示
- 数据分析模式：CSV/Excel 上传 + Agent 自动分析工具（`data_analysis.py`）
- 通用工作流模式：支持用户选择并组合工具集
- 场景切换入口（前端）

**验收标准：**

- 代码助手：输入"用 Python 写一个冒泡排序"，返回格式化代码；
- 数据分析：上传 CSV，询问"数据的平均值是多少"，返回正确统计结果；
- 多工具工作流：组合搜索 + 计算工具完成复合任务。

---

## 5. 功能页面规划

### 5.1 对话页（`/chat`）

| 功能 | 说明 |
|------|------|
| 新建对话 | 创建新会话，可选场景（知识库问答/代码助手/数据分析/通用） |
| 消息输入 | 文本输入框，支持换行与快捷键发送 |
| 流式输出 | 实时显示 Agent 回复，支持 Markdown 渲染 |
| 历史消息 | 展示当前会话完整历史 |
| 模型选择 | 下拉切换通义千问模型版本 |
| 知识库绑定 | 选择关联的知识库（知识库问答模式下） |
| 工具调用展示 | 显示 Agent 调用了哪些工具及结果（可折叠） |

### 5.2 知识库管理页（`/knowledge`）

| 功能 | 说明 |
|------|------|
| 创建知识库 | 输入名称，创建新的 Milvus Collection |
| 文档上传 | 支持 PDF、TXT、Markdown 格式，上传后自动向量化 |
| 文档列表 | 显示知识库内已有文档及状态（处理中/可用） |
| 文档删除 | 删除指定文档及其向量数据 |
| 知识库删除 | 删除整个知识库 |

### 5.3 任务 / 运行记录页（`/tasks`）

| 功能 | 说明 |
|------|------|
| 任务列表 | 展示历史 Agent 运行记录（时间、场景、状态） |
| 任务详情 | 查看单次运行的完整步骤、工具调用链路 |
| 状态过滤 | 按成功/失败/运行中筛选 |
| 任务重试 | 对失败任务支持重新触发（后续增强） |

### 5.4 设置页（`/settings`）

| 功能 | 说明 |
|------|------|
| DashScope API Key | 配置与验证 API Key |
| 默认模型 | 选择默认使用的通义千问版本 |
| Milvus 连接配置 | 主机、端口配置（高级） |
| PostgreSQL 连接配置 | 数据库连接（高级） |
| 系统提示词模板 | 各场景默认系统提示词编辑 |

---

## 6. 依赖与环境变量

### 6.1 Python 依赖（`backend/requirements.txt`）

```txt
# Web 框架
fastapi>=0.110.0
uvicorn[standard]>=0.29.0

# Agent 核心
deepagents>=0.1.0          # 官方包，版本号以实际发布为准

# DashScope 模型
dashscope>=1.18.0

# 向量数据库
pymilvus>=2.4.0

# 关系数据库
sqlalchemy>=2.0.0
asyncpg>=0.29.0
alembic>=1.13.0

# 缓存
redis>=5.0.0

# 文件处理
PyPDF2>=3.0.0
python-multipart>=0.0.9

# 工具
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-dotenv>=1.0.0
httpx>=0.27.0
```

### 6.2 前端依赖（`frontend/package.json`，按需）

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-markdown": "^9.0.0",
    "react-syntax-highlighter": "^15.0.0",
    "axios": "^1.6.0",
    "swr": "^2.2.0"
  }
}
```

### 6.3 Docker 服务依赖（`infra/docker-compose.yml`）

| 服务 | 镜像 | 端口 |
|------|------|------|
| PostgreSQL | `postgres:16-alpine` | 5432 |
| Redis | `redis:7-alpine` | 6379 |
| Milvus（Standalone） | `milvusdb/milvus:v2.4.0` | 19530, 9091 |
| etcd（Milvus 依赖） | `quay.io/coreos/etcd:v3.5.0` | - |
| MinIO（Milvus 依赖） | `minio/minio:RELEASE.2023-03-13T19-46-17Z` | 9000 |

### 6.4 环境变量（`.env`）

| 变量名 | 用途 | 示例值 |
|--------|------|--------|
| `DASHSCOPE_API_KEY` | DashScope API 密钥 | `sk-xxxxxxxxxxxx` |
| `DEFAULT_MODEL` | 默认通义千问模型 | `qwen-plus` |
| `EMBEDDING_MODEL` | 向量化模型 | `text-embedding-v3` |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql+asyncpg://user:pass@localhost:5432/deepagent` |
| `REDIS_URL` | Redis 连接地址 | `redis://localhost:6379/0` |
| `MILVUS_HOST` | Milvus 服务主机 | `localhost` |
| `MILVUS_PORT` | Milvus 服务端口 | `19530` |
| `MILVUS_COLLECTION_PREFIX` | Collection 名称前缀 | `deepagent_` |
| `BACKEND_HOST` | 后端监听地址 | `0.0.0.0` |
| `BACKEND_PORT` | 后端监听端口 | `8000` |
| `FRONTEND_URL` | 前端地址（CORS 配置） | `http://localhost:3000` |
| `SECRET_KEY` | JWT / Session 密钥 | 随机生成的强密钥 |
| `LOG_LEVEL` | 日志级别 | `INFO` |

---

## 7. 风险与约束

### 7.1 官方 `deepagents` 包当前已知限制

| 限制项 | 影响 | 应对措施 |
|--------|------|----------|
| Multi-Agent 协作能力尚不稳定 | 无法在首版实现复杂的多 Agent 协同 | 首版使用单 Agent + 工具链替代 |
| 自定义 Tool 接口文档不完整 | 自定义 Milvus 检索工具需参考源码 | 预留工具适配调试时间 |
| 流式输出 API 可能随版本变化 | 后端接口稳定性风险 | 封装适配层，版本锁定 |
| 官方包更新节奏不确定 | 版本升级可能引入 Breaking Change | 使用固定版本，升级前充分测试 |

### 7.2 首版可延后的能力

| 能力 | 延后原因 | 计划阶段 |
|------|----------|----------|
| Multi-Agent 协作 | 官方能力暂不成熟，自研成本高 | 后续增强 |
| Agent 流程可视化编辑 | 前端开发量大 | 后续增强 |
| 本地模型（Ollama）接入 | 首版聚焦 DashScope | 第二版 |
| 细粒度权限与多租户 | 首版单用户场景 | 第二版 |
| 语音输入/输出 | 需额外模型与前端支持 | 后续增强 |
| 任务失败自动重试 | 逻辑复杂，首版手动触发 | 后续增强 |
| 代码沙盒安全执行 | 安全性要求高，需专项设计 | 后续增强 |

### 7.3 Windows + Docker Desktop 特有风险

| 风险 | 说明 | 缓解措施 |
|------|------|----------|
| Milvus 资源消耗较大 | Milvus Standalone 在 Windows Docker Desktop 上内存占用高 | 限制容器内存，或使用 Milvus Lite 进行本地开发 |
| 文件路径兼容性 | Windows 路径分隔符与 Linux 不同 | 统一使用 Docker Volume，避免绑定宿主机路径 |
| 网络性能 | WSL2 + Docker Desktop 网络转发有轻微延迟 | 开发阶段可接受，生产部署切换 Linux |

---

## 附录：快速启动参考命令

```bash
# 1. 复制环境变量配置
cp .env.example .env
# 编辑 .env，填写 DASHSCOPE_API_KEY 等必填项

# 2. 启动基础服务
cd infra
docker-compose up -d

# 3. 安装后端依赖（开发环境）
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 4. 初始化数据库
alembic upgrade head

# 5. 启动后端
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 6. 验证服务
curl http://localhost:8000/health
```

---

*文档版本：v1.0 | 创建日期：2026-03-28 | 状态：规划中*
