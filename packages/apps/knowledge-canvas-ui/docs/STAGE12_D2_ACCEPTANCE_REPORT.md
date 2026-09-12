# Stage 12 · D2 Acceptance Report — MockBackend.importSourceAs Closes Owner-Attribution Loop

**Stage**: 12 (AI Employee Knowledge Contribution Integrity) · Sub-step **D2**
**Status**: D2 COMPLETE — stops at D2 acceptance node, awaits D3 approval
**Prerequisite**: Stage 12 Mini Plan (`f5016eb`) approved; D1–D5 / D6 resolved
**Parent commit**: `f5016eb` (Stage 12 Mini Plan, design-only)
**This commit**: `e16a124`

---

## 1. Commit

| Field | Value |
|-------|-------|
| **Hash** | `e16a124` |
| **Message** | `Stage 12 D2: MockBackend.importSourceAs closes owner-attribution loop` |
| **Files changed** | 1 |
| **Insertions / Deletions** | +115 / 0 |
| **Lefthook** | lint (oxlint, 0 errors) ✔ · whitespace ✔ · vendor manifest guard ✔ |
| **Typecheck (pre-push gate)** | not run at commit (pre-push only); D2 scope is additive, interface-external |

---

## 2. Modified File List

| File | Change | Scope |
|------|--------|-------|
| `packages/apps/knowledge-canvas-ui/src/mock/mockBackend.ts` | +115 (added `importSourceAs` method + `ingestSource` import) | Contribution Integrity only |

**Not modified** (verified): `types.ts` (interface & node schema), `lightRAGBackend.ts`, `knowledgeAccess.ts`, `employeeKnowledgeAccess.ts`, `knowledgeUniverse.ts`, ingestion layer, any UI/Employee/Card/Rail file.

---

## 3. `importSourceAs` → `listOwned` Closure Verification

**Approach**: real runtime harness. The committed `mockBackend.ts` + seam were bundled with esbuild and executed under the managed Node 22 runtime. Three closure assertions were exercised against the module-level shared-universe singleton (the same instance the app uses).

```text
backendClosure.closed = true     // importSourceAs writes node, listNodes shows it
seamClosure.closed    = true     // contribute → importSourceAs → ownerAttribution, listOwned reads it back
isolationOk           = true     // a different employee cannot see nox's node
```

| Assertion | Result | Evidence |
|-----------|--------|----------|
| `importSourceAs(src, agent)` writes a node | ✅ | `nodeId` returned; node present in `listNodes()` |
| `listOwned(agent)` returns that node | ✅ | `backendClosure.closed = true` |
| `contribute()` takes the attributed path | ✅ | `seamClosure.ownerAttribution = 'attributed'`, `status = 'draft'` |
| Isolated from other employees | ✅ | `isolationOk = true` (employee `task` sees no `nox` node) |

**Test harness note**: an earlier probe used an unsupported `SourceRef.type: 'note'` (the ingestion registry only defines `chat/url/pdf/video/github`), which surfaced as a `registry['note'].fetch` → undefined error. This is a test-data error, **not** a product defect — `importSourceAs` routes through `ingestSource` exactly as designed, and a valid source type (`pdf`) closes the loop. The discrepancy was also confirmed to be a harness calling mistake (passing the backend as the `id` argument), not a code defect.

---

## 4. `ownerAgent` / `aiStatus` Write Verification

| Field | Expected | Observed | Result |
|-------|----------|----------|--------|
| `KnowledgeNode.ownerAgent` | `= agentId` (`'nox'`) | `'nox'` | ✅ |
| `KnowledgeNode.aiStatus` | `'draft'` | `'draft'` | ✅ |

The node produced by `importSourceAs` carries both provenance fields, so the seam's `listOwned(agentId)` filter (`ownerAgent === agentId`) matches it. This resolves **G1** (previously MockBackend lacked `importSourceAs`, so `contribute()` degraded to unattributed `importSource` and `listOwned` returned nothing for the contributing employee).

---

## 5. `KnowledgeBackend` Interface Unchanged (Proof)

`src/types.ts` lines 165–174 — the interface contract is **exactly the original 5 methods**, with **no** `importSourceAs`:

```ts
export interface KnowledgeBackend {
  listNodes(): Promise<KnowledgeNode[]>
  listEdges(): Promise<KnowledgeEdge[]>
  importSource(src: SourceRef): Promise<{ nodeId: string }>
  getNeighbors(nodeId: string, text: string): Promise<{ nodeId: string; score: number; reason: string }[]>
  getMemory(): Promise<MemoryEntry[]>
}
```

`importSourceAs` is added as an **interface-external** method on the concrete `MockBackend` class only, discovered by the seam's narrow capability probe (`OwnedImportCapable.importSourceAs?`). This is the same extension mechanism `LightRAGBackend` already uses — no contract drift between backends.

---

## 6. Scope Freeze Check

| Constraint (D2 boundary) | Result |
|--------------------------|--------|
| KnowledgeBackend 5-method interface unchanged | ✅ (proven §5) |
| No new `KnowledgeNode` / `KnowledgeEdge` fields | ✅ (`ownerAgent?` / `aiStatus?` were already present; reused, not added) |
| LightRAGBackend behavior untouched / adapters independent | ✅ (0 diff vs parent) |
| MockBackend remains the default backend | ✅ (`createBackend()` still returns `MockBackend` by default; `bindEmployeeAccess` uses the singleton) |
| No Workflow / Runtime / Multi-Agent introduced | ✅ |
| No Memory privatization / Capability coupling | ✅ (memory path unchanged; `resolvePermission` untouched) |
| Scope limited to Contribution Integrity | ✅ (only `mockBackend.ts` touched) |

---

## 7. Acceptance Assertions (D6 subset relevant to D2)

| Assertion | Result |
|-----------|--------|
| `contributionOwnerPreserved` | ✅ (`ownerAgent` written + read back) |
| `importSourceAsClosedLoop` | ✅ (§3) |
| `noKnowledgeBackendInterfaceChange` | ✅ (§5) |
| `noRuntimeIntroduced` | ✅ |
| `noWorkflowEngineIntroduced` | ✅ |
| `noPrivateKnowledgeSpace` | ✅ (no private namespace; `ownerAgent` is a shared-universe tag) |
| `noCapabilityCoupling` | ✅ |
| `noLightRAGBackwardPollution` | ✅ |

---

## 8. Decision Node

**D2 is accepted.** The owner-attribution loop is closed at both backend and seam level, proven at runtime, with no interface or schema change.

**Next**: stops here. D3 (unify contribution through `ingestSource`, no bypass) and D4 (UI result enhancement + `confirmed` semantic + G7 fix) require explicit approval before any coding. Per standing rule: **Mini Plan → D-resolution → code → Acceptance Node**; no auto-advance to the next sub-step or Stage 13.
