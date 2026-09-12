# Stage 12 · D3 Acceptance Report — 贡献统一经 ingestSource

**Stage**: 12 (AI Employee Knowledge Contribution Integrity)
**Sub-step**: D3 — Contribution uniformly routed through `ingestSource`
**Status**: ✅ D3 验收通过，停在 D3 Acceptance Node（不进入 D4）
**Prerequisite**: D2 (`e16a124`) 已验收通过

---

## 1. Commit

| 项 | 值 |
|---|---|
| **Commit hash** | `bcaaff7` |
| 提交信息 | `Stage 12 D3: contribution uniformly routed through ingestSource` |
| 修改文件数 | 1 |
| 变更量 | +10 / −8 |
| 父提交 | `e16a124` (D2) |
| lefthook | lint 0 errors / whitespace / vendor manifest guard 全过 |

---

## 2. 修改文件列表

| 文件 | 改动 | 说明 |
|---|---|---|
| `src/knowledge/lens/knowledgeAccess.ts` | +10 / −8 | 删除 `contribute` 中绕过 ingestion 的 `importSource` fallback；`tryAttributedImport` 不再吞掉错误（使 ingestion 失败可上报为 `ingest-failed`） |

> 仅此 1 文件入库。其余预存 tracked-modified（94 个 tsconfig/package.json 等）与 kcu 67 个 untracked 文件、dist 均未暂存。

---

## 3. ingestSource 闭环验证结果（运行时实证）

通过 esbuild 打包 + 受管 node 执行真实运行时断言：

**A. 具备 `importSourceAs` 的后端（Mock）—— 贡献必须经由 ingestion**
```json
{
  "throughIngestion": {
    "ok": true,
    "ownerAttribution": "attributed",
    "status": "draft",
    "nodeHasOwnerAgent": true,
    "nodeHasIngestedContent": true,   // meta.content 由 ingestSource 写入 → 证明路径经 ingestion
    "listOwnedReadable": true
  }
}
```

**B. 不具备 `importSourceAs` 的后端 —— 禁止回退到 `importSource`（旁路已删）**
```json
{
  "bypassBlocked": {
    "ok": false,
    "reason": "backend-unsupported",
    "importSourceNotCalled": true      // fallback 删除，importSource 永不被调用
  }
}
```

**结论**：贡献链路已固定为
```
contribute
  → importSourceAs()        (接口外扩展 seam)
  → ingestSource()          (ingestion layer：SourceRef → 归一化文本 + meta.ownerAgent)
  → KnowledgeNode.ownerAgent + aiStatus:'draft'
  → EmployeeKnowledgeAccess.listOwned() 可回读
```
无任何绕过 ingestion 的路径。`nodeHasIngestedContent:true` 证实 ingestion 确实在贡献链中执行。

---

## 4. KnowledgeBackend 五方法未变化证明

`src/types.ts` 接口定义（行 165–174）保持精确 5 方法，无 `importSourceAs`：

```ts
export interface KnowledgeBackend {
  listNodes(): Promise<KnowledgeNode[]>
  listEdges(): Promise<KnowledgeEdge[]>
  importSource(src: SourceRef): Promise<{ nodeId: string }>
  getNeighbors(nodeId: string, text: string): Promise<{ nodeId: string; score: number; reason: string }[]>
  getMemory(): Promise<MemoryEntry[]>
}
```

`importSourceAs` 仍作为各具体后端（Mock / LightRAG）的**接口外扩展方法**存在，不污染 5 方法契约（满足 D3 约束「保留 importSourceAs 作为接口外扩展 seam」）。

---

## 5. LightRAG isolation 检查

```
git diff --stat HEAD -- packages/apps/knowledge-canvas-ui/src/knowledge/backends/lightRAGBackend.ts
(empty)  →  LightRAGBackend 在 D3 中零改动
```

两个后端经由同一 `importSourceAs → ingestSource` seam，贡献行为一致（满足 D3 约束「保证 Mock 与 LightRAG 行为一致」）。LightRAG adapter 未被污染。

---

## 6. Scope Freeze 检查

| 约束 | 结果 |
|---|---|
| 不修改 KnowledgeBackend 五方法 interface | ✅ 接口未变 |
| 不新增 KnowledgeNode / KnowledgeEdge 字段 | ✅ 仅复用既有 `ownerAgent?` / `aiStatus?` |
| 不引入 Workflow / Runtime / Chat | ✅ 无新增 |
| 不引入 Private Knowledge Space | ✅ 无新增命名空间 |
| 不污染 LightRAGBackend | ✅ 零 diff |
| MockBackend 继续默认后端 | ✅ 未改其默认角色；其 `importSourceAs`（D2 已加）保持 |
| SourceRef 类型复用已有 registry | ✅ 测试用 `pdf`（registry: chat/url/pdf/video/github），未新增临时类型 |
| 保留 importSourceAs 作为接口外扩展 seam | ✅ 签名 `(src, ownerAgent?)` 未变 |

---

## 7. 验收断言草案对应（D6）

| 断言 | D3 结果 |
|---|---|
| `contributionOwnerPreserved` | ✅ ownerAgent 写入且可回读 |
| `importSourceAsClosedLoop` | ✅ (D2 已证) + D3 固化唯一路径 |
| `ingestionPathEnforced` | ✅ `nodeHasIngestedContent:true`；旁路删除后无绕过可能 |
| `ownedProjectionRefresh` | （D4 范围，本步不涉及） |
| `noKnowledgeBackendInterfaceChange` | ✅ 五方法未变 |
| `noRuntimeIntroduced` | ✅ |
| `noWorkflowEngineIntroduced` | ✅ |
| `noPrivateKnowledgeSpace` | ✅ |
| `noCapabilityCoupling` | ✅ |
| `noLightRAGBackwardPollution` | ✅ LightRAG 零 diff |

---

## 8. 提交纪律

- `bcaaff7` 是 D3 唯一 commit，仅 `knowledgeAccess.ts` 入库；harness 噪声（94 tracked-modified + 67 untracked kcu + dist）零暂存。
- **D3 Acceptance Report 已落盘**（本文件），**未单独提交**——沿用「保持历史干净、不追加 report commit」纪律。如需补入版本库可作一次独立 follow-up commit（需授权）。

⚠️ **当前停在 D3 Acceptance Node。不自动进入 D4（结果 UI 增强 + confirmed 语义 + G7 修复），更不进 Stage 13。** 下一步请对 D4 给出明确批准后，再启动编码。
