# Stage 14 — P1-4A：`qwen3:4b` 能否替代 `qwen3:8b` 作为 Knowledge Ingestion 默认模型

> **状态**：🟢 **实验完成，停在 Acceptance Node**。
> **判定**：**❌ 不能替代**。4B 在 LightRAG 的**分隔符输出格式**上完全不达标 ⇒ 触发不了「修订 DP3」的预设条件。
> **边界**：未改仓库代码、未提交 commit、未改 `.env`、未做 provider separation、未进 UI/P2。产出均在仓库外。

---

## 1. Step 0：显存驻留实测（直接量化 M1）

用 `/api/ps` 读 Ollama 的 VRAM 拆分（`size_vram / size`）：

| 模型 | size | **VRAM 驻留** | **GPU / CPU 拆分** | nvidia-smi during | 首次加载+调用 |
|---|---|---|---|---|---|
| **qwen3:8b** | 5.97 GB | 4.21 GB | **GPU 70.5% / CPU 29.5%** | 4175 MiB | **54.0 s** |
| **qwen3:4b** | 3.18 GB | 3.18 GB | **GPU 100% / CPU 0%** | 3191 MiB | **18.4 s** |
| nomic-embed-text | 0.32 GB | 0.32 GB | 100% / 0% | 461 MiB | 3.3 s |

**结论**：
1. **P1-2 记录的「约 30% CPU 卸载」现已直接实测验证 = 29.5%**（此前只是转述，未复验）。
2. **`qwen3:4b` 零卸载、100% GPU**，首调用快 **2.9×**。⇒ 如果只看预填，4B 的假设成立。

### 1.1 ⚠️ 同时更正 P1-4 Mini Plan 中的 M2（"逐篇卸载/重载"）

Mini Plan 依据权重算术推断「8B + embedder 无法共存 ⇒ 逐篇卸载重载（M2）」。
**实测推翻该推断**：`/api/ps` 同时列出 **`nomic-embed-text` 0.32 GB + `qwen3:8b` vram 4.21 GB**，
且 Arm A 全程 `llm_resident = [true, true, true, true]` ⇒ **两者共存，无卸载/重载**。

> 教训（与 PROMPT_COST_ANALYSIS 同类）：**由容量算术推断运行时行为不可靠，必须实测**。
> 修正后的机制图景：**只有 M1（8B 静态欠配 → 29.5% CPU 卸载）真实存在；M2 不成立。**

---

## 2. Step 1：配对 A/B 结果

**条件一致性（两臂完全相同）**：同一份确定性语料（4 篇，每篇 1 chunk，逐字节相同）｜同 `nomic-embed-text`｜
`MAX_ASYNC=1`｜`MAX_GLEANING=1`｜`num_ctx=4096`｜`think=False`｜**各自独立的一次性临时 working_dir**
（`wd_p14a_a8b` / `wd_p14a_b4b`，主语料全程未触碰）。
**模型通过进程环境变量切换**（`load_dotenv(override=False)` ⇒ OS env 优先），**`.env` 逐字节未改**。

### Arm A — `qwen3:8b`

| doc | 状态 | 耗时 | Δnodes | Δedges | GPU% |
|---|---|---|---|---|---|
| 1 | processed | 232.7 s | +9 | +12 | 70.5 |
| 2 | processed | 244.7 s | +7 | +12 | 70.5 |
| 3 | processed | 228.7 s | +7 | +13 | 70.5 |
| 4 | processed | 236.7 s | +7 | +13 | 70.5 |

- **processed 4 / failed 0 / timeout 0**｜总墙钟 **942,711 ms ≈ 15.7 min**｜单篇均值 **235.7 s**
- 最终图规模 **30 nodes / 50 edges / 30 labels**
- **LLM 调用 8 次**（4 篇 × 2）｜**格式错误 0 条**
- `/api/ps` 全程 `qwen3:8b` 常驻（GPU 70.5%）

### Arm B — `qwen3:4b`（**11m9s 后中止**）

| 指标 | 实测 |
|---|---|
| doc 1 状态 | **`processing`，10 分 31 秒仍未完成**（对照 Arm A 同篇 232.7 s） |
| **LLM 调用成功入缓存** | **0 次**（缓存文件都未生成） |
| **LLM output format error** | **21 条**（对照 Arm A：**0 条**） |

**为什么中止**：doc 1 的抽取**没有任何一次产出可解析结果**，且失败不入缓存 ⇒ 无限重试；
4 篇按每篇 20 min 上限将再耗 40–70 min，**且不可能改变结论**。

**格式错误的性质（决定性）**：日志显示 4B 把**关系行当实体行**输出：

```
LLM output format error; found 2/4 fields on ENTITY `Model Tau-01 | produced_by | Engineer Lambda-01 |` @ `N/A`
LLM output format error; found 2/4 fields on ENTITY `Model Tau-01 | uses | Ollama |` @ `N/A`
LLM output format error; found 2/4 fields on ENTITY `Nox | can_research | Project Delta-01 |` @ `N/A`
```

`source | relation | target` 是标准的**关系元组**，但模型把它标成 `ENTITY` ⇒ 字段数 2/4 不符 ⇒ 解析失败。
**这不是慢，而是输出契约根本不被遵守。**

> 补充佐证：库文档对 `ENTITY_EXTRACTION_USE_JSON` 的说明正好点中此症 ——
> *"significantly improves extraction quality and **compatibility with smaller models**"*。
> 即：**小模型需要 JSON 模式**；而该模式库内自述为 *slower*。

---

## 3. 验收判定（逐条对照你预设的门槛）

| 门槛 | 要求 | 实测 | 判定 |
|---|---|---|---|
| 速度明显提升 | **≥ 2×** | 4B 首篇 **>10.5 min 未完成** vs 8B **232.7 s** ⇒ **慢 >2.7×** | ❌ **反向** |
| failed 降低 | 不劣于 8B | 8B **0 failed**；4B **无法完成任一篇** | ❌ **恶化** |
| nodes/edges ≥ 8B 的 90% | 质量门槛 | 4B **未产出任何图数据** | ❌ **无法满足** |

**三条门槛全部未达，且速度方向相反。**

---

## 4. 对 S13-C DP3 的建议

你预设的条件是：**若 4B 三条门槛全过**，则把 DP3 修订为
「复用 qwen3 系列，根据硬件资源选择最佳尺寸」。

**该条件未触发 ⇒ 不建议据此修订 DP3。**

- **维持 DP3：`qwen3:8b` 继续作为 Knowledge Ingestion 默认模型。**
- 「按硬件选尺寸」这条**原则本身仍然合理**，但**本实验证明它不能以 `qwen3:4b` + 当前文本模式落地**——
  尺寸匹配解决了显存（M1），却输掉了**输出格式遵从性**，后者是更硬的约束。
- **正确的下一步不是换更小的模型，而是换抽取的输出模式**（见 §5）。

---

## 5. 下一步候选（未执行，待裁决）

| # | 候选 | 说明 | 风险 |
|---|---|---|---|
| N1 | **`ENTITY_EXTRACTION_USE_JSON=true` + `qwen3:4b`** | 直接针对本次失败根因；库自述小模型兼容性更好 | 库标注该模式 **slower**，可能吃掉 4B 的速度优势；需重新配对 A/B |
| N2 | `ENTITY_EXTRACTION_USE_JSON=true` + `qwen3:8b` | 若 JSON 模式对 8B 也提速/提质，则与尺寸无关 | 同样 slower 风险 |
| N3 | 维持现状（8B + 文本模式） | 本次实测 8B **4/4 成功、0 格式错误**，稳定性良好 | 单篇 235.7 s；多 chunk 大文档仍可能触 900 s 上限（P1-2 已见） |
| N4 | 云端抽取 opt-in | 彻底绕开本地算力 | 隐私是产品决策 |

> 注：N1/N2 都只需**环境变量**（同样可用进程 env 覆盖，不动 `.env`），成本与本次相当。

---

## 6. 本轮新增的可复用事实

1. **模型切换的干净机制**：`load_dotenv(dotenv_path=".env", override=False)`（`lightrag.py:217`、`api/config.py:61`）
   ⇒ **进程环境变量优先于 `.env`** ⇒ 可在**完全不改 `.env`** 的前提下做模型 A/B，回滚成本为零。
2. **`/api/ps` 的 `size_vram / size` 即 GPU/CPU 拆分**，是量化"是否 CPU 卸载"的可靠手段（无需读日志）。
3. **LightRAG 的格式失败不入 LLM 缓存** ⇒ 缓存条目数可用来区分"真慢"与"解析失败重试"。
4. **一次性临时 working_dir + `--working-dir`** 依旧是安全隔离手段（主语料 mtime 未变）。

---

## 7. 红线与状态

| 项 | 状态 |
|---|---|
| 仓库 HEAD | `595dc88`（**未产生任何 commit**） |
| 仓库文件改动 | **0** |
| `.env` | **逐字节未改**（`LLM_MODEL=qwen3:8b` / `EMBEDDING_MODEL=nomic-embed-text` / `MAX_ASYNC=1`） |
| 主语料 `working_dir` | **未触碰**（mtime 仍 `Sep 11 12:39`） |
| UI / P2 / llm-router / `packages/llm` / 依赖 | 均未触碰 |
| provider separation | 未做（模型切换仅走 env，未动 provider 架构） |
| 收尾 | lightrag 已停；Ollama 两模型已 unload（`/api/ps` 空）；显存回落 29 MiB / 5968 MiB free |
| 证据 | `bench/p14a_a8b.{json,csv}`、`bench/p14a_b4b.{json,csv}`（B 为部分）、`logs/p14a_arm{A,B}_server.log`、`wd_p14a_a8b/`、`wd_p14a_b4b/` |

---

## 8. 待裁决

1. 是否接受「**维持 DP3（qwen3:8b）**，不按 4B 结果修订」？
2. 是否执行 **N1（JSON 模式 + 4B）** 或 **N2（JSON 模式 + 8B）** 的后续配对 A/B？
3. 是否将本报告提交（单文件、kcu 惯例路径）？
4. 遗留：P1-3 根 `docs/` 重份仍按你指示**未处理**。

---

**状态**：🟢 停在 **Acceptance Node**。
