# S13-B B-1 Acceptance Report — LightRAG 1.5.7 客户端契约适配

> **状态**：🟢 **完成，停在 B-1 Acceptance Node**（未进入 S13-C）
> **commit**：`14340ce` — `S13-B B-1 adapt LightRAG client to 1.5.7 wire format`
> **范围**：仅 `src/knowledge/backends/lightragHttpClient.ts`（1 file / +156 / −50）
> 生成时间：2026-09-10

---

## 1. 执行顺序与结果

| 步骤 | 结果 |
|---|---|
| 1 编码 | ✅ 完成（C1–C6，仅单文件） |
| 2 单文件 diff 验证 | ✅ `modified count = 1`（恰好 `lightragHttpClient.ts`） |
| 3 oxlint | ✅ 严格配置 **0/0**（89 规则）· staged 配置 **0/0**（48 规则） |
| 4 LightRAG 1.5.7 实机验证 | ⚠️ **6/7 PASS**（唯一失败项为环境阻塞，见 §4） |
| 5 提交 commit | ✅ `14340ce`，lefthook 全过（lint 0/0 / whitespace / vendor manifest guard） |

---

## 2. 改动清单（C1–C6）

| # | 位置 | 改动 |
|---|---|---|
| **C1** | `insert()` | body `source` → **`file_source`**；lineage 由 `doc_id` 改读 `track_id` |
| **C2** | `getEntities()` | `GET /graphs?label=*&max_nodes=2000`（**一次取全图**）→ 映射 `nodes[].properties.{entity_id,entity_type,description,source_id,file_path}` |
| **C3** | `getRelations()` | 同源映射 `edges[].{source,target,properties.{description,weight}}` |
| **C4** | `getGraphNeighbors()` | `GET /graphs?label=<nodeId>&max_depth=1`（不再全表推导） |
| **C5** | `fetchGraph(label,{maxDepth})`（新私有） | 统一 `URLSearchParams` 构造 + `{nodes,edges}` 归一化 |
| **C6** | `query()` | 加 **`include_references: true`**；把 1.5.7 **文件级** `references[{reference_id,file_path}]` 经一次图读取**解析回实体名** → `LightRAGQueryHit{entity, score:0}` |

**关键设计判断**：1.5.7 的 `references` 是**文件级引用**（无实体名、无分数）。若直接映射，会把文件路径塞进 `LightRAGQueryHit.entity`，污染 `getNeighbors` 的命中匹配与 S13-A Nox 的上下文水合 → 故改为 `file_path → 实体名` 解析（不可解析时回退 `reference_id`）。该决策已写入文件头注释。

---

## 3. 约束符合性（实测验证）

| 约束 | 验证 |
|---|---|
| 仅改 `lightragHttpClient.ts` | ✅ `git diff --cached --name-only` = 1 文件 |
| 不改 `LightRAGClient` 接口 | ✅ `lightragClient.ts` **unchanged** |
| 不改 `LightRAGBackend` | ✅ `lightRAGBackend.ts` **unchanged** |
| 不改映射层 | ✅ `lightragMapping.ts` **unchanged** |
| 不改 UI | ✅ 无色/组件文件改动 |
| 不新增依赖 | ✅ 无 `package.json` diff；客户端运行时**零 import**（仅 type-only） |
| 不改变 MockBackend | ✅ 未触及 |
| 不引入 Runtime / Workflow | ✅ 未引入 |
| oxlint 无豁免 | ✅ 无 ignore 注释、无 `--no-verify` |

---

## 4. 实机验证（对 `127.0.0.1:9621`，tsx 加载真实客户端）

验证脚本：`F:/dsh-lightrag/verify_b1.mts`（**置于仓库外**，不污染 git）

| 断言 | 结果 | 证据 |
|---|---|---|
| **A-7** getEntities | ✅ **PASS** | `entities=7`，样例 `{entity_name:"Nox", entity_type:"person", description:"…", source_ids:["doc-…-chunk-000"], meta:{file_path:"s13b-smoke.md"}}` |
| **A-8** getRelations | ✅ **PASS** | `relations=6`，样例 `{src_id:"AI Employee OS", tgt_id:"Nox", description:"…", weight:1}` |
| **A-9** getGraphNeighbors('Nox') | ✅ **PASS** | `neighbors=2`（`Knowledge Graph` / `AI Employee OS`，relation 非空） |
| **A-6** insert | ✅ **PASS** | 接受、无抛错（`file_source` 生效） |
| **A-10** 后端映射 | ✅ **PASS** | `listNodes=7` / `listEdges=6`，正确映射为 `KnowledgeNode`/`KnowledgeEdge` |
| **A-12-map**（确定性，fake fetch） | ✅ **PASS** | `hits=[{Nox,0},{LightRAG,0}]`，`include_references=true`，2 次调用 |
| **A-12-live** | ❌ **FAIL（环境阻塞）** | `hits=0` —— 服务端 embedding 调用失败（见下） |

---

## 5. 环境阻塞（非 B-1 缺陷，属 B-2 范畴）

`POST /query` 与 `/query/data` 因**服务端 embedding 调用失败**而不可用：

- 早期：`HTTP_PROXY=127.0.0.1:12334` 使服务端 httpx 走代理 → Ollama 返回 **502**。
- 清空服务进程代理后**仍失败**，且实测隔离结论为：
  - `curl /api/embed` → **HTTP 200**
  - Python `httpx`（含 `ollama` 客户端）→ **ReadError**（3/3）
  - 显式设置/清空代理均不能修复
- → 判为**沙箱对 Python 进程出网的限制**或 **Ollama runner 崩溃**，**与客户端代码无关**。
- **影响范围**：仅需 embedding 的检索路径（`/query`、`/query/data`）；**graph 读取路径（A-7/A-8/A-9/A-10）不受影响**，全部 PASS。

**结论**：B-1 的客户端契约适配**已被实机证实正确**（A-7～A-10 + A-12-map）；`A-12-live` 的缺口完全来自环境，须由 B-2（VRAM/网络策略）解决后方可复验。

---

## 6. 回滚

- 代码：`git revert 14340ce`（单文件，可逆）
- 环境：沿用 `STAGE13_B_ENV_ACCEPTANCE_REPORT.md` §5（L0–L3）

---

## 7. 状态与下一步

🟢 **B-1 完成，停在 B-1 Acceptance Node。**

- **未进入 S13-C**。S13-C 规模基准依赖 `A-12-live` 恢复，须先解决 **B-2（VRAM / Python 出网 / embedding 稳定性）**。
- 待决：B-2 策略、B-3 auth、B-4 S13-C 可行性。
