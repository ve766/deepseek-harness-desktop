# S13-B: LightRAG / Ollama Environment Preparation Plan（仅设计）

> 本文档为**可执行的安装/配置 Plan**，但**仅设计，不执行**（D3：批准提交，暂不安装）。
> 父文档：`STAGE13_DESIGN_DECOMPOSITION.md` §2 / §3。
> 纪律：不安装 Python / LightRAG / Scrapling / Docker（D3：Plan 可写，安装延后）。

---

## 1. 目标
为真实 LightRAG + Ollama 环境准备一份可复核的**安装 / 配置 / 验证 / 回滚 Plan**，使 knowledge app 可经 env / window seam 切到 `LightRAGBackend` 做真实检索与规模验证（S13-C）。

---

## 2. 组件与职责

1. **Ollama（本机已运行 localhost:11434）**
   - 确认模型：`qwen3:8b`（问答）、`qwen2.5-coder:7b`（代码）。复用 `llm-ollama` 默认 `DEFAULT_BASE_URL`（`config.ts:11`）。
   - 校验：`ai-provider-manager.detectOllama('http://localhost:11434/v1')` 返回可用。

2. **LightRAG Server（Python，待安装）**
   - 提供 HTTP API：`POST /documents/text`、`POST /query`、`GET /graphs`（见 `lightragHttpClient.ts:14`）。
   - 本机 GPU **RTX 3060 6GB** → 选轻量 embedding + 轻量 LLM（问答走 Ollama，LightRAG 仅做检索/图谱，不强制本地 LLM）。向量库从轻量起步。
   - 部署形态待裁决：Docker vs 本地 venv（受 6GB 显存与 Docker 安装约束）。

3. **Scrapling（可选，Web 抓取）**
   - Web 源 ingestion 用；feature-flag 门控（`ingestion.ts` 注册表已含 `url` / `web` 路径占位）。

4. **knowledge app 连接**
   - `LightRAGHttpClient` 已存在（`lightragHttpClient.ts`），指向 `LIGHTRAG_BASE_URL`（新增 env）。
   - `LightRAGBackend` 已就绪（`lightRAGBackend.ts`），经 env flag 或 window seam opt-in。

---

## 3. 配置 / 环境变量
- `LIGHTRAG_BASE_URL`（LightRAG HTTP 根）
- `OLLAMA_BASE_URL`（默认 `http://localhost:11434/v1`）
- 可选 `LIGHTRAG_EMBEDDING_MODEL`（受 6GB 显存约束选型）
- `KNOWLEDGE_BACKEND=lightrag|mock`（切换开关，**默认 mock**）

---

## 4. 验证（环境就绪判定）
- LightRAG `POST /query` 返回非空 hits。
- Ollama `/v1/models` 含 `qwen3:8b`。
- knowledge app 切 `KNOWLEDGE_BACKEND=lightrag` 后 `listNodes()` 非空、`getNeighbors(seed, text)` 含 query 命中。

---

## 5. 安全 / 回滚
- MockBackend **始终默认**；LightRAGBackend opt-in，不修改默认路径。
- 安装/启动失败不影响现有 mock 路径（绿灯回归）。
- 任何一步失败即停，记录于本报告，不强行继续。

---

## 6. 安装顺序（仅列表，不执行）
1. Ollama 校验（已运行）
2. LightRAG 安装 + 启动（部署形态待裁决）
3. Scrapling（如需 Web 抓取）
4. 连通性验证（Ollama ↔ LightRAG ↔ app）
5. 切后端冒烟验证

---

## 7. 约束重申
- 本机曾约束"不安装 Python/LightRAG/Scrapling/Docker"——本 Plan 批准其**设计为后续执行用**，但 D3 明确"暂不安装"，故本 Plan **不触发任何安装命令**。
- 不引入 Runtime / Workflow。

---

## 8. 决策点
- LightRAG 部署形态（Docker vs 本地 venv）
- embedding 模型选型（受 6GB 显存约束）
