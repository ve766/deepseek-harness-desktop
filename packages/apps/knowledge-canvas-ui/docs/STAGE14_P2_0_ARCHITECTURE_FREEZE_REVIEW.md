# STAGE14 P2-0 Architecture Freeze Review

> 状态：**架构冻结评审（design-only）**。不编码、不引依赖、不启动重构、不修改生产代码。
> 进入 P2 的前置节点。本评审通过并获批准后，才决定 P2 实施范围。
> 约束（用户 2026-09-11）：不开始粒子系统开发 · 不做 UI 美化 · 不拆插件到外部项目 · 不修改现有生产代码。

---

## 0. 结论摘要

| 项 | 结论 |
|---|---|
| 模块边界 | 6 层可辨识；**5 层边界成立**，**1 层无主**（Inference Runtime Policy） |
| 最严重风险 | **R1：UI 层 15 处直接 import `mock/*`** —— 不是"耦合后端"，是"耦合 fixture"，换真后端时 UI 会先坏 |
| 次要风险 | R2 LightRAG 隔离**靠注释声明，未被机器强制**；R5 Ollama 全局量无归属层 |
| 扩展接口 | 多 provider ✅ 已就绪；多 Agent ⚠️ 类型就绪、运行时缺失；Visualization ⚠️ 布局就绪、渲染器不可替换；插件 ✅ 平台侧就绪 |
| 冻结条目 | **11 条**（F1–F11），其中 F10/F11 为本次**新增收紧** |
| P2 禁止项 | **10 条**（N1–N10） |
| 待裁决 | **5 项**（D-P2-0-1 ~ 5） |

---

## 1. 前置：P1 关闭记录（继承决策）

| 子项 | 结论 | 落地状态 |
|---|---|---|
| P1-1 `EXTRACT_LLM_TIMEOUT=900` | ✅ **保留** | 已生效（`.env`） |
| P1-2 `MAX_GLEANING=0` | ❌ **不合入** | 已回退 |
| P1-3 batch insert | ❌ **不合入** | 未切 endpoint |
| P1-4A `qwen3:4b` 替代 ingestion | ❌ **不采用** | DP3 维持 `qwen3:8b` |
| P1-4B `FA + q8_0 + KEEP_ALIVE` | ✅ **批准保留** | ⏳ 待 `STAGE14_OLLAMA_RUNTIME_LAYER_CONFIG_REVIEW.md` 批准后落地 |

**瓶颈结论（P1 三次实测收敛，已修正归因）**：耗时主因是 **decode 阶段**（prefill ≈3% / decode ≈60%+），由**输出 token 长度 × 4.7 tok/s 的 decode 吞吐**决定；且 `qwen3:8b` 存在 **29.5% CPU offload**（已实测证实）。

**`qwen3:4b` 定位（本次裁决登记）**：保留，**不进入 ingestion pipeline**；调整为**轻量 Agent 模型候选** —— UI Agent / 命令解析 / 简单规划 / 本地辅助任务。**不删除。**

**遗留（按指示不处理）**：P1-3 根 `docs/` 重份保持遗留状态，**不再删除或移动历史文件**。

---

## 2. 现有模块边界盘点（file-level 证据）

### 2.1 层清单

| 层 | 责任 | 代码位置 | 规模 | 依赖方向 |
|---|---|---|---|---|
| **L5 UI 层** | 渲染与交互 | `src/components/` + `hooks/` + `i18n/` | **72 组件** | → L4（store selectors） |
| **L4 Store** | 单一状态树 + 选择器 | `src/store/canvasStore.ts` | ~440 行 | → L3（`KnowledgeBackend` 抽象接口） |
| **L3 Knowledge / Memory 层** | 知识资产、关系、检索、归属 | `src/knowledge/` | **11 文件** | → 后端 adapter / HTTP |
| **L2 Agent Core** | 推理调用、prompt 组装、provider 选择、流式与错误映射 | `src/llm/` | **2 文件**（20.3 KB + 11.4 KB） | → L2 下游 provider |
| **L1 Inference Runtime Policy** | 进程级推理资源策略 | **（无主）** — 现散落于 Ollama 环境变量 | — | — |
| **Plugin Runtime** | 宿主扩展基座（slot/注册/生命周期） | `packages/client/*` | **43 包** | 独立于 KG 原型，经 window seam 桥接 |

### 2.2 Knowledge Galaxy 前端（Canvas / Node / Edge / Store / Renderer）

| 关注点 | 文件 | 事实 |
|---|---|---|
| **Canvas** | `GalaxyCanvas.tsx` · `CanvasRegion` · `CanvasViewport` · `CanvasToolbar` · `BackgroundLayer` · `ClusterFrame` | 手写 SVG/CSS 合成 |
| **Node** | `GalaxyNode.tsx` · `KnowledgeNode.tsx` · `components/morphicons/*` | 无图渲染库 |
| **Edge** | `GalaxyEdgeLayer.tsx` · `EdgeLayer.tsx` | 同上 |
| **Store** | `store/canvasStore.ts` | ✅ `createStore(backend: KnowledgeBackend)` —— **依赖抽象接口，不依赖具体后端** |
| **Renderer / Layout** | `galaxyLayout.ts` | ✅ `layoutGalaxy(nodes: KnowledgeNode[]): Record<string,{x,y}>` —— **纯函数，仅 import types + `NODE_W`，零后端依赖** |

**渲染技术栈事实**：`package.json` 中图形相关依赖**仅** `react` / `react-dom`。**无** `@xyflow/react`、`d3`、`three`、`framer-motion`、`pixi`、`konva` —— 即当前渲染器是**手写实现**，不存在"库锁定"，但也**不存在渲染器抽象接口**。

### 2.3 Store 契约（L4）

`createStore(backend: KnowledgeBackend)` + `bindStore(s)` + 细粒度选择器：

```
useNodes · useEdges · useSelection · useAiState · useAiStage · useInsight · useConnectFrom
useClusters(=useGroups) · useMode · useRelationships · useLearningPaths · useProgress
useRecommendations · useAppearance · useActivePath
```

✅ **评价**：UI 与知识获取之间只有"store selector"一条通道，形态正确。

### 2.4 Knowledge / Memory 层（L3）

```
src/knowledge/
├── knowledgeUniverse.ts          ← 组装根：唯一真正 import LightRAG 具体类的文件（:25-28）
├── lens/
│   ├── knowledgeAccess.ts        ← 契约：只用 core types（注释声明 "never a LightRAG*"）
│   └── employeeKnowledgeAccess.ts
├── backends/
│   ├── lightragHttpClient.ts     ← ★ 全仓唯一出网点（/documents/text · /query）
│   ├── lightRAGBackend.ts        ← 实现 KnowledgeBackend 5 方法
│   ├── lightragMapping.ts · lightragConfig.ts · lightragClient.ts · inMemoryLightRAGClient.ts
└── ingestion/
    ├── ingestion.ts · scraplingAdapter.ts
```

| 事实 | 判定 |
|---|---|
| `KnowledgeBackend` 5 方法契约 | ✅ 无 `query`（自由文本检索经 seam 探针，OB 裁决） |
| 出网点集中度 | ✅ **仅 1 个文件**发起 HTTP |
| LightRAG 具体类 import | ✅ **仅 `knowledgeUniverse.ts` 一处** |
| 归属建模 | ✅ 节点/文档带 `ownerAgent?: AgentId` → 员工归属已是**数据层事实**，非 UI 装饰 |
| Space / Growth 边界 | ✅ 已由 `KNOWLEDGE_MODE_BOUNDARY.md` 固化（Import Rule：外部输入只能先入 Space） |

### 2.5 Model Provider 层（L2 的一部分）

`src/llm/providerConfig.ts` 导出面（已抽读）：

```ts
type LlmProviderKind = 'deepseek' | 'openai-compatible' | 'ollama'
interface LlmProviderProfile { providerKind; model?; baseURL?; credentialRef? }

// 4 层优先级（高 → 低）
1. runtime profile（window seam 注入）
2. build-time：Vite import.meta.env.VITE_KCU_LLM_* （仅非密）
3. window 全局
4. 默认：ollama / qwen3:8b

DEFAULT_LLM_PROVIDER_KIND = 'ollama'
DEFAULT_DEEPSEEK_CREDENTIAL_REF = 'DEEPSEEK_API_KEY'
DEEPSEEK_PROVIDER_ROUTE_KEY = 'deepseek'
FAILOVER_ELIGIBLE_CODES = ['NO_ADAPTER','TRANSPORT','TIMEOUT','SERVER','QUOTA']
```

**安全模型事实**：`credentialRef` 携带的是**密钥的名字，不是值**；源码注释明确「`import.meta.env` 会被内联进浏览器 bundle，故 `credentialRef` 刻意不从 `VITE_*` 读取；密钥只在 Node 路径从 `process.env` 读取」。

### 2.6 Plugin Runtime（宿主侧）

`packages/client/` = **43 个包**，含 `ui-slots` · `ui-primitives` · `ui-layout` · `ui-desktop` · `ui-knowledge` · `ui-workflow-run` · `ui-jobs` · `ui-goal` · `ui-plan` · `ui-subagent` · `ui-agent-preset` · `runtime` · `modules` · `schema-form` · `connection` · `hmr` · `locale` · `web` · `web-react` 等。

门禁已存在：**`dsh-client-bundle-purity`** —— 禁止跨插件 **value** import（类型可跨包，因擦除）。

⚠️ **关键事实**：`packages/apps/` 下**只有** `knowledge-canvas-ui` 一个包，且它是**独立 Vite 原型，不是 cordis 插件**。它与宿主的桥接面目前**只有 window 全局**（`window.__kcuLlmHost`、`KnowledgeUniverseSeamProbe`），**不是 cordis 注入**。

---

## 3. 当前架构图

```
┌─ L5  UI 层 ───────────────────── src/components/ (72) · hooks · i18n
│     GalaxyCanvas · GalaxyNode · GalaxyEdgeLayer · EdgeLayer · BackgroundLayer · ClusterFrame
│     EmployeeCard · EmployeeCenter · CommandCenter · NavigationRail · ProviderStatusCard · NoxResearchPanel
│        │                                                    ▲
│        │ ① 渲染路径：store selectors（形态正确 ✅）            │
│        │                                                    │ ⚠️ R1：15 处直接 import mock/*
│        ▼                                                    │      （agents 7 · sequencer 3 · data 3 · galaxy 1 · mockBackend 1）
├─ L4 Store ───────────────────── src/store/canvasStore.ts   │
│     createStore(backend: KnowledgeBackend)  ← 依赖抽象 ✅    │
│     useNodes · useEdges · useMode · useRelationships · useProgress · ...（15 选择器）
│        │                                                    │
│        ▼                                                    │
├─ L3 Knowledge / Memory 层 ───── src/knowledge/ (11 files)  │
│     knowledgeUniverse.ts  ← 组装根；全仓唯一 import LightRAG 具体类（:25-28）✅
│     lens/  knowledgeAccess · employeeKnowledgeAccess   ← 契约只用 core types
│     backends/  lightRAGBackend · lightragHttpClient(★唯一出网点) · lightragMapping · lightragConfig
│     ingestion/  ingestion.ts · scraplingAdapter.ts
│        │  HTTP：仅 2 端点  /documents/text · /query
│        ▼
├─ L2 Agent Core ──────────────── src/llm/  llmContext.ts (20.3KB) · providerConfig.ts (11.4KB)
│     providerConfig: deepseek | openai-compatible | ollama ✅ ·4 层优先级 ·credentialRef(名非值) ·failover 白名单
│     llmContext: NODE_PACKAGES → dsh-llm-ollama · window.__kcuLlmHost seam
│     ⚠️ 与 L3 处于同一包同一 src 树 —— 边界靠契约，非包边界
│
├─ L1 Inference Runtime Policy ── **（无主）**
│     OLLAMA_MODELS（已持久） ·  FA · KV_CACHE_TYPE · KEEP_ALIVE（待落地）
│     ⚠️ R5：进程级 + 全局作用域，对所有模型生效，provider abstraction 无法表达
│
└─ 外部 ── LightRAG 9621  →  Ollama 11434  (qwen3:8b + nomic-embed-text)

────────── 同时存在、物理分离（仅 window 全局桥接）──────────
  Electron host（cordis）· Plugin Runtime: packages/client/* (43 包)
     ui-slots · ui-primitives · ui-layout · ui-desktop · ui-knowledge · ui-workflow-run · ui-jobs · ui-agent-preset ...
     门禁：dsh-client-bundle-purity（禁跨插件 value import）
```

---

## 4. 特别风险检查（逐条判定）

### R1 — UI 是否直接耦合后端能力？

**判定：⚠️ 部分成立，但性质与预期不同 —— 不是"耦合后端"，是"耦合 fixture"。**

| 检查 | 结果 |
|---|---|
| UI → `knowledge/backends/*` 直接 import | ✅ **0 处**（`components/` + `hooks/` grep 为空） |
| UI → 硬编码端点（9621 / 11434 / `/documents` / `/query`） | ✅ **0 处**（出网仅在 `lightragHttpClient.ts`） |
| **UI → `mock/*` 直接 import** | ❌ **15 处** |

```
components → mock/agents      7 处
           → mock/sequencer   3 处
           → mock/data        3 处   ← 含领域常量 GROWTH_KINDS（定义在 mock/data.ts:174）
           → mock/mockBackend 1 处
           → mock/galaxy      1 处
```

**为什么这是真问题**：`mock/` 是**演示 fixture**。UI 直接读 fixture，意味着**领域常量被囚禁在 fixture 模块里**（`GROWTH_KINDS` 理应在领域层/`types.ts`），且**接真后端时 UI 会先于知识层损坏** —— 因为 UI 不经过 store/lens 就能拿到数据。

**风险等级：高**（不阻塞当前演示，但会在「Knowledge Galaxy 稳定化」阶段立刻暴露）。

### R2 — Knowledge Galaxy 是否直接绑定 LightRAG？

**判定：✅ HTTP 层已隔离；⚠️ 语义隔离层"靠注释声明，未被机器强制"。**

| 事实 | 值 |
|---|---|
| 全仓 `lightrag*` 提及文件数 | 16 |
| **真正的具体类 import** | **1 处** —— `knowledgeUniverse.ts:25-28` |
| 直接 HTTP 出网点 | **1 处** —— `backends/lightragHttpClient.ts`（`:131` /`:149`） |
| 其余 14 处提及的性质 | **注释中的隔离声明**，例如<br>`lens/knowledgeAccess.ts:9` "never a concrete backend, never a LightRAG*"<br>`lens/employeeKnowledgeAccess.ts:11` 同上<br>`components/useEmployeeKnowledgeAccess.ts:9` "must NEVER import LightRAG*"<br>`components/SharedKnowledgeSpace.tsx:55` "never reads KnowledgeBackend / LightRAG* directly" |

**评价**：隔离设计**意图明确、实现集中**，但**没有 lint/测试强制** —— 规则只写在注释里。风险是**单点膨胀**：`knowledgeUniverse.ts` 是唯一组装根，若无契约约束，后端选择逻辑会在此累积（Stage 7/8 的痕迹已可见，见其 `:54-62` 注释）。

**风险等级：低**（当前正确）+ **中**（长期漂移）。

### R3 — Agent 是否直接绑定 Ollama？

**判定：✅ 硬绑定已在 S14 P0 解除 —— Ollama 现为「默认」而非「唯一」。**

| 证据 | 位置 |
|---|---|
| provider kind 联合类型含 3 种 | `providerConfig.ts:26` |
| 默认零配置路径 = ollama | `DEFAULT_LLM_PROVIDER_KIND='ollama'`（`:55`）、`DEFAULT_LLM_MODEL='qwen3:8b'`（`:57`） |
| 适配器按 kind 分派 | `llmContext.ts:225` `NODE_PACKAGES = { ollama: '@deepseek-ai/dsh-llm-ollama' }`；`:243` `if (profile.providerKind === 'ollama')` |
| 云端 kind 已有 key 与路由键 | `DEFAULT_DEEPSEEK_CREDENTIAL_REF`（`:61`）、`DEEPSEEK_PROVIDER_ROUTE_KEY='deepseek'`（`:68`） |
| failover 白名单 | `FAILOVER_ELIGIBLE_CODES`（`:259`） |

**残留观察（非缺陷）**：`DEFAULT_OLLAMA_*` 是"零配置可用"的合理默认，但它同时意味着**离线兜底路径永远是 Ollama**。这不构成绑定，但应在 P2-2 明确记录。

**风险等级：低**。

### R4 — 模型配置是否应该进入 provider abstraction？

**判定：✅ 已经进入（S14 P0 完成）；但存在一层它**结构上管不到**的配置。**

| provider abstraction **能**表达 | provider abstraction **无法**表达 |
|---|---|
| 哪个 provider（3 种 kind） | `OLLAMA_KV_CACHE_TYPE`（KV 量化类型） |
| 哪个 model | `OLLAMA_FLASH_ATTENTION` |
| baseURL | `OLLAMA_KEEP_ALIVE`（驻留策略） |
| credentialRef（密钥名） | `OLLAMA_NUM_PARALLEL`（并发槽位） |
| provider chain + failover | `OLLAMA_GPU_OVERHEAD`（显存预留） |

**结构性原因**：前者是 **per-call 路由**（每次请求可选不同 profile）；后者是 **process-level 资源策略**（Ollama 进程启动时读取，全局生效）。

**结论**：这不是 provider abstraction 的缺陷，而是**缺失了一层**——见 §2.1 的 L1「Inference Runtime Policy（无主）」。当前这些量**没有归属层**，只能以"裸环境变量"形态存在，因而**不可版本化、不可按环境区分、不可与 provider profile 关联**。

**风险等级：中**（当前可用，但会成为多模型架构的债）。

### R5 — KV cache 等 Ollama 全局配置对未来多模型架构的影响

**判定：⚠️ 可预期的架构债 —— 且已被官方文档确认为设计限制。**

| 事实 | 来源 |
|---|---|
| `OLLAMA_KV_CACHE_TYPE` **是全局选项**，"all models will run with the specified quantization type" | Ollama 官方 FAQ |
| 该量化**需要 FA 启用**为前提 | 官方 FAQ（"when Flash Attention is enabled"） |
| 高 GQA 模型（**官方点名 Qwen 族**）对量化更敏感 | 官方 FAQ |
| 本机受影响模型 | `qwen3:8b`（ingestion）· `qwen2.5-coder:7b` · `qwen3:4b`（轻量 Agent 候选）· `nomic-embed-text` |

**影响推演（P2 及以后）**：

1. **无法 per-model 表达策略** —— 例如"8b 用 q8_0 省显存，coder:7b 用 f16 保精度"在当前架构下**不可能**，因为 KV 类型是进程级全局。
2. **未来引入云端 provider 后**，"本地腿"仍共享同一 KV 策略；abstraction 层对此**无话可说**。
3. **唯一的架构级解法是"多实例"** —— P1-4B 已验证该手法可行且零污染（第二实例承载 B 臂，用户的 11434 全程未被干扰）。这恰好是 L1 层未来应有的能力：**按"腿"划分实例，每实例一套全局策略**。

**已完成的缓解**：Step 2 配对 A/B 四项质量门槛全过（nodes 103.6% / edges 107.5% / failed 0 / 格式错误 0）。

**诚实缺口**：质量验证**仅覆盖 ingestion 抽取**，**未覆盖检索问答（QA）质量** —— 而 RAG 场景下 QA 质量才是 KV 量化的主要敏感面。

**风险等级：中**（已登记，需在 P2-2 补 QA 质量验证）。

### 3.x 风险汇总

| # | 风险 | 等级 | 状态 |
|---|---|---|---|
| R1 | UI 直接 import `mock/*`（15 处）+ 领域常量困在 fixture | **高** | 待解 → 建议作为 P2-1 首个动作 |
| R2 | LightRAG 隔离靠注释、未强制 | 低 / 长期中 | 登记 |
| R3 | Agent 绑定 Ollama | **低** | ✅ S14 P0 已解 |
| R4 | 资源策略无归属层 | 中 | 登记 → L1 显式化 |
| R5 | KV 全局性对多模型架构的债 | 中 | 登记；QA 质量验证缺口 |

---

## 5. 未来扩展接口检查

### E1 — 多模型 provider（Ollama / 云端 API）

**判定：✅ 已支持。**

- 3 种 `providerKind`；4 层优先级解析；profile chain + failover 白名单；`credentialRef` 名而非值的安全模型。
- **残余缺口**：provider profile 目前是**全局单例**（`setLlmProviderProfile` / `setLlmProviderChain`），**未与 `AgentId` 关联** ⇒ 若未来要"黑猫用云端、田园犬用本地"，需要扩展此层。

### E2 — AI Employee 多 Agent

**判定：⚠️ 类型/数据就绪，运行时缺失（符合 S13-D4 延后裁决）。**

| 已就绪 | 证据 |
|---|---|
| AgentId 联合类型（4 角色） | `types.ts:15` `AgentId = 'assistant' \| 'nox' \| 'knowledge' \| 'task'` |
| 员工 profile 表 | `mock/agents.ts:7` `AGENTS` · `:44` `AGENT_MAP` |
| **归属已是数据层事实** | `ownerAgent?: AgentId`（`types.ts:34` / `:92` / `:113`；`id: AgentId` @ `:184`） |
| UI 表面已存在 | `EmployeeCard` · `EmployeeCenter` · `EmployeeDetail` · `AgentAvatar` · `ui-agent-preset` · `ui-subagent` |

| 缺失 | 说明 |
|---|---|
| 编排 / 任务分派 | 无 orchestration（D4 明确延后） |
| per-agent provider 选择 | provider profile 为全局单例（见 E1） |
| 员工运行时状态机 | UI 有 `StateDot` 类展示，但无真实运行时状态源 |

**结论**：多 Agent 的**数据结构已预留且已在真实数据上使用**（`ownerAgent` 不是装饰）。P2-4 接入时**不需要改 schema** —— 这是一个正面发现。

### E3 — Visualization Engine（粒子 / Shader / Agent 活动可视化）

**判定：⚠️「数据 → 布局」已就绪且可复用；「布局 → 像素」**无替换接口**。**

| 关注点 | 事实 | 评价 |
|---|---|---|
| 布局计算 | `layoutGalaxy(nodes: KnowledgeNode[])` 纯函数，仅依赖 `types` + `NODE_W` | ✅ **与数据源解耦**，新引擎可直接复用 |
| 渲染实现 | 手写 SVG/CSS（`GalaxyNode` · `GalaxyEdgeLayer` · `BackgroundLayer`） | ⚠️ 与 React 组件树耦合，无 renderer 接口 |
| 图形库 | **无**（依赖仅 `react` / `react-dom`） | ➖ 无库锁定，但也无 WebGL/Canvas 层 |
| 活动可视化 | `aiActivity.ts` · `aiStages.ts` · `ThinkingRing` · `AiInsightPanel` | ➖ 状态词汇存在，无统一时间轴/事件总线 |

**结论**：未来粒子/Shader 引擎**不需要重写布局算法**，但需要在「布局输出」与「渲染实现」之间**新增一层 Renderer 契约**。该契约为**设计产物**，P2 不实现。

### E4 — 插件扩展能力

**判定：✅ 平台侧已具备；⚠️ KG 侧仍是独立原型，经 window 全局桥接。**

| 已具备 | 证据 |
|---|---|
| slot 机制 | `packages/client/ui-slots` |
| 插件自描述 | 各 `ui-*` 自带 `package.json` 的 `dsh.client.inject` |
| 纯净度门禁 | `dsh-client-bundle-purity`（禁跨插件 value import） |
| 现成 UI 表面 | `ui-desktop` · `ui-knowledge` · `ui-workflow-run` · `ui-jobs` · `ui-agent-preset` 等 43 包 |

| 待决 | 说明 |
|---|---|
| KG 是否迁为 cordis 插件 | 现状是独立 Vite 原型 + `window.__kcuLlmHost` / `KnowledgeUniverseSeamProbe` |
| 迁移代价 | 受纯净度门禁约束；且需 lockfile 变更（历史风险点，P1 期间仍为未解风险） |

**按用户约束「不拆插件到外部项目」**：本阶段**仅登记，不迁移**。

---

## 6. 推荐目标架构图

> 说明：**标注「P2 不实现」的框为设计产物，仅冻结边界，不进入实施。**

```
┌─ L6 Renderer 契约（设计产物 · P2 不实现）──────────────────────────────
│     layoutGalaxy(nodes) → 坐标   ──►   Renderer 接口
│                                           ├── SvgRenderer（现状，保持）
│                                           ├── Canvas/WebGL Renderer（未来）
│                                           └── Particle/Shader（未来）
├─ L5 UI 层 ──────────────────────────────────────────────────────────
│     ✅ 只读 store selectors + lens 契约
│     ❌ 禁止 import mock/*            ← F10（新增收紧）
│     ❌ 禁止直接调用 provider / LightRAG HTTP
├─ L4 Store ──────────────────────────────────────────────────────────
│     createStore(backend: KnowledgeBackend)      ← 不变（F2）
│     单一 mode 视图 · 禁双份存储 · 不引入 crossMode（F3）
├─ L3 Knowledge / Memory 层 ───────────────────────────────────────────
│     KnowledgeBackend 5 方法契约不变（F2）
│     组装根唯一（knowledgeUniverse.ts）· 出网点唯一（lightragHttpClient.ts）
│     Import Rule：外部输入 → Space；Growth 仅由 Relationship 派生（F1）
│     归属一律用 ownerAgent: AgentId（F6）
├─ L2 Agent Core ─────────────────────────────────────────────────────
│     唯一 LLM 出口（F4）· 对 KG 只读（F5）
│     per-call 路由：provider / model / baseURL / credentialRef
│     （未来：per-AgentId profile —— P2-2 评估，非本阶段）
├─ L1 Inference Runtime Policy（**本次显式化**）──────────────────────────
│     命名空间化资源策略，按"腿"划分：
│        local-ollama-11434  : FA / KV_CACHE_TYPE / KEEP_ALIVE
│        local-ollama-<port> : 第二实例策略（per-model 差异的唯一解法）
│        cloud-<provider>    : 无本地资源策略，走 credentialRef
│     ⚠️ 不再把这类量塞进项目 .env（F11）
└─ L0 Provider 实现 ──────────────────────────────────────────────────
      ollama | deepseek | openai-compatible（经 providerConfig 解析）
```

**目标图相对现状的 4 处变化**：

| # | 变化 | 性质 | P2 是否实施 |
|---|---|---|---|
| 1 | UI 层的 `mock/*` 依赖被切断 | 边界收紧 | P2-1（建议首发） |
| 2 | L1 Inference Runtime Policy 显式成层 | 归属澄清 | 配置方案 Review 已单独出 |
| 3 | 新增 L6 Renderer 契约 | 扩展点预留 | ❌ 不实现（仅冻结） |
| 4 | L2 抽为独立包 | 物理隔离 | ❌ 不实施（见 D-P2-0-1） |

---

## 7. 必须保持的边界（冻结条目 F1–F11）

| # | 边界 | 来源 | 备注 |
|---|---|---|---|
| **F1** | 外部输入**只能**先入 Space；Growth 节点**必须**由 Space 资产经 AI 理解 + Relationship 派生 | `KNOWLEDGE_MODE_BOUNDARY.md §7` | 禁止外部输入直接生成 Growth |
| **F2** | `KnowledgeBackend` **5 方法契约不变**；扩展走 seam 探针（`OwnedImportCapable` / `KnowledgeQueryCapable`） | S13-OB 裁决 | 不得直接改接口 |
| **F3** | 单一 `mode` 视图、**禁止双份数据存储**；**不引入 `crossMode`** | `KNOWLEDGE_MODE_BOUNDARY.md §6/§8` | 任务 #224 |
| **F4** | **Agent Core 是唯一 LLM 出口**；UI / Knowledge 层**不得**直接调用 provider | S14 P0 | 现有代码已满足 |
| **F5** | Agent Core 对 Knowledge **只读**；**禁止 KG Memory 写入** | S13-D1 | 只读边界 |
| **F6** | 员工归属**一律**用 `ownerAgent: AgentId`；**不得**新建并列 agent 字段 | 本次 | schema 已预留 |
| **F7** | **不恢复 `llm-router`**；provider 解析**只走** `providerConfig` 4 层优先级 | S14 P0 + 用户红线 | 历史红线 |
| **F8** | 新 UI 必须经 Plugin Runtime slot；**禁止跨插件 value import** | `dsh-client-bundle-purity` | 类型可跨包（擦除） |
| **F9** | `layoutGalaxy` 保持**纯函数契约**（输入 nodes → 输出坐标），不得引入后端/全局状态 | 本次 | 保住可视化扩展性 |
| **F10** | **UI 层禁止 import `mock/*`**；领域常量（如 `GROWTH_KINDS`）必须迁出 fixture 模块 | **本次新增（收紧）** | 对应 R1 |
| **F11** | **进程级推理资源策略不得写入项目 `.env`**；必须归属 L1 层 | **本次新增** | 对应 R4/R5 |

---

## 8. P2 阶段禁止修改项（N1–N10）

| # | 禁止项 | 依据 |
|---|---|---|
| **N1** | 不开始粒子系统 / Shader / WebGL 开发 | 用户约束 |
| **N2** | 不做 UI 美化 | 用户约束 |
| **N3** | 不拆插件到外部项目 | 用户约束 |
| **N4** | **不修改现有生产代码**（本评审阶段） | 用户约束 |
| **N5** | 不实装云端 provider（provider separation **已暂停**） | P1 裁决 |
| **N6** | 不调整 `MAX_ASYNC` / `OLLAMA_NUM_PARALLEL` 并发 | 既定顺序：先单请求后并发，尚未闭环 |
| **N7** | 不恢复 `llm-router` | 历史红线 |
| **N8** | 不新增依赖、不改 lockfile | 历史红线 |
| **N9** | **禁用 `git rm`** —— 改用 `rm` 工作区文件 → `git add <path>` → commit | git rm 事故（295 文件误删） |
| **N10** | 不删除 / 不移动历史文档（含 P1-3 根 `docs/` 重份） | 用户指示：登记遗留，避免扩大风险 |

**其余延续红线**：不改 UI 架构 · 不改 `packages/llm` · 不跨阶段实现 · 不自动进入下一 Stage（每阶段须 Mini Plan → 审核 → 明确批准）。

---

## 9. 后续开发优先级建议

### 9.1 用户给定的 P2 阶梯（登记）

```
P2-0 Architecture Freeze          ← 本文档
   ↓
P2-1 Knowledge Galaxy 稳定化
   ↓
P2-2 Agent Core 接入
   ↓
P2-3 Plugin Runtime
   ↓
P2-4 AI Employee Workflow
```

### 9.2 建议的 P2-1 首批动作（按风险排序，**待批准，未实施**）

| 优先 | 动作 | 对应 | 理由 |
|---|---|---|---|
| 1 | **切断 UI → `mock/*`（15 处）**，把 `GROWTH_KINDS` 等领域常量迁出 fixture | R1 / F10 | 风险等级最高；是"稳定化"的字面含义；不接真后端也值得做 |
| 2 | 为 `knowledgeUniverse.ts` 的组装根职责写**明确契约**（唯一 import 点 + 不得上移） | R2 | 防止后端逻辑继续向组装根累积 |
| 3 | 把 L1 资源策略**显式化**（配置方案 Review 已单独产出） | R4/R5 | 零代码，只需环境变量 + 文档 |
| 4 | 补 **QA 质量验证**（KV 量化对检索问答的影响） | R5 缺口 | 当前质量证据只覆盖 ingestion |
| 5 | （可选）`layoutGalaxy` 的 Renderer 契约**只写文档**，不实现 | E3 | 保住扩展性而不启动粒子开发 |

### 9.3 不建议在 P2 早期做的事

- ❌ 把 Agent Core 抽为独立包 —— 收益是"结构美感"，代价是纯净度门禁 + lockfile 风险；且不解决当前任何实测问题。
- ❌ KG 迁为 cordis 插件 —— 需 lockfile 变更，历史风险未解。
- ❌ 任何依赖"提高并发"的优化 —— 单请求调优尚未闭环（N6）。

---

## 10. 待裁决（D-P2-0-1 ~ 5）

| # | 问题 | 选项 | 建议 |
|---|---|---|---|
| **D-P2-0-1** | **Agent Core 的物理归属** | (a) 保持留在 `knowledge-canvas-ui/src/llm/`（seam 模式）(b) 未来抽为独立包 | **(a)** —— 本阶段不动；仅以契约（F4/F5）冻结边界。抽包的代价（纯净度门禁 + lockfile）不解决任何实测问题 |
| **D-P2-0-2** | **KG ↔ host 桥接面** | (a) 维持 window seam (b) 迁为 `ui-knowledge` 插件 | **(a)** —— 零架构变更；迁移留待 P2-3 评估（且受 N8 lockfile 约束） |
| **D-P2-0-3** | **UI → `mock/*` 解耦是否作为 P2-1 首个动作** | (a) 是，P2-1 首发 (b) 否，延后 | **(a)** —— 当前最高风险项；且属"稳定化"本义 |
| **D-P2-0-4** | **per-agent provider 是否纳入 P2-2 范围** | (a) 纳入（proposal 层扩展）(b) 不纳入 | **(b) 暂不纳入** —— 先完成"单一 provider 下 Agent Core 接通"，避免同时动两层 |
| **D-P2-0-5** | **L1 Inference Runtime Policy 的命名与归属** | (a) 仅文档登记（本次）(b) 写成正式契约文档 | **(b)** —— 建议升为契约文档，与 `KNOWLEDGE_MODE_BOUNDARY.md` 同级；否则 R4/R5 会持续复发 |

---

## 11. 红线自检

| 项 | 状态 |
|---|---|
| 仓库 HEAD | `3174bc5`（**未变**） |
| 仓库文件改动 | **0**（本轮全部为只读 grep / 文件清单 / 文档读取） |
| `src ' M'` | **0** |
| 全仓 modified / untracked | **99 M / 144 ??**（与实验前一致） |
| `packages/llm` · router · 依赖 · lockfile | 均未触碰 |
| 服务 / 环境 | 未启动 LightRAG；未加载模型；**系统环境变量未修改**；`.env` 未修改 |
| 本轮产出 | 2 份 design-only 文档（**未提交**） |
| Git 操作 | 无 commit / 无 `git rm` |

---

**状态**：🟡 停在 **P2-0 Review Node** —— 等待批准架构冻结，并裁决 D-P2-0-1 ~ 5 后再决定 P2 实施范围。
