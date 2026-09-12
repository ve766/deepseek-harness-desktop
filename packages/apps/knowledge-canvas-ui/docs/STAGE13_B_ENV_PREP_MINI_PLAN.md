# S13-B Mini Plan：LightRAG / Ollama 环境准备（仅设计，待审核）

> **状态**：🟡 独立 Mini Plan，提交至架构审核节点。**本文档不执行任何安装命令。**
> **父文档**：`STAGE13_B_ENV_PREP_PLAN.md`（高层设计，commit `e6d02bd`）、`STAGE13_DESIGN_DECOMPOSITION.md` §2/§3。
> **关系**：本 Plan 是对父文档两大待裁决项（部署形态 / embedding 选型）的**具体化与执行分解**，并修正其中 2 项已过时的环境假设（见 §2.3）。
> **纪律**：Mini Plan → 架构审核 → 明确批准 → 执行。审核前不安装、不改代码。

---

## 1. 目标与边界

### 1.1 目标
为 knowledge app 准备一套**可复核、可回滚**的真实 LightRAG + Ollama 环境，使 `createBackend()` 能经**既有配置 seam**切到 `LightRAGBackend` 做真实检索，为 S13-C 规模基准提供底座。

### 1.2 硬约束（本 Plan 遵守）
- ❌ 不安装任何环境（审核前）
- ❌ 不修改任何代码
- ❌ 不接入 Agent Runtime / Workflow
- ❌ 不修改 `KnowledgeBackend` 五方法接口（`types.ts:165-174`）
- ✅ MockBackend **始终为默认**；LightRAG 为 opt-in

---

## 2. 环境现状核实（只读探测，已实测）

### 2.1 软件
| 组件 | 实测结果 | 结论 |
|------|---------|------|
| **Docker** | `docker: command not found` | ❌ **未安装** |
| **Python** | `python` → 3.13.14；`py` → 3.14.0 | ✅ 已具备，**无需安装 Python** |
| **Ollama CLI** | `ollama --version` → 0.32.5 | ⚠️ 已装，但见 2.2 |
| **Ollama 端点** | `11434` 无响应；CLI 报 `could not connect to a running Ollama instance` | ❌ **当前未运行** |

### 2.2 硬件（跨项目长期事实）
- GPU：NVIDIA RTX 3060 Laptop，**6 GB 显存**（最大约束）
- CPU：i5-11260H；内存 15.8 GB
- 已有 Ollama 模型：`qwen3:8b`、`qwen2.5-coder:7b`

### 2.3 ⚠️ 对父文档的环境假设修正（重要）
| 父文档 `STAGE13_B_ENV_PREP_PLAN.md` 原述 | 实测 | 修正 |
|---|---|---|
| §2.1「Ollama（本机**已运行** localhost:11434）」 | 未运行，11434 无响应 | 需补 **Step 1：启动 Ollama** 并验证 |
| §7「环境未装 Python…」 | Python 3.13.14 / 3.14.0 已具备 | venv 路线**无需装 Python**，仅需建 venv |

> 这两项修正使「本地 venv」路线的成本显著低于父文档预估。

---

## 3. 代码侧契约核实（file:line，决定「连接方式」）

| 事实 | 位置 | 含义 |
|------|------|------|
| `createBackend()` 是**唯一切换点** | `knowledgeUniverse.ts:61-87` | 后端切换只改此处配置，不改接口 |
| 优先级 1：解析到 LightRAG 配置 → `LightRAGBackend + LightRAGHttpClient` | `:62-74` | **真实服务端路径** |
| 优先级 2：`__KCU_ENABLE_LIGHTRAG_BACKEND===true` → 内存原型 | `:75-85` | 原型路径（非本 Plan 目标） |
| 默认 / 任何异常 → `MockBackend` | `:86`、`try/catch` `:71-73,:81-84` | **天然回滚**：失败即回落 |
| `resolveLightRAGConfig()` 三层优先级 | `lightragConfig.ts:53-69` | runtime > `VITE_LIGHTRAG_BASE_URL` > `globalThis.__KCU_LIGHTRAG_BASE_URL` |
| 返回 `null` 即回落 Mock | `lightragConfig.ts:60` | 回滚只需让配置解析失败 |
| 仅用 3 个 HTTP 端点 | `lightragHttpClient.ts:14` | `POST /documents/text`、`POST /query`、`GET /graphs` |
| 鉴权 | `lightragHttpClient.ts:60-64` | `X-API-Key` 头（`VITE_LIGHTRAG_API_KEY`） |
| 安装源（代码注释明示） | `lightragHttpClient.ts:2` | `pip install "lightrag-hku[api]"` |
| Scrapling 开关 | `lightragConfig.ts:85-87`、`scraplingAdapter.ts:28-30` | `ENABLE_SCRAPING`，**默认 OFF**，关闭时抛 `ScrapingDisabledError` |
| Scrapling 为 Phase 1 占位 | `scraplingAdapter.ts:8-11` | Phase 2 才接 Python sidecar |

**结论：连接所需的一切 seam 均已存在，本 Plan 的连接步骤为「零代码改动」。**

---

## 4. 安装范围

### 4.1 IN SCOPE（批准后才执行）
1. **启动 Ollama 服务**并验证 `/v1/models` 含 `qwen3:8b`；按需 `ollama pull nomic-embed-text`（embedding，见 §5.2）
2. **建 Python venv**（不装 Python 解释器）：`F:/dsh-lightrag/venv`
3. **安装 LightRAG**：`pip install "lightrag-hku[api]"`（依据 `lightragHttpClient.ts:2`）
4. **启动 `lightrag-server`**，绑定 §5 规划端口与数据目录
5. **数据目录创建**（§6）
6. **连通性验证 + 切后端冒烟**（§8）
7. **回滚演练**（§9）

### 4.2 OUT OF SCOPE（明确不做）
- 安装 Docker / Docker Desktop（当前未装，且需 WSL2/Hyper-V，成本高）
- 任何代码改动
- 修改 `KnowledgeBackend` 五方法接口
- 接入 Agent Runtime / Workflow
- Scrapling（默认 OFF，建议**延后至 Phase 2**，见 DP4）
- CI / 生产部署 / 端口对外暴露（仅绑定 `127.0.0.1`）

### 4.3 部署形态建议（DP1，待裁决）
- **推荐：本地 Python venv**。理由：Docker 未安装且引入成本高；Python 已具备；6GB 显存下 venv 直连本机 GPU 无虚拟化损耗。
- 备选：Docker（需先装 Docker Desktop，成本高，本 Plan 不推荐）。

---

## 5. 端口规划

| 服务 | 端口 | 绑定 | 状态 | 说明 |
|------|------|------|------|------|
| **Ollama** | `11434` | `127.0.0.1` | 既有约定 | `llm-ollama` 默认 `DEFAULT_BASE_URL`；`VITE_OLLAMA_BASE_URL` 默认同址 |
| **LightRAG server** | `9621` | `127.0.0.1` | **规划** | LightRAG 官方默认端口；与下表无冲突 |
| FreeLLMAPI 本地网关 | `31415` | 本机 | 已占用（他项目） | **规避**，不复用 |
| Vite dev server | `5173` | 本机 | 既有 | **规避** |
| Scrapling sidecar | `8787` | `127.0.0.1` | **预留（Phase 2）** | 本 Plan 不启用 |

- 冲突核验：`9621` 与 `11434` / `31415` / `5173` 均不冲突（DP6 待确认）。
- 原则：**仅绑定回环地址**，不对外暴露；LightRAG 与 Ollama 均本机直连。

---

## 6. 数据目录规划

> 统一置于**仓库之外**，避免污染 git（因此**无需改 `.gitignore`，无 repo 改动**）。

```
F:/dsh-lightrag/                 # 根（仓库外，非 git  tracked）
├── venv/                        # Python 虚拟环境
├── working_dir/                 # LightRAG 工作目录
│   ├── kv_store/                # 文档 / 文本块 KV
│   ├── vdb/                     # 向量库
│   └── graph/                   # 知识图谱（实体/关系）
├── inputs/                      # 待 ingest 的原始文档（S13-C 用）
├── logs/                        # 启动与查询日志
└── backup/                      # 回滚归档（§9）
```

- 仓库路径为 `F:/deepseek-harness-.../`，数据根与之同级，路径短、无空格、无中文（规避 Windows 编码问题）。
- `working_dir` 为 LightRAG 的 `--working-dir` 指向；**图谱是唯一真源**，删除即重建。

---

## 7. 与现有 KnowledgeBackend seam 的连接方式（**零代码改动**）

### 7.1 连接链路（复用既有 seam，不新增抽象）
```
LightRAG server (127.0.0.1:9621)
        ↑ HTTP: POST /documents/text · POST /query · GET /graphs
LightRAGHttpClient  (lightragHttpClient.ts)
        ↑ 实现 LightRAGClient 契约 (lightragClient.ts)
LightRAGBackend     (lightRAGBackend.ts) —— 实现 KnowledgeBackend 五方法
        ↑ 由 createBackend() 选中 (knowledgeUniverse.ts:61-87)
App / lens / UI     —— 完全 unaware（R6）
```

### 7.2 切换方式（二选一，均不改代码）
| 方式 | 操作 | 痕迹 | 适用 |
|------|------|------|------|
| **A. 运行时 globalThis（推荐先做）** | 浏览器控制台：`window.__KCU_LIGHTRAG_BASE_URL='http://127.0.0.1:9621'` 后刷新 | **零文件改动** | 冒烟验证 |
| **B. `.env.local`** | 包根写 `VITE_LIGHTRAG_BASE_URL=http://127.0.0.1:9621` | 单文件，通常 gitignored | 持久化 |

- 两者均被 `lightragConfig.ts:53-69` 已支持；配置生效后 `createBackend()` 自动选 `LightRAGBackend`。
- **不修改 KnowledgeBackend 五方法接口**：`LightRAGBackend` 本就实现五方法；S13-A 新增的 `query()` 属**接口外扩展**（同 `OwnedImportCapable` 范式），经 `KnowledgeQueryCapable` seam 暴露，接口本身零改动。

### 7.3 失败即回落（内建安全）
`createBackend()` 对 LightRAG 构造包了 `try/catch`（`knowledgeUniverse.ts:71-73`），服务端不可达 / 配置缺失 → 自动 `MockBackend`。

---

## 8. 验证方案（环境就绪判定）

| # | 断言 | 判据 |
|---|------|------|
| V1 | Ollama 在线 | `GET 127.0.0.1:11434/v1/models` 含 `qwen3:8b` |
| V2 | embedding 可用 | `nomic-embed-text` 已在模型列表 |
| V3 | LightRAG 在线 | `GET 127.0.0.1:9621/graphs` 返回 200（可为空图） |
| V4 | 写入可用 | `POST /documents/text` 返回 200 且含 `doc_id` |
| V5 | 检索可用 | `POST /query` 返回非空 `results` |
| V6 | app 切后端 | 设 §7.2 方式 A → 刷新 → `createBackend()` 选中 `LightRAGBackend` |
| V7 | 五方法可用 | `listNodes()` 非空、`getNeighbors(seed,text)` 含 query 命中 |
| V8 | 只读语义保持 | 面板仅展示，无写回；`query()` 走 `KnowledgeQueryCapable` |

任一失败 → 停止，记录，按 §9 回滚（不改代码、不强推）。

---

## 9. 回滚方案（分层，全部为环境操作，**无需 git revert**）

> 因连接为**配置态**、代码零改动，回滚不涉及任何 commit 回退。

| 级别 | 触发 | 动作 | 恢复判据 |
|------|------|------|----------|
| **L0 瞬时** | 切后端后异常 | 删除 `window.__KCU_LIGHTRAG_BASE_URL`（刷新）或删 `.env.local` | 刷新后 `createBackend()` 回落 `MockBackend`，UI 正常 |
| **L1 停服** | 不再需要真实检索 | 停 `lightrag-server`；Ollama 可保留（他项目在用） | app 走 Mock，`try/catch` 兜底 |
| **L2 卸载** | 放弃 venv 路线 | 删除 `F:/dsh-lightrag/venv/` | Python 系统环境未受影响（venv 隔离） |
| **L3 清数据** | 彻底清理 | 先归档到 `F:/dsh-lightrag/backup/<ts>/`，再删 `F:/dsh-lightrag/` | 磁盘释放，仓库无残留 |

- **L0 是主要兜底**：`resolveLightRAGConfig()` 返回 `null` 即回落（`lightragConfig.ts:60`），且 `createBackend()` 另有 `try/catch`。
- 每次安装前**先建回滚点**：记录端口占用、venv 包清单（`pip freeze > backup/requirements.<ts>.txt`）。
- Ollama 为**跨项目共享**（他项目在用），**不列入删除范围**，仅停/启。

---

## 10. 风险与约束

| 风险 | 等级 | 缓解 |
|------|------|------|
| **6GB 显存不足**：`qwen3:8b`+embedding 同载 | 高 | 选小 embedding（`nomic-embed-text` ~274MB）；Ollama 空闲自动卸载；必要时降 LLM |
| Ollama 当前未运行，可能被他项目依赖 | 中 | 启动前确认；不改动其模型与全局配置 |
| LightRAG 首次 ingest 慢 / 抽取质量 | 中 | S13-C 小规模先行，再放量 |
| `9621` 端口潜在冲突 | 低 | 执行前核验；冲突则改 `9761` 备选 |
| Scrapling 引入网络依赖与不稳定 | 低 | 默认 OFF，Phase 2 再议 |
| 数据目录写满 F: 盘 | 低 | 目录外置 + 定期归档 |

---

## 11. 决策点（**待架构审核裁决**）

| # | 决策 | 建议 |
|---|------|------|
| **DP1** | 部署形态：Docker vs 本地 venv | **本地 venv**（Docker 未装，Python 已有） |
| **DP2** | embedding 模型 | **`nomic-embed-text`**（小，适配 6GB） |
| **DP3** | LightRAG 的 LLM 绑定 | **复用 Ollama `qwen3:8b`**（显存紧张时降规格） |
| **DP4** | Scrapling | **延后**（Phase 2），本 Plan 保持 flag OFF |
| **DP5** | 数据根 `F:/dsh-lightrag/` | 确认（仓库外，免 .gitignore 改动） |
| **DP6** | 端口 `9621` | 确认（备选 `9761`） |

---

## 12. 执行清单（**仅列表，审核前不执行**）

1. 启动 Ollama，验证 V1；按需 pull embedding（V2）
2. 建 venv：`F:/dsh-lightrag/venv`
3. `pip install "lightrag-hku[api]"`（依据 `lightragHttpClient.ts:2`）
4. 建数据目录（§6）；启动 `lightrag-server` 绑定 `127.0.0.1:9621` + `--working-dir`
5. 连通性验证 V3–V5
6. 切后端冒烟（§7.2 方式 A）→ V6–V8
7. 回滚演练 L0（§9）
8. 产出环境准备验收报告（**不自动进入 S13-C**）

---

## 13. 状态

🟡 **停在 S13-B Mini Plan 审核节点。** 未安装任何环境、未改任何代码、未接入 Runtime、未改五方法接口。
待 §11 决策点裁决 + 明确批准后，方可进入执行。**不自动进入 S13-B 编码或 S13-C。**
