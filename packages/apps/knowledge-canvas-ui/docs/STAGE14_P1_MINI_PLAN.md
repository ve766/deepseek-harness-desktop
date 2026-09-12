# Stage 14 · P1 Mini Plan Review（design-only）

> **类型**：Mini Plan / Review 材料（**不编码**）
> **Baseline**：`fa52179`（S3-C，`src/` modified = 0）
> **前置状态**：Stage 14 **P0 Stabilization ✅ 完成**（S1 / S2 / S3-A / S3-C 已提交；S0/S0.5 发现已归档）
> **纪律**：Mini Plan → Review → **明确批准** → 才执行；本文件不写代码、不改环境
> **状态**：🟡 停在 **P1 Review Node**
> 生成时间：2026-09-10

---

## 0. 前置状态确认（与用户确认一致）

| 项 | 状态 |
|---|---|
| Stage 14 P0 Stabilization | ✅ 完成（`d995fc6` S1 · `e312210` S2 · `0594b56` S3-A · `fa52179` S3-C） |
| Provider seam（唯一入口） | ✅ 完成（router-free，`ctx.llm.prepareCall` 直连） |
| Ollama 零配置 E2E | ✅ 跑通（首 chunk 48.0s，text "S3C OK"，12/12 PASS） |
| DeepSeek / OpenAI-compatible | ✅ 设计路径打通（pi-ai profile key = route id；凭据边界报 `MISSING_CREDENTIAL`） |
| `llm-router` | ❌ 按计划**延期**，不纳入本 Stage（登记为未来 Stage） |
| ingestion / LightRAG 优化 | ⏸ **等本 P1 Mini Plan 批准** |
| UI / 交互装修 | ⏸ **仅登记**（见 §5），**不改变当前技术路线** |

---

## 1. 环境事实基线（实测，P1 的改动起点）

`.env`（`F:/dsh-lightrag/.env`）当前**生效值**：

```
LLM_BINDING=ollama          LLM_BINDING_HOST=http://127.0.0.1:11434
LLM_MODEL=qwen3:8b          OLLAMA_LLM_NUM_CTX=4096     OLLAMA_LLM_THINK=false
EMBEDDING_BINDING=ollama    EMBEDDING_MODEL=nomic-embed-text   EMBEDDING_DIM=768
MAX_ASYNC=1                 TIMEOUT=900                  NO_PROXY=127.0.0.1,localhost,::1
```

**未设置**（因此仍取默认值）：`LLM_TIMEOUT`（默认 **240**）、`MAX_GLEANING`（默认 **1**）、`FORCE_LLM_SUMMARY_ON_MERGE`（默认 **8**）、`CHUNK_SIZE`（1200）、`CHUNK_OVERLAP_SIZE`（100）、`MAX_PARALLEL_INSERT`（**3**）、`EXTRACT_LLM_TIMEOUT`、`EXTRACT_MAX_ASYNC_LLM`。

**服务状态**：LightRAG `9621` **未运行**（HTTP 000）；Ollama `11434` **在线**（200）。
**数据基线**：`working_dir` = **178 KB**（S13-C 恢复后状态）；备份快照 `backup/working_dir_20260910_171209` 可用。

> ⚠️ 关键事实回顾：`TIMEOUT`（`args.timeout`，默认 300）与 **`LLM_TIMEOUT`（`args.llm_timeout`，默认 240）是两个不同参数**。现有 `TIMEOUT=900` **从未延长 LLM 超时**。

---

## 2. P1 四项逐项评估

### P1-1 · `LLM_TIMEOUT` 修正

| 维度 | 评估 |
|---|---|
| **是否值得做** | ✅ **值得，且应最先做**（零代码、零风险、修的是一个已确证的误配） |
| **具体动作** | `.env` 增补 `LLM_TIMEOUT=900`（可选：`EXTRACT_LLM_TIMEOUT=900` 精确作用于抽取角色）。**保留** `TIMEOUT=900`（另一参数，不动） |
| **预期收益** | **稳定性**：消除「慢推理被误判为失败」。C3 实测 **4 次超时**（`ReadTimeout`）即 240s 上限所致。收益**不是吞吐**，而是**降低失败率**（目标 `failed = 0`） |
| **风险** | 🟢 低。代价是「真卡住时等待更久」；可用 `EXTRACT_LLM_TIMEOUT` 精确控制而非全局放宽 |
| **红线** | **不触碰**（纯环境参数，不改代码 / 不改契约 / 不改 packages/llm） |
| **对 UI / Agent Workspace** | 无直接影响；间接提升「Nox 研究」在长推理下的可靠性 |

### P1-2 · `MAX_GLEANING=0` 实测

| 维度 | 评估 |
|---|---|
| **是否值得做** | ✅ **值得，但必须「实测」而非「盲调」**（它是**质量换速度**的权衡） |
| **机制** | `entity_extract_max_gleaning` 默认 **1** = 每个 chunk 额外一轮抽取 LLM 调用。设 **0** 直接削减该轮次 |
| **预期收益** | **吞吐**：每 chunk 抽取调用数约减半 → 估算 **1.5–2×**（须实测校正）。这是当前**唯一不换硬件/不换模型**就能显著提速的杠杆 |
| **风险** | 🟠 **中**：抽取**召回可能下降**（实体/关系数量减少），进而影响检索质量。**必须双指标对照**（吞吐 + 质量） |
| **红线** | **不触碰**（环境参数） |
| **对 UI / Agent Workspace** | 间接：ingestion 可行性↑ → 未来 Workspace 可容纳更大知识库。**不改变 UI 契约** |
| **实测口径（关键）** | 复用 **S13-C C3 同口径**：固定文档集、逐档快照、per-import 均值 + 外推 + CI；质量侧记录 **实体/关系计数**与图规模；`failed` 计数 |

### P1-3 · batch insert 收益验证

| 维度 | 评估 |
|---|---|
| **是否值得做** | ✅ **值得，但分两步**：先**实测收益**（**零代码**），再决定是否实现客户端扩展 |
| **第一阶段（P1 内，零代码）** | 用**仓库外 harness** 直接驱动 `POST /documents/texts`（`texts[]` + `file_sources[]`）与单条 `POST /documents/text` 对比，测量：入队耗时、管线重叠度、整体 wall-clock。**产出收益数字** |
| **第二阶段（获批后才做）** | 若收益显著，再在 `lightragHttpClient` **接口外**新增批量方法（与 `importSourceAs` / `query()` 同范式；**5 方法契约不变**） |
| **预期收益** | **适中**：批端点**不减少 LLM 抽取量**（S14 能力盘点已证），估算 **1.2–2×**，主要来自消除逐条往返 + 允许流水线重叠。**不是数量级** |
| **风险** | 🟢 低（第一阶段零改动）；🟡 第二阶段需守接口外扩展范式 |
| **红线** | **不触碰**（第一阶段）；第二阶段仍**不改 5 方法契约、不改 packages/llm** |
| **对 UI / Agent Workspace** | 无直接影响；为未来「批量导入」体验打基础 |

### P1-4 · ingestion provider 分离方案（**最高杠杆 / 最高风险**）

| 维度 | 评估 |
|---|---|
| **是否值得做** | ✅ **值得做**，但**必须先成本估算 + 小规模基准**，**不可直接切云**（沿用你此前裁决） |
| **问题定性** | **App seam 的 provider ≠ LightRAG 的抽取 provider**。抽取发生在 `lightrag-server` **内部**，由其自身 `.env` 的 `LLM_BINDING` 决定 → **P0 的 Provider 抽象只惠及 app 侧问答，未触及真正的瓶颈（3.65 min/doc）** |
| **分离方案（双配置并存，零代码）** | 维护两份 LightRAG 环境配置并文档化切换：<br>• **local**：`LLM_BINDING=ollama` + `qwen3:8b`（现状，隐私安全、零成本、受 6GB 限制）<br>• **cloud**：`LLM_BINDING=openai`（或等价）+ OpenAI 兼容 baseURL + key（**key 仅存 `.env`，仓库外**）<br>切换 = 改 `.env` + 重启服务；**两条链路互不干扰** |
| **预期收益** | **潜在最高**：云端抽取可**彻底解除 6GB 显存约束**（C3 的 `failed:3/10` 与 3.65 min/doc 均源于此）。理论上可把 1000 docs 从 **61–167 h** 压到可用区间。**但收益上限取决于 API 速率与成本** |
| **风险** | 🔴 **高**（四重）：① **成本**（1000 docs 的抽取 token 量须先估算，不能盲测）；② **隐私**（文档内容**离开本机**）；③ **质量方差**（换模型可能改变抽取风格）；④ **推翻已裁决项**（S13-B DP3「复用 qwen3:8b」）→ **需显式重新裁决** |
| **红线** | ⚠️ **敏感但可控**：仅动 `F:/dsh-lightrag/.env`（**仓库外**）；**不动** `packages/llm`、不动 app 代码、不动 5 方法契约。**注意**：S3 曾限「不改 LightRAG 配置」，该限制**仅适用 S3**；P1 明确包含此项，但仍需批准 |
| **对 UI / Agent Workspace** | 间接且重要：抽取能力（速度/规模）是未来 Workspace 的**供给侧**基础；分离后可支持「本地隐私模式 / 云端性能模式」的产品语义 |

---

## 3. 汇总对比

| # | 项 | 是否值得 | 预期收益 | 风险 | 触碰红线 | 影响 UI/Workspace |
|---|---|---|---|---|---|---|
| P1-1 | `LLM_TIMEOUT` 修正 | ✅ 值得（**先做**） | 稳定性（`failed→0`） | 🟢 低 | ❌ 不触碰 | 间接 |
| P1-2 | `MAX_GLEANING=0` 实测 | ✅ 值得（须实测） | **1.5–2×** 吞吐 | 🟠 中（质量） | ❌ 不触碰 | 间接 |
| P1-3 | batch insert 收益验证 | ✅ 值得（分两步） | 1.2–2×（估算） | 🟢/🟡 | ❌ 不触碰 | 间接 |
| P1-4 | ingestion provider 分离 | ✅ 值得（须先评估） | **潜在最高**（解显存约束） | 🔴 **高**（成本/隐私/裁决） | ⚠️ 仅动仓库外 `.env` | 间接但重要 |

**共同红线合规**：四项均**不触碰** `KnowledgeBackend` 5 方法契约、**不改** `packages/llm`、**不恢复** `llm-router`、**不引入** Runtime / Workflow。

---

## 4. 建议执行顺序与门控

```
Step 1  P1-1  LLM_TIMEOUT 修正（零代码）
          ↓ 重启服务 + 冒烟（health + 单次插入）
Step 2  P1-2  MAX_GLEANING=0 实测（同口径基准 + 质量对照）
          ↓ 数据达标才继续；不达标则回退并记录
Step 3  P1-3a batch insert 收益实测（零代码 harness）
          ↓ 收益显著才进入 P1-3b（客户端接口外扩展，需另行批准）
Step 4  P1-4a 成本估算 + 小规模云端抽取基准（对比本地）
          ↓ 明确裁决「是否切云 / 是否双配置并存」
Step 5  P1 汇总报告 → Acceptance Node
```

**每步停下汇报**（沿用既有节奏）；**不得跨步自动推进**。

### 统一验证口径（继承 S13-C 纪律）
- **隔离**：`snapshot → clean working_dir → run → save CSV → restore`（快照已有基线）
- **双口径**：实测均值 + 保守界；**置信区间**并标注估算
- **预算**：单步墙钟 **≤3 h**，超时即停并用已有数据外推
- **产出**：Markdown 报告 + 原始 CSV；harness **仓库外**（不入 git）

### P1 明确不做（保护 scope）
- ❌ 不改 UI / 不引入交互装修
- ❌ 不恢复 `llm-router`、不改 `packages/llm`
- ❌ 不新增运行时依赖、不改 lockfile
- ❌ 不做视频 Ingestion Plugin 实现（保持 P2 仅设计）
- ❌ 不换数据库、不 Docker 化、不装 Scrapling

---

## 5. UI 灵感池（**仅登记，不排期**）

> 用户指示：未来 UI 设计阶段需参考优秀开源/商业项目，**但不得提前打乱工程顺序**。以下仅作**登记**，当前 Stage 14 技术路线不变。

| # | 方向 / 参考 | 备注（登记用途） |
|---|---|---|
| 1 | **Knowledge Galaxy / Galaxy 类空间交互** | 与现有 `knowledge-canvas-ui` 的图谱空间语义同源 |
| 2 | **tldraw** | 无限画布 / 直接操作范式 |
| 3 | **React Flow** | 节点-边编辑与布局 |
| 4 | **Raycast 风格命令入口** | 键盘优先的全局命令面板 |
| 5 | **Linear / Notion / Obsidian 类信息组织** | 层级、双向链接、快速捕获 |
| 6 | **Apple 风格简洁交互** | 克制、留白、动效节制（与既有 Design System 一致） |
| 7 | **AI Agent Workspace 类产品** | 员工/任务/工作流的空间化组织 |

**登记纪律**：进入任何 UI 阶段前须**独立 Mini Plan + 审核**；不得因 UI 议题调整 Stage 14 / P1 的工程顺序。

---

## 6. 待裁决决策点

| # | 决策 | 选项 | 倾向 |
|---|---|---|---|
| **DP-P1-1** | P1 范围是否就是上述四项（不含其它）？ | (a) 是 (b) 增删项 | **(a)** |
| **DP-P1-2** | 执行顺序是否采纳 §4？ | (a) 采纳 (b) 调整 | **(a)** |
| **DP-P1-3** | `LLM_TIMEOUT` 取值 | (a) 900（全局）(b) 240 保持 + `EXTRACT_LLM_TIMEOUT=900`（精确）(c) 600 | **(b)** 更精准、副作用最小 |
| **DP-P1-4** | `MAX_GLEANING=0` 的质量门槛 | (a) 实体/关系计数 ≥ 基线 90% (b) ≥ 基线 100% (c) 不设门槛 | **(a)** 务实 |
| **DP-P1-5** | batch insert 第二阶段的触发条件 | (a) 收益 ≥1.3× 才实现 (b) 任何正收益都实现 (c) 只报告不实现 | **(a)** |
| **DP-P1-6** | P1-4 云端抽取的评估深度 | (a) **仅成本估算 + 极小样本（≤10 docs）** (b) 小规模基准（≤100 docs）(c) 直接切云 | **(a)** 先算账再动手 |
| **DP-P1-7** | 是否同意 P1-4 若通过则**推翻** S13-B 的 DP3（复用 `qwen3:8b`） | (a) 届时单独裁决 (b) 现在就预授权 | **(a)** 保持门控 |
| **DP-P1-8** | UI 灵感池登记方式 | (a) 本文 §5 即视为登记（不另立文件）(b) 另建 `UI_INSPIRATION_POOL.md` | **(b)** 便于未来独立演进 |

---

## 7. 状态

🟡 **停在 P1 Review Node。**

- 本文件**仅评估**，**未编码、未改环境、未重启服务**；`src/` 零改动；HEAD 仍 `fa52179`。
- 四项均通过红线自检（不碰 5 方法契约 / `packages/llm` / `llm-router` / Runtime）。
- 后续顺序：裁决 **DP-P1-1 … DP-P1-8** → 明确批准 → 才进入 **P1 Step 1**。
- **不自动进入 P1 编码**，也不进入 P2 / 任何 UI 阶段。
