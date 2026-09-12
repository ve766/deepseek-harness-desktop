# S13-B B-2 Acceptance Report — 环境稳定性排查（恢复 A-12-live）

> **状态**：🟢 **完成，停在 B-2 Acceptance Node**（未进入 S13-C）
> **范围**：**纯环境层**——HEAD 仍为 `14340ce`，`src/` modified = **0**（零业务代码改动）
> 生成时间：2026-09-10

---

## 1. 验收目标达成情况

| # | 目标 | 结果 | 证据 |
|---|---|---|---|
| **B2-1** | `curl /api/embed` PASS | ✅ **PASS** | `HTTP 200`（全程稳定，从未受影响） |
| **B2-2** | Python httpx embedding PASS | ✅ **PASS** | `httpx POST /api/embed → 200 dims=768`；`ollama` 客户端 → `OK dims=768` |
| **B2-3** | LightRAG `/query` 返回 references/hits | ✅ **PASS** | `references len: 1` = `{"reference_id":"1","file_path":"s13b-smoke.md"}`；`llm_generated:true`，`response_time:2.96` |
| **B2-4** | A-12-live 恢复 PASS | ✅ **PASS** | 实机验证 **7/7 PASS**，`A-12-live hits=7`（Nox / AI Employee OS / LightRAG / Knowledge Graph / Ollama qwen3:8b …） |

---

## 2. 根因（已定位，非推测）

**httpx 通过 `urllib.request.getproxies()` 读取了 Windows 注册表中的系统代理**，把本地回环请求交给 `http://127.0.0.1:12334`，而该代理无法正确处理回环 → `ReadError` / `502`。

实测证据（**关键判别**）：

```
httpx.get_environment_proxies() = {'http://': 'http://127.0.0.1:12334', 'https://': '...'}
urllib.request.getproxies()     = {'http': 'http://127.0.0.1:12334', ...}   ← 读注册表
os.environ 中 proxy 变量        = 无（环境变量里根本没有代理！）
```

**判别矩阵**：

| 测试 | 结果 |
|---|---|
| `curl /api/embed` | ✅ 200（curl 不读注册表代理） |
| raw socket → 11434 / 9621 | ✅ OK（网络层无阻断） |
| `httpx` (trust_env **默认 True**) → 11434 / 9621 | ❌ **ReadError** |
| `httpx` (**trust_env=False**) → 11434 / 9621 | ✅ **200** |
| `httpx` + **`NO_PROXY=127.0.0.1,localhost`** | ✅ **200**（`resolved proxies: {'all://127.0.0.1': None, ...}`） |

→ 结论：**既非沙箱阻断、亦非 VRAM、亦非 Ollama 缺陷**，而是 **httpx 读取 Windows 系统代理且缺少回环 bypass**。

---

## 3. 修复措施（全部为环境层）

| # | 措施 | 位置 |
|---|---|---|
| **F1** | 服务进程注入 **`NO_PROXY=127.0.0.1,localhost,::1`** + `no_proxy` 同值 | lightrag-server 启动环境 |
| **F2** | 将上述变量**持久化写入** `.env`（LightRAG 经 python-dotenv 载入进程环境） | `F:/dsh-lightrag/.env` |
| **F3** | 保留既有调优：`OLLAMA_LLM_NUM_CTX=4096` · `OLLAMA_LLM_THINK=false` · `MAX_ASYNC=1` · `TIMEOUT=900` | `F:/dsh-lightrag/.env` |

**Ollama 侧无需改动**（embedding 模型自始正常，`nomic-embed-text` 100% GPU 常驻 323MB）。

---

## 4. 约束符合性（实测）

| 约束 | 验证 |
|---|---|
| 不修改 TypeScript | ✅ `src/` modified = **0**；无新 commit（HEAD `14340ce` 不变） |
| 不修改 KnowledgeBackend | ✅ 未触及 |
| 不修改 LightRAG client | ✅ 未触及（B-1 的 `14340ce` 保持原样） |
| 不修改 UI | ✅ 未触及 |
| 不新增依赖 | ✅ 无 `package.json` diff |
| 不 Docker 化 | ✅ 仍为本地 venv |
| 不引入 Runtime / Workflow | ✅ 未引入 |

**B-2 的全部改动仅落在**：`F:/dsh-lightrag/.env`（环境配置）+ 服务启动参数 + 验证脚本（仓库外 `F:/dsh-lightrag/verify_b1.mts`）。

---

## 5. 最终实机验证（7/7 PASS）

```
PASS  A-7   entities=7      （label=* 全图）
PASS  A-8   relations=6
PASS  A-9   neighbors=2     （?label=Nox&max_depth=1）
PASS  A-6   insert accepted
PASS  A-10  nodes=7 edges=6 （后端五方法映射）
PASS  A-12-live  hits=7     ← 本轮恢复
PASS  A-12-map   hits=[Nox, LightRAG] + include_references=true
=== B-1 VERIFY SUMMARY: 7/7 PASS ===
```

---

## 6. 回滚

- 环境：移除 `.env` 中 `NO_PROXY`/`no_proxy` 两行 → 重启服务（回退到已知故障态）
- 全量：沿用 `STAGE13_B_ENV_ACCEPTANCE_REPORT.md` §5（L0–L3）
- **无代码回滚需求**（B-2 零代码改动）

---

## 7. 状态与下一步

🟢 **B-2 完成，停在 B-2 Acceptance Node。A-12-live 已恢复。**

- 环境现处于**全绿可用**状态：graph 读取 + 真实 RAG 检索（embedding + LLM 生成）端到端跑通。
- **未进入 S13-C**。S13-C 规模基准的前置阻塞已解除，但仍须按流程重新 **Mini Plan → 审核 → 明确批准**。
- 遗留待决：B-3 `auth_mode`（保持 disabled）、B-4 S13-C 规模基准方案。
- **注**：本修复依赖 Windows 注册表系统代理的存在；若日后代理配置变化，`NO_PROXY` 白名单仍保证回环直连。
