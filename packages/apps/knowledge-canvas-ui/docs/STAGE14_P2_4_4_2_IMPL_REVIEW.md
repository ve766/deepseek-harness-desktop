# STAGE14 P2-4.4.2 Implementation Review — Proposal Validation

> 阶段：**P2-4.4.2 实现完成，停在 Review Node，未提交**。
> 范围：`src/knowledge/write/validate.ts`（纯函数 `validateProposal(proposal): ReviewResult`）+ builder 前缀常量小幅导出（批准的 Q3 加法）。

---

## 1. 文件清单

| # | 文件 | 动作 | 说明 |
|---|---|---|---|
| 1 | `src/knowledge/write/validate.ts` | **新增** | ~230 行，`validateProposal` 纯函数 |
| 2 | `src/knowledge/write/proposalBuilder.ts` | 小幅增补 | 导出 `PROPOSED_NODE_PREFIX` / `PROPOSED_RELATION_PREFIX` 并内部复用（Q3 批准：防字符串复制漂移；单独记录，不扩大范围） |

**`contracts/` · `executor.ts` · `runner.ts` · `store` 零改动。**

## 2. 五类校验覆盖矩阵（探针实证）

| # | 校验 | 正向 | 负向注入 | 码 |
|---|---|---|---|---|
| 1 | id | `propose-run-77` 全 ok | 空 id / 错误前缀 → reject | `schema` |
| 2 | source | agent verbatim ok | 空 runId → reject；`source.agentId ≠ proposal.agentId` → reject | `schema` |
| 3 | target（逐 op） | create 带预分配前缀 ok | create 无前缀 → reject；create 缺 nodeId → reject；**update 指向 `proposed-*` → reject** | `schema` |
| 4 | evidence（逐 op） | text 引用 ok | 空 excerpt → reject；负数 event seq → reject | `schema` |
| 5 | ops 完整性（批级） | 非空 + id 唯一 ok | 空 ops → reject；**批内重复预分配 id** → reject | `schema`（注：`conflict` 是 **ApplyCode**，Review 时段同问题用 `schema` —— 已注释） |
| — | **decision 语义** | 全 ok → `needs_approval` | 任一失败 → `reject` | **`auto_apply` 永不产出**（grep 证实仅注释提及） |

探针：**16/16 PASS**（`bench/p2442_probe.mts`）—— 正向 3 + 负向注入矩阵 11 + 前缀常量接线 1 + auto_apply 禁令 1。

## 3. ReviewResult 输出示例（builder 正向输出）

```json
{
  "proposalId": "propose-run-77",
  "decision": "needs_approval",
  "verdicts": [
    { "index": -1, "ok": true },   // id（-1 = proposal 级）
    { "index": -1, "ok": true },   // source
    { "index": 0, "ok": true },    // op0 node.create target
    { "index": 1, "ok": true },    // op1 relation.create target
    { "index": 2, "ok": true }     // op2 update target（指向既有实体）
  ]
}
```

## 4. 纯净度

| 项 | 结果 |
|---|---|
| runtime import | **1** —— 即前缀常量（`./proposalBuilder`，Q3 明确允许 "import type / 常量"；无其它值导入） |
| type imports | `contracts/knowledgeWrite`（ReviewResult/Verdict/Proposal 类型） |
| store / llm / agent / activity / mock / demo | **0** |
| class / fetch / Date.now / network | **0**（纯函数：同输入同 ReviewResult） |
| `auto_apply` 产出 | **0**（字符串仅在注释中作为禁令说明） |

**契约交互发现（已修）**：批内重复预分配 id 最初误用 `'conflict'` —— 该码属 **ApplyCode**（Apply 时段）；Review 时段同问题用 **`schema`**（注释已固化此区分）。

## 5. tsc 对比基线

**48 = 基线** · `validate.ts` / `proposalBuilder.ts` 错误 NONE · `TS2307 = 0` · oxlint 预检 **0 errors**（修掉一处不必要的模板字符串 → `@stylistic(quotes)`）。

## 6. git diff 状态

| 项 | 状态 |
|---|---|
| HEAD | `8efe56d`（本轮未产生 commit） |
| staged | **0**（未提交） |
| tracked 改动 | **1 个**：`proposalBuilder.ts`（前缀常量导出 + 内部复用，批准的加法） |
| untracked 新增 | `validate.ts` + 本文档 |
| 全仓 | 100 M / **148 ??** / **0 D** · 根 `src ' M'=0` |
| contracts / executor / runner / store / demo | 零改动 |

## 7. 风险

| # | 项 | 说明 |
|---|---|---|
| R1 | `needs_approval` 语义 | 结构合法 ≠ 可写入 —— 4.4.3 Applier 的 `ApplyRequest.review` 必须携带本 ReviewResult（契约强制），且 Applier 侧还有 Import Rule / privacy / 快照三道语义检查 |
| R2 | 前缀约定耦合 | builder↔validator 经共享常量耦合 —— 这是**有意的防漂移设计**；若前缀变更须同步两文件（同 commit） |
| R3 | validator 可被绕过 | 纯函数无强制力；4.4.3 Applier 的 `ApplyRequest` 契约要求携带 review —— review 必须来自 validator，接线时以 grep 断言 |

## 8. 禁项核验

❌ Applier · ❌ store mutation · ❌ 自动审批/auto_apply（grep=0 产出）· ❌ 权限系统 · ❌ knowledgeWrite contract 改动 · ❌ 插件 runtime · ❌ undo restore · ❌ DB migration · ❌ 新依赖 —— 全部未触碰。

---

**状态**：🟡 停在 **P2-4.4.2 Review Node，未提交**。待裁决：① 是否提交（建议两笔：builder 前缀常量导出 → validate.ts；或合并为一笔并注明）② 本 Review 是否提交 ③ 是否进入 **4.4.3 Applier 设计**（治理链最后一段：ApplyRequest → KnowledgeApplier → store mutation + before-state 快照 + local-only 二次校验）。
