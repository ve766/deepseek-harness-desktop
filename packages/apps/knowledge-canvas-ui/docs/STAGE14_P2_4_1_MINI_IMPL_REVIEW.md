# STAGE14 P2-4.1 Mini Implementation Review — ActivityBus 接线

> 阶段：**P2-4.1 实现前设计评审**。本轮**不写实现**，只把「接在哪、接多少、怎么验」定死，避免"边写边设计"造成大改。
> 前置裁决：Q-A（ActivityBus 为第一个消费者，范围 = **publish / subscribe / lifecycle**）、R-6（runtime 必须消费契约）、R-7（执行流禁直写 store）。

---

## 0. 定位

把 `contracts/activityBus.ts` + `contracts/activityEvent.ts` 从「零消费者」变成「有真实发布者与订阅者」，**且是加法**：不删、不改任何现有组件行为，不迁移 demo，不动 store 语义。

---

## 1. 范围冻结（Q-A）

| 做 | 不做 |
|---|---|
| ✅ event publish | ❌ replay engine（持久化回放、时间旅行） |
| ✅ event subscribe（含 filter） | ❌ persistence（跨会话存储） |
| ✅ lifecycle（宿主创建 / 持有 / dispose） | ❌ distributed event system |
| | ❌ event sourcing（以事件重建状态） |

**ActivityBus 是进程内事件通道，不是数据库。**

---

## 2. ⚠️ 一个必须裁决的契约冲突：`replay()` 在范围内还是范围外

契约 `ActivityBus` 定义了四个成员：

```ts
register(source): Unsubscribe
subscribe(filter, next): Unsubscribe
replay(options?): AsyncIterable<ActivityEvent>   ← Q-A 说"不做 replay engine"
readonly latestSeq: number
```

**冲突**：若实现不提供 `replay`，它就不满足 `ActivityBus` 接口 → 编译期即失败（或被迫 `as any` 强转，等于废掉契约）。

**三个选项**

| 选项 | 做法 | 评价 |
|---|---|---|
| **A（建议）** | 最小内存兑现：append-only 数组 + `async function*` 遍历已有事件，无持久化、无索引、无跨会话 | 满足接口，且**不是** replay engine；成本 ≈ 10 行 |
| B | `replay()` 抛 `not-implemented` | 满足类型但违背契约语义，等于埋雷 |
| C | 实现不声明 `implements ActivityBus` | 直接违反 R-6（runtime 必须消费契约） |

**建议 A**，并在代码注释里写明「这不是 replay engine，只是接口的最小兑现；持久化回放属后续阶段」。

---

## 3. 接线点清单（实测，均为当前代码真实位置）

### 3.1 宿主侧（bus 的创建/持有/销毁）

| 现有点 | 位置 | 用途 |
|---|---|---|
| 组装根 | `knowledge/knowledgeUniverse.ts:61` `createBackend()` | 选 `LightRAGBackend` / `MockBackend` |
| 单例 | `knowledge/knowledgeUniverse.ts:96` `getSharedUniverse()` | 已有的"宿主级单例"范式 |
| 入口装配 | `mock/bootstrap.ts` | 入口 wiring（seed + startDemo） |

**落点建议**：与 `getSharedUniverse()` **同级**新增宿主上下文（而非塞进 `knowledgeUniverse`，那是知识层不是宿主层）。
**禁止**：`component -> new ActivityBus()`。

### 3.2 发布侧 — UI 源（`'user'`）

| 事件 kind | 当前代码锚点 | 可用性 |
|---|---|---|
| `node.clicked` | `components/KnowledgeNode.tsx:43` `store.setSelection([node.id])` | ✅ 有锚点 |
| `node.selected` | `components/KnowledgeNode.tsx:43`；`CanvasViewport.tsx:185`（框选）；`SharedKnowledgeSpace.tsx:95` | ✅ 有锚点 |
| `node.dragEnd` | `CanvasViewport.tsx:165` / `GalaxyCanvas.tsx:121` `onPointerUp` | ✅ 有锚点 |
| `search.performed` | `components/useNoxResearch.ts:74` `access.researchQuery(query)` | ⚠️ 语义偏"研究查询"，是否等同搜索需确认 |
| `galaxy.opened` | 画布组件挂载（7 个文件引用 `GalaxyCanvas`/`WelcomeDashboard`） | ⚠️ 需选定唯一挂载点 |
| `task.created` | **未找到锚点** | ❌ 当前无对应功能 |
| `knowledge.viewed` | **未找到明确锚点** | ❌ 需定义"查看"语义 |

### 3.3 发布侧 — ingestion 源（`'ingestion'`）

真实链路：`lightRAGBackend.importSourceAs()` → `ingestSource(src)` → `this.client.insert(doc.content, sourceId)`

| 事件 kind | 可用性 | 说明 |
|---|---|---|
| `document.imported` | ✅ | `insert()` 返回后即可发 |
| `extraction.completed` | ❌ | 抽取在 **LightRAG 服务端异步**进行，`insert()` 返回 ≠ 抽取完成 |
| `extraction.failed` | ❌ | 同上，本地不可观测 |
| `entity.discovered` | ❌ | 只能经 `getEntities()` 轮询**推导**，非真事件 |
| `relation.created` | ❌ | 同上（`getRelations()`） |

**诚实结论**：12 种冻结 kind 中，**本地当前只有 5–6 种有真实锚点**（`node.clicked` / `node.selected` / `node.dragEnd` / `document.imported` + 待定的 `search.performed` / `galaxy.opened`）。

**建议**：P2-4.1 **只接有锚点的**，其余 6 种登记为 **pending anchor**，等真实触发点出现后再接 —— 不为凑齐契约而发明事件。

---

## 4. 依赖方向

```
src/host/*  (新增，runtime)
     │ import type
     ↓
src/contracts/activityBus.ts + activityEvent.ts
```

- `contracts/` **不变**（本轮零改动）
- runtime **不 import** `knowledge/` / `llm/` / `mock/` / `demo/`
- UI 组件只经宿主上下文拿到 bus（或经一个薄封装 hook），**不直接 new**

---

## 5. 文件级改动清单（预估）

| # | 文件 | 动作 | 说明 |
|---|---|---|---|
| 1 | `src/host/activityBus.ts`（新） | 新增 | `createActivityBus()`：append-only 数组 + `register/subscribe/replay/latestSeq` + `dispose()` |
| 2 | `src/host/hostContext.ts`（新） | 新增 | 宿主级单例：`getActivityBus()` / `disposeHost()`；与 `getSharedUniverse()` 同范式 |
| 3 | `components/KnowledgeNode.tsx` | **+1 行** | 在既有 `setSelection` 旁发 `node.clicked` |
| 4 | `components/CanvasViewport.tsx` | **+1 行** | `onPointerUp` 内发 `node.dragEnd`（框选处发 `node.selected`） |
| 5 | `knowledge/backends/lightRAGBackend.ts` | **+1 行** | `insert()` 后发 `document.imported` |

**规模**：2 新文件 + 3 处各 1 行发射点。**不是大改。**

> ⚠️ 第 5 项需跨越"知识层 → 宿主层"反向依赖。替代方案：由**调用方**（`knowledgeAccess.ts` / UI 侧 import 入口）在 `importSource` 返回后发事件，避免 backend 依赖 host。**建议采用替代方案**（保持 `knowledge/` 不反向依赖 `host/`）。

---

## 6. 实施步骤与逐步验收

| 步 | 动作 | 验收 |
|---|---|---|
| **S1** | 建 `src/host/activityBus.ts` + `hostContext.ts`（最小实现，含 A 选项 `replay`） | 文件 type-check 通过；`implements ActivityBus` 成立 |
| **S2** | 接 UI 发射点 3 处（node.clicked / node.selected / node.dragEnd） | 触发交互 → 订阅方收到事件；**UI 行为零变化** |
| **S3** | 接 ingestion 发射点（document.imported，走调用方而非 backend） | 一次真实 import → 事件序列含 `document.imported` |
| **S4** | 加一个真实订阅者（最小：调试订阅或现有面板只读消费） | `contracts/` 消费者数 > 0（R-6 达标） |
| **S5** | 验收与报告 | 见 §7 |

---

## 7. 验收标准

| # | 标准 | 判定方式 |
|---|---|---|
| V1 | **contracts 消费者 > 0** | `grep -rn "from '.*contracts/" src/` 排除 contracts 自身后有命中 |
| V2 | `implements ActivityBus` 成立，无 `as any` / `@ts-ignore` | tsc |
| V3 | **tsc 基线不增**（48） | 逐行对比 HEAD，改动行 0 错误 |
| V4 | **UI 行为零变化** | 仅新增发射语句，不修改既有 store 调用 |
| V5 | 生命周期正确 | bus 由宿主创建，`dispose()` 释放；全仓 `new ActivityBus(` 不得出现在组件中 |
| V6 | `contracts/` 零改动 | `git status -- src/contracts/` 无输出 |
| V7 | package.json / lockfile 未动 | git status |
| V8 | 无持久化 / 无跨会话 / 无网络 | 代码审查：无 `localStorage` / `indexedDB` / `fetch` |

---

## 8. 风险

| # | 风险 | 说明 | 缓解 |
|---|---|---|---|
| R1 | **replay 语义越界** | 最小实现可能被后续误当成 replay engine 扩展 | 注释写明边界 + 本评审留档；持久化回放需另开节点 |
| R2 | **backend 反向依赖 host** | 若直接在 `lightRAGBackend` 发事件会污染知识层 | 采用调用方发射（§5 替代方案） |
| R3 | **高频事件打爆渲染** | `node.selected` 在框选时可能一次多条 | 订阅层合并（契约已预留 `ActivityFilter`）；P2-4.1 先限量 |
| R4 | **pending anchor 长期挂空** | 6 种 kind 无触发点，可能长期悬空 | 登记清单；若到 P3 仍无锚点，走契约演进移除或替换 |
| R5 | **事件发射散落** | 后续越来越多组件直接发事件 | 建议收敛为薄封装（hook 或 emitter 模块），但 P2-4.1 先不抽象 |

---

## 9. 待裁决

| # | 问题 | 建议 |
|---|---|---|
| **Q-P1** | `replay()` 采用 **选项 A（最小内存兑现）** 吗？ | 建议 A（否则类型不成立或违背 R-6） |
| **Q-P2** | P2-4.1 是否**只接 5–6 种有锚点的 kind**，其余登记 pending anchor？ | 建议是（不为凑齐契约发明事件） |
| **Q-P3** | ingestion 事件由**调用方**发射（避免 knowledge→host 反向依赖）？ | 建议是 |
| **Q-P4** | `search.performed` / `galaxy.opened` 是否纳入本轮（语义待定）？ | 建议 `galaxy.opened` 纳入（挂载点明确），`search.performed` 待确认语义 |
| **Q-P5** | 宿主模块命名：`src/host/` 还是 `src/runtime/`？ | 建议 `src/host/`（与 `contracts/` 平级、语义为"宿主能力"，避免与"renderer runtime"混淆） |
| **Q-P6** | 是否授权开始 **S1–S5** 编码（约 2 文件 + 3 处 1 行改动）？ | 待批准后执行 |

---

## 10. 红线与状态

| 项 | 状态 |
|---|---|
| HEAD | `23b172e`（本轮未产生 commit） |
| 本轮改动 | **0**（仅新增 1 个未跟踪文档） |
| 根 `src ' M'` | 0 |
| 全仓 | 99 M / 143 ?? / **0 D** |
| `contracts/` | 零改动 |
| package.json / lockfile | 未触碰 |
| 服务 | 未启动（Ollama 11434 常驻、LightRAG 9621 停） |

**继续冻结**：WebGL · 粒子系统 · 3D 城市 · Renderer 实现 · Plugin runtime · Bridge adapter · LangGraph · 多 Agent handoff · Agent Core 拆包 · 新依赖 · 云端实装。
**本阶段红线**：R-7 —— 执行流不得直写 `store.setXXX()`；本轮事件发射是**加法**，不得借机改写现有状态逻辑。

---

**状态**：🟡 停在 **P2-4.1 Mini Implementation Review Node**，未编码，等待 Q-P1 ~ Q-P6 裁决。
