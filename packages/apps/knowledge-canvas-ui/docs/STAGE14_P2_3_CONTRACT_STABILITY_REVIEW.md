# STAGE14 P2-3 Contract Stability Review

> 状态：**评估完成，停在 Review Node**。本次**不实现任何代码**，只回答四个问题：
> ① 是否有循环依赖风险 ② 能否支撑未来四类扩展 ③ 是否需要删减字段 ④ 主要稳定性风险。
> 上游：contracts 七契约（`fdcbc25` + `06f98c5` + `86851c3`）。

---

## 1. 循环依赖风险 —— **无（DAG 已验证）**

用程序解析真实 import 边（注释剥离后），并用 **DFS 三色标记 + Kahn 拓扑排序**双算法验证：

| 源 | → 目标 |
|---|---|
| `activityBus` | → `activityEvent` |
| `bridge` | → `activityBus`，→ `activityEvent` |
| `renderer` | → `sceneGraph` |
| `agentRun` | → `../types` |
| `knowledgeWrite` | → `../types` |
| `sceneGraph` | → `../types` |
| `activityEvent` | （无） |

- **环数量：0**（DFS 三色未发现回边）
- **拓扑排序成功**：`agentRun / bridge / knowledgeWrite / renderer / activityBus / sceneGraph / activityEvent → ../types`
- **外部依赖唯一**：`../types`（仅取 `AgentId`） —— 无 store / knowledge / llm / mock / demo / packages runtime / npm 包

**结论**：contracts 是**单向无环**的。当前结构不会出现循环依赖。

**风险等级**：低。但需注意 —— 无环是**现状**，不是自动保证的。若未来 `sceneGraph` 反过来 import `renderer`（例如把 capability 放进 IR），环立刻出现。**建议**：保持 `renderer → sceneGraph` 单向，IR 不得引用渲染能力枚举。

---

## 2. 四个未来扩展方向评估

### 2.1 WebGL Renderer —— **部分支撑**

| 能力 | 现状 | 评估 |
|---|---|---|
| 渲染器可替换 | `Renderer` 接口 + `RendererProbe` 降级链 | ✅ 充分 |
| 增量更新 / dirty region | `ScenePatch` + `DirtyRegion` | ✅ 充分（万节点刚需） |
| 动画语义 | `AnimationIntent`（kind/durationMs/easing/staggerMs） | ✅ 语义充分 |
| 资源释放 | `dispose()` | ✅ 充分 |
| **帧/时间源** | **无** —— 没有 `frame(timeMs)` 或 tick | ⚠️ **缺口** |
| **3D 视口** | `Viewport {x, y, zoom}` —— **仅 2D** | ⚠️ **缺口（仅影响 3D 城市）** |
| **3D 命中测试** | `hitTest({x, y})` —— **仅 2D 点** | ⚠️ **缺口（仅影响 3D 城市）** |

**结论**：

- **2D WebGL 粒子银河：充分。** 与 SVG 共享同一 2D 坐标空间，`layoutGalaxy` 输出可直接喂给粒子系统，业务层零改动。
- **3D 城市：不充分** —— 需要 3D `Viewport`（yaw/pitch/fov）与射线命中测试。但这是**在渲染契约内做加法**，不触碰业务层，护栏仍然成立。

**待决（不在此阶段做）**：帧/时间源。可二选一：(a) 由外部 rAF 每帧调 `apply()` 发 animate patch；(b) 给 `Renderer` 加 `frame(timeMs)`。建议留到真正实现 WebGL 时再定。

### 2.2 Plugin Source —— **结构充分，激活需一步**

| 项 | 评估 |
|---|---|
| 注册协议 | ✅ `ActivitySourceRegistration` + `RegistrableActivitySource` |
| 生命周期 | ✅ `ActivitySourceLifecycle`（initialize / dispose / health） |
| 错误隔离 | ✅ `BridgeResult` + 四域 + 不暴露 bus |
| **事件可发出** | ⚠️ **未激活** —— `ActivitySourceId` 仍为 `'user' \| 'ingestion'` |

**结论**：结构足以支撑插件源；**唯一阻塞是 Q7 的有意裁决**（`plugin:` 命名空间保留但未启用）。第一个真实插件接入时，走 `ActivitySourceId` evolution 三步：提案 → 兼容性评审 → 迁移。这是**已知且正确**的状态，不是缺陷。

### 2.3 Host Adapter —— **边界标记成立，细节待补**

| 项 | 评估 |
|---|---|
| 能力边界存在 | ✅ `HostContract { bridge, llmHost }` |
| 不绑 LLM / provider | ✅ `llmHost: unknown`（Q8 有意裁决） |
| 旧桥可共存 | ✅ `window.__kcuLlmHost` 未被删除，绞杀者路径已定 |
| **能力协商** | ⚠️ 无 version / capabilities 字段 |

**结论**：作为**边界标记**已足够。真实 adapter 需要能力协商时，向 `HostContract` **加字段**即可 —— 加法扩展，不影响业务层。

### 2.4 Agent Runtime —— **生命周期充分，模型调用缝有意缺失**

| 项 | 评估 |
|---|---|
| Run 生命周期 | ✅ `Agent → Run → Turn → ToolCall → Result` |
| 写入治理 | ✅ `Proposal → Review → Applier` |
| 路由输入 | ✅ `RouteNeeds` + `privacy`（local-only 默认） |
| **模型调用契约** | ⚠️ **不存在** —— 无 `ModelRequest` / `ModelResponse` / 流式块 |

**结论**：run 生命周期与写入治理**充分**。模型调用缝**有意缺席** —— Q8 明令 bridge 不得设计 LLM API，且 Agent Core 不拆包。该缝应在 **P2-4 / P3 启动 Agent Core 运行时**时设计，不是现在。

---

## 3. 字段删减建议

### 3.1 建议删除（投机字段，共 4 处）

| 文件 | 字段 | 理由 |
|---|---|---|
| `sceneGraph.ts` | `SceneNodeMetadata.extra?` | 万能兜底，无任何消费者 |
| `sceneGraph.ts` | `SceneEdgeMetadata.extra?` | 同上 |
| `sceneGraph.ts` | `SceneMetadata.extra?` | 同上 |
| `bridge.ts` | `ActivitySourceMetadata.extra?` | 同上 |

**理由**：`Record<string, unknown>` 兜底是**典型的提前设计** —— 它让 schema 失去约束力，任何字段都能塞进去，等于没有契约。且当前零消费者。要删就现在删，等到有人往里塞东西就删不掉了。

### 3.2 建议保留（均有依据）

| 字段 | 保留理由 |
|---|---|
| `SceneMetadata.mode?` | 映射到**真实既有状态** `store.mode`（'space'/'growth'） |
| `SceneOverlay` | 映射到**真实既有状态** `aiState` / `aiStage` / `insight` |
| `SceneGroup` | 映射到 `clusters` |
| `ActivitySourceMetadata.displayName/version` | 具体字段（非兜底），语义明确 |
| `BridgeError.sourceId?` | 错误定位（非 telemetry） |
| `RunResult.usage?` | 具体形状，非兜底；用量统计是后续真实需求 |
| `ProposalUndo = unknown` | **Q5 有意裁决**：语义锁死、形状不锁 |

---

## 4. 主要稳定性风险

### 4.1 ⚠️ 最大风险：contracts 目前**没有任何消费者**

程序扫描确认：`src/` 下除 contracts 自身外，**没有一个文件 import contracts**。

**含义**：

- 契约目前是**静态可达但未被使用**的。tsc 通过不代表它被正确实现。
- 未被消费的契约会**漂移** —— 实现时很可能绕过它直接写代码，契约沦为文档。
- 这是**当前阶段可接受的**（契约先行是既定策略），但必须在 P2-4/P3 接线，否则前期工作空转。

**建议**：

1. P2-4 起，新代码**必须** import 契约类型，不得重复定义同义类型。
2. P3 增加一次**契约一致性检查**（类型级即可，不引入运行时依赖）。
3. 若长期无消费者，应重新评估是否保留（避免"契约墓地"）。

### 4.2 其余风险

| # | 风险 | 缓解 |
|---|---|---|
| R2 | 无环是现状而非保证 | 保持 `renderer → sceneGraph` 单向；IR 不得引用渲染能力 |
| R3 | 3D 扩展会动 `Viewport`/`hitTest` | 属渲染契约内加法，业务层不动 —— 护栏仍成立 |
| R4 | 帧/时间源未定 | WebGL 实现前定，不影响当前冻结 |
| R5 | `extra?` 若不删会被填充 | 见 §3.1，建议现在删 |

---

## 5. 结论

| 问题 | 结论 |
|---|---|
| 是否有循环依赖风险 | **无**（DAG 双算法验证，外部依赖仅 `../types`） |
| 能否支撑 WebGL renderer | **能**（2D 粒子银河充分；3D 城市需加 3D 视口/射线，属渲染契约加法） |
| 能否支撑 plugin source | **能**（结构充分；激活待 `ActivitySourceId` evolution，属有意裁决） |
| 能否支撑 host adapter | **能**（边界标记成立；能力协商后续加字段） |
| 能否支撑 Agent runtime | **生命周期充分**；模型调用缝有意缺席，应在 P2-4/P3 设计 |
| 是否需要删减字段 | **建议删 4 处 `extra?` 兜底**；其余均有依据保留 |

**当前判断**：contracts **通过第一阶段稳定性冻结**，三个未来扩展方向都有清晰边界。

---

## 6. 裁决结论（已批准并落地）

| # | 裁决 | 落地 |
|---|---|---|
| 1 | **删除 4 处 `extra?`（sceneGraph ×3 + bridge ×1）** | ✅ 已执行并提交（`dcfc433` sceneGraph / `cbfdd49` bridge）。扩展规则写入两文件的文档注释：**需求出现 → 新增明确字段 → contract review → migration**，禁止先塞 `extra` 后解释 |
| 2 | **接受「零消费者」为已知风险，不阻塞当前阶段** | ✅ 登记。顺序确认为 **Contract Freeze → Runtime Implementation → Consumer Wiring**（而非先接代码再反推契约）。**新增 P2-4/P3 前置规则（R-6）**：任何 runtime 实现必须至少消费一个对应 contract —— Renderer↔Renderer、Agent↔AgentRun、Plugin↔Bridge；**禁止 contracts 长期无消费者** |
| 3 | **帧/时间源登记为 WebGL/Renderer 实现前置决策项，现在不设计** | ✅ 登记为 **D-P2-3-FRAME**。契约层刻意不绑定 animation loop / browser RAF / game loop / worker clock。候选待 Renderer 阶段单独决策：**A** Renderer 自带 frame loop / **B** Host 提供 clock / **C** Activity timeline 驱动。当前保持未知 |
| 4 | **单向依赖原则冻结（F12）** | ✅ 新增长期架构规则：**允许 `Renderer → SceneGraph`，禁止 `SceneGraph → Renderer capability`**。理由：IR 描述世界，Renderer 解释世界；数据模型不得知道显示实现 |
| 5 | 本 Stability Review 提交 | ✅ 单文件提交 |

### 新增长期规则

- **F12（单向依赖）**：`renderer → sceneGraph` 单向。IR 不得引用渲染能力枚举，否则立即成环。
- **R-6（消费者强制）**：自 P2-4 起，任何 runtime 必须消费至少一个对应契约。
- **D-P2-3-FRAME（未决）**：帧/时间源三候选，Renderer 阶段决策。

**仍不实现**：plugin runtime · bridge adapter · ActivityBus 实例 · WebGL · Renderer · 粒子系统 · 3D 城市。

---

**状态**：🟢 **P2-3 Contract Stability Review 通过**。契约层（7 文件）冻结完成，下一节点 = **P2-4 Agent Core / Runtime 接线前 Mini Plan**（仅设计，不实现 runtime）。
