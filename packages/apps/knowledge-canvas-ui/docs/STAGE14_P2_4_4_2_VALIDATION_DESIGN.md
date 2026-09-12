# STAGE14 P2-4.4.2 Design — Proposal Validation

> 阶段：**4.4.2 设计节点（design-only）**。只设计 Proposal validation，不编码、不建 Applier、不 store mutation、不自动审批、不 undo restore、不 DB migration。
> 前置：4.4.1 ProposalBuilder 已交付（`06a0522`）+ Review（`8efe56d`）。

---

## 0. 定位：Validation 在治理链中的位置

```
ToolCall → ProposalBuilder(✅4.4.1) → 【Validation(本设计)】 → Review decision → Applier(4.4.3)
```

Validation 是 **Reviewer 的前置与静态半区**：对 proposal 做**纯函数、无 I/O** 的结构校验，输出契约已定义的 `ReviewResult`。它**不是**审批（无 UI、无权限、无 auto_apply）—— 4.4.2 只回答"这个 proposal 结构上是否合法、每个 op 是否站得住"。

## 1. 产出物

`src/knowledge/write/validate.ts`（纯函数，~120 行预估）：

```ts
export function validateProposal(proposal: KnowledgeWriteProposal): ReviewResult
```

**输出直接使用契约类型**（`ReviewResult{proposalId, decision, verdicts}` / `ReviewVerdict{index, ok, code?, reason?}` / `ReviewCode` 词汇表）—— **契约零改动**。

## 2. 五项校验 → ReviewCode 映射

| # | 校验 | 检查内容 | 失败码（契约词汇） | 层级 |
|---|---|---|---|---|
| 1 | **id 校验** | 非空、`propose-` 前缀格式（builder 派生约定）、批内唯一（单 proposal 天然唯一 —— 校验格式即可） | `schema` | proposal |
| 2 | **source 校验** | kind ∈ {agent, ingestion, user}；agent → `runId` 非空且 `proposal.agentId === source.agentId`（两处字段必须一致，L123 冗余字段的一致性检查）；ingestion → docId 非空 | `schema` | proposal |
| 3 | **target 校验**（逐 op） | `node.create` → `target.nodeId` 必须存在且以 `proposed-node-` 开头（预分配约定）；`relation.create` → `relationId` 以 `proposed-rel-` 开头；`node.update` → `nodeId` 必须存在**且不以 `proposed-` 开头**（update 必须指向**已存在**节点，而非本批新造） | `schema` | op |
| 4 | **evidence 校验**（逐 op） | 每个 EvidenceRef kind 合法；`text.excerpt` 非空；引用字段类型正确（id 为 string / seq 为 number） | `schema` | op |
| 5 | **ops 完整性**（批级） | ① `ops.length > 0`（空 proposal 无意义 → `schema` 拒绝）；② **批内 nodeId/relationId 无重复**（预分配 id 冲突 = Applier 侧必然碰撞）；③ `node.update` 的 target 不得引用本批 `proposed-node-` id（update 只能指向既有实体 —— 新建后立即 update 应合并为一次 create） | `schema` / `conflict` | batch |

**明确不在 4.4.2 的校验**（需 I/O 或语义上下文，归 4.4.3 Applier）：

| 校验 | 归属 | 理由 |
|---|---|---|
| Import Rule（F1：外部输入只入 Space） | Applier | 需要知识上下文判断归属 |
| local-only 二次校验 | Applier | 需要 `decideProviderCandidates.allowed[].local` 事实（4.3.1 已备好） |
| before-state 快照采集 | Applier | 需要 store 读 |
| 置信度阈值 | Reviewer（未来） | Q4：产品策略，非协议 |

## 3. decision 语义（关键设计决定）

**4.4.2 的 `validateProposal` 永不产出 `auto_apply`**：

```
全部 verdict ok     → decision = 'needs_approval'（结构合法 ≠ 自动写入）
任一 verdict 失败   → decision = 'reject'
```

理由：`auto_apply` 属**自动审批**（你明令禁止）；结构合法只是写入的**必要条件**，语义/上下文合法性（Import Rule、privacy、快照）都在 4.4.3 Applier 侧 —— 所以即使未来引入 auto_apply，也必须在 Applier 通过之后，而不是 validation 层。

## 4. 依赖方向与纯度

```
knowledge/write/validate.ts ──type──> contracts/knowledgeWrite
禁止 import：store · llm · agent · activity · mock · demo · components · react
```

- 零 runtime import（同 builder 纪律）· 零副作用 · 无 Date.now（纯函数，同输入同 ReviewResult）
- `KnowledgeWriteProposal` 全 readonly ⇒ validator 只读不写（类型层保证）

## 5. 验收标准（预览）

| # | 标准 |
|---|---|
| V1 | 输出为契约 `ReviewResult`，契约零改动 |
| V2 | 五项校验各有正/负探针用例（builder 输出 → 全 ok；注入畸形 proposal → 对应码） |
| V3 | `auto_apply` 在 validate.ts 中**不出现**（grep=0） |
| V4 | 纯度：零 runtime import、零 store/llm import、无 Date.now |
| V5 | tsc 48 · oxlint 0 · cycles=0 |
| V6 | 负向注入矩阵：缺 id / source 不一致 / target 缺失 / 伪装前缀 / 空 ops / 重复预分配 id / update 指向 proposed id —— 各得对应拒绝码 |

## 6. 明确不做

Applier · store mutation · 自动审批 / auto_apply · undo restore · DB migration · Import Rule / privacy / 快照（Applier 层）· 置信度阈值 · UI · 契约修改 · 新依赖

## 7. 风险

| # | 风险 | 缓解 |
|---|---|---|
| R1 | 校验规则与 builder 约定漂移（前缀约定改了 validator 不知道） | 前缀常量 `proposed-node-`/`proposed-rel-` 从 builder **导出**复用（4.4.1 文件小幅增补导出，加法） |
| R2 | `needs_approval` 被误当"已批准" | 命名即语义；4.4.3 Applier 的 `ApplyRequest.review` 必须携带 ReviewResult —— 消费方契约强制 |
| R3 | 校验过早僵化 | 规则表驱动（检查项 = 数据），新增检查 = 加条目 |

---

**状态**：🟡 停在 **P2-4.4.2 Design Review Node**。**待裁决**：① 五项校验 + decision 语义（永不 auto_apply）是否批准 ② 是否接受「Import Rule/privacy/快照归 Applier」的分层 ③ 前缀常量从 builder 导出复用是否批准（4.4.1 文件小幅加法）④ 本设计是否提交。
