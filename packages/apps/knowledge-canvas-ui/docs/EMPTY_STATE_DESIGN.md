# P4-1 子步 3/5 — EmptyState System 设计方案

> 状态：**待确认**（先方案后编码，确认后再实现）
> 目标：在数据为空的三处界面提供「价值引导层」，而非「功能入口层」。
> 核心约束（用户）：EmptyState **不得演变成新导航系统**；定位 = 空数据时的价值引导，不是功能菜单。

---

## 1. 设计原则

1. **纯展示组件**：`EmptyState` 只负责「图标 + 标题 + 描述（+ 可选单一引导动作）」，不含任何路由、状态机、跨组件协调。
2. **价值引导，不是功能入口**：解释「这个区域是做什么的、为什么有价值」，最多 **一个** 轻量引导动作；**禁止** 罗列多个功能按钮/链接形成导航菜单。
3. **复用既有资产**：样式只用 `styles/app.css` 真实 token（见 `VISUAL_GUIDE.md` §0 兼容说明），**不新造 token**；图标沿用 app 既有 emoji 语言（🐈‍⬛/🔗/📈 风格）。
4. **数据驱动显隐**：仅在对应数据源为空时渲染；正常有数据时完全不出现（不侵入正常流程）。
5. **不提前实现 Demo Flow**：Demo 数据入口（「体验示例知识库」）只做**接口预留**，本子步不接线、不实现 seed 逻辑。

---

## 2. 组件结构设计

### 2.1 基础组件 `src/components/EmptyState.tsx`（新增）

```tsx
export type EmptyStateVariant = 'welcome' | 'space' | 'growth'

export interface EmptyStateAction {
  label: string
  onClick: () => void
}

export interface EmptyStateProps {
  variant: EmptyStateVariant          // 仅影响默认图标/微调视觉，不影响行为
  title: string                       // 来自 i18n empty.title.*
  description: string                 // 来自 i18n empty.desc.*
  icon?: string                      // 可选覆盖；默认按 variant
  action?: EmptyStateAction          // 可选单引导动作；本子步三处调用均不传
}

// 默认图标：welcome '🌱' / space '🕸️' / growth '🌌'
// 结构：.emptystate > .emptystate__icon + .emptystate__title + .emptystate__desc + (.emptystate__action?)
// 入场动画：.emptystate-in（fade + 轻微上移），reduced-motion 下关闭
```

- 行为完全一致，三处共用；`variant` 仅选图标与极少量视觉微调（如 growth 在星空前用更透的底）。
- `action` 是**可选槽**：本子步不传；未来 Demo 子步接入「体验示例知识库」时再传 `action={{ label: t('empty.action.demo'), onClick: seedDemo }}`，组件本身无需改动。

### 2.2 样式 `src/components/EmptyState.css`（新增）

- 居中 flex 列布局（覆盖在各自画布之上，不遮挡工具栏/缩放读数/HUD）。
- 用 token：`--space-*` / `--radius-lg` / `--text-title` / `--text-body` / `--label-primary` / `--label-secondary` / `--shadow-2` / `--glass-blur`。
- `.emptystate__action` 复用现有按钮观感（参考 FirstRunScreen 的 `.appbtn` 调用方式），不新造 button class。
- 入场 `.emptystate-in` + `@media (prefers-reduced-motion: reduce){ .emptystate-in{animation:none} }`。

---

## 3. 三个接入位置与空数据判定

| 位置 | 文件 | 空态判定 | 渲染位置 |
|---|---|---|---|
| **Welcome** | `components/WelcomeDashboard.tsx` | `Object.keys(useNodes()).length === 0`（无知识节点 → 无 progress/rels） | 取代 `.wd__cards` + `.wd-next` 区块；`.wd__hero` 欢迎语保留 |
| **Knowledge Space** | `components/CanvasViewport.tsx` | `Object.values(nodes).filter(isSpaceNode).length === 0` | 居中覆盖在 `.canvas-viewport` 之上（保留工具栏/缩放/HUD/stage banner） |
| **Growth Galaxy** | `components/GalaxyCanvas.tsx` | `growthNodes.length === 0`（`growthNodes = allNodes.filter(GROWTH_KINDS.has)`） | 居中覆盖在星空前（保留 LearningOverview/HUD/缩放） |

判定依据均为已有 store 选择器（`useNodes` / `GROWTH_KINDS`），**不新增 store 字段、不接 backend**。

接入方式（三处统一）：
```tsx
{isEmpty
  ? <EmptyState variant="..." title={t('empty.title.*')} description={t('empty.desc.*')} />
  : <原内容 />}
```

---

## 4. i18n Key 清单（`empty.*` 域，6 key，zh/en 1:1）

新增于 `src/i18n/zh-CN.ts` 与 `en-US.ts` 末尾（`settings.replayGuide` 之后），key 域与现有 `firstrun.*` 同级。

| Key | zh-CN | en-US |
|---|---|---|
| `empty.title.welcome` | 你的知识空间还是空的 | Your knowledge space is empty |
| `empty.desc.welcome` | Nox 会帮你把零散的知识连成网络，随时开始你的第一次探索。 | Nox will help you connect scattered knowledge into a network. Start your first exploration anytime. |
| `empty.title.space` | 还没有知识资产 | No knowledge assets yet |
| `empty.desc.space` | 把文档、笔记或链接交给 Nox，它会自动理解并建立关联。 | Hand documents, notes, or links to Nox — it will understand and connect them automatically. |
| `empty.title.growth` | 能力星图还在孕育中 | Your growth galaxy is still forming |
| `empty.desc.growth` | 每掌握一个概念，这里就会生长出一颗星。 | Each concept you master will grow a star here. |

- **不新增 `empty.action.*` key**：Demo 入口键留待 Demo 子步统一加入，避免本子步产生死键。
- 验收时 `zh-CN key count === en-US key count`（296 → 302），并跑 en-US CJK 泄漏检查。

---

## 5. Demo 数据入口关联（决策建议）

**问题**：空态是否关联「体验示例知识库」Demo 入口？是否本子步实现？

**建议（B 方案，推荐）**：
- `EmptyState` 暴露可选 `action` 槽（已在上文定义），但**本子步三处调用均不传 `action`**。
- 不新增 `empty.action.*` i18n、不实现 `seedDemo`、不改动数据流。
- 未来 Demo 子步只需：①加 `empty.action.demo` 双语 key；②在对应空态（建议 Welcome + Space）传 `action={{ label, onClick: seedDemo }}`。组件零改动即可复用。
- 这样满足「关联 Demo 入口」的意图（接口已预留），同时严守「不提前实现 Demo Flow」。

> 备选 A：本子步直接加一个 disabled「即将上线」按钮 —— 反对，因为它会模糊「价值引导 vs 功能入口」边界，且引入死状态。

---

## 6. 验收方案

### 6.1 i18n
- `check-i18n.cjs`：zh=en key 集合相等；en-US 无 CJK 泄漏（排除 `lang.opt*`/`lang.region*` 原生名）。

### 6.2 构建
- `build.cjs`（esbuild）执行通过；bundle 无新增别名/未定义问题。

### 6.3 视觉验证（headless，复用 FirstRun 管线）

**验证脚手架（临时，非产品行为）**：在 `src/mock/bootstrap.ts` 增加 dev-only 查询参数门控（参数缺失时零影响）：
- `?kcuEmpty=space` → 跳过 `s.setNodes(nodes)`（Space 空，Growth 有数据）
- `?kcuEmpty=growth` → 跳过 `seedGalaxy(s)`（Growth 空，Space 有数据）
- `?kcuEmpty=welcome`（或 `all`）→ 两者都跳过（全空 → Welcome 也空）

**截图场景**（capture-empty.cjs，每场景 DOM 断言 `.emptystate` 存在 / `errors=0` / en-US 无 CJK / reduced `animLive=0`）：

| 场景 | URL / 操作 | 语言/主题 |
|---|---|---|
| welcome-empty | `?kcuEmpty=all` | zh-light / en-light / zh-dark / zh-reduced |
| space-empty | `?kcuEmpty=space` → 切到 Space | zh-light / en-light / zh-dark / zh-reduced |
| growth-empty | `?kcuEmpty=growth` → 切到 Galaxy | zh-light / en-light / zh-dark / zh-reduced |

共 **12 张**验收截图（落 `outputs/empty-{welcome,space,growth}-{zh-light,en-light,zh-dark,zh-reduced}.png`）。

### 6.4 回归
- 正常无参数运行：三处**均不**出现空态（mock 数据存在），与原行为一致。

---

## 7. 实现阶段文件清单（确认后）

新增：
- `src/components/EmptyState.tsx`
- `src/components/EmptyState.css`

修改：
- `src/components/WelcomeDashboard.tsx`（条件空态；新增 `useNodes` 导入）
- `src/components/CanvasViewport.tsx`（条件空态）
- `src/components/GalaxyCanvas.tsx`（条件空态）
- `src/i18n/zh-CN.ts`（+6 `empty.*`）
- `src/i18n/en-US.ts`（+6 `empty.*`）
- `src/mock/bootstrap.ts`（dev-only `?kcuEmpty` 门控，**验证脚手架**）

临时（temp dist，不入库）：
- `capture-empty.cjs`（复用 `build.cjs` / `check-i18n.cjs`）

提交：`P4-1/3: add EmptyState system (welcome/space/growth, i18n, no nav)`

---

## 8. 非目标（范围护栏）

- ❌ 不演变为导航/菜单系统（无多链接列表、无路由）。
- ❌ 不实现 Demo Flow / `seedDemo` / 示例库逻辑。
- ❌ 不新增设计 token（只用 `app.css` 既有 token）。
- ❌ 不改 `App.tsx` 核心、FirstRun、其他 surface。
- ❌ 不做常驻「空态教程」——仅在数据为空时出现。
