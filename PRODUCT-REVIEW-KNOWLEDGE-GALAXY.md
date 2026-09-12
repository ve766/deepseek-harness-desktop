# PRODUCT-REVIEW-KNOWLEDGE-GALAXY.md

> Knowledge Canvas v1.3 — 产品评审（编码前最后一道门）
> 输入：`DESIGN-KNOWLEDGE-GALAXY.md`（v1.2）、`IMPLEMENTATION-KNOWLEDGE-GALAXY-MVP.md`（v1.3 plan）
> 方法：产品视角评审 6 个问题，给出结论与调整建议
> 状态：**仅设计，不写代码**；结论如需落地，待确认后回写实现计划

---

## 0. 评审范围与符号

| 符号 | 含义 |
|---|---|
| ✅ | 方向正确 / 建议采纳 |
| ⚠️ | 方向对但有风险，需补强 |
| ❌ | 不建议 / 需调整 |

输入前提：v1.3 仍受 6 项约束冻结（仅扩 `knowledge-canvas-ui`、不改 `llm-router`/`ai-provider-manager`/`agent-loop`、继续 MockBackend、不 commit）。

---

## 1. Knowledge Space ↔ Knowledge Galaxy 产品关系

### 结论：✅ 方向正确，但必须明确「边界」与「切换 trigger」

**定义（避免功能重叠的核心）：**
- **Space = 「我有什么」**：已捕获的**具体知识资产**（document / video / conversation / project / memory / task）。
- **Galaxy = 「我懂什么 / 还缺什么」**：从资产中抽出的**抽象知识单元**（concept / skill / learningPath）与成长状态。

两者是**同一底层知识的两种镜头**，不是两份功能。桥接物是 `Relationship`（资产→概念、概念→概念）。

**边界原则（必须写进实现）：**
- Space 节点是**制品**（可导入、可检索、可整理）。
- Galaxy 节点是**抽象单元**（由 AI 从资产抽取，或在 Galaxy 内由学习路径生成）。
- **导入只在 Space**；Galaxy 的「加入 Galaxy」仅把概念节点纳入个人星系，不是让用户手动导入文件。否则两模式边界模糊。

**进入时机：**
| 场景 | 应进入 |
|---|---|
| 导入 / 检索 / 整理资料；处理「收件箱」；回顾已有资产 | **Space** |
| 想学习、探索关系、发现自己缺什么；Nox 提示有缺口 | **Galaxy** |

**AI 主动推荐切换的条件（建议明确落地）：**
1. 导入后 Nox 检测到资料触及某概念，但用户该概念 `mastery` 低 → 建议「在 Galaxy 看 30 分钟学习路线」。
2. 用户在 Space 长时间未处理导入 → 推送 Galaxy 探索建议。
3. 完成一条学习路径 → 推荐 Space 中相关资产「深化」。

> 评审意见：当前 plan 已隐含此边界，但**未显式声明「Space 唯一导入入口」**。建议补一条冻结规则。

---

## 2. Galaxy 长期产品价值 — 核心闭环

### 结论：✅ 是 AI Employee OS 的核心成长闭环，值得作为长期主轴

**采纳用户给出的闭环链：**
```
Knowledge Input
      ↓
Knowledge Graph
      ↓
Gap Detection
      ↓
Learning Path
      ↓
Skill Growth
      ↓
AI Employee 能力增强
```

**价值判断：**
- 市面工具（Notion / Obsidian）多在 **Space 层止步**——解决「存得下、找得到」。Galaxy 补齐 **「从存到长」** 的闭环，是真正差异点。
- 末环 **「AI Employee 能力增强」** 是 AI Employee OS 的论点核心：用户个人知识增长 → 员工（Nox 等）更具上下文与能力。因此 Galaxy 不是「一个功能」，而是 **OS 的增长引擎**。

**风险与前提（必须标注）：**
- 缺口检测质量依赖未来 Embedding / Knowledge Graph；v1.3 mock 仅为**规则级演示**，需在 UI 标注「演示」。
- 学习不能成负担：坚持 **30 分钟路径、非课程化**，否则留存差。

**建议：** 将 `mastery` / `progress` 作为**一等数据**，反哺 Employee context（v1.3 仅建模 + 可视化，不接 Agent Core）。

---

## 3. Nox 的角色定义

### 结论：✅ 升级为 Personal Knowledge Navigator（个人知识导航员）

| 维度 | 旧（知识管理 Agent） | 新（Personal Knowledge Navigator） |
|---|---|---|
| 形态 | 被动应答的聊天机器人 | 主动驱动成长的导航员 |
| 职责 | 整理 / 检索 | 找缺口 · 规划路线 · 解释关系 · 推荐下一步 |
| 输出 | 对话消息 | OS 对象（缺口卡 / 学习路径 / 下一步行动） |

**与「聊天机器人」的边界（关键）：**
- Navigator **主动推送、有主张**（「你缺 Memory Architecture」），并把引导**持久化进 OS**（缺口卡/路径是 OS 实体，非 ephemeral 聊天）。
- Chat 只是其**一个通道**，不是其形态。Galaxy 中 Nox 的主表面是 **Insight Panel 缺口卡 + 路径轨道**，不是聊天框。

**实现影响（v1.3）：**
- Nox 是路径 / 缺口建议的 `ownerAgent`。
- 在员工注册表正式改 Nox `role` 文案为 **Personal Knowledge Navigator**（v1.3 mock 体现，真实 agent 后续对齐）。

---

## 4. Galaxy UI 产品化方向

### 结论：⚠️ 隐喻需加「大白话层」，否则「美但晕」

**核心问题：** 普通用户第一次打开，是否知道「这里可以帮我成长」？当前「星系 / 节点 / 轨道」偏抽象，有认知门槛。

**参考取舍：**
- **Apple**：清晰、affordance、渐进披露（普通用户先看到结果，专家才见全貌）。
- **learn-anything.xyz**：探索即点击展开，关系即地图。
- **Notion / Obsidian**：大白话组织，不炫术语。
- **Arc Browser**：空间化、温暖感。

**具体建议（采纳可降风险）：**
1. **用户面命名**：对外叫 **「成长 / Growth」** 或「学习地图」；「Galaxy」作为视觉 / 内部名。避免首屏只给一片星空。
2. **首开 Galaxy 态**：Nox 用**具体缺口 + 建议路径**迎接——「发现 3 个知识缺口，30 分钟路线已备好」，**而非空星场**。
3. **节点大白话**：每个节点配一句人话描述（如「Memory Architecture：让 Agent 记住历史对话」），不只标题。
4. **渐进披露**：普通用户看路径 + 下一步；进阶用户看全关系图。
5. 动效服务理解（轨道点亮 = 进度），不炫技。

> 评审意见：视觉隐喻保留，但**必须叠加价值主张层**，否则首开转化与留存会受损。

---

## 5. v1.3 是否继续 Mock

### 结论：✅ 继续 Mock，且要把「后端契约」先钉死

**链路保持：**
```
UI  →  MockBackend  →  未来：Knowledge OS / Embedding / Memory / LLM Router / Agent Core
```

**理由：** 产品假设（缺口闭环、Navigator 角色、UI 清晰度）可先用 mock 验证，再投后端，降风险、快迭代。

**关键动作（建议补进 plan）：**
- v1.3 定义 `GalaxyBackend` / `Relationship` / `Progress` 的**契约桩**（接口形态固定），使未来替换**零 UI 改动**（沿用 v1.1 `KnowledgeBackend` 哲学）。
- 明确不做：真实 embedding、图谱持久化、Memory 持久化、`llm-router` 调用。

---

## 6. 最终建议

### 6.1 v1.3 是否值得实现 → ✅ 值得
差异点验证成本极低（mock 即可），且是 AI Employee OS 的增长引擎，应作为主轴推进。

### 6.2 是否调整信息架构 → ✅ 小幅调整
- Galaxy 用户面标签改为 **「成长 / Growth」**（Galaxy 为视觉名）。
- 首开 Galaxy 改为**缺口驱动**，非空星场。
- 顶层可规划 **「今天 / Today」** 聚合面（Space 收件箱 + Galaxy 缺口 + Employee 建议），v1.3 先不做，列入 v1.4。

### 6.3 是否增加 Learning Dashboard → ✅ 建议增加（分阶段）
- **价值**：一眼回答「这帮我成长了吗」——活跃路径 / 掌握雷达 / 缺口清单 / 近期成长 / 下一步。
- **落地**：v1.3 在 Galaxy 左栏加 **「学习概览」面板（最小可用）**；完整 Dashboard 放 v1.4。

### 6.4 是否加入 AI Employee 成长系统 → ✅ 建模 + 可视化，不接真实能力
- v1.3：`mastery` / `progress` 作为数据 + **Nox 知识覆盖率指示**（Employee Growth 指示）。
- 真实能力增强需 Agent Core + Memory（超范围），v1.3 **仅反映，不接线**。

---

## 7. 评审结论与回写待办（待确认后落 plan）

**总体：v1.3 方向通过，建议采纳以下 5 项调整。**

需回写 `IMPLEMENTATION-KNOWLEDGE-GALAXY-MVP.md` 的变更（确认后执行）：
1. Galaxy 用户面标签 → **「成长 / Growth」**（Galaxy 为视觉名）。
2. 首开 Galaxy **缺口驱动**（mock 预置缺口，非空白）。
3. Galaxy 左栏新增 **「学习概览」面板**（v1.3 最小可用）。
4. Nox `role` 改为 **Personal Knowledge Navigator**（mock 体现）。
5. 范围冻结补一条：**Space 唯一导入入口；Galaxy 不直接导入**。

**风险登记：**
- 缺口检测质量（mock 规则级，需 UI 标注「演示」）。
- UI 抽象度（靠第 4 节「大白话层」缓解）。

---

## 8. 决策门

- ✅ 进入编码前置条件：上述 5 项调整被确认。
- 文档状态：product-review-draft｜未回写实现计划｜未编码｜未 commit

---

*评审输入：DESIGN-KNOWLEDGE-GALAXY.md（v1.2-draft）、IMPLEMENTATION-KNOWLEDGE-GALAXY-MVP.md（v1.3-plan-draft）*
*评审输出：本文件（产品决策）+ 回写待办（§7）*
