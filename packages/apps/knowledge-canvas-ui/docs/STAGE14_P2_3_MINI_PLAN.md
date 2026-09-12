# STAGE14 P2-3 Mini Plan — Typed Bridge（Design Only）

> 状态：**待批准，未创建代码**。P2-3 只允许**设计** typed bridge。
> 上游：`src/contracts/` 六契约（P2-2.1 `fdcbc25` + P2-2.3 `06f98c5`）· P2-2 closure（`b636089`）。
> 目标形态：
>
> ```
> Plugin / External Runtime → Typed Bridge → ActivityBus
> ```
>
> **不要扩大范围。**

---

## 1. 目标与非目标

**目标**：为「外部/插件运行时」进入 ActivityBus 建立**唯一、类型化、可隔离**的入口，并回答 Q1–Q5。

**非目标（本阶段不做）**：第一个插件实现 · 插件市场 · 沙箱 · 权限系统 · 业务逻辑 · 任何渲染实现。

**继续禁止**：WebGL · 粒子银河 · 3D 城市 · Renderer 实现 · Agent 编排 · LangGraph · 新依赖 · 拆 Agent Core · 云端 provider 实装。

---

## 2. Q1 — Bridge 位置

| 候选 | 能放什么 | 结论 |
|---|---|---|
| `src/contracts/` | **仅类型** | ✅ 放 `bridge.ts`（type-only） |
| `src/bridge/` | 原型期 bridge **运行时**（注册 / 生命周期 / 错误隔离） | ✅ **当前唯一入口**（**临时**，须标注） |
| `packages/client/*` | 真正的 Plugin Runtime（cordis、ui-slots、43 包） | 🎯 **迁移目标**，非当前落点 |

**裁决理由**：

1. **contracts/ 不能放运行时** —— 该目录的纯净度门禁是 `runtime import = 0 / runtime export = 0`。Bridge 必然有运行时（注册、生命周期、错误隔离），放进去会直接破坏 ABI 层的性质。因此 contracts/ 只承载 **bridge 的类型契约**。
2. **`packages/client/*` 现在是迁移目标而非落点** —— knowledge-canvas-ui 是**独立 Vite 原型，不是 cordis 插件**，且插件迁移已被冻结（P2-0 D-P2-0-2）。现在接进去等于提前做插件迁移。
3. 因此 `src/bridge/` 作为**唯一入口**，但必须在文件头标注「临时位置，P3 迁至 `packages/client/*`」。

**Bridge 不是业务层** —— 硬约束：

| Bridge 不得 | 说明 |
|---|---|
| 不得包含领域逻辑 | 只做协议翻译 |
| 不得直接读 store / backend | 只能产出 `ActivityEvent` / 调用契约接口 |
| 不得成为第二组装根 | 组装根仍是 `bootstrap`（P2-1 已确立 `mock/bootstrap`） |

---

## 3. Q2 — window bridge 是否继续

**当前**：`window.__kcuLlmHost` 是临时桥。

**裁决**：**保留旧桥，只新增迁移路径**（严禁删除）。

采用**绞杀者（strangler）**顺序：

| 阶段 | 动作 | 是否删除旧桥 |
|---|---|---|
| S1 | 在 `contracts/bridge.ts` 定义 `HostContract`（类型） | ❌ |
| S2 | 写适配器：用 `HostContract` 包装现有 `window.__kcuLlmHost` | ❌ |
| S3 | 新代码只依赖 `HostContract`，不再直接读 `window.*` | ❌ |
| S4 | （P3）替换内部实现，旧桥退化为兼容层 | ❌ |
| S5 | （P3 之后）**仅在类型路径被证明等价后**才移除 | ✅ |

**关键约束**：`window.__kcuLlmHost` 在 P2-3 **不得被删除、不得被改写语义**。旧桥失效会同时打断 LLM 宿主接入与既有演示。

---

## 4. Q3 — Plugin ActivitySource

**允许**：注册接口 · 类型定义 · 生命周期设计。
**禁止**：第一个插件实现 · 插件市场 · 沙箱 · 权限系统。

> ⚠️ **需要一次契约修订（必须显式批准）**：P2-2.1 把 `ActivitySourceId` 冻结为 `'user' | 'ingestion'`。接入插件源意味着扩展为 `` `plugin:${string}` ``。这是**对已冻结契约的修订**，不是顺带改动 —— 本计划把它列为独立步骤并单独验收。

**生命周期（subsystem 模式）**：

| 阶段 | 行为 |
|---|---|
| `initialize` | 插件声明其 source id 与支持的 kinds |
| register | 经 **Bridge** 注册（插件不得直接碰 Bus） |
| emit | 事件经 Bridge 进入 Bus |
| `deinitialize` | 注销订阅；失败/反复异常 → **仅禁用该 source** |

**硬约束**：插件**不得**直接调用 `ActivityBus.register`；只能经 Bridge。否则错误隔离无从谈起。

---

## 5. Q4 — ActivityBus 生命周期

| 问题 | 答案 |
|---|---|
| **谁创建** | **宿主组装根**（当前是 `bootstrap`），不是组件 |
| **谁持有** | 宿主上下文（经 `HostContract` 暴露），**单实例** |
| **谁销毁** | 宿主 teardown：`dispose()` 释放订阅与日志 |

**明令禁止**：

```
component -> new ActivityBus()      // ❌ UI 持有核心服务
```

UI 只能**取得**宿主已创建的实例（经契约访问器或 context），永远不得构造。

**规则**：

1. 每个宿主**恰好一个** Bus 实例。
2. `register` / `unregister` 必须对称（subsystem 的 `Initialize` / `Deinitialize`）。
3. `dispose()` 必须释放订阅与 append-only 日志，否则长期运行会泄漏。
4. Bus 的存活期**长于任何组件**。

---

## 6. Q5 — 错误隔离

失败域划分：

```
plugin failure      → 只影响该插件 source
bridge failure      → 只影响经 bridge 的事件
ActivityBus failure → 影响事件流（但不得抛回 emitters）
knowledge core      → 独立；写仍需经 Proposal
```

**契约级隔离规则**：

| # | 规则 |
|---|---|
| E1 | **异常不得跨越 bridge** —— 统一用 `BridgeResult<T>` 信封（ok / error + domain + reason），禁止 throw 穿透 |
| E2 | 插件订阅者抛错 → 在 bridge 边界捕获 → 转为 error 事件；**反复失败则只禁用该 source** |
| E3 | Bus 对订阅者**逐个隔离**：某个订阅者慢/坏不得阻塞其它订阅者，也不得向 emitter 抛错 |
| E4 | 插件路径**不得同步调用** knowledge core；任何写入仍走 Proposal → Review → Applier |
| E5 | 每个错误必须携带 `domain`，便于按域统计与降级 |

```ts
export type BridgeErrorDomain = 'plugin' | 'bridge' | 'bus' | 'core'
```

---

## 7. 契约草案（示意，待批准后实现）

```ts
// src/contracts/bridge.ts —— type-only
export type BridgeErrorDomain = 'plugin' | 'bridge' | 'bus' | 'core'

export interface BridgeError {
  readonly domain: BridgeErrorDomain
  readonly code: string
  readonly reason: string
  readonly sourceId?: string
}
export type BridgeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: BridgeError }

/** 插件声明自己的能力；不得直接碰 Bus。 */
export interface BridgeActivitySourceSpec {
  readonly id: string                    // 对应 `plugin:<id>`
  readonly kinds: readonly string[]
}

export interface TypedBridge {
  readonly bus: ActivityBus
  /** 注册/注销必须对称；返回 BridgeResult，不抛异常。 */
  registerActivitySource(spec: BridgeActivitySourceSpec): BridgeResult<Unsubscribe>
  /** 宿主 teardown：释放订阅与日志。 */
  dispose(): void
}

/** 宿主契约：TypedHostContract 取代直接读 window.* */
export interface HostContract {
  readonly bridge: TypedBridge
  readonly llmHost: unknown              // 先兼容 window.__kcuLlmHost 的既有形状
}
```

---

## 8. 禁止项对照

| 禁止 | 本计划中的体现 |
|---|---|
| WebGL / 粒子 / 3D 城市 / Renderer 实现 | 完全不涉及 |
| Agent 编排 / LangGraph | 不涉及 |
| 新依赖 | `package.json` 不动 |
| 拆 Agent Core | 不涉及 |
| 云端 provider 实装 | 不涉及 |
| 第一个插件实现 / 市场 / 沙箱 / 权限系统 | 只给类型与生命周期设计 |
| 删除旧 window bridge | 明令禁止（§3） |

---

## 9. 验收标准

| # | 标准 |
|---|---|
| 1 | 新增 `src/contracts/bridge.ts`（type-only）；`contracts/` 纯净度不变（runtime import 0 · 外部依赖 0 · class 0 · 无 barrel） |
| 2 | 若批准 `src/bridge/` 运行时，须在文件头标注「临时位置，P3 迁至 packages/client」 |
| 3 | `ActivitySourceId` 若扩展 `` `plugin:${string}` ``，须作为**独立契约修订**单独验收 |
| 4 | `window.__kcuLlmHost` **仍然存在且语义不变** |
| 5 | 全仓不出现 `new ActivityBus()`（除宿主组装根） |
| 6 | `tsc --noEmit` 错误数不变（基线 48），`contracts/` 内错误 0 |
| 7 | 业务代码零改动；`package.json` / lockfile 未改 |

---

## 10. 开放问题

| # | 问题 | 建议 |
|---|---|---|
| **Q6** | P2-3 是否一并实现 `src/bridge/` **运行时**，还是**只出类型契约**？ | 建议**只出类型契约**（本阶段是设计节点；运行时等 P3 与 cordis 迁移一起做，避免产生第二个要迁移的实现） |
| **Q7** | `ActivitySourceId` 现在就扩展 `` `plugin:${string}` ``，还是等真正接入时？ | 建议**现在只定义 bridge 类型、暂不改 `ActivitySourceId`**；等第一个真实插件接入时再扩，避免冻结契约被空头修改 |
| **Q8** | `HostContract.llmHost` 是否现在就给出完整类型？ | 建议先 `unknown` + 注释（同 P2-2.3 的 `ProposalUndo` 处理方式），避免在迁移期锁错形状 |
| **Q9** | 是否需要为插件 source 设计「能力声明」校验（kinds 白名单）？ | 建议**不做** —— 属 registry 范畴，留到 P3 插件化时 |

---

## 11. 步骤（批准后）

1. 按 Q6/Q7/Q8 结论写 `src/contracts/bridge.ts`（type-only）
2. 复跑 contracts 纯净度 + tsc 对比（错误数不变）
3. 校验 `window.__kcuLlmHost` 未被改动
4. 输出 P2-3 Review Report
5. 停 Review Node，等你裁决

---

**状态**：🟡 停在 **P2-3 Mini Plan Review Node**，等待批准（尤其 **Q6 是否实现运行时** 与 **Q7 是否现在扩 `ActivitySourceId`**）。批准后我才创建文件。
