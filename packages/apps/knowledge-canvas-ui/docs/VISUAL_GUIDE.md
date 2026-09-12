# VISUAL_GUIDE.md — AI Employee OS 统一视觉规范

> 状态：v1.0（P4-1 创建）
> 权威来源：`src/styles/app.css` 的 `:root` token 块（约 line 2394）与 `:root[data-theme="dark"]` 覆写块（约 line 2440）。
> 定位：本文件是 **Agent Workspace / Today Dashboard / Command Palette** 等未来模块的**唯一视觉引用标准**。组件 CSS 禁止裸 hex，一律引用下方 token。
> 校正说明：`THEME_TOKEN_GUIDE.md §4` 的缩写名（`--space-xs`、`--text-title/body/caption`、`--shadow-ambient/float`）为旧摘要，**以本文件为准**。详见 §0 兼容说明。

---

## 0. 兼容说明（Compatibility Note）

本文件以 `src/styles/app.css` 的真实 token 为**唯一权威来源**。发现旧文档 `THEME_TOKEN_GUIDE.md §4` 使用了与实际代码不符的缩写别名，记录如下，后续一律以实际代码为准：

| 用途 | 旧文档（THEME_TOKEN_GUIDE §4，代码中不存在） | 实际代码（`app.css` token） |
|---|---|---|
| 间距 | `--space-xs / sm / md / lg / xl` | `--space-1 … --space-7` |
| 排印 | `--text-title / body / caption` | `--text-caption(11) / foot(12) / body(14) / sub(15) / title(17) / display(22)` |
| 阴影 | `--shadow-ambient / float` | `--shadow-1 / 2 / 3` |
| 状态色 | （未单列） | `--morph-idle / thinking / searching / learning / completed / warning / error` |

- **规则**：组件 CSS 一律引用 `app.css` 真实 token；旧文档别名视为废弃。后续改文档时应直接采用真实名称，或在旧文档标注「见 VISUAL_GUIDE.md」。
- **引用优先级**：后续所有视觉方案（含 Agent Workspace / Today Dashboard / Command Palette）**优先引用本文件**，不重述 token 值；如发现本文件与 `app.css` 不一致，以 `app.css` 为准并回补本文件。

---

## 1. Apple Design Principles（设计原则）

- **克制的层次**：用 1–2 层阴影 + 玻璃质感表达深度，不堆叠硬阴影。
- **系统一致性**：所有圆角 / 间距 / 排印来自 token，禁止任意值。
- **有意义的动效**：动效服务理解（状态变化、空间关系），非装饰；默认微动（≤0.3s），大动（≥0.5s）仅用于入场。
- **明确的可达性**：焦点可见、对比达标、尊重 `prefers-reduced-motion`。
- **留白即内容**：8pt 栅格驱动呼吸感，不挤不空。

---

## 2. Color Tokens

### 2.1 Semantic（语义色：Light 基线 → Dark 覆写）

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--bg-base` | `#f5f5f7` | `#1e1e20` | 页面底色 |
| `--bg-layer-1` | `rgba(255,255,255,0.72)` | `rgba(40,40,44,0.72)` | 玻璃层 |
| `--bg-layer-2` | `rgba(255,255,255,0.9)` | `rgba(48,48,52,0.92)` | 实体层 |
| `--bg-insert` | `rgba(255,255,255,0.55)` | `rgba(255,255,255,0.06)` | 内嵌区 |
| `--label-primary` | `#1d1d1f` | `#f5f5f7` | 主文本 |
| `--label-secondary` | `#6e6e73` | `#b0b0b6` | 次文本 |
| `--label-tertiary` | `#8e8e93` | `#8a8a90` | 三级文本 |
| `--label-caption` | `#aeaeb2` | `#6a6a70` | 说明文本 |
| `--border-l1` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.1)` | 边框一级 |
| `--border-l2` | `rgba(0,0,0,0.14)` | `rgba(255,255,255,0.18)` | 边框二级 |
| `--brand-primary` | `#0a84ff` | `#0a84ff` | 品牌主色 |
| `--brand-ink` | `#2f6df6` | `#2f6df6` | 品牌墨色 |
| `--state-success` | `#34c759` | `#30d158` | 成功 |
| `--state-warn` | `#ff9f0a` | `#ffd60a` | 警告 |
| `--state-error` | `#ff3b30` | `#ff453a` | 错误 |
| `--bg-grad-a` / `--bg-grad-b` | 渐变端色 | 渐变端色 | 背景光晕 |
| `--brand-grad` | `linear-gradient(135deg,#0a84ff,#5e5ce6)` | 同左 | 品牌渐变 |

### 2.2 Morphicon state colors（状态色，映射 7 基类态）

Light（约 line 2364）/ Dark（约 line 2476）：

| Token | Light | Dark | 对应基类态 |
|---|---|---|---|
| `--morph-idle` | `#8e8e93` | `#98989d` | `idle` |
| `--morph-thinking` | `#0a84ff` | `#0a84ff` | `thinking` |
| `--morph-searching` | `#30b0c7` | `#64d2ff` | `searching` |
| `--morph-learning` | `#5e5ce6` | `#7d7aff` | `learning` |
| `--morph-completed` | `#34c759` | `#30d158` | `completed` |
| `--morph-warning` | `#ff9f0a` | `#ffd60a` | `warning` |
| `--morph-error` | `#ff453a` | `#ff6961` | `error` |

与 `STATUS_CONTRACT.md` 7 态一一对应；新增状态面复用这些色，不新增 hex。

**铁律**：组件 CSS 禁止裸 hex；仅 token 定义块内允许裸色。Dark 模式通过 `:root[data-theme="dark"]` 覆写 token 自动适配，**禁止组件级选择器硬编码**（见 §9 / 任务 #223）。

---

## 3. Typography（排印）

- **字体栈**：`var(--font)`（系统 UI 字体：`-apple-system / SF Pro / Segoe UI / Roboto / sans-serif`）。
- **字号 token**：`--text-caption 11` / `--text-foot 12` / `--text-body 14` / `--text-sub 15` / `--text-title 17` / `--text-display 22`（px）。
- **字重**：正文 400，强调 / 标题 500；**禁止 600 / 700** 重压。
- **层级**：display(22/500) > title(17/500) > sub(15/400) > body(14/400) > foot(12/400) > caption(11/400)。
- **行高**：正文 1.5–1.6；标题 1.2–1.3。

---

## 4. Radius（圆角）

| Token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 8px | 小元素 / 输入 |
| `--radius-md` | 12px | 按钮 / 控件 |
| `--radius-lg` | 16px | 卡片 / 面板 |
| `--radius-xl` | 22px | 大容器 / 弹层 |
| `--radius-card` | 12px | 卡片默认 |
| `--radius-pill` | 999px | 标签 / 头像 / 胶囊 |

**规则**：禁止裸 px 圆角；按钮 / 输入用 `md`，卡片 / 面板用 `lg`，大容器用 `xl`，标签 / 头像用 `pill`。

---

## 5. Shadow（阴影，仅三层 + 两辅助）

| Token | 值 | 用途 |
|---|---|---|
| `--shadow-1` | `0 1px 2px rgba(0,0,0,0.05)` | 静态层（ambient） |
| `--shadow-2` | `0 4px 12px rgba(0,0,0,0.08)` | 悬浮微抬 |
| `--shadow-3` | `0 12px 40px rgba(0,0,0,0.18)` | 弹层 / 浮起（float） |
| `--shadow-soft` / `--shadow-pop` | 历史辅助值 | 新组件优先用 `1/2/3` |

**规则**：禁止多重硬阴影；Dark 下阴影自动覆写（更暗、更扩散）。

---

## 6. Glass（玻璃拟态）

`.glass` 工具类（app.css 约 line 2431）：

```css
.glass {
  background: var(--glass-bg);
  -webkit-backdrop-filter: saturate(180%) blur(var(--glass-blur));
  backdrop-filter: saturate(180%) blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}
```

- **token**：`--glass-bg` / `--glass-blur`(20px) / `--glass-border` / `--glass-shadow`。
- **规则**：Modal / Tooltip / Toast / 浮层统一走 `.glass`；禁止裸 `rgba` 背景替代。

---

## 7. Animation（动效语言）

- **节奏**：
  - 微反馈 `0.05–0.15s ease`（hover / active / color / border）。
  - 入场 `0.5–0.6s cubic-bezier(0.2,0.8,0.2,1)`（`welcome-rise` / `wd-rise`）。
  - 循环态 `0.8–1.2s ease-in-out`（`tr-spin` / `tr-pulse` / `stage-dot`）。
  - 慢漂浮 `9s`（`wd-float`，仅装饰背景，reduced-motion 下关闭）。
- **缓动**：默认 `ease`；大位移用 `cubic-bezier(0.2,0.8,0.2,1)`。
- **现有关键帧**（复用，勿新建重复）：`tr-spin` / `tr-pulse` / `welcome-rise` / `stage-dot` / `wd-float` / `wd-rise`。
- **状态动效**：Morphicon 脉冲 / 扫描 / 渐变由 `--morph-*` 驱动（见 `STATUS_CONTRACT.md §7`）。

---

## 8. Reduced Motion（减弱动效）

- 现有覆写位于 app.css 约 line 1657 与 2277（`@media (prefers-reduced-motion: reduce)`）。
- **规则**：reduced-motion 下，所有非必要动画 `animation: none; transition: none`；Morphicon 直接跳终态；Nox 关联解释降级为瞬时显隐（`STATUS_CONTRACT.md §7`）。
- 新组件必须遵守：纯 CSS 动效由媒体查询覆盖；**JS 驱动的位移 / 缩放须用 `usePrefersReducedMotion()` 跳过**。

---

## 9. Component Examples（落地范式）

未来模块可直接抄的范式：

- **卡片**：`.glass` + `border-radius: var(--radius-lg)` + `box-shadow: var(--shadow-2)`；hover 升 `var(--shadow-3)` + `transform: translateY(-2px)`（0.15s）。
- **按钮**：主按钮背景 `var(--brand-primary)`、文字白；次级用 `var(--bg-layer-2)` + `var(--label-primary)`；`radius: md`；hover / active 用 `0.08–0.15s` 微反馈。
- **标签 / Pill**：`--radius-pill` + `var(--bg-layer-1)` + `var(--label-secondary)`。
- **状态点**：MorphIcon 消费域枚举 → base → `--morph-*`，不自绘 hex。
- **浮层（Modal / Tooltip / Toast）**：`.glass` + `var(--shadow-3)` + `radius: lg`。
- **焦点环**：`outline` 用 `var(--border-l2)` + 外阴影，禁默认蓝环；仅 `:focus-visible` 生效。

---

## 10. 禁止清单（约束未来模块）

- 禁止裸 hex / 任意 px 圆角 / 多重硬阴影。
- 禁止新增组件级 `:root[data-theme="dark"] .xxx` 选择器硬编码（统一 token 覆写；现有残留由任务 #223 收敛）。
- 禁止为单需求新增 `BaseMorphState`（`STATUS_CONTRACT.md §9`）。
- 禁止新增与现有重复的关键帧。

---

## 11. 引用方式

未来模块设计文档在「视觉」章节直接写：

> 遵循 `VISUAL_GUIDE.md`（颜色 / 排印 / 圆角 / 阴影 / 玻璃 / 动效 / reduced-motion），实现时引用同名 token，不重述值。

无需复制本文件 token 表；本文件为单一事实来源。

---

_本文件随 P4-1 创建，未来模块（Agent Workspace / Today Dashboard / Command Palette）统一引用。_
