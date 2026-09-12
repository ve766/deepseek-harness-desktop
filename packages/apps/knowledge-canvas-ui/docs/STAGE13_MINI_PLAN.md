# Stage 13 Mini Plan — Knowledge OS 产品化进入路线（仅设计，不编码）

**Stage**：13 — Re-evaluate how the Knowledge OS kernel enters the productization phase
**类型**：Mini Plan（设计文档，仅规划，不编码）
**Baseline**：`44411de`（Stage 12 Closed Node，历史保持不变）
**纪律**：仅提交本 Mini Plan 文档；**不修改任何代码**、**不安装环境**（Python/LightRAG/Ollama/Scrapling/Docker）、**不引入 Runtime / Workflow**、**不进入 Stage 13 coding**。
**状态**：🟡 已写好，停在 **审核节点（Review Node）**，等待 D 项裁决。

---

## 0. 范围与纪律声明

本 Mini Plan 仅对「Knowledge OS 内核如何进入产品化」做**重新评估与设计**，产出路线、缺口分析与决策点（D 项）。**不落地任何代码**，不触碰 `packages/llm/*`、不接真实后端、不装运行时。

所有既有红线在 Stage 13 编码（若后续获批准）时继续生效：
- 不引入新的 Runtime / Workflow / Agent framework（仅可复用 harness 已有的 `agent-loop`/`workflow`，且须经 D 裁决）。
- `KnowledgeBackend` 5 方法接口契约不变；`importSourceAs` 保持接口外 seam。
- 不修改 `llm-router` / `ai-provider-manager` / `agent-loop` 内部实现，除非 D 裁决明确放宽。
- per-commit scope freeze：Mini Plan → 审核 → 明确批准 → 才编码。

---

## 1. 当前状态盘点（代码实证，非臆测）

> 来源：`packages/apps/knowledge-canvas-ui/src/` + `packages/llm/*` + 仓库根设计文档，已逐文件核实。

### 1.1 知识层（Knowledge Layer）— 已成形
| 组件 | 路径 | 状态 |
|------|------|------|
| `KnowledgeBackend` 5 方法接口 | `types.ts:165-174` | `listNodes/listEdges/importSource/getNeighbors/getMemory`，契约锁定 |
| `importSourceAs(src, ownerAgent?)` seam | `mockBackend.ts:81` / `lightRAGBackend.ts:62` | 接口外扩展，不破坏 5 方法契约 |
| `MockBackend`（当前默认后端） | `mock/mockBackend.ts:16` | 内存数组，seed 数据；`importSourceAs` 写 `ownerAgent`+`aiStatus:'draft'` |
| `LightRAGBackend`（真实适配器） | `knowledge/backends/lightRAGBackend.ts` | 5 方法 + `importSourceAs` 全实现，委托 `LightRAGClient` |
| `InMemoryLightRAGClient` | `knowledge/backends/inMemoryLightRAGClient.ts` | 真实运行，但实体/关系抽取为**确定性规则**（伪抽取，非 LLM） |
| `LightRAGHttpClient` | `knowledge/backends/lightragHttpClient.ts` | 真实 HTTP 客户端，需**活的 lightrag-server** |
| 摄入层 registry | `knowledge/ingestion/ingestion.ts:62-69` | `chat/url/pdf/video/github`；`url` 走 Scrapling 但**默认 feature-flag OFF**；pdf/video/github 为 placeholder |
| 权限 + 贡献 seam | `knowledge/lens/knowledgeAccess.ts` / `employeeKnowledgeAccess.ts` | `resolvePermission` + `contribute`（仅经 `importSourceAs`，缺失即 `backend-unsupported`） |
| 单点 seam | `knowledge/knowledgeUniverse.ts` | `createBackend()`（Mock↔LightRAG 切换）、`getSharedUniverse()` 单例、`bindEmployee/bindEmployeeAccess` |

### 1.2 推理层（Inference Layer）— 真实现成但未接线
| 组件 | 路径 | 状态 |
|------|------|------|
| `LlmRuntime` | `packages/llm/llm` | 真实适配器注册表 + 流式 `prepareCall/stream` |
| `llm-ollama` | `packages/llm/llm-ollama/src/*` | **真实 Ollama 客户端**；`config.ts` 默认 `http://localhost:11434/v1`（即你本机 Ollama）；`health.ts` `GET /api/tags` 探测 |
| `llm-router` | `packages/llm/llm-router/src/*` | 真实 cordis Service `ctx.llmRouter`，`service.ts:160 prepareCall`，委托 `ai-provider-manager` + `ctx.llm` |
| `ai-provider-manager` | `packages/llm/ai-provider-manager/src/*` | 真实：`detectOllama/detectDeepSeek` + `recommend()`（cloud→local→offline） |
| **接线状态** | — | ❌ 三个包**均未在 host/Electron 注册**；仅出现于自身 `src/tests`。Harness Agent Core 走 `ctx.llm.prepareCall`，**不经过 router**（`ARCHITECTURE-AGENT-ROUTER-INTEGRATION.md` 为设计未实现） |
| **知识 app 推理** | `knowledge-canvas-ui/src` | ❌ **零 LLM 推断**：全目录 grep `@deepseek-ai/dsh-llm/llmRouter/ctx.llm/prepareCall/stream` 均为 0 命中。该 app 是**孤岛 Vite 原型**，不 import cordis/agent-loop |

### 1.3 Employee 表面 — 展示 + 贡献，无执行
`EmployeeCard/EmployeeCenter/EmployeeKnowledgeDetail/useEmployeeKnowledgeAccess`（只读投影）、`EmployeeKnowledgeContribute/useEmployeeKnowledgeContribute`（受权限 gate 的单次写，`aiStatus` 恒 `'draft'`，**不自动确认**）、`EmployeeKnowledgeSuggestions`（注释明确 PURE READ-ONLY，无推荐 Runtime/无 Agent 行为）。**无任何 agent/tool/workflow 接线**（harness 有 `agent-loop/workflow/goal/plan/subagent`，但本 app 不消费）。

### 1.4 VTuber Avatar + Voice — 视觉有，声音无
- **Avatar/Mascot 真实**：`AgentAvatar.tsx` + `components/morphicons/`（状态驱动 morphicon 系统）+ `ui-desktop/src/assets/mascots/`（仅 `assistant` 狗 / `nox` 猫 有 PNG；`knowledge`/`task` 回退首字母）。
- **Voice/TTS/STT 完全缺失**：全仓 grep `tts/stt/speech/voice/audio/elevenlabs/whisper` 在知识 app 内无任何实现；无 voice 包。
- **Knowledge Brain 映射**：知识层本身即「脑」底料（图 + Memory + owner 归因），但**无 LLM 推理接线** → 今日「脑」= 知识图 + 记忆（展示 + 贡献），推理为后续接线步骤。

### 1.5 既有设计文档约束（必须尊重，但须重新审视）
- `IMPLEMENTATION-KNOWLEDGE-GALAXY-MVP.md` §0：❄️ 冻结「仅扩展 `knowledge-canvas-ui`、**不修改 `llm-router`/`ai-provider-manager`/`agent-loop`**、**保留 MockBackend**、**不接真实后端**」。
- `IMPLEMENTATION-KNOWLEDGE-CANVAS-MVP.md`：孤岛 Vite app，**不碰 `packages/llm/*`、无真实 AI**。
- 这些冻结在 MVP 原型期合理；**但 Stage 13 产品化的本质就是突破「mock-only / 无 LLM 接线」**，故构成核心张力 → 列为 D1 决策点。

---

## 2. 五焦点分析

### 2.1 AI Employee 推理层缺口
- **缺口**：知识/Employee 表面**完全没有 LLM 推理路径**；推理层（`llm-*`）已真实存在但**既未注册进 host，也未被知识 app 消费**。
- **产品化方向**：
  1. **接线（host 侧，属 Environment/Integration 范畴）**：把 `llm-ollama` + `llm-router` 注册进 host 运行时（设计已见于 `ARCHITECTURE-AGENT-ROUTER-INTEGRATION.md`，未实现）；使你本机 `qwen3:8b` 成为可用推理源。
  2. **暴露只读推理 seam 给知识 app**：新增一个**只读**「问脑 / 摘要 / 解释」接口（如 `askBrain(query) → stream`），**不引入 agent runtime、不写回、不执行**。
- **决策点（D）**：Stage 13 是否放宽 Galaxy MVP 的「无 LLM 接线」冻结？放宽到何种程度（仅只读推理 vs 允许写回/执行）？

### 2.2 真实 LightRAG / Ollama 环境接入
- **缺口**：LightRAG **运行时未安装**；`InMemoryLightRAGClient` 用伪抽取；`LightRAGHttpClient` 需活的 `lightrag-server`。
- **产品化方向（环境准备，非本 Stage 编码）**：
  1. 单独 **Environment Preparation Plan**（遵循 Stage 12 纪律，独立提交）：`pip install "lightrag-hku[api]"` + 起 `lightrag-server` + 设 `VITE_LIGHTRAG_BASE_URL` / `setLightRAGRuntimeConfig({baseURL})` → `createBackend()` 切到 `LightRAGBackend`。
  2. **关键解耦**：真实 LightRAG 的 LLM 抽取发生在 `lightrag-server` **内部**，由其配置使用 Ollama 作为抽取 LLM —— 这与 app 内的 `llm-ollama` 适配器是**两件事**，须分别处理。
  3. Scrapling 默认 OFF；`url/pdf/video/github` 真实摄入需 Phase-2 Python sidecar（亦属环境准备）。
- **决策点（D）**：何时排程 Environment Preparation？是否现在就批准独立的环境准备 Plan？

### 2.3 大规模知识库验证
- **缺口**：`MockBackend` 与 `InMemoryLightRAGClient` 均内存、无分页/索引/查询规划；知识层**无 vitest 规格**、无基准脚手架。
- **产品化方向**：
  1. 验证须基于**真实 `LightRAGHttpClient` 后端** + 生成数千节点的 seed（LightRAG/NetworkX 处理规模，内存客户端不行）。
  2. 补知识层 vitest 规格（确定性、分页契约——若真实后端引入分页、neighbor 打分契约）。
  3. 定义规模基准指标：节点数、查询延迟、neighbor 打分质量、贡献闭环吞吐。
- **决策点（D）**：规模目标（千/万级节点）？核心指标与达标线？是否纳入 Stage 13 范围？

### 2.4 Employee：从知识展示 → 任务执行
- **缺口**：今日 Employee = 展示 + 贡献，**零执行**；harness 有 `agent-loop/workflow` 但知识 app 不消费。
- **产品化方向（分阶段）**：
  - **P1（本 Stage 维持）**：展示 + 贡献。
  - **P2（只读推理）**：接 2.1 的 `askBrain`，让 Employee「能回答关于知识的提问」。
  - **P3（任务执行）**：经 **harness 已有** `agent-loop/workflow` **委派**执行（在知识 app **外部**运行），**不在知识 app 内嵌新 Runtime/Workflow**。
- **决策点（D）**：任务执行是否进入 Stage 13 范围，还是推迟到 Stage 14+？（鉴于「不引入 Runtime/Workflow」约束，P3 大概率**超出** Stage 13。）

### 2.5 VTuber Avatar + Voice + Knowledge Brain
- **缺口**：Avatar/Mascot 真实（仅 assistant+nox 有资产）；**Voice 完全缺失**；Brain 有数据模型但无推理。
- **产品化方向**：
  1. **Avatar**：把 mascot 资产扩展到 `knowledge`/`task` 员工（补齐四角色视觉家族）。
  2. **Voice（绿地）**：引入 TTS/STT。须遵守无 Runtime 约束 —— 优先**本地 TTS**（可借 Ollama 或轻量本地模型）或云 TTS；STT 用于「语音问脑」。
  3. **Brain**：2.1 的只读推理无缝成为「与你的知识对话」的 Brain 能力。
- **决策点（D）**：Voice 用本地 vs 云 TTS？是否纳入 Stage 13，还是单独 Stage？四角色 Avatar 扩展是否现在做？

---

## 3. 产品化进入路线（建议序列，待 D 裁决定夺）

```
阶段 A — Stage 13（若批准，编码受限）
  ├─ 知识层「只读推理 seam」设计 + 最小接线（askBrain，不写回/不执行）
  ├─ 放宽 Galaxy 冻结的 D 裁决落地（仅限只读推理）
  └─ 知识层 vitest 规格 + 规模基准骨架（针对真实后端契约）
阶段 B — Environment Preparation（独立 Plan，遵循 Stage 12 纪律）
  ├─ 安装 lightrag-server（Python）+ 起服务 + 配 Ollama 抽取 LLM
  ├─ 注册 llm-ollama + llm-router 进 host
  └─ 翻 createBackend() → LightRAGBackend；开 Scrapling flag + Phase-2 sidecar
阶段 C — Stage 14+（后续）
  ├─ 大规模验证（数千节点 seed + 基准达标）
  ├─ Employee 任务执行（委派 harness agent-loop/workflow）
  └─ VTuber Voice + 四角色 Avatar 扩展
```

> 关键判断：**Stage 13 的「产品化进入」应以「设计 + 受限只读推理接线 + 测试骨架」为主**；真实后端接入（阶段 B）与任务执行/语音（阶段 C）需各自独立 Plan，不在本 Stage 编码内。

---

## 4. 决策点（D 项，待用户裁决）

| # | 决策 | 选项（草案） |
|---|------|--------------|
| **D1** | 是否放宽 Galaxy MVP「mock-only / 无 LLM 接线」冻结？ | (a) 维持冻结，Stage 13 纯设计不接线；(b) 仅放开**只读推理** seam；(c) 放开到写回/执行（不推荐，违反无 Runtime 约束） |
| **D2** | Stage 13 编码范围（若批准）覆盖哪些焦点？ | 仅 2.1 只读 seam？+ 2.3 测试骨架？其余留设计？ |
| **D3** | LightRAG/Ollama 环境准备是否现在批准独立 Plan？ | 现在排程 / 延后到 Stage 13 设计确认后 |
| **D4** | 任务执行（2.4 P3）是否进入 Stage 13？ | 进入（需委派 harness，不嵌 Runtime）/ 推迟 Stage 14+（建议） |
| **D5** | VTuber Voice（2.5）范围？ | 本地 TTS / 云 TTS / 推迟独立 Stage |
| **D6** | 规模验证（2.3）目标与指标？ | 节点规模、延迟/质量达标线、是否纳入 Stage 13 |

---

## 5. Stage 13 红线（若获批准进入编码，须继承）

1. 不在 `knowledge-canvas-ui` 内引入新 Runtime / Workflow / Agent framework。
2. 不修改 `llm-router` / `ai-provider-manager` / `agent-loop` 内部，除非 D1 明确放宽。
3. 保留 `MockBackend` 为默认；`LightRAGBackend` 仅经 config 可选启用（不安装运行时）。
4. **不安装** Python / LightRAG / Ollama / Scrapling / Docker（环境准备单列 Plan）。
5. 不写回、不自动确认：`contribute` 行为（`aiStatus:'draft'`、`ownerAgent` 归因、权限 gate）不变。
6. per-commit scope freeze；每子步先获显式批准才编码。

---

## 6. 结论

Knowledge OS 内核已具备**扎实的数据与贡献基座**（5 方法接口 + `importSourceAs` seam + 权限 + 真实 `LightRAGBackend`/`llm-*` 适配器代码），产品化的主要障碍是**接线与环境**，而非架构缺失。本 Mini Plan 重评估了五个焦点、标定了缺口与方向，并将「放宽冻结 / 范围 / 环境准备时机 / 执行与语音边界」凝练为 **D1–D6 决策点**。

**本 Plan 停在审核节点，等待 D 项裁决。未批准前不进入任何 Stage 13 编码。**
