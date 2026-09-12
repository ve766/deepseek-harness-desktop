# Stage 14 — 抽取 prompt 成本分析（P1-4 前置评估节点）

> **状态**：🟢 只读分析完成，停在 **Review Node**，等待批准。
> **性质**：**零代码、零改动**（未改任何文件、未启服务、未动 .env）。分析对象为库内 prompt 常量。
> **红线**：未碰 UI · 未恢复 router · 未改 `packages/llm` · 未加依赖 · 未动 lockfile · 未跨阶段实现。

---

## 0. Revision / Errata（2026-09-11，同日二次核实后更正）

> ⚠️ **本节修正本文档 §2.4 / §3 / §4 / §5 中的错误结论。**
> 原始分析过程（含错误推断）已按"保留历史证据"要求**原样保留在下文，未删除**。

### 0.1 被修正的错误结论

| # | 原文（错误） | 位置 | 实际事实 |
|---|---|---|---|
| **E1** | 「prompt 覆盖机制存在 ⇒ **裁剪 prompt 可用官方支持的 YAML 覆盖实现，无需改任何代码**」 | §2.4 表格第 2 行 | ❌ **错**。YAML 覆盖只能改**有限字段**，碰不到系统提示词主体 |
| **E2** | 「激进裁剪（6,328 → ≈2,400 chars）⇒ 单次调用 prefill **下降约 30–40%**」 | §3.1 / §3.2 / §4.1 | ❌ **错**。无源码修改下**理论上限仅约 6.5%** |
| **E3** | §5 建议「写 `./prompts/entity_extraction_system_prompt.yml`，仅精简 `---Instructions---`」 | §5 | ❌ **不可行**。该文件名在此覆盖语义下不存在 |

**错误根因（如实记录）**：当时只看到 `_DEFAULT_PROMPT_DIR = "./prompts"` 这一**目录常量存在**，即推断可覆盖整个 prompt；
**未读** `EntityExtractionPromptProfile` 的**字段定义**，也**未读** `operate.py` 的**实际取值路径**。属核实不足，非表述问题。

### 0.2 更正确认的事实（只读核实，未改任何文件）

| 事实 | 值 / 来源 |
|---|---|
| 官方覆盖 profile 的字段数 | **仅 3 个**：`entity_types_guidance` / `entity_extraction_examples` / `entity_extraction_json_examples`（`prompt.py` → `EntityExtractionPromptProfile`） |
| 主体 prompt 的取值路径 | `operate.py:4071`：`PROMPTS["entity_extraction_system_prompt"].format(**context_base)` → **库内硬编码，无 env / addon_params 覆盖入口** |
| `USER_PROMPT_PREFIX` / `USER_PROMPT_PREFIX_FILE` | 只**追加** user prompt 前缀（是**加**，不是**减**） |
| 渲染后 system prompt | **7,019 chars ≈ 1,755 tok** |
| 其中**可**覆盖 | `entity_types_guidance` 844 + `examples` 189 = **1,033 chars（14.7%）** |
| 其中**不可**覆盖 | `Instructions` / `Role` / `Output Format` = **5,986 chars ⇒ 约 85.3%** |
| 最优裁剪可省 | **773 chars ≈ 193 tok** |
| 输入 token（prompt + chunk 1200） | **2,955 → 2,762 tok** |
| **无源码修改的理论收益上限** | **≈ 6.5%** |

### 0.3 修正后的结论

1. **「仓库外 YAML 覆盖裁剪主体 prompt」这条路不成立** —— 占 85.3% 的主体块在官方配置面之外，无法触及。
2. **理论收益上限 ≈ 6.5%**，低于「延迟明显下降」的验收门槛。
3. 且 **6.5% 小于 P1-2 实测的单调用延迟方差（169 → 410 s/call，约 2.4×）**
   ⇒ **小规模配对 A/B 在原理上测不出该效应**，故 **Prompt Cost Validation 未执行**（避免产出不可信数字）。
4. 若确要裁剪主体 prompt，**只能修改库源码**（如 monkeypatch `PROMPTS[...]`）
   → **越过现行红线**，且库升级即失效，**不建议**。
5. **对 P1-4 的判断不变**：真正的杠杆仍指向 provider 分离 / 单次调用成本，**而非 prompt 文本**。

> 本节仅更正结论；**未改动任何代码、未改环境、未创建 override 文件**。

---

## 1. 节点目的

P1 三次实测已把瓶颈钉死为 **LLM 单次调用的固定 prefill 成本 × 串行执行**。
本节点回答一个问题：**这个固定成本里，prompt 占多少？能否通过裁剪 prompt 降低单次调用延迟？**

---

## 2. 实测数据（只读，来源：`lightrag/prompt.py`）

### 2.1 extraction 相关 prompt 体量

| 常量 | 角色 | 字符数 | 行数 |
|---|---|---|---|
| `entity_extraction_system_prompt` | **每次调用都发** | **6,328** | 70 |
| `entity_extraction_user_prompt` | user 模板（含 `{text_chunks}` 等） | 1,350 | 17 |
| `entity_continue_extraction_user_prompt` | **gleaning 第 2 次调用**追加 | 2,063 | 17 |
| `entity_extraction_section_context` | 附加段 | 139 | 4 |

### 2.2 system prompt 内部分布（6,328 chars = 100%）

| 段 | 字符 | 占比 |
|---|---|---|
| `---Role---` | 145 | 2.3% |
| **`---Instructions---`** | **5,945** | **93.9%** |
| `---Entity Types---` | 26 | 0.4% |
| `---Output Format Template---` | 138 | 2.2% |

→ **裁剪空间几乎全在 `---Instructions---`**：它逐字段展开解释 `entity_name` / `entity_type` / `entity_description` / `relation` 四元组的每个字段，外加命名一致性、大小写、语言规则等。

### 2.3 对 `num_ctx` 的占用（`num_ctx = 4096`）

| 组成 | token 估算 | 占 num_ctx |
|---|---|---|
| system prompt（6,328 chars，英文 ≈ chars/4） | **≈1,582** | **38.6%** |
| system prompt（保守 ≈ chars/3.5） | ≈1,808 | 44.1% |
| chunk（`chunk_token_size` 默认 1200） | 1,200 | 29.3% |
| **system + chunk 合计** | **≈2,782** | **67.9%** |
| **剩余输出预算** | **≈1,314** | 32.1% |

**关键比值**：system prompt 占每次调用 input 的 `1582 / 2782 ≈ **57%**` —— 也就是说，**每次调用超过一半的 input token 是与文档内容无关的固定 prompt**。

### 2.4 两个配置事实（影响判断）

| 项 | 值 | 含义 |
|---|---|---|
| `ENTITY_EXTRACTION_USE_JSON` | **默认 `false`**（`.env` 未设） | 当前走的是 6,328 字符的**分隔符版** prompt。**不要**开 JSON 模式——库文档明确写着 "slower but improves quality"，会**加剧**延迟 |
| prompt 覆盖机制 | **存在**：`_DEFAULT_PROMPT_DIR = "./prompts"`，允许后缀 `.yml` / `.yaml`；含 `entity_type/`、`user_prompt/` 子目录 | ⇒ ~~裁剪 prompt 可用官方支持的 YAML 覆盖实现，无需改任何代码~~ ❌ **【已在 §0 更正：见 E1】** 该机制**只能覆盖有限字段，碰不到主体 prompt** |

---

## 3. 裁剪可行性判断

> ❌ **【§3–§5 的正确结论见 §0 Revision】**：下文关于「YAML 可零代码覆盖主体 prompt」「−40% / −62% 激进裁剪」、
> 「30–40% 延迟降幅」，以及 §5 的 `./prompts/entity_extraction_system_prompt.yml` 方案，**均不成立**（见 E1/E2/E3）。
> 无源码修改的理论收益上限为 **≈6.5%**。
> **以下原文按"保留历史证据"要求原样保留，请勿据此行动。**

### 3.1 可裁剪空间（估算）

`---Instructions---` 为 5,945 字符，其中大量是**逐字段的冗长解释**，可压缩为紧凑定义而不丢信息契约。

| 方案 | system prompt | 估算 token | system+chunk / 4096 | 输出余量 |
|---|---|---|---|---|
| 现状 | 6,328 chars | ≈1,582 | 67.9% | ≈1,314 |
| 温和裁剪（−40%） | ≈3,800 chars | ≈950 | 55.2% | ≈1,946 |
| **激进裁剪（−62%）** | **≈2,400 chars** | **≈600** | **44.0%** | **≈2,296** |

### 3.2 对延迟的预期影响

- prefill 成本与 **input token 数**近似线性（本区间）；system prompt 占 input 的 57%。
- 激进裁剪 → input 从 ≈2,782 → ≈1,800 token（**−35%**）
- ⇒ **单次调用 prefill 预计下降约 30–40%**（叠加 30% CPU 卸载，实际可能略优或略差）

参考 P1-2 实测单价（169–410 s/call；成功篇 677.9 s）：
**预期成功篇耗时 678 s → 约 430–480 s**（−30% 左右）。

### 3.3 必须原样保留的部分（否则解析失败）

| 不可动 | 原因 |
|---|---|
| `DEFAULT_TUPLE_DELIMITER = "<|#|>"` / `DEFAULT_COMPLETION_DELIMITER = "<|COMPLETE|>"` | 输出由此分隔符解析；改了 → 解析失败 → 文档判 `failed` |
| `---Output Format Template---`（138 chars） | 输出契约，必须逐字保留 |
| `{text_chunks}` 等模板占位符 | 渲染契约 |

---

## 4. 收益 / 风险评估

### 4.1 收益

| 项 | 评估 |
|---|---|
| 预期延迟降幅 | **≈30–40%**（单次调用 prefill） |
| 实现成本 | **零代码**（`./prompts/*.yml` 官方覆盖机制） |
| 落地风险面 | 极低——覆盖文件是**数据文件**，删除即回滚；不动库、不动 `src`、不动 `.env` |
| 单卡可行性 | ✅ **当前唯一在 6GB 单卡上可做的杠杆** |
| 可复用性 | 与 P1-2/P1-3 的 A/B harness 完全兼容（可直接复用 `p12_gleaning.mts` 流程） |

### 4.2 风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| **抽取质量下降**（实体/关系变少或变脏） | **中（主要风险）** | 用与 P1-2 相同的 **≥90% 质量门槛**做 A/B；保留基线数字（21n/43e 等） |
| 误删输出契约 → 全篇 `failed` | 中 | §3.3 三项逐字保留；小样本先验证 |
| 裁剪收益被延迟方差淹没 | 中 | P1-2 已证方差可达 2.4×；需**同内容配对 A/B** + 多次采样，不能单跑一次 |
| 库升级不继承覆盖 | 低 | 覆盖文件在数据根（仓库外），升级后需复核 |
| 被认为"绕过质量" | 低 | 本次是**精简表述**而非删除规则；产出仍需过质量门槛 |

### 4.3 重要的边界（避免高估）

⚠️ **本节点不能解决可靠性问题**。P1-2 实测失败率 **50–67%**（单调用 >900s 触顶）。
裁剪 30–40% 延迟 ≈ 678s→~450s，**可显著减少触顶，但不保证消除**；真正的可靠性答案仍在 **P1-4（抽取 provider 分离）**。
故本节点定位为**延迟优化**，不得据此关闭 P1-4。

---

## 5. 建议（待批准）

**建议：值得做一次有界验证**，理由：零代码、可秒级回滚、且是当前单卡上**唯一**能作用于固定 prefill 成本的杠杆。

若批准，建议的最小方案：

1. 写一个 `./prompts/entity_extraction_system_prompt.yml`（仓库外，数据文件），仅精简 `---Instructions---`，**逐字保留** §3.3 三项；
2. 复用 P1-2 的 `bench/p12_gleaning.mts` 流程做**同内容配对 A/B**（基线 vs 裁剪），小样本、一次性临时 working_dir（沿用 P1-3 的隔离法，主语料不动）；
3. 双指标验收：延迟（目标 ≥30% 改善）+ 质量（**≥基线 90%**），阈值同 P1-2；
4. 达标 → 记录为可采纳配置；不达标 → 记录并回滚（删除 `.yml`）。

**成本预估**：两臂各 ~13 分钟（沿用 P1-3 的极小文档法可压到分钟级）+ 分析，总计 < 1 小时。

**或**：不批准，则直接进 P1-4（provider 分离），本节点结论仅作为 P1-4 成本模型的输入。

---

## 6. 红线状态

| 项 | 状态 |
|---|---|
| HEAD | 分析时 `b1a625a`；本报告随后提交为 `e9d2978`，本次为 **§0 修订** |
| 本次改动 | **0**（只读读取 `prompt.py` / `lightrag.py` / `operate.py` / `.env` 文本） |
| `src ' M'` | 0 |
| 全仓 modified / untracked | 99 / 142（修订前基线） |
| 服务 / `.env` | 未启服务、未改 `.env`、**未创建任何 override 文件** |
| UI / router / `packages/llm` / 依赖 / lockfile | 均未触碰 |

---

**状态**：🟢 **已修订（见 §0 Revision / Errata）**。
**Prompt Cost Validation 未执行** —— 按 §0.3，该实验在现行边界（仅仓库外 override、不改源码）下**无法达成自身验收标准**，
且目标效应（6.5%）**小于实测延迟方差（2.4×）**，原理上不可测。
停在 **Review Node**，等待裁决：**直接进 P1-4**（建议）或其它。
