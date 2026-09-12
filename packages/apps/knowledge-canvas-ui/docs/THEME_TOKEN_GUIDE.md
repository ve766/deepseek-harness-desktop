# THEME_TOKEN_GUIDE.md — 主题与 Token 契约

> 状态：v1.0（P4-0 固化）
> 来源：`src/styles/app.css`（token 基线 + `[data-theme]` 块）、`src/themeBootstrap.ts`、`src/components/ThemeSwitcher.tsx`

## 1. 目的
定义主题驱动机制与 token 命名规范，保证"未来增加主题只需新增 token，不修改组件"。

## 2. Light / Dark / System 优先级
解析顺序（高→低）：
1. `data-theme="light|dark"`（用户显式）＞
2. `prefers-color-scheme`（System 跟随 OS）＞
3. `:root` 默认（浅色基线）

- System 为默认模式；`applyTheme('system')` → `removeAttribute('data-theme')`，交 `@media` 兜底。
- 显式 `light/dark` 写入 `data-theme` 属性，覆盖 System。

## 3. data-theme 生命周期
- 启动：`themeBootstrap.applyThemeBootstrap()` 从 `localStorage.kcu-theme` 读取，于**首帧前**（entry 渲染 React 之前）应用，避免 FOUC。
- 持久化：用户切换（ThemeSwitcher）写入 `localStorage.kcu-theme`。
- 运行态：`'system'` 仅存为值，DOM 上移除属性；`'light'|'dark'` 写为属性。

## 4. token 命名规则
- 颜色（语义）：`--bg-base` / `--bg-layer-1..3` / `--label-primary..tertiary` / `--border-l1..l2` / `--brand-primary` / `--state-success` / `--state-error`
- 间距：`--space-xs/sm/md/lg/xl`
- 圆角：`--radius-sm/md/lg/xl/full`
- 阴影：`--shadow-ambient` / `--shadow-float`
- 字体：`--text-title/body/caption`（+ 字号/字重派生）
- 玻璃：`--glass-bg` / `--glass-border` / `--glass-blur`
- **铁律**：组件 CSS 禁止裸 hex；颜色一律引用 token（裸色只出现在 token 定义块内）。

## 5. custom theme 扩展方式（目标态）
- 新增 `:root[data-theme="brand-x"] { /* 仅覆写 token 集 */ }` 块。
- 组件因全部引用 token，**自动适配**，无需组件选择器改动。
- 验收：新主题 = 一个 token 覆写块，零组件级补丁。

## 6. 组件级硬编码迁移路线
- 审计清单（来自 §5 caveat）：`.tbtn`、`.knode__connect`、`.bg-layer__base`、`.gnode__sugg-text`（及后续 grep 发现项）。
- 每项迁移：深色专用值提升为 token（如 `--tbtn-bg-dark`）或改为由现 token 派生。
- 终点态：显式 `[data-theme="dark"]` 块内只含 token 覆写，无组件选择器。
- 验证：以"仅覆写 token 的 custom theme"渲染，全组件正确。

## 7. Future Apple 风格主题方向
- **克制原则**：不做大量主题皮肤，以少量高质量 preset 为主，不做传统换肤系统。
- **预设序列**：
  - `System`（跟随 OS）— 默认
  - `Light` — 浅色基准
  - `Dark` — 深色基准
  - `Aurora`（未来）— 高质感渐变光晕预设
  - `Deep Space`（未来）— 深空冷色调预设
- 所有 preset 均为"token 覆写块"，不引入新组件样式；新增 preset 不改动任何组件。

## 8. custom theme token 化路线（重申）
§5–§6 的 token 化目标是 §7 preset 与任意自定义主题的共同前提：只有当组件级覆写全部收敛为 token 派生，preset / 自定义主题才能做到"纯 token 切换"。该收敛随 P4-1 视觉统一顺带推进（任务 #223）。
