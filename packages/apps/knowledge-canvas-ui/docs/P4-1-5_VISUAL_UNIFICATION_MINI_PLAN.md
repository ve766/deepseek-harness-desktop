# P4-1/5 Mini Plan — Apple 风格最终视觉统一 + 交互细节精修

> 父计划：`docs/P4-PRODUCTIZATION-PLAN.md` §3.4 / §3.5 / §3.6
> 状态：**待确认后进入编码**
> 约束（用户显式）：不在当前阶段进行大规模 UI 重构；不引入新依赖；不改动架构。
> 衔接：P4-1/5 收尾 → P4-2 Showcase（六面 × 双语 × 三主题）→ 之后单独规划 Visual Evolution（见 `AI_EMPLOYEE_OS_VISUAL_EVOLUTION.md`）。

---

## 1. 目标（对应 §3.6 验收）

让「首次启动 → 空状态 → Demo → 主界面」形成**无断点体验**，并完成 **Apple 风格最终视觉统一**，使三主题（System/Light/Dark）+ 双语（zh-CN/en-US）下视觉一致、`reduced-motion` 关闭所有非必要动画。

---

## 2. 范围与边界（严禁越界）

**做**：§3.4 视觉统一（token 收敛 / 重复 token 化解 / `.glass` 规则对齐）+ §3.5 交互精修（hover/active 一致性、主题无闪烁验证、reduced-motion 补齐）。
**不做**（红线）：不重做布局/信息架构；不引入 Liquid Glass / visionOS 新视觉语言；不新增依赖/组件/架构改动；不改语义色（kind accent hex 如 `#5e5ce6` 是数据）。

---

## 3. 四大核查范围（基于本次审计，作为编码清单）

### 3.1 当前 token 收敛范围（Token Convergence Scope）

**既有 token 系统（已确认存在且带 dark 覆盖）：**
- 旧版 alias：`--bg-base / --bg-layer-2 / --label-primary|secondary|tertiary|caption / --border-l1|l2 / --brand-primary / --state-success|warn|error`（定义于 `app.css` `:root` L8–26，dark 覆盖 L980–999）。
- 几何/排版/玻璃：`--space-1…7`（L2396）、`--radius-sm|md|lg|xl`（L2405–2408）、`--shadow-1|2|3`（L2411–2413）、`--text-caption|foot|body|sub|title|display`（L2416+）、`--glass-bg|blur|border|shadow`（L2424+，dark 覆盖 L2467+）。

**冲突点（需化解，app.css-only，低风险）：**
- `--radius-card` 被定义两次：L28 `12px` 与 L1719 `14px`（后者 cascade 胜出）。
- `--radius-lg` 被定义两次：L1720 `22px` 与 L2407 `16px`（后者胜出）。
- `--shadow-soft` / `--shadow-pop` 两个值集：L31–32 与 L1722–1723（后者胜出）。
- 处置：合并为单一权威值，删除早期重复块；不引入新 token 名。

**收口动作：**
- `AssociationExplainer.css` 引用 `--dsw-alias-*`（见 3.2），该系列在 `src/` 内**无任何定义** → 改为引用既有 alias（`--bg-layer-2 / --border-l1|l2 / --label-*`），与 `FirstRunScreen.css` / `EmptyState.css` 保持一致。

### 3.2 dark hardcode 收敛清单（Dark-Mode Hardcode List）

| # | 文件 | 问题 | 处置 | 范围 |
|---|---|---|---|---|
| D1 | `AssociationExplainer.css` | 全部颜色走 `var(--dsw-alias-*, <hex>)`，`--dsw-alias-*` 未定义 → 兜底 hex 常驻生效：bg `#1c1c1e`（暗）、label `#f2f2f7`/`#c7c7cc`/`#98989d`、border `rgba(255,255,255,.08\|.1)`。**后果：Nox 面板在 light 模式下仍是暗色卡，非主题自适应** | 改引用既有 `--bg-layer-2 / --border-l1|l2 / --label-*`（带 dark 覆盖） | **in-scope（被 capture 覆盖）** |
| D2 | `p1Demo.css` / `p2Demo.css` | 同 D1 的 `--dsw-alias-*` 未定义问题 + 裸 `#fff`/`#ff9f0a`/`#c77700` | 不动（独立 demo 入口，不在 capture 路径） | out-of-scope（登记债务） |
| D3 | `p3Demo.css` | 用旧版 `--bg-base/--surface/--label-secondary/--brand-primary` + 裸 `#fff`；旧版 token 已有 dark 覆盖 → 实际自适应 | 不动（demo，不在 capture 路径） | out-of-scope |
| D4 | `morphiconDemo.css` | 本地 `--md-*` 变量 + 自带 `[data-theme="dark"]` 覆盖块（L296–304）→ 自适应 | 不动（demo） | out-of-scope |
| D5 | `GalaxyNode.tsx` / `AssociationExplainer.tsx` | kind accent 裸 hex（`#5e5ce6` 等）为语义数据色 | 不改（红线：语义色） | out-of-scope |

→ **in-scope 仅 D1**。其余为 demo 债务或语义色，不进入 P4-1/5。

### 3.3 reduced-motion 全量检查范围（Reduced-Motion Full Check）

**已含守卫（verify 不新增即可）：**
- `app.css` 两处 `@media (prefers-reduced-motion: reduce)`：L1657（`.modeswitch__track/.gnode/.lptrack__glow/.cta/.tbtn` 等）、L2277（`.wd*`/`.gnode/.gedge__line/.lptrack*/.mastery-ring__fill/.thinking-ring*/.nox-gap__pulse` 等）。
- `FirstRunScreen.css` L170（`.firstrun` 动画 + `.firstrun__dot` 过渡禁用）。
- `EmptyState.css` L72（`.emptystate-in` 动画禁用）。
- `AssociationExplainer.css` L223（`.assoc__*` 脉冲/涟漪/连线过渡禁用）。
- `morphicons/morphicons.css`（已含守卫）。

**待核实缺口（编码时补齐）：**
- 全局守卫为「按类名枚举」式，未覆盖的 hover/active 过渡（如 `.appbtn`、`.pill`、卡片 hover）需确认是否落入上述枚举；若有遗漏，在 `app.css` L1657/L2277 枚举中追加对应类，或补一条宽泛兜底（`* { transition-duration: 0.01ms !important }` 仅 reduced 块内）。
- 复核 TSX 内联 `style={{transition}}`：当前 grep 无命中（安全）。

### 3.4 可能影响截图 / 回归范围（Screenshot / Regression Impact）

**capture 路径（必回归，复用 `kcu-dist/capture-demo.cjs` 范式）：**
- 主场景：welcome / space-thinking / space-done / growth / exit × 4 主题（zh-light / en-light / zh-dark / zh-reduced）= **20 张**。
- 因改动集中在全局 `app.css` token，任何面都会受影响；回归断言：`errors=0`、无 CJK 泄漏、无 404、`data-theme` 首帧就位（无闪烁）、reduced 主题过渡为 0。
- 交付：`P4-1/5` 截图集（同 sub-step 4 四主题范式）供验收。

**不在 capture 路径（登记，不阻塞）：**
- `p1/p2/p3/morphiconDemo` 独立 demo 入口（受 D2–D4 债务影响，但不参与 P4-1/5 验收门）。
- `canvasStore.ts` / `sequencer.ts` / `bootstrap.ts` / i18n（除非发现漏译，最小补 key）。

---

## 4. 实施清单（预估文件，均为 app.css + 组件 CSS，无 TSX 逻辑改动）

1. **`src/styles/app.css`** — 化解 `--radius-card`/`--radius-lg`/`--shadow-soft`/`--shadow-pop` 重复定义（单一权威值）；如 reduced-motion 缺口存在则补枚举。
2. **`src/components/AssociationExplainer.css`** — D1：将 `--dsw-alias-*` 引用改为既有 `--bg-layer-2 / --border-l1|l2 / --label-*`，使 Nox 面板主题自适应。
3. **验证脚本** — 复用 `capture-demo.cjs` 范式新增/复用 `capture-p41-5.cjs`，断言三主题切换无闪烁、reduced-motion 下无过渡、`errors=0`、无 CJK 泄漏、无 404。

**不改动**：`canvasStore.ts`、`sequencer.ts`、`bootstrap.ts`、i18n（除非漏译）、任何布局/组件结构。

---

## 5. 验收（对应 §3.6）

- 首启 → 空态 → Demo → 主界面 全程可走通，无断点、无控制台报错（headless capture `errors=0`）。
- 三主题 + 双语下视觉一致（Nox 面板 light/dark 均正确）；`reduced-motion` 关闭所有非必要动画。
- 不引入新依赖；`pnpm` / lefthook（oxlint）零阻断。
- 交付截图：主界面/空态/Demo × zh-light / en-light / zh-dark / zh-reduced。

---

## 6. 纪律

- 先文档（本计划）后编码；编码 → 构建验证（esbuild）→ 跑 capture 截图 → 检查 zh/en/dark/reduced → 检查 no-error/no-404 → 提交后停在验收节点。
- 提交信息建议：`P4-1/5: Apple-style visual unification & interaction polish`。
- **完成后不自动进入 P4-2**，停在验收节点等你确认。

---

## 7. 与 Visual Evolution 的边界（防越界提醒）

本子步只做"一致性收口"，**不**落地 `AI_EMPLOYEE_OS_VISUAL_EVOLUTION.md` 的 Liquid Glass / Shell 重构 / 单核心 Welcome / AI Employee Card / 知识生命系统。那些是 P4-2 之后单独规划的阶段。
