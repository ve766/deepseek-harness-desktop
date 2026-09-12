# AI Employee OS — Visual Evolution Direction

> 状态：P4-1 收尾后的 UI Evolution 基准（**仅记录，不进入当前编码**）
> 记录时间：2026-09-06
> 约束：不影响 P4-1 当前收尾；不提前改架构；当前 P4-1/5 只做体验精修与一致性收口。
> 衔接：P4-1/5 收尾 → P4-2 Showcase → 之后单独规划 Visual Evolution / Product Experience Upgrade。

---

## 0. 核心定位升级

**From → To**

- Knowledge Canvas Prototype
- **→ AI Employee OS Spatial Workspace**

---

## 1. 视觉参考

### 1.1 Apple Liquid Glass / visionOS

关键词：

- macOS Tahoe Liquid Glass
- WWDC25 Liquid Glass
- Spatial Computing UI

核心原则：

- 半透明层叠
- 浮动窗口
- 内容穿透玻璃
- 柔和边缘高光
- 深浅主题一致
- 空间层级感

### 1.2 Shell 方向（未来 AI Employee OS Shell）

```
Desktop
 ├── Employee Center
 ├── Knowledge Space
 ├── Memory
 ├── Marketplace
 └── Settings
```

不再以传统 Dashboard 为中心。

### 1.3 首页方向（未来 Welcome）

未来 Welcome **不采用数据卡片堆叠**。目标：一个核心 AI Employee 入口。

示例（Apple 官网式大留白 + 单核心主体）：

```
🐈‍⬛ Nox

你的 AI 知识员工

今日完成：
- 整理 X 个知识资产
- 建立 X 个连接

[进入工作]
```

强调：Apple 官网式大留白 + 单核心主体。

### 1.4 AI Employee Card（统一员工视觉模型）

未来统一员工卡结构：

```
Avatar
+ Identity
+ Status
+ Level / Growth
+ Capability
```

示例：

```
Nox
Knowledge AI

● Online

Level 3

负责：整理、理解、连接知识。
```

### 1.5 Knowledge Space 方向

未来**不要做传统节点图**。方向：

```
资料
 ↓
AI 理解
 ↓
洞察
 ↓
成长
```

Graph 从「数据关系图」升级为「知识生命系统」。

### 1.6 Spatial UI 方向（重点研究）

- visionOS interface design
- spatial computing UI
- glass panel hierarchy
- floating workspace

### 1.7 开源 / GitHub 参考（后续统一收集）

- liquid glass react ui
- apple glassmorphism dashboard
- react macos desktop
- ai agent ui
- knowledge graph react
- react flow beautiful examples
- spatial ui react

---

## 2. 阶段衔接

1. **P4-1/5** — 当前收尾：体验精修与一致性收口（Apple 风格最终视觉统一 + 交互细节精修）。
2. **P4-2 Showcase** — 六面 × 双语 × 三主题演示资产。
3. **Visual Evolution / Product Experience Upgrade** — 单独规划，落地本方向；**不提前改架构**。

---

## 3. 约束

- 该方向**不影响 P4-1 当前收尾**。
- **不提前改架构**；当前 P4-1/5 仅做体验精修与一致性收口。
- 本文件为未来阶段的设计基线，不在此阶段产生任何代码改动。
