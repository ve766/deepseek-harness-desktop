# STAGE14 P2-4 Mini Plan — Agent Core / Runtime 接线前设计

> 阶段：**P2-4 接线前设计评审（design-only）**。本轮**不实现 runtime、不创建代码**，只回答「契约如何产生消费者」的五个问题并给出接线顺序。
> 前置：P2-3 Contract Stability Review 已通过（`2817603`），contracts 7 文件冻结，新增 F12 / R-6 两条长期规则。

---

## 0. 本阶段边界

**目标**：把已经冻结的 7 份契约，规划出**第一个真实消费者**的路径，并确定 Agent 执行流、provider routing、local-only 强制、写入治理四者的落点。

**明确不是**：不是开发 Agent，不是实现 runtime，不是接入真实 LLM 编排。

**继续冻结**：WebGL · 粒子银河 · 3D 城市 · Renderer 实现 · Plugin runtime · Bridge adapter · LangGraph · Agent Core 拆包 · 新依赖 · 云端实装。

---

## 1. 现状证据（接线点清单，均为实测而非推断）

| 类别 | 位置 | 事实 |
|---|---|---|
| 契约层 | `src/contracts/` ×7 | 782 行，type-only，**消费者 = 0**（R-6 触发源） |
| 组装根 | `knowledge/knowledgeUniverse.ts:61` `createBackend()` | 选 `LightRAGBackend` / `MockBackend`；`getSharedUniverse()` 单例 |
| 后端契约 | `types.ts:165` `KnowledgeBackend` | 五方法；`lightRAGBackend.ts:62` 另有 `importSourceAs(src, ownerAgent?)` |
| Lens 只读 | `knowledge/lens/knowledgeAccess.ts:53,100` | Agent 经 lens 读 KG，能力探测 `importSourceAs` |
| 状态写入面 | `store/canvasStore.ts` | `addNode/addEdge/addRelationship/removeNode/removeEdge/setNodes/setEdges/setClusters/addCluster/setRecommendations/setProgress/setLearningPaths/clearAiGenerated/autoClusterIfNeeded` —— **Applier 的唯一合法落点集** |
| **伪 Agent 执行流** | `src/demo/sequencer.ts` | `runImportDemo/runDemoFlow` **直写 store 13+ 个 API**（`setAiState`/`setAiStage`/`setInsight`/`addNode`/`addEdge`/`addCluster`…）—— 即当前**唯一**的"Agent"，且**完全绕过 Proposal** |
| LLM 唯一出口 | `llm/llmContext.ts:442` `getLlmClient()` | F4；`providerConfig.ts` 提供 `resolveLlmProviderChain()`、`FAILOVER_ELIGIBLE_CODES` |
| 临时桥 | `llm/llmContext.ts:507` | `window.__kcuLlmHost = { getLlmClient, getLlmProviderStatus, … }` |
| 任务词汇 | `contracts/agentRun.ts:17` | `TaskKind = 'extract' \| 'classify' \| 'plan' \| 'qa' \| 'summarize'` |

**关键观察**：当前系统里"Agent"这个角色实际上是 `demo/sequencer.ts` —— 一个脚本化状态机，直接调用 store setter。它是 P2-4 要替换的对象，也是 Proposal 链迟迟无法闭合的原因：**写入根本没有经过治理层**。

---

## 2. Q1 — contracts 如何产生第一个消费者

**新增规则 R-6（P2-3 裁决）**：任何 runtime 实现必须至少消费一个对应契约。

```
Renderer runtime  → Renderer contract
Agent runtime     → AgentRun contract
Plugin runtime    → Bridge contract
```

### 建议接线顺序（按风险从低到高）

| 序 | 消费者 | 契约 | 风险 | 理由 |
|---|---|---|---|---|
| **P2-4.1** | **ActivityBus 运行时**（user + ingestion 两源） | `activityEvent` + `activityBus` | **最低** | 只读订阅，不触碰任何写入路径；即使出错也只是少一条事件 |
| P2-4.2 | Agent Run 骨架（turn 结构化，暂不接真实 LLM） | `agentRun` | 中 | 产出结构而非知识；可并行于 demo 运行 |
| P2-4.3 | 真实 LLM 接入（经 `getLlmClient()`） | `agentRun` + routing | 中高 | 引入不确定延迟与失败语义 |
| P2-4.4 | KnowledgeApplier 实现 | `knowledgeWrite` | **最高** | 唯一改动知识真相的路径 |

### Bus 生命周期（Q4 既有裁决，此处落点）

- **创建**：宿主组装根（在 `getSharedUniverse()` 同级新增宿主上下文），**不是** 组件
- **持有**：宿主上下文单实例
- **销毁**：宿主 teardown 时 `dispose()`
- **禁止**：`component -> new ActivityBus()`

### 第一个消费者的验收判据

1. 一个真实 UI 交互（如 `node.clicked`）产生一条 `ActivityEvent` 并被订阅方收到
2. 一次真实 ingestion（`importSource` / LightRAG insert）产生 `document.imported` → `extraction.completed` 事件序列
3. `contracts/activityEvent.ts` 与 `activityBus.ts` 在编译图上**被 import**（目前为 0）

---

## 3. Q2 — AgentRun 如何进入真实执行流

### 现状 → 目标

```
现状：  demo/sequencer  ──直接──>  store 13 个 setter        （无审计、无 Proposal）
目标：  UI intent → AgentRun → Turn → ToolCall → Result
                        │
                        ├─ 进度/状态 → ActivityEvent → UI 订阅
                        └─ 知识变更 → KnowledgeWriteProposal → Applier → store
```

### 三条硬约束（沿用 P2-2 裁决）

1. **进度只经 ActivityEvent 外显** —— `setAiState` / `setAiStage` / `setInsight` 不再由执行流直接调用，改为事件驱动订阅。**这是 `aiState` 语义的迁移，不是新增。**
2. **执行流只产出 Proposal，不直接写 store**
3. **取消必须协作式** —— 不得强杀留下半截写入

### 分步建议

| 步 | 动作 | 是否接 LLM |
|---|---|---|
| 4.2a | 定义 run 执行器骨架，turn 结构化，**复用现有 demo 脚本的时序**产生真实事件 | 否 |
| 4.2b | UI 从「订阅 store 的 aiState」切到「订阅事件」 | 否 |
| 4.3 | turn 的 LLM 调用经 `getLlmClient()`（F4 唯一出口） | 是 |
| 4.4 | 抽取结果封装为 Proposal → Applier | 是 |

**过渡策略**：`demo/sequencer` **保留不删**（它是 UI 的现有时序来源，删了会破坏展示），但在 4.2b 之后它退化为「事件回放源」—— 这与 ActivityBus 的 `replay()` 设计正好对上：**脚本化 demo 可被录好的事件流取代**。

---

## 4. Q3 — Provider routing 放在哪里

**落点建议**：新增 `src/llm/routing.ts`，**留在 kcu 包内**（遵守「不拆 Agent Core 包」）。

**不在**：UI · 插件 · Applier · backend 层。
**理由**：隐私红线必须在一个地方强制，分散即失效（P2-2 裁决 2）。

```
routing.ts
  输入：TaskKind（extract/classify/plan/qa/summarize） + privacy 约束
  处理：resolveLlmProviderChain() → 过滤 → 排序
  输出：单个 LlmProviderProfile
  调用者：仅 Agent Run 执行器
```

**优先级（不可协商在前）**

| 序 | 规则 | 性质 |
|---|---|---|
| 1 | `privacy = 'local-only'` → 只保留本地 profile | **产品红线** |
| 2 | 能力匹配（严格输出 / 长上下文 / 多模态） | 硬约束 |
| 3 | 成本档 / 延迟档 | 偏好 |
| 4 | failover（`FAILOVER_ELIGIBLE_CODES`） | 兜底 |

**当前实测落点**：ingestion（extract）→ `qwen3:8b` 本地（P1 已证唯一可用）；轻量 Agent（classify/简单 plan）→ `qwen3:4b` 候选（**需单独验证，不可默认成立**）。

---

## 5. Q4 — local-only 如何进入 runtime enforcement

**三重强制（缺一不可）**

| 层 | 机制 | 关键点 |
|---|---|---|
| ① routing 解析前 | **先过滤后选择**，不是"选中云端后拒绝" | 云端 profile 在候选集里就**不存在** |
| ② failover 运行时 | 白名单剔除 remote | 否则本地故障会自动漂到云 |
| ③ Applier 二次校验 | 纵深防御 | 路由出错时，写入前再拦一次 |

**③ 需要一个新契约字段**（⚠️ 需裁决）：Applier 要二次校验，就必须知道这次 run 走了哪条路由。方案是把 routing 决策随 Proposal 传递：

```
AgentRun.routingDecision → ProposalSource（或 proposal 上下文）→ Applier 校验
```

这属于**对已冻结契约 `knowledgeWrite.ts` 的演进**，按 Q7 先例应**独立步骤单独验收**，不顺手改。

**"本地"如何判定（实现细节，但影响正确性）**：不能相信 profile 自称 `kind:'ollama'` —— 应校验 **base URL host 是否为本机回环**（`127.0.0.1` / `localhost` / `::1`）。否则一个 `kind:'ollama'` 但指向远程的 profile 就能绕过红线。

**失败语义**：`local-only` 下无可用 profile → **run 失败并明确报错**，不得静默降级到云。

---

## 6. Q5 — KnowledgeWriteProposal 如何连接 Applier

**Applier 落点**：新增 `src/knowledge/write/`（候选名），是**唯一**写入通道。

**合法调用面（穷举，来自 §1）**：
`addNode` `addEdge` `addRelationship` `removeNode` `removeEdge` `setNodes` `setEdges` `setClusters` `addCluster` `setRecommendations` `setProgress` `setLearningPaths` `autoClusterIfNeeded`

> 超出此集合的 store API（视图/选中/外观类：`setView` `setSelection` `setAppearance` …）**不得**由 Applier 调用 —— 它们不属于知识真相。

**事务语义**：逐 op 应用，`applied + failed == ops.length`（部分成功是设计而非异常）；失败 op 用 **before-state 快照**回滚同批已应用 op（P2-2.3 Q1 裁决）。

**双通道收敛路径**

| 阶段 | Agent 写入 | UI 手工编辑 | demo sequencer |
|---|---|---|---|
| 4.4 | ✅ 走 Proposal | ❌ 直写 store | ❌ 直写 store（保留） |
| 后续 | ✅ | ✅ 走 Proposal（`source.kind='user'`） | 退化为事件回放源 |

**诚实披露**：R-2（UI 不得绕过 Agent Core）在 4.4 阶段**只兑现一半**（Agent 侧），UI 侧与 demo 侧仍是直写。全通道收敛是后续工作，不应塞进 P2-4.4 一次性做完。

---

## 7. 推荐顺序

```
P2-4.1  ActivityBus runtime + 两源接线        ← 第一个消费者，最低风险
   ↓
P2-4.2  AgentRun 骨架（不接 LLM）+ UI 改订阅事件
   ↓
P2-4.3  routing.ts + local-only 强制（含契约演进步骤） + 真实 LLM 接入
   ↓
P2-4.4  KnowledgeApplier + Proposal 通道（仅 Agent 侧）
   ↓
P2-4.5  demo/sequencer 退化为事件回放源
```

**为什么 bus 先行**：它只增不删、零写入风险，且能把「契约零消费者」这个 R-6 风险立刻降到 0，同时为 4.2 的状态外显提供通道 —— 后者没有 bus 就只能继续直写 `setAiState`。

---

## 8. 风险

| # | 风险 | 说明 | 缓解 |
|---|---|---|---|
| R1 | **契约漂变** | 契约长期无消费者会变成"契约墓地" | R-6 + 4.1 立即接线 |
| R2 | **双轨期状态冲突** | demo 直写 store 与事件驱动 UI 并存 | 4.2b 一次性切换订阅源，不留半切换态 |
| R3 | **local-only 判定被绕过** | 依赖 profile 自称 kind 而非 host | 校验 base URL 回环地址 |
| R4 | **契约演进偷渡** | routing 决策字段顺手加进 `knowledgeWrite.ts` | 独立步骤 + 单独验收（Q7 先例） |
| R5 | **Applier 越权** | 调用视图/选中类 store API | 白名单穷举 + review 检查 |
| R6 | **范围膨胀** | 一次性做完 UI 通道 + demo 迁移 | 按 §6 排序，每步独立验收 |

---

## 9. 待裁决

| # | 问题 | 我的建议 |
|---|---|---|
| **Q-A** | P2-4.1 是否以 ActivityBus 作为第一个消费者？ | 建议是（风险最低且能立刻消掉 R-6） |
| **Q-B** | 是否接受「4.4 只兑现 Agent 侧写入治理，UI/demo 侧后续收敛」？ | 建议接受（避免范围膨胀） |
| **Q-C** | routing 决策是否写入 Proposal（需演进 `knowledgeWrite.ts`）？ | 建议是，但**独立步骤单独验收** |
| **Q-D** | `local-only` 判定是否采用 **base URL 回环校验**（而非 profile 自称）？ | 建议是 |
| **Q-E** | demo/sequencer 保留为过渡还是 4.5 直接删除？ | 建议保留→退化为回放源，不删 |
| **Q-F** | 本 Mini Plan 是否提交？ | 建议提交（kcu 惯例路径，单文件） |

---

## 10. 红线与状态

| 项 | 状态 |
|---|---|
| HEAD | `2817603`（本轮未产生 commit） |
| 本轮改动 | **0**（仅新增 1 个未跟踪文档） |
| 根 `src ' M'` | 0 |
| 全仓 | 99 M / 143 ?? / **0 D** |
| package.json / lockfile | 未触碰 |
| 服务 | 未启动（Ollama 11434 常驻、LightRAG 9621 停） |

---

## 11. 裁决结论（已批准）

### 11.1 六项裁决

| # | 裁决 | 落地 |
|---|---|---|
| **Q-A** | ActivityBus 作为第一个消费者 | ✅ 批准。**P2-4.1 范围收窄为：event publish / subscribe / lifecycle 三件事**。**不做** replay engine · persistence · distributed event system · event sourcing。**ActivityBus 是进程内事件通道，不是数据库** |
| **Q-B** | 4.4 只兑现 Agent 侧治理 | ✅ 批准。P2-4.4 目标限定为**关闭 `Agent → Store` bypass**。UI 手工编辑与 `demo/sequencer` 登记为 **legacy mutation path**，后续单独迁移，**禁止顺手删除** |
| **Q-C** | routing 决策进入 Proposal | ⚠️ **不直接改**。routing/provider 选择属 **execution provenance**，不是 knowledge mutation。新增字段前必须走 **新 Mini Plan → Contract review → migration**。**禁止**直接追加 `proposal.routing = xxx` |
| **Q-D** | local-only 用 base URL 回环校验 | ✅ 批准。**配置声明不是事实**。local-only 必须同时校验 **provider kind + endpoint hostname + failover candidates**；profile 自称 `kind:'ollama'` 但指向 `https://cloud-api.xxx` **必须拒绝** |
| **Q-E** | demo/sequencer 保留 | ✅ 批准。定位从 **Agent implementation** 降级为 **Demo Replay Source**：未来 `demo/sequencer → ActivityBus`，作为 UI 演示 / regression / replay / contract testing 的数据源 |
| **Q-F** | 本 Mini Plan 提交 | ✅ 单文件提交 |

### 11.2 P2-4 实施顺序（冻结）

```
P2-4.1  ActivityBus          （publish / subscribe / lifecycle）
   ↓
P2-4.2  AgentRun skeleton
   ↓
P2-4.3  routing + local-only enforcement
   ↓
P2-4.4  KnowledgeApplier runtime seam
   ↓
P2-4.5  demo sequencer replay 化
```

### 11.3 新增 P2-4 红线（R-7）

> **禁止 Agent Runtime 直接调用 `store.setXXX()`。**

任何状态变化必须走：

```
Intent → Run → Event / Proposal → Controlled mutation
```

即：执行流只能产生 **ActivityEvent（状态外显）** 或 **KnowledgeWriteProposal（知识变更）**，由受控通道落地。
`demo/sequencer` 作为 legacy path 暂时豁免，但**不得新增**同类直写。

### 11.4 当前架构状态

```
Contracts Layer                Runtime Layer                Visualization
─────────────────              ─────────────────            ─────────────
Activity        ✅             ActivityBus     ← P2-4.1     WebGL     ❌
SceneGraph      ✅             Agent Executor  ← P2-4.2     Particle  ❌
Renderer        ✅             Routing         ← P2-4.3     3D City   ❌
AgentRun        ✅             Applier         ← P2-4.4
KnowledgeWrite  ✅
Bridge          ✅
```

**继续保持**：不拆 Agent Core · 不做 LangGraph · 不做多 Agent handoff · 不做 WebGL · 不做粒子系统 ·
不做插件 runtime · 不增加依赖 · 不提前云化。

---

**状态**：🟢 **P2-4 Mini Plan 通过**。下一节点 = **P2-4.1 Mini Implementation Review**（仅设计，不直接大改）。
