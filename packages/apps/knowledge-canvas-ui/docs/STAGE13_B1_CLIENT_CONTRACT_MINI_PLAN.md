# S13-B B-1 Mini Plan：LightRAG 1.5.7 客户端契约适配（仅设计，待审核）

> **状态**：🟡 独立 Mini Plan，提交架构审核节点。**本文档不写任何代码。**
> **父文档**：`STAGE13_B_ENV_ACCEPTANCE_REPORT.md` §4.1（B-1 阻塞项）。
> **纪律**：Mini Plan → 审核 → 明确批准 → 编码。审核前不编码。

---

## 1. 目标与范围

### 1.1 目标
修复 `lightragHttpClient.ts` 与真实 `lightrag-server 1.5.7` 的 wire-format 漂移，使 `createBackend()` 选中 `LightRAGBackend` 后 V6–V8 可通过。

### 1.2 范围（用户批准）
1. `insert`：`source` → **`file_source`**
2. `getEntities` / `getRelations`：适配新版 graph API（`/graph/label/list`、`/graphs?label=X&max_depth=N`）

### 1.3 硬约束
- ❌ 不改 `KnowledgeBackend` 五方法接口
- ❌ 不引入 Runtime / Workflow
- ❌ 不改 UI
- ❌ 不改 `MockBackend` 行为
- ❌ 不引入新依赖

---

## 2. 已核实事实（实测 + file:line）

### 2.1 真实 1.5.7 契约（OpenAPI + 活体探测）

| 端点 | 请求 | 响应 |
|---|---|---|
| `POST /documents/text` | `{text, **file_source**, chunking?}` | `{status, message, track_id}` |
| `GET /graphs?label=L&max_depth=N&max_nodes=M` | `label` **必填** | `{nodes:[{id,labels,properties:{entity_id,entity_type,description,source_id,file_path,created_at}}], edges:[{id,type,source,target,properties:{weight,description,keywords,source_id}}], is_truncated}` |
| `GET /graph/label/list` | 无参 | `string[]`（**仅标签名，无类型/描述**） |
| `POST /query` | `{query, mode, top_k, include_references?, …}` | `{response, references, response_time, llm_generated}`（**无 `results[]`**） |
| `POST /query/data` | — | **500 Internal server error**（不可用） |

### 2.2 关键突破：`label=*` 返回全图（实测）

```
GET /graphs?label=*&max_nodes=500
→ nodes: 7, edges: 6, is_truncated: false
→ node ids: [Nox, AI Employee OS, LightRAG, Knowledge Graph, Ollama qwen3:8b, nomic-embed-text, Knowledge Canvas]
```

**一次请求即可取全图** → 无需 N 次轮询 `label/list` + 逐个 `/graphs?label=X`。

### 2.3 当前客户端漂移点（file:line）

| 位置 | 现状 | 问题 |
|---|---|---|
| `lightragHttpClient.ts:74` | body `{text, source: sourceId}` | 1.5.7 需 `file_source` → 400 |
| `lightragHttpClient.ts:81-82` | 读 `data.doc_id` | 1.5.7 返回 `track_id`（lineage 为 best-effort，无害） |
| `lightragHttpClient.ts:104-113` `getEntities` | `GET /graphs`（无参）→ `graph.nodes[]` 且按 `entity_name/source_ids` 取值 | 422（`label` 必填）；字段名不匹配 |
| `lightragHttpClient.ts:115-123` `getRelations` | 同上 → `graph.links[]`，取 `src_id/tgt_id` | 同上（1.5.7 是 `edges[]`，`source/target`） |
| `lightragHttpClient.ts:125-140` `getGraphNeighbors` | 由 `getRelations()` 全表推导 | 连带失败；应直接用 `?label=<nodeId>&max_depth=1` |
| `lightragHttpClient.ts:88-102` `query` | 读 `data.results[].{entity,score}` | **1.5.7 无此字段** → 恒返回 `[]`（**见 §3.3 附加项**） |

### 2.4 不受影响（已核实）
- `lightragClient.ts`（`LightRAGClient` 接口）：**不需要改**（形状由实现层适配）
- `lightRAGBackend.ts`：消费 `LightRAGEntity/Relation`，**不需要改**
- `lightragMapping.ts`：`entityToNode`/`relationToEdge` 入参形状不变，**不需要改**
- `mapEntityTypeToNodeKind`：真实类型 `person`/`organization`/`concept` → 默认落 `concept`，可接受，**不需要改**

---

## 3. 修改文件清单

### 3.1 唯一修改文件
```
packages/apps/knowledge-canvas-ui/src/knowledge/backends/lightragHttpClient.ts
```
（`git diff --name-only` 预期**恰好 1 个文件**）

### 3.2 改动设计（仅实现内部，签名不变）

| # | 函数 | 改动 |
|---|---|---|
| **C1** | `insert(content, sourceId)` | body → `{ text: content, file_source: sourceId }`；lineage 改读 `data.track_id`（best-effort，缺失即忽略） |
| **C2** | `getEntities()` | 新增私有 `fetchGraph('*', { maxNodes })` → `GET /graphs?label=*`；映射 `nodes[]` → `{ entity_name: p.entity_id ?? n.id, entity_type: p.entity_type ?? 'concept', description: p.description ?? '', source_ids: p.source_id ? [p.source_id] : [], meta: p.file_path ? { file_path: p.file_path } : {} }` |
| **C3** | `getRelations()` | 同源 `fetchGraph('*')` → 映射 `edges[]` → `{ src_id: e.source, tgt_id: e.target, description: e.properties?.description ?? '', weight: typeof e.properties?.weight === 'number' ? e.properties.weight : 5 }` |
| **C4** | `getGraphNeighbors(nodeId)` | 改调 `GET /graphs?label=<encodeURIComponent(nodeId)>&max_depth=1` → 遍历 `edges[]` 取对端（`source===nodeId ? target : source`）去重 → `{ target, relation: properties.description ?? '' }` |
| **C5** | 私有辅助 | `fetchGraph(label, opts)` 统一发起 + 解析 `{nodes, edges, is_truncated}`；`is_truncated` 仅作软上限（**不抛错**），`max_nodes` 取较大值（如 2000） |

- **无缓存**（保持简单）；`listNodes()`+`listEdges()` 会各发 1 次 → 共 2 次 `/graphs?label=*`。可选优化留待后续，**本 Plan 不做**。
- 不改 `headers()`（`X-API-Key` 保留，auth disabled 时无害）。

### 3.3 ⚠️ 附加漂移项（**不在批准范围，需你裁决**）

`query()` 亦属同类漂移：1.5.7 响应为 `{response, references, …}`，**无 `results[].{entity,score}`**，故当前恒返回 `[]`。影响：
- `getNeighbors` 失去「文本相关性加成」（图邻居仍可用）
- S13-A 的 `query(text)`（Nox 只读检索）恒得空 hits → Nox 无上下文

**建议修复**（不在本 Plan 范围，需明确批准）：`POST /query` 带 `include_references: true`，将 `references` 映射为 `LightRAGQueryHit[]`；`/query/data` 因 500 不可用。
**可选处置**：① 纳入 B-1（推荐，同文件同类）② 单列 B-1b ③ 保持现状并记录为已知限制。

---

## 4. 风险分析

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| **R1** | `label=*` **未在 OpenAPI schema 中声明**（属实现约定），版本升级可能失效 | 中 | 加**降级路径**：若 `label=*` 返回空/异常 → 回退 `/graph/label/list` + 逐标签 `/graphs?label=X` 聚合 |
| **R2** | 大图 `max_nodes` 截断 → `is_truncated:true` 时实体不全 | 中 | `max_nodes` 取大值（2000）+ 不抛错，接受部分（S13-C 规模下需再评估） |
| **R3** | `listNodes`+`listEdges` 各发 1 次全图请求（2×流量） | 低 | 本 Plan 不做缓存；后续可加短 TTL/in-flight 合并 |
| **R4** | `references` 需 `include_references:true` 才有内容 | 低 | 仅在批准附加项后处理 |
| **R5** | 改动触及 LightRAG 适配层 → 需保 R6 隔离（类型不外泄） | 低 | 仅改实现，`LightRAGClient` 类型不变；purity 门禁不受影响（无新 import） |
| **R6** | oxlint 约束（`no-explicit-any`/`no-unsafe-*`/`arrow-parens`） | 中 | 用本地结构化类型描述 1.5.7 响应；`as unknown as` 桥接；箭头单参不加括号 |
| **R7** | 环境依赖运行中的 server（`127.0.0.1:9621`）才可验证 | 中 | 断言分两层：**纯单测**（注入 fake fetch）+ **活体探测**（对真 server） |

---

## 5. 验收断言

### 5.1 静态 / 约束
| # | 断言 | 判据 |
|---|---|---|
| **A-1** | 仅 1 文件改动 | `git diff --name-only` == `lightragHttpClient.ts` |
| **A-2** | 接口零改动 | `LightRAGClient` 5 方法签名逐字不变；`KnowledgeBackend` 五方法不变 |
| **A-3** | 无新依赖 | `package.json` 无 diff |
| **A-4** | MockBackend 行为不变 | `createBackend()` 无配置时仍返回 `MockBackend`；Mock 文件 0 diff |
| **A-5** | lint 通过 | staged oxlint（`.oxlintrc.staged.json`）对目标文件 **0 warning / 0 error** |

### 5.2 运行时（对 `127.0.0.1:9621`）
| # | 断言 | 判据 |
|---|---|---|
| **A-6** | `insert` 契约 | `client.insert(text, 'src:x')` 不抛错；server 返回 `status:success` |
| **A-7** | `getEntities` | 返回 ≥7 实体，每项含非空 `entity_name` / `entity_type` / `source_ids` |
| **A-8** | `getRelations` | 返回 ≥6 关系，每项含非空 `src_id`/`tgt_id`/`weight:number` |
| **A-9** | `getGraphNeighbors('Nox')` | 返回含 `AI Employee OS` 等邻居，`relation` 非空 |
| **A-10** | 后端映射 | `new LightRAGBackend({client,…}).listNodes()` 非空且 `id/title` = 实体名；`listEdges()` 非空 |
| **A-11** | 降级保持 | 无配置 → `MockBackend`（`resolveLightRAGConfig()` 返 null 路径） |

---

## 6. 回滚
- 代码回滚：`git checkout -- src/knowledge/backends/lightragHttpClient.ts`（改动仅此一文件，未提交前可逆）
- 环境回滚：沿用 `STAGE13_B_ENV_ACCEPTANCE_REPORT.md` §5（L0–L3），**无需 git revert**（若未提交）

---

## 7. 已记录决策（本轮）

| 项 | 决定 |
|---|---|
| **VRAM 策略** | `qwen3:8b` + `num_ctx=4096` + `think=false` + `MAX_ASYNC=1` |
| **auth_mode** | 暂保持 `disabled`，**不扩展安全范围** |

---

## 8. 状态

🟡 **停在 B-1 Mini Plan 审核节点。** 未写任何代码。
待批准后编码；**完成 B-1 后停在 Acceptance Node，不自动进入 S13-C。**
**§3.3 附加漂移项（`query()`）需你明确裁决。**
