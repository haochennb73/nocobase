# Deep Agent 项目规划文档

> 本文档描述如何从零搭建一个基于 LangChain / LangGraph + 通义 DashScope 的 Deep Agent 项目，涵盖知识库问答、代码助手、数据分析和通用多工具工作流四大应用场景。

---

## 一、项目概述

### 1.1 项目目标

基于 **LangChain / LangGraph** 的 Deep Agent 架构，实现以下四大应用场景：

| 场景 | 说明 |
|------|------|
| 📚 知识库问答 | 上传企业/个人文档，基于 RAG 进行多轮精准问答，并给出引用来源 |
| 💻 代码助手 | 自动理解需求、生成代码、执行沙箱测试、迭代修复，输出可运行方案 |
| 📊 数据分析 | 接入结构化数据源（CSV / 数据库），自动生成分析脚本、图表与结论 |
| 🔧 通用多工具工作流 | Planner → Tool Executor → Verifier 循环，支持搜索、API 调用等自由组合 |

### 1.2 技术选型

| 层次 | 技术 | 说明 |
|------|------|------|
| **LLM 接口** | 通义 DashScope | 支持 qwen-max / qwen-plus / qwen-turbo 等模型动态切换 |
| **Agent 引擎** | LangGraph | 有向图状态机，实现 Planner → Executor → Verifier 多步骤循环 |
| **LangChain** | langchain / langchain-community | Chain、Tool、Retriever、Prompt 等基础积木 |
| **前端** | React + Next.js (App Router) | 对话界面 + 任务面板 + 知识库管理 |
| **后端** | FastAPI (Python) | 异步 API 服务，WebSocket 支持流式输出 |
| **向量数据库** | Milvus | 生产级向量检索，支持多集合/多场景 |
| **关系数据库** | PostgreSQL | 用户、会话、任务持久化 |
| **缓存** | Redis | 会话状态缓存 + 流式消息中转 |
| **部署** | Docker Desktop (Windows) | docker-compose 一键编排所有服务 |

---

## 二、目录结构规划

```
deep-agent/
├── docker-compose.yml          # 全服务编排入口
├── .env                        # 环境变量（API Key、数据库密码等）
├── .env.example                # 环境变量模板（提交到版本库）
│
├── backend/                    # 后端 FastAPI 应用
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI 入口，挂载路由、中间件
│       ├── api/                # 路由层（REST + WebSocket）
│       │   ├── __init__.py
│       │   ├── chat.py         # POST /v1/chat, WS /v1/chat/stream
│       │   ├── knowledge.py    # POST /v1/knowledge/upload, GET /v1/knowledge
│       │   ├── tools.py        # GET/POST /v1/tools（工具启用/配置）
│       │   └── settings.py     # GET/PUT /v1/settings（模型、参数）
│       ├── agent/              # Deep Agent 核心
│       │   ├── __init__.py
│       │   ├── graph.py        # LangGraph 状态机定义（节点 + 边）
│       │   ├── state.py        # AgentState 数据结构
│       │   ├── planner.py      # 任务规划节点（子问题拆解）
│       │   ├── executor.py     # 工具执行节点
│       │   ├── verifier.py     # 结果校验节点（触发重试/结束）
│       │   └── tools/          # 各场景工具实现
│       │       ├── __init__.py
│       │       ├── search.py          # 网络搜索工具
│       │       ├── code_exec.py       # 代码沙箱执行工具
│       │       ├── data_analysis.py   # 数据分析工具（pandas/matplotlib）
│       │       └── api_caller.py      # 通用 HTTP API 调用工具
│       ├── models/             # ORM 数据模型（SQLAlchemy）
│       │   ├── __init__.py
│       │   ├── user.py
│       │   ├── session.py
│       │   └── task.py
│       ├── services/           # 业务逻辑层
│       │   ├── __init__.py
│       │   ├── llm.py          # DashScope 模型管理（动态切换）
│       │   ├── milvus.py       # 向量库服务（插入/检索/删除）
│       │   └── knowledge.py    # 文档解析、切分、向量化流水线
│       └── core/
│           ├── config.py       # Pydantic Settings 配置管理
│           └── database.py     # PostgreSQL + Redis 异步连接管理
│
├── frontend/                   # 前端 Next.js 应用
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app/                # Next.js App Router 页面
│       │   ├── layout.tsx
│       │   ├── page.tsx        # 默认跳转到 /chat
│       │   ├── chat/
│       │   │   └── page.tsx    # 对话界面
│       │   ├── tasks/
│       │   │   └── page.tsx    # 任务面板
│       │   ├── knowledge/
│       │   │   └── page.tsx    # 知识库管理
│       │   ├── tools/
│       │   │   └── page.tsx    # 工具配置
│       │   └── settings/
│       │       └── page.tsx    # 系统设置
│       ├── components/
│       │   ├── Chat/           # 对话界面组件
│       │   │   ├── ChatWindow.tsx
│       │   │   ├── MessageBubble.tsx
│       │   │   └── ThinkingSteps.tsx   # 展示 Agent 思考过程
│       │   ├── TaskPanel/      # 任务面板组件
│       │   │   ├── TaskList.tsx
│       │   │   └── TaskDetail.tsx
│       │   ├── Knowledge/      # 知识库管理组件
│       │   │   ├── UploadArea.tsx
│       │   │   └── DocumentList.tsx
│       │   ├── Tools/          # 工具配置组件
│       │   └── Settings/       # 系统设置组件
│       └── lib/
│           ├── api.ts          # 后端 REST API 封装（axios/fetch）
│           └── websocket.ts    # WebSocket 流式通信封装
│
└── infra/                      # 基础设施配置
    ├── milvus/
    │   └── milvus.yaml         # Milvus standalone 配置
    ├── postgres/
    │   └── init.sql            # 数据库初始化脚本
    └── redis/
        └── redis.conf          # Redis 配置
```

---

## 三、步骤规划

### 3.1 第一阶段：基础设施搭建（docker-compose）

**目标**：所有依赖服务在 Docker Desktop 中正常运行。

#### 3.1.1 编写 `docker-compose.yml`

```yaml
version: '3.8'

services:
  # ── 后端 ──────────────────────────────────────
  backend:
    build: ./backend
    container_name: deep-agent-backend
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      - postgres
      - redis
      - milvus
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  # ── 前端 ──────────────────────────────────────
  frontend:
    build: ./frontend
    container_name: deep-agent-frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

  # ── PostgreSQL ────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: deep-agent-postgres
    environment:
      POSTGRES_DB: deepagent
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"

  # ── Redis ─────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: deep-agent-redis
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  # ── Milvus 依赖：etcd ─────────────────────────
  etcd:
    image: quay.io/coreos/etcd:v3.5.5
    container_name: deep-agent-etcd
    environment:
      ETCD_AUTO_COMPACTION_RETENTION: "1"
      ETCD_QUOTA_BACKEND_BYTES: "4294967296"
      ETCD_SNAPSHOT_COUNT: "50000"
      ETCD_HEARTBEAT_INTERVAL: "500"
      ETCD_ELECTION_TIMEOUT: "2500"
    volumes:
      - etcddata:/etcd
    command: >
      etcd --data-dir=/etcd
           --listen-client-urls=http://0.0.0.0:2379
           --advertise-client-urls=http://etcd:2379

  # ── Milvus 依赖：MinIO ────────────────────────
  minio:
    image: minio/minio:RELEASE.2024-01-16T16-07-38Z
    container_name: deep-agent-minio
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    volumes:
      - miniodata:/minio_data
    command: minio server /minio_data
    ports:
      - "9001:9001"

  # ── Milvus standalone ─────────────────────────
  milvus:
    image: milvusdb/milvus:v2.4.0
    container_name: deep-agent-milvus
    command: milvus run standalone
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    volumes:
      - milvusdata:/var/lib/milvus
    ports:
      - "19530:19530"
    depends_on:
      - etcd
      - minio

volumes:
  pgdata:
  redisdata:
  etcddata:
  miniodata:
  milvusdata:
```

#### 3.1.2 启动验证

```bash
# 启动所有服务
docker compose up -d

# 检查状态
docker compose ps

# 查看后端日志
docker compose logs -f backend
```

---

### 3.2 第二阶段：后端开发

#### 3.2.1 FastAPI 应用入口 (`backend/app/main.py`)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, knowledge, tools, settings
from app.core.database import init_db

app = FastAPI(title="Deep Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router,      prefix="/v1/chat",      tags=["chat"])
app.include_router(knowledge.router, prefix="/v1/knowledge", tags=["knowledge"])
app.include_router(tools.router,     prefix="/v1/tools",     tags=["tools"])
app.include_router(settings.router,  prefix="/v1/settings",  tags=["settings"])

@app.on_event("startup")
async def startup():
    await init_db()
```

#### 3.2.2 核心 API 路由

**对话接口** (`/v1/chat`)

```python
# backend/app/api/chat.py
from fastapi import APIRouter, WebSocket
from app.agent.graph import build_agent_graph
from app.services.llm import get_llm

router = APIRouter()

@router.post("/")
async def chat(request: ChatRequest):
    """同步对话（短任务）"""
    graph = build_agent_graph(llm=get_llm(request.model))
    result = await graph.ainvoke({"messages": [request.message]})
    return {"reply": result["messages"][-1].content}

@router.websocket("/stream")
async def chat_stream(websocket: WebSocket):
    """流式对话（WebSocket，实时推送每一步）"""
    await websocket.accept()
    data = await websocket.receive_json()
    graph = build_agent_graph(llm=get_llm(data.get("model", "qwen-max")))
    async for chunk in graph.astream({"messages": [data["message"]]}):
        await websocket.send_json({"type": "chunk", "data": chunk})
    await websocket.send_json({"type": "done"})
```

**知识库接口** (`/v1/knowledge`)

```python
# backend/app/api/knowledge.py
from fastapi import APIRouter, UploadFile, File
from app.services.knowledge import process_document

router = APIRouter()

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """上传文档 → 自动解析 → 切分 → 向量化 → 存入 Milvus"""
    result = await process_document(file)
    return {"status": "ok", "chunks": result["chunk_count"], "doc_id": result["doc_id"]}

@router.get("/")
async def list_documents():
    """列出所有已上传文档"""
    ...

@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    """从向量库删除文档"""
    ...
```

#### 3.2.3 LangGraph Agent 状态机 (`backend/app/agent/graph.py`)

```python
from langgraph.graph import StateGraph, END
from app.agent.state import AgentState
from app.agent.planner import planner_node
from app.agent.executor import executor_node
from app.agent.verifier import verifier_node

def build_agent_graph(llm):
    graph = StateGraph(AgentState)

    graph.add_node("planner",  lambda s: planner_node(s, llm))
    graph.add_node("executor", lambda s: executor_node(s, llm))
    graph.add_node("verifier", lambda s: verifier_node(s, llm))

    graph.set_entry_point("planner")
    graph.add_edge("planner", "executor")
    graph.add_edge("executor", "verifier")

    # 校验通过 → 结束；未通过 → 回到 executor 重试（最多 3 次）
    graph.add_conditional_edges(
        "verifier",
        lambda s: END if s["verified"] or s["retry_count"] >= 3 else "executor",
    )

    return graph.compile()
```

#### 3.2.4 DashScope 模型服务 (`backend/app/services/llm.py`)

```python
from langchain_community.llms.tongyi import Tongyi
from langchain_community.chat_models.tongyi import ChatTongyi

SUPPORTED_MODELS = ["qwen-max", "qwen-plus", "qwen-turbo", "qwen-long"]

def get_llm(model: str = "qwen-max") -> ChatTongyi:
    if model not in SUPPORTED_MODELS:
        raise ValueError(f"不支持的模型: {model}，可选: {SUPPORTED_MODELS}")
    return ChatTongyi(model=model, streaming=True)
```

---

### 3.3 第三阶段：前端开发

#### 3.3.1 初始化 Next.js 项目

```bash
cd deep-agent/frontend
npx create-next-app@latest . --typescript --tailwind --app
npm install axios swr zustand
```

#### 3.3.2 对话页面（`/chat`）核心组件

```tsx
// frontend/src/components/Chat/ChatWindow.tsx
"use client";
import { useState, useRef, useEffect } from "react";

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const sendMessage = () => {
    if (!input.trim()) return;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
    wsRef.current = new WebSocket(`${wsUrl}/v1/chat/stream`);

    wsRef.current.onopen = () => {
      wsRef.current!.send(JSON.stringify({ message: input, model: "qwen-max" }));
      setMessages(prev => [...prev, { role: "user", content: input }]);
      setInput("");
    };

    wsRef.current.onerror = () => {
      setMessages(prev => [...prev, { role: "assistant", content: "连接错误，请稍后重试。" }]);
    };

    wsRef.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "chunk") {
        // 将 Agent 每一步的中间结果追加到界面
        setMessages(prev => updateLastAssistantMessage(prev, data.data));
      }
    };
  };

  return (
    <div className="flex flex-col h-screen p-4">
      <div className="flex-1 overflow-auto space-y-4">
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <input
          className="flex-1 border rounded px-3 py-2"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="输入你的问题..."
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={sendMessage}
        >
          发送
        </button>
      </div>
    </div>
  );
}
```

#### 3.3.3 页面路由规划

| 路径 | 页面 | 主要功能 |
|------|------|----------|
| `/chat` | 对话界面 | 流式对话、思考步骤展示、历史会话切换 |
| `/tasks` | 任务面板 | 当前/历史任务列表、子步骤详情、工具调用日志 |
| `/knowledge` | 知识库管理 | 文档上传、列表查看、删除 |
| `/tools` | 工具配置 | 启用/禁用各工具、配置参数（如搜索 API Key） |
| `/settings` | 系统设置 | 模型选择、温度/Token 上限、DashScope Key 管理 |

---

## 四、依赖清单与环境变量

### 4.1 后端依赖 (`backend/requirements.txt`)

```text
# ── LangChain 核心 ───────────────────────────
langchain>=0.2.0
langchain-core>=0.2.0
langchain-community>=0.2.0
langgraph>=0.1.0

# ── 通义 DashScope ───────────────────────────
dashscope>=1.17.0

# ── 向量数据库 ───────────────────────────────
pymilvus>=2.4.0

# ── 后端框架 ─────────────────────────────────
fastapi>=0.111.0
uvicorn[standard]>=0.30.0
websockets>=12.0
python-multipart>=0.0.9

# ── 数据库 ───────────────────────────────────
asyncpg>=0.29.0
sqlalchemy[asyncio]>=2.0.0
alembic>=1.13.0
redis[asyncio]>=5.0.0

# ── 文档处理 ─────────────────────────────────
pypdf>=4.0.0
python-docx>=1.1.0
unstructured>=0.14.0

# ── 数据分析 ─────────────────────────────────
pandas>=2.2.0
matplotlib>=3.8.0
httpx>=0.27.0

# ── 配置与工具 ───────────────────────────────
pydantic>=2.7.0
pydantic-settings>=2.3.0
python-dotenv>=1.0.0
tiktoken>=0.7.0
```

### 4.2 前端依赖 (`frontend/package.json` 关键依赖)

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "axios": "^1.6.0",
    "swr": "^2.2.0",
    "zustand": "^4.5.0",
    "tailwindcss": "^3.4.0",
    "lucide-react": "^0.400.0",
    "react-markdown": "^9.0.0",
    "highlight.js": "^11.9.0"
  }
}
```

### 4.3 环境变量 (`.env.example`)

```dotenv
# ── DashScope / 通义 ──────────────────────────
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
DEFAULT_MODEL=qwen-max

# ── PostgreSQL ────────────────────────────────
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=deepagent
POSTGRES_USER=admin
# ── 数据库密码（请使用至少16位、包含大小写字母和特殊字符的随机密码）
POSTGRES_PASSWORD=change_me_in_production

# ── Redis ─────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ── Milvus ────────────────────────────────────
MILVUS_HOST=milvus
MILVUS_PORT=19530
MILVUS_COLLECTION_DEFAULT=deep_agent_knowledge

# ── 应用配置 ──────────────────────────────────
SECRET_KEY=change_me_to_a_random_secret
DEBUG=false
CORS_ORIGINS=http://localhost:3000

# ── LangSmith（可选） ─────────────────────────
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=deep-agent
```

---

## 五、应用场景实现

### 5.1 知识库问答

**流程**：文档上传 → 解析切分 → 向量化存 Milvus → 提问时检索 → RAG 生成答案

```python
# backend/app/services/knowledge.py
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import DashScopeEmbeddings
from pymilvus import MilvusClient

embeddings = DashScopeEmbeddings(model="text-embedding-v2")
milvus_client = MilvusClient(uri="http://milvus:19530")

async def process_document(file) -> dict:
    content = await parse_file(file)                        # 1. 解析文档
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=512, chunk_overlap=50
    )
    chunks = splitter.split_text(content)                   # 2. 文本切分
    vectors = embeddings.embed_documents(chunks)            # 3. 向量化
    milvus_client.insert(                                   # 4. 存入 Milvus
        collection_name="deep_agent_knowledge",
        data=[{"vector": v, "text": t} for v, t in zip(vectors, chunks)],
    )
    return {"chunk_count": len(chunks), "doc_id": generate_doc_id()}

def retrieve(query: str, top_k: int = 5) -> list[str]:
    query_vector = embeddings.embed_query(query)
    results = milvus_client.search(
        collection_name="deep_agent_knowledge",
        data=[query_vector],
        limit=top_k,
        output_fields=["text"],
    )
    return [r["entity"]["text"] for r in results[0]]
```

**RAG Agent 节点**

```python
# backend/app/agent/tools/knowledge_retriever.py
from langchain.tools import tool
from app.services.knowledge import retrieve

@tool
def knowledge_retriever(query: str) -> str:
    """从企业知识库中检索与问题相关的文档片段，并附上引用来源。"""
    chunks = retrieve(query, top_k=5)
    return "\n\n".join(f"[引用{i+1}] {c}" for i, c in enumerate(chunks))
```

---

### 5.2 代码助手

**流程**：理解需求 → 生成代码 → 沙箱执行 → 校验输出 → 迭代修复

```python
# backend/app/agent/tools/code_exec.py
import subprocess, tempfile, os
from langchain.tools import tool

@tool
def python_executor(code: str) -> str:
    """在安全沙箱中执行 Python 代码，返回标准输出或错误信息。

    注意：生产环境应将此工具运行在独立的 Docker 容器沙箱中，
    并配置 CPU/内存限制和网络隔离，防止任意代码执行带来的安全风险。
    """
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        tmp_path = f.name
    try:
        result = subprocess.run(
            ["python", tmp_path],
            capture_output=True, text=True, timeout=30,
        )
        return result.stdout if result.returncode == 0 else f"ERROR:\n{result.stderr}"
    finally:
        os.unlink(tmp_path)
```

---

### 5.3 数据分析

**流程**：加载 CSV/数据库 → LLM 生成 Pandas 脚本 → 执行 → 返回图表 + 文字结论

```python
# backend/app/agent/tools/data_analysis.py
import pandas as pd
import matplotlib.pyplot as plt
import io, base64
from langchain.tools import tool

@tool
def analyze_csv(file_path: str, query: str) -> str:
    """
    读取 CSV 文件，根据用户问题自动执行数据分析，
    返回统计摘要和 base64 编码的图表。

    注意：生产环境应验证 file_path 位于允许的目录内，
    防止路径穿越（如 '../' 序列）等安全漏洞。
    """
    import os
    allowed_dir = os.environ.get("DATA_UPLOAD_DIR", "/app/uploads")
    abs_path = os.path.realpath(file_path)
    if not abs_path.startswith(os.path.realpath(allowed_dir)):
        raise ValueError("文件路径不在允许的上传目录内")
    df = pd.read_csv(abs_path)
    summary = df.describe().to_string()
    # 生成简单图表
    fig, ax = plt.subplots()
    df.select_dtypes("number").iloc[:, 0].plot(ax=ax)
    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    chart_b64 = base64.b64encode(buf.getvalue()).decode()
    plt.close(fig)
    return f"统计摘要:\n{summary}\n\nchart_base64:{chart_b64}"
```

---

### 5.4 通用多工具工作流

**工具集注册**

```python
# backend/app/agent/graph.py（工具绑定片段）
from app.agent.tools.search import web_search
from app.agent.tools.code_exec import python_executor
from app.agent.tools.data_analysis import analyze_csv
from app.agent.tools.knowledge_retriever import knowledge_retriever
from app.agent.tools.api_caller import http_get

ALL_TOOLS = [web_search, python_executor, analyze_csv, knowledge_retriever, http_get]

def build_agent_graph(llm, tools=None):
    tools = tools or ALL_TOOLS
    llm_with_tools = llm.bind_tools(tools)
    # … 构建 LangGraph 状态机（见 3.2.3）
```

**Planner 节点**（拆解子任务）

```python
# backend/app/agent/planner.py
from langchain_core.messages import SystemMessage

PLANNER_SYSTEM = """你是一个任务规划专家。
接收用户目标后，将其拆分为若干有序的子任务列表，每个子任务需明确：
1. 子任务描述
2. 应使用的工具（如有）
3. 预期输出格式
以 JSON 列表返回。"""

async def planner_node(state, llm):
    messages = [SystemMessage(PLANNER_SYSTEM)] + state["messages"]
    plan = await llm.ainvoke(messages)
    return {**state, "plan": plan.content, "current_step": 0}
```

---

## 六、测试计划

### 6.1 后端单元测试

使用 `pytest` + `pytest-asyncio`，每个模块独立测试。

```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

#### 示例：测试 LLM 服务

```python
# backend/tests/test_llm.py
import pytest
from app.services.llm import get_llm, SUPPORTED_MODELS

def test_get_llm_valid_model():
    for model in SUPPORTED_MODELS:
        llm = get_llm(model)
        assert llm is not None

def test_get_llm_invalid_model():
    with pytest.raises(ValueError, match="不支持的模型"):
        get_llm("gpt-99-ultra")
```

#### 示例：测试知识库切分

```python
# backend/tests/test_knowledge.py
import pytest
from app.services.knowledge import process_document

@pytest.mark.asyncio
async def test_document_chunking(tmp_path):
    test_file = tmp_path / "test.txt"
    test_file.write_text("这是一段测试文本。" * 100)
    # mock Milvus insert，只验证切分逻辑
    result = await process_document(str(test_file))
    assert result["chunk_count"] > 0
```

#### 示例：测试 Agent 图

```python
# backend/tests/test_agent.py
import pytest
from unittest.mock import AsyncMock, patch
from app.agent.graph import build_agent_graph

@pytest.mark.asyncio
async def test_agent_graph_completes():
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value.content = '{"reply": "测试回答"}'
    graph = build_agent_graph(llm=mock_llm)
    result = await graph.ainvoke({"messages": ["你好"]})
    assert "messages" in result
```

### 6.2 API 集成测试

使用 FastAPI 的 `TestClient` 验证端到端接口。

```python
# backend/tests/test_api.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200

def test_chat_endpoint():
    response = client.post("/v1/chat/", json={"message": "你好", "model": "qwen-max"})
    assert response.status_code == 200
    assert "reply" in response.json()

def test_knowledge_upload():
    with open("tests/fixtures/sample.pdf", "rb") as f:
        response = client.post("/v1/knowledge/upload", files={"file": f})
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
```

### 6.3 前端测试

使用 `Jest` + `React Testing Library`。

```bash
cd frontend
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
npm test
```

```tsx
// frontend/src/__tests__/ChatWindow.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChatWindow from "@/components/Chat/ChatWindow";

test("renders input and send button", () => {
  render(<ChatWindow />);
  expect(screen.getByPlaceholderText("输入你的问题...")).toBeInTheDocument();
  expect(screen.getByText("发送")).toBeInTheDocument();
});

test("sends message on Enter key", async () => {
  render(<ChatWindow />);
  const input = screen.getByPlaceholderText("输入你的问题...");
  fireEvent.change(input, { target: { value: "测试问题" } });
  fireEvent.keyDown(input, { key: "Enter" });
  // waitFor 处理消息渲染的异步更新
  await waitFor(() => {
    expect(screen.getByText("测试问题")).toBeInTheDocument();
  });
});
```

### 6.4 端到端（E2E）测试

使用 `Playwright` 验证完整用户流程。

```bash
cd frontend
npm install --save-dev @playwright/test
npx playwright test
```

```typescript
// frontend/e2e/chat.spec.ts
import { test, expect } from "@playwright/test";

test("complete chat flow", async ({ page }) => {
  await page.goto("http://localhost:3000/chat");
  await page.fill('[placeholder="输入你的问题..."]', "什么是深度学习？");
  await page.click("text=发送");
  // 等待 Agent 回复出现
  await expect(page.locator(".assistant-message")).toBeVisible({ timeout: 30000 });
});

test("knowledge base upload", async ({ page }) => {
  await page.goto("http://localhost:3000/knowledge");
  await page.setInputFiles('input[type="file"]', "fixtures/sample.pdf");
  await expect(page.locator("text=上传成功")).toBeVisible({ timeout: 15000 });
});
```

### 6.5 测试覆盖目标

| 模块 | 测试类型 | 覆盖率目标 |
|------|----------|-----------|
| `app/services/llm.py` | 单元测试 | ≥ 90% |
| `app/services/knowledge.py` | 单元测试 | ≥ 85% |
| `app/agent/graph.py` | 单元测试 | ≥ 80% |
| `app/api/*.py` | 集成测试 | 全接口覆盖 |
| 前端核心组件 | React Testing Library | ≥ 80% |
| 主要用户流程 | Playwright E2E | 全场景覆盖 |

### 6.6 功能验证清单

- [ ] DashScope 模型连接正常，可切换 qwen-max / qwen-plus / qwen-turbo
- [ ] 文档上传、切分、向量化入库流程无误
- [ ] 知识库问答能正确检索并引用来源
- [ ] 代码助手能生成、执行代码并返回结果
- [ ] 数据分析场景可处理 CSV 并生成图表
- [ ] 通用工具工作流可组合多工具完成复杂任务
- [ ] 前端对话界面流式展示 Agent 思考步骤
- [ ] docker-compose 一键启动所有服务且容器间通信正常
- [ ] `.env` 环境变量正确注入所有容器
