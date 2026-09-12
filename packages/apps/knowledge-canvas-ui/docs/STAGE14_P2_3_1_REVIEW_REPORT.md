# P2-3.1 Review Report — Typed Bridge Contract（未提交）

> 定位：**Contract Freeze**，不是 Bridge Implementation。
> 本文件是冻结在两端之间的**类型化契约边界**：
>
> ```
> Future Runtime Bridge        （上——本阶段不实现）
>          |
> Typed Contract Boundary      （本文件）
>          |
> Current Host / Plugin Eco    （下——本阶段不实现）
> ```
>
> 上游：P2-3 Mini Plan（`a5ba79a`）· `src/contracts/` 六契约（`fdcbc25` + `06f98c5`）。

---

## 1. 文件结构

```
packages/apps/knowledge-canvas-ui/src/contracts/bridge.ts     164 行
├─ § 定位说明          —— 两端都不实现，只冻结边界
├─ § 1 Bridge Result   —— 统一错误隔离
├─ § 2 Lifecycle       —— 只描述语义
├─ § 3 Registration    —— 只冻结「一个 source 如何被宿主认识」
└─ § 4 Host Contract   —— 只描述能力存在
```

contracts 目录现状（7 文件）：

```
contracts/
 ├─ activityEvent.ts     62
 ├─ activityBus.ts       30
 ├─ sceneGraph.ts       161
 ├─ renderer.ts          46
 ├─ agentRun.ts          91
 ├─ knowledgeWrite.ts   228
 └─ bridge.ts           164   ← 当前
```

---

## 2. 类型清单（10 个导出，全部 `type` / `interface`）

| # | 类型 | 归属 | 说明 |
|---|---|---|---|
| 1 | `BridgeErrorDomain` | 错误模型 | `'plugin' \| 'bridge' \| 'bus' \| 'core'` |
| 2 | `BridgeError` | 错误模型 | `domain` · `code` · `message` · `sourceId?` |
| 3 | `BridgeResult<T>` | 错误模型 | `{ok:true,value}` \| `{ok:false,error}`；异常不跨桥 |
| 4 | `ActivitySourceHealth` | 生命周期 | `unknown / healthy / degraded / failed / disabled` |
| 5 | `ActivitySourceLifecycle` | 生命周期 | `initialize()` · `dispose()` · `health()` |
| 6 | `ActivitySourceMetadata` | 注册 | `displayName?` · `version?` · `extra?` |
| 7 | `ActivitySourceRegistration` | 注册 | `id` · `metadata?` · `lifecycle?` |
| 8 | `RegistrableActivitySource` | 注册 | `registration` + `subscribe(next)` 签名 |
| 9 | `TypedBridge` | 宿主 | `registerActivitySource()` · `dispose()` |
| 10 | `HostContract` | 宿主 | `bridge` · `llmHost: unknown` |

**约束落实**：

| 约束 | 状态 |
|---|---|
| HostContract 不得定义 LLM 请求格式 / provider routing / 云端字段 / Agent Core 类型 | ✅ 无相关类型 |
| `llmHost` 保持 `unknown` | ✅ |
| 错误模型不扩展 retry policy / recovery / telemetry / logging | ✅ 四项均为 0 |
| 不实现 `register()` / `unregister()` / event dispatch | ✅ 仅方法**签名**，无函数体 |
| **不改变 `ActivitySourceId`** | ✅ 仍 `'user' \| 'ingestion'`；`plugin:` 仅存在于注释 |
| 生命周期不引入 async queue / worker / scheduler / sandbox / process isolation | ✅ 五项均为 0 |

---

## 3. import graph

```
bridge.ts
   ├─ import type { Unsubscribe }   from './activityBus'
   └─ import type { ActivityEvent } from './activityEvent'
```

**依赖方向合规**：

| 方向 | 状态 |
|---|---|
| `bridge → contracts/*` | ✅ 允许（同层，type-only） |
| `bridge → store` | ❌ 无 |
| `bridge → knowledge` | ❌ 无 |
| `bridge → llm` | ❌ 无 |
| `bridge → mock` | ❌ 无 |
| `bridge → demo` | ❌ 无 |
| `bridge → packages runtime` | ❌ 无 |
| `bridge → 外部依赖包` | ❌ 无 |

**两条链依旧不合并**：`bridge.ts` 不 import `sceneGraph` / `renderer` / `knowledgeWrite`。

---

## 4. purity check（注释已剥离后检查）

| 检查项 | 结果 |
|---|---|
| runtime implementation（`return` / `await`） | **0** |
| runtime import（`import` 无 `type`） | **0** |
| external dependency | **0** |
| class | **0** |
| function body | **0** |
| arrow body | **0** |
| window injection（`window.`） | **0** |
| instantiation（`new X`） | **0** |
| retry / recovery / telemetry / logging | **0** |
| queue / worker / scheduler / sandbox | **0** |
| ollama / openai / provider 字段 | **0** |
| `ActivitySourceId` 未被改动 | ✅ |
| `llmHost: unknown` | ✅ |

---

## 5. tsc baseline comparison

| 指标 | 结果 |
|---|---|
| 解析到的错误数 | **48**（= 基线，未变） |
| `TS2307` cannot-find-module | **0** |
| `contracts/` 内错误 | **0** |
| `bridge.ts` 错误 | **NONE** |
| 落在与 HEAD 相同行的既有错误 | 33（未触碰） |
| **落在被改动行的错误** | **0** |

⇒ **零新增类型错误**。

---

## 6. git status

| 项 | 值 |
|---|---|
| HEAD | `a5ba79a`（未变） |
| modified | **99**（全为既有 tsconfig / lockfile 噪声，无一属本轮） |
| untracked | **144**（含新增 `bridge.ts`） |
| **deleted** | **0** |
| 仓库根 `src ' M'` | **0** |
| kcu/src 业务代码改动（M/D） | **0** |
| contracts 新增 | **1**（`bridge.ts`） |
| package 改动 | **0** |
| lockfile 改动（我方） | **0**（未 stage） |
| staged | **0** —— **未提交，等你裁决** |

### 验收红线

| 红线 | 结果 |
|---|---|
| runtime implementation = 0 | ✅ |
| dependency = 0 | ✅ |
| class = 0 | ✅ |
| function body = 0 | ✅ |
| package change = 0 | ✅ |
| lockfile change = 0 | ✅ |

---

## 7. 风险说明

### 7.1 我在冻结审计中做的一处修改（需要你确认）

**原设计**：`TypedBridge { readonly bus: ActivityBus }` —— 把 bus 暴露给持有 bridge 的任何人。

**问题**：这直接违反 Q5「插件不能拖垮核心」。一旦 `bus` 公开，任何持有 bridge 的一方都能 `bus.register(...)` / `bus.subscribe(...)`，**绕过 bridge 的隔离边界** —— 插件订阅者抛错会直接传播进 bus，而不是在边界被禁用。

**处理**：移除 `readonly bus`，改为「bridge **拥有** bus，但不暴露」，并在注释中写明理由。相应地 `ActivityBus` 的 import 也一并移除（现只 import `Unsubscribe`）。

> 这是我的判断，不是你的裁决 —— 若你认为该暴露（例如为读写便利），我可以改回，但建议保留当前形态。

### 7.2 其余风险

| # | 风险 | 说明 |
|---|---|---|
| R1 | `RegistrableActivitySource.subscribe` 是方法**签名** | 严格说属于「source 如何被认识」的协议部分，无函数体；若你认为这已越界到 dispatch，可移除 |
| R2 | `plugin:` 命名空间仅存在于注释 | 无代码可误用；但需防止有人误以为已可用 —— 注释已写明「须经 ActivitySourceId evolution 评审」 |
| R3 | `BridgeError.sourceId?` 是可选扩展 | 错误定位用，非 telemetry；若要求极简可删 |
| R4 | 契约能否支撑未来 runtime 尚未被证明 | 这正是下一节点要确认的事 —— 目前只有**静态可达性**，没有运行时验证 |

---

## 待裁决

1. 是否接受 §7.1 的「不暴露 bus」修改（我建议保留）
2. 是否提交 `src/contracts/bridge.ts`
3. 本 Review Report 是否一并落盘提交
4. 下一节点：**确认 Contract 是否足够支撑未来 Runtime** —— 仍不是插件实现

继续保持：不做 WebGL / 粒子银河 / 3D 城市 / Renderer / 插件市场；不拆 Agent Core；不加依赖；不云化。

---

**状态**：🟡 停在 **P2-3.1 Review Node**，**未提交**，等待裁决。
