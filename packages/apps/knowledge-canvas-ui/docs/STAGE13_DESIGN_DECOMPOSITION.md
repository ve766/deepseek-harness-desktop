# Stage 13 Design Decomposition — Knowledge OS 产品化进入路线

> 状态：**设计拆分（design-only）**。不修改代码、不安装环境、不引入 Runtime / Workflow。
> 父计划：`STAGE13_MINI_PLAN.md`（commit `867e7ca`）。
> 裁决来源：用户 D1–D6 裁决（2026-09-09）。
> 纪律：各子项须各自走 **Mini Plan → 审核 → 明确批准 → 编码**；本文档停在审核节点。

---

## 0. D1–D6 裁决记录（来自用户）

- **D1**：批准放开**只读** LLM 推理接线。路径：`Employee → LLM Router → Knowledge Access → Universe → Response`。禁止 Runtime / Workflow / Tool Execution / **KG Memory 写入**。
- **D2**：Stage 13 Coding 范围 = ① LLM 推理接线 ② LightRAG/Ollama Environment Preparation Plan（仅设计）③ Knowledge Scale Benchmark。
- **D3**：批准提交独立 Environment Preparation Plan；**暂不安装任何环境**。
- **D4**：任务执行、多 Agent、Workflow **延后**。
- **D5**：Voice / TTS / VTuber 接入 **延后**，仅保留产品路线。
- **D6**：规模验证目标 = **100 PDF + 50 Web + 10 GitHub Repo**；指标 = **ingest 成功率、query latency、内存占用、稳定性**。

---

## 1. 当前代码事实盘点（已源码级核实，file:line）

### 1.1 LLM 推理层：真实存在，但完全未接线
- `packages/llm/llm`：`LlmRuntime extends Service`（index.ts:284）、`LlmAdapter` 基类、`PreparedLlmCall`（index.ts:155）、`GenerateOptions`（types.ts:341）、消息/错误类型。这是 LLM 运行时注册中心。
- `packages/llm/llm-ollama`：cordis 插件 `apply(ctx, config)` inject `['llm']`（index.ts:27-37）；`OllamaAdapter extends LlmAdapter`（adapter.ts:159）；`detectOllama(baseURL)`（health.ts:59）；`DEFAULT_BASE_URL='http://localhost:11434/v1'`（config.ts:11）。即**本机 Ollama（qwen3:8b / qwen2.5-coder:7b）已是该适配器的默认目标**。
- `packages/llm/ai-provider-manager`：`detect(options)`（detect.ts:100）返回 `DetectionReport`；`detectOllama` / `detectDeepSeek`；`recommend(report, mode)`（recommend.ts:20）。即 provider 自动探测 + 推荐已具备。
- `packages/llm/llm-router`：`LlmRouter extends Service`（service.ts:77）；`RouterRequest` / `RouterConfig` / `RouterMode`；`resolveMode`（resolve.ts:18）、`autoChainFrom(recommended)`（resolve.ts:34）、`sourceOf`（resolve.ts:23）；`apply(ctx, config, internals)` inject `['llm']`（service.ts:256）。即按 provider source 路由已具备。
- 其它同构 cordis 插件：`llm-deepseek`、`llm-pi-ai`、`llm-retry`。
- **关键事实**：以上全部是 **cordis 服务/插件**（`extends Service` + `apply(ctx)` + `inject`），设计为注册进 **Electron host (cordis Context)**。而 `knowledge-canvas-ui` 是**独立 Vite 原型**，当前**零 LLM 推断**。→ S13-A 的核心分叉点见 §4 OA。

### 1.2 语义检索：已在 LightRAG 适配器中实现，但被 lens 层 seed 限制挡住
- `LightRAGBackend.getNeighbors(nodeId, text)`（lightRAGBackend.ts:72-92）内部已并行执行 `client.getGraphNeighbors(nodeId)` **与** `client.query(text)`（lightragHttpClient.ts:88，`POST /query`，`top_k:10`），并将图邻近(0.5) + 查询相关度融合打分。即**语义检索已通过现有接口可达**。
- 但 `employeeKnowledgeAccess.query(seedNodeId, text)`（employeeKnowledgeAccess.ts:55,91）要求 `seedNodeId`，注释明写 `D3-c; no free search`——即 lens 层**只允许 seed-node 邻居查询，无自由文本检索**。
- `KnowledgeBackend` 5 方法接口（types.ts:165-174）**不含 query**；`importSourceAs` 是接口外 seam（lightRAGBackend.ts:62），与 mockBackend 同构。
- → S13-A 要支持开放问答，必须暴露"自由文本检索"。两种路径见 §4 OB。

### 1.3 知识接入入口
- `knowledgeUniverse.bindEmployeeAccess(id)`（knowledgeUniverse.ts:131）是 app 使用的 lens 入口，返回 `EmployeeKnowledgeAccess`。
- `EmployeeKnowledgeAccess` 已含 `listOwned / listAll / query(seedNodeId,text) / memory / summary / contribute`（employeeKnowledgeAccess.ts:44-68）；`canWrite` 由 permission 派生（read→false），天然支撑只读约束。
- `KnowledgeUniverseSeamProbe`（knowledgeUniverse.ts:141-166）是暴露到 window 的 seam 模式——可作为 host 接入 LLM 的参考。

---

## 2. 拆分子项概览

| 子项 | 目标 | 范围(IN) | 范围(OUT) | 关键设计 | 验收门 |
|---|---|---|---|---|---|
| **S13-A** LLM 只读推理接线 | Employee 问答经 LLM Router 接地知识，只读 | 新 `ask()` lens 方法；检索 seam；llmBridge | Runtime/Workflow/Tool/KG 写 | OA+OB 决策 | 见 S13-A |
| **S13-B** LightRAG/Ollama 环境准备 Plan（仅设计） | 可执行的安装/配置 Plan | 文档化安装/配置/验证/回滚 | 不执行安装 | LightRAG 部署形态/embedding 选型 | 文档评审通过 |
| **S13-C** Knowledge Scale Benchmark | 规模验证 harness 设计 | 数据集生成器设计、指标采集、报告 | 不实际跑大规模（依赖 S13-B 环境） | 数据集来源/阈值 | harness 设计评审通过 |

---

## 3. 跨切面约束（红线延续，必须遵守）
- 禁 Runtime / Workflow / Tool Execution / KG Memory 写入（D1）。
- 沿用 seam 模式（`OwnedImportCapable` / `importSourceAs` / `KnowledgeUniverseSeamProbe`），不破坏 `KnowledgeBackend` 5 方法契约（除非 OB 选接口扩展并经裁决）。
- MockBackend 默认；LightRAGBackend 经 env / window seam opt-in，无回归。
- 不安装 Python / LightRAG / Scrapling / Docker（D3：Plan 可写，安装延后）。

---

## 4. 待裁决开放决策（进入编码前必须 D 项裁定）
- **OA — LLM 运行时宿主**：
  - (a) 原型内 cordis bootstrap（自包含，验证用）；
  - (b) Electron host 集成（生产路径）；
  - (c) 分阶段：先 (a) 验证再 (b) 生产。
  - **推荐 (c)**。
- **OB — 自由文本检索暴露方式**：
  - (a) 新增 `KnowledgeQueryCapable` 探针（沿用 `OwnedImportCapable` seam，不改 5 方法接口，MockBackend 不支持→`backend-unsupported`，LightRAGBackend 实现 `query(text)`）；
  - (b) 直接扩展 `KnowledgeBackend` 接口加 `query`。
  - **推荐 (a)**。
- **OC — S13-A 首落点**：先原型验证 vs 直接 host。**建议随 OA(c) 先原型**。

---

## 5. 推迟路线（仅产品路线图，D4/D5）
- **D4**：任务执行 / 多 Agent / Workflow → 延后至 Stage 14+（禁止在 S13 引入 Runtime/Workflow）。
- **D5**：Voice / TTS / VTuber Avatar 接入 → 仅保留产品路线；当前仅 Avatar/Mascot 真实（assistant + nox PNG），Voice/TTS 完全缺失。结合方向：**Knowledge Brain（知识层）+ Avatar（视觉）+ Voice（TTS/STT）** 三层，S13 不实现。

---

## 6. 进入编码的前置纪律
各子项须各自走 **Mini Plan → 审核 → 明确批准 → 编码**。本分解文档停在审核节点，待 **OA / OB / OC** 裁定后，再为每个子项出 Mini Plan。
