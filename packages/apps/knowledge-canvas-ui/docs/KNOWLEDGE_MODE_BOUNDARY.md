# KNOWLEDGE_MODE_BOUNDARY.md — Space 与 Growth 边界契约

> 状态：v1.0（P4-0 固化）
> 来源：`src/types.ts`（`SpaceNodeKind` / `GrowthNodeKind` / `Relationship` / `KnowledgeBackend`）、`src/store/canvasStore.ts`

## 1. 目的
固化 Space 与 Growth 的语义边界，防止功能重复与双份数据存储。

## 2. Space =「我有什么」
用户已拥有 / 导入的 **tangible 资产**。

## 3. Growth =「我懂什么 / 缺什么」
内化的知识、技能、缺口与成长路径。

## 4. 节点归属表
| 归属 | `NodeKind` | 实例 |
|---|---|---|
| **Space** | `SpaceNodeKind` | `document` / `video` / `conversation` / `project` |
| **Growth** | `GrowthNodeKind` | `memory` / `task` / `concept` / `skill` / `learningPath` |

- 由单一 `mode: 'space' | 'growth'` 切换，非两套数据。
- 节点读写统一经 `KnowledgeBackend`，两面不复写管理逻辑。

## 5. Relationship 桥接规则
- 同源跨视图**不复制节点**，用 `Relationship`（edge）连接。
- 例：`project`(Space) —`derives`→ `concept`(Growth)；`document`(Space) —`informs`→ `skill`(Growth)。
- 边模型含 `source` / `target` / `kind`；跨模式链接用 `derives` / `informs` / `practices` 等语义 kind。
- `getNeighbors(nodeId)` 可跨越 mode 边界返回关联，视图按 mode 过滤展示。

## 6. 禁止双份数据存储
- 同一底层资产只存一份；Space 与 Growth 是两种视图。
- 反例（禁止）：一份文档既存 Space 节点又存 Growth 节点。正解：文档 = Space 节点，派生概念 = Growth 节点，由 `Relationship` 桥接。
- 校验：`importSource` 只产生 Space 资产；Growth 节点由关系推导 / 用户标注产生，不重复持有原文。

## 7. Import Rule（外部输入入口）
- **所有外部输入**：Document / Video / Conversation / Web Source。
- **统一入口**：`Space`（经 `importSource` 生成 Space 资产）。
- **流转**：`Space 资产` → AI 理解 → `Relationship` → `Growth`（概念 / 技能 / 缺口）。
- **禁止**：外部输入**直接生成 Growth 节点**。Growth 节点必须由 Space 资产经 AI 理解 + Relationship 桥接派生。

## 8. crossMode 暂不加入原因
- 加 `crossMode` 字段会让每个节点背负跨模式同步逻辑，schema 与 store 复杂度上升。
- 当前无确证需求：尚无"同一节点必须同时在两模式表现为不同行为"的场景；Relationship 已支撑跨模式看关联。
- 触发条件：仅当真实场景出现（如某 `project` 需在 Space 与 Growth 同时显示实时进度且状态需同步）时，再专门设计 `crossMode`。
- 决策：P4 及近期阶段**不引入 `crossMode`**（任务 #224）。
