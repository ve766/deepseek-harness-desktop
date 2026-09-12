# STATUS_CONTRACT.md — Morphicon 统一状态层契约

> 状态：v1.0（P4-0 固化）
> 来源：`src/components/morphicons/geometry.ts`、`src/components/morphicons/states.ts`、`src/components/morphicons/index.ts`
> 本契约为团队事实标准；未来模块（Today Dashboard / Agent Workspace / Command Palette / AI Activity Timeline / AI Employee Growth）接入时直接引用，无需读源码。

## 1. 目的
把 Morphicon 状态层从"代码约定"升级为"团队契约"：所有产品面共享同一套视觉状态语言，新增状态面零侵入。

## 2. Morphicon 7 态定义（基类，冻结集）
基类态位于 `geometry.ts`，是唯一的视觉原型集合。任何语义态必须映射到其中之一。

| 基类态 | 语义 | 视觉 | 进入 | 退出 |
|---|---|---|---|---|
| `idle` | 静止 / 就绪 | 低饱和静态 | 默认 | — |
| `thinking` | 推理中 | 缓慢脉冲 | 任务派发 | completed / error |
| `searching` | 检索中 | 扫描线 | 查询开始 | completed / warning |
| `learning` | 学习中 | 渐变填充 | 摄入数据 | completed |
| `completed` | 成功 | 稳定高亮 | 终态 | 不自动退出（停留） |
| `warning` | 警告 | 琥珀色 | 可恢复异常 | 恢复后回 idle |
| `error` | 错误 | 红色 | 不可恢复异常 | 需人工重置 |

## 3. 五域状态映射规范
每域一套语义枚举 + `*_TO_BASE` 映射 + `status.*` i18n key。

### 3.1 Provider（`PROVIDER_TO_BASE`）
| 语义态 | 基类态 |
|---|---|
| idle | idle |
| connecting | thinking |
| online | completed |
| warning | warning |
| error | error |

### 3.2 Employee（`EMPLOYEE_TO_BASE`）
| 语义态 | 基类态 |
|---|---|
| idle | idle |
| thinking | thinking |
| working | searching |
| completed | completed |
| blocked | error |

### 3.3 Task（`TASK_TO_BASE`）
| 语义态 | 基类态 |
|---|---|
| queued | idle |
| running | thinking |
| success | completed |
| failed | error |
| cancelled | warning |

### 3.4 AI（`AI_TO_BASE`）
| 语义态 | 基类态 |
|---|---|
| thinking | thinking |
| discovering | searching |
| building | learning |
| completed | completed |
| failed | error |

### 3.5 Memory（`MEMORY_TO_BASE`）
| 语义态 | 基类态 |
|---|---|
| synced | completed |
| drifting | warning |
| stale | error |

## 4. 新状态添加规则
1. 新增某域的语义态：只改该域 enum + 在 `*_TO_BASE` 补映射 + 在 `zh-CN.ts`/`en-US.ts` 加 `status.{domain}.{state}`（中英 1:1）。**禁止**因此新增基类态。
2. 新增整个域：新建 `XxxStatus` 类型 + `Xxx_TO_BASE` + `status.xxx.*` keys + 可选 `XxxStatusIcon` 包装；**禁止**修改 `geometry.ts` 基类集。
3. 基类集（7 态）冻结：除非证明存在新的"通用视觉原型"，否则不增不减。

## 5. 禁止业务层直接使用 base state
- **规则**：业务组件不得向 `MorphIcon` 直接传基类态字符串（如 `'thinking'`），必须消费域枚举（如 `ProviderStatus.online`）经映射得到。
- **理由**：① 语义留在域层，基类视觉集可独立演进；② 状态文案经 `status.*` 统一 i18n；③ 避免散落硬编码导致映射漂移。
- **校验建议**：`MorphIcon` 的 `state` prop 仅接受 `BaseMorphState` 类型，域组件只暴露自己的 enum。

## 6. i18n key 命名规范
- 命名空间：`status.{domain}.{semanticState}`（如 `status.provider.online`）。
- 双包 1:1：`zh-CN.ts` 与 `en-US.ts` 必须成对存在（类型 `LanguageKey = keyof typeof zhCN` 编译期兜底）。
- 实体级状态名若需双语，走 `resolveEntity(base, loc, lang)`，不写 `lang === 'x'` 分支。
- 禁止在 key 中出现业务动词（保持"状态名词"语义）。

## 7. reduced-motion 行为规范
- 检测：`usePrefersReducedMotion()` 订阅 `prefers-reduced-motion`。
- MorphIcon：过渡/脉冲改为 `animation: none; transition: none`，**直接跳到终态视觉**。
- `useMorphState`（最小停留/终态停留）在 reduced-motion 下跳过入场/出场动画，仅保留状态切换的瞬时视觉差异。
- Nox 关联解释（P2 动画）降级为**瞬时显隐**，无位移/缩放。
- Provider/Employee/Task 指示器微光一律关闭。

## 8. MemoryStatusIcon 预留说明
- `MemoryStatusIcon` 已在 barrel（`index.ts`）就位，当前映射 `synced / drifting / stale`。
- **预留为未来 Memory System 接入的接缝**：当真实 Memory backend 接入时，仅数据来源变化（mock → real），图标契约（语义态 + base 映射 + i18n key + reduced-motion）保持不变，UI 零改动。

## 9. Future Extension Rules
- **新业务状态优先新增 domain enum**：业务侧新状态应落在某域枚举内，而非扩张基类。
- **禁止为了单个业务需求增加 `BaseMorphState`**：基类集是跨产品共享的视觉原型，不随单点需求膨胀。
- **`BaseMorphState` 新增必须经过架构评审**：任何对 7 态集的增删需 P4-0 级评审通过，并同步更新本文档 §2。
- **所有状态必须具备四要素**：① semantic state（语义态）② base mapping（`*_TO_BASE` 映射）③ i18n key（`status.*` 双包）④ reduced-motion 行为（§7 约定）。缺任一不得合入。
