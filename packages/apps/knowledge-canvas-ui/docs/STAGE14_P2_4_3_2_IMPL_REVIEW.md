# STAGE14 P2-4.3.2 Implementation Review — Local-only Failover Guard

> 阶段：**P2-4.3.2 实现完成，停在 Review Node，未提交**。
> 范围：补齐 failover 安全链 —— 每个候选**重新验证**，堵死「本地失败 → 自动切云 → 泄露」。

---

## 1. 文件清单

| # | 文件 | 动作 | 行数 |
|---|---|---|---|
| 1 | `src/llm/localGuard.ts` | **新增** | ~90 |

**`contracts/` · `routing.ts` · `providerConfig.ts` · `agent/` · `activity/` 全部零改动。**

## 2. 导出 API

| 导出 | 说明 |
|---|---|
| `PrivacyContext` | `{ privacy }` —— failover 遍历必须遵守的隐私姿态 |
| `filterFailoverCandidates(candidates, ctx)` | 核心函数：**忽略候选自带的 `local` 旗标**，逐个从 profile 端点**重新验证**；allowed 中的 `local` 用重验后的**事实值**刷新 |
| `mayAttemptFailover(candidate, ctx)` | 单问便捷版：「下一个 failover 候选可以试吗？」（同一事实源同一规则） |

**核心不变量**：决策时算出的 `local` 旗标**不可信** —— 陈旧或伪造的旗标不能为候选背书。被拒理由码沿用 `privacy-local-only`（与 4.3.1 同词汇表）。

## 3. 功能探针（`bench/p2432_probe.ts`）—— **6/6 PASS**

| # | 用例 | 结果 |
|---|---|---|
| 1 | **裁决 Case 1**：A(ollama localhost) + B(ollama cloud URL)，local-only → **A allow / B reject**（B 甚至携带**说谎的** `local:true` 旗标仍被拒） | ✅ |
| 1b | allowed 条目携带**重验后**的 local 旗标（事实而非历史） | ✅ |
| 2 | **裁决 Case 2（产品红线）**：A localhost **宕机** → 遍历提交云 B → guard 拒绝 → **no-provider，不是 fallback B** | ✅ |
| 2b | `mayAttemptFailover(云B) = false` | ✅ |
| 3 | 双本地候选均放行；**伪造的云旗标被纠正**为 local（证明重验生效） | ✅ |
| 4 | `privacy:'any'` → 全放行（guard 按 privacy 作用域生效） | ✅ |

## 4. 静态验收

| # | 标准 | 结果 |
|---|---|---|
| 1 | tsc 基线不增 | ✅ **48 = 基线**；`localGuard` 错误 NONE；`TS2307 = 0` |
| 2 | oxlint 预检 | ✅ 0 errors |
| 3 | 依赖方向 | ✅ `localGuard → ./routing`（同层，复用 `isLocalEndpoint`，**不复制判定逻辑**）+ contracts type；无 store/knowledge/mock/demo/react/agent |
| 4 | contracts 零改动 | ✅ |
| 5 | package/lockfile | ✅ 未触碰 |
| 6 | 禁项 | ✅ 无 failover 循环实现（属 4.3.3 executor）、无重试策略、无遥测、无新依赖 |

## 5. 与 4.3.3 的接口约定（写给未来执行器）

```
真实执行循环（4.3.3）在每次尝试失败后：
  1. 取下一候选
  2. MUST 调 filterFailoverCandidates([下一候选], { privacy })
  3. allowed 为空 → run 失败（no-local-provider），human decides
  4. 绝不允许绕过 guard 直接调用下一候选的 endpoint
```

**为什么 guard 必须独立于 routing**：`decideProvider` 的隐私过滤只在**初次决策**时生效；运行期候选列表会被失败驱动地遍历 —— 若遍历处不复核，4.3.1 的安全边界在第一次失败后即失效。Q-R3 的「每一个候选重新验证」就是这个意思。

## 6. 风险

| # | 项 | 说明 |
|---|---|---|
| R1 | guard 可被绕过 | 纯函数无强制力 —— 4.3.3 执行器**必须**消费它（已写入 §5 接口约定）；review 时以 grep 断言执行器内存在 filterFailoverCandidates 调用 |
| R2 | LAN Ollama 未支持 | 白名单刻意不含 192.168.x.x —— 需走产品规则（Q-R2），不接受代码层偷偷扩大 |
| R3 | 重验成本 | URL 解析每候选一次，纳秒级；无缓存必要（缓存旗标正是本模块要消除的信任） |

## 7. 红线与状态

| 项 | 状态 |
|---|---|
| HEAD | `07d9246`（本轮未产生 commit） |
| staged | **0**（未提交） |
| 新增 | `src/llm/localGuard.ts`（未跟踪）+ 本文档；探针在仓库外 `bench/p2432_probe.ts` |
| 全仓 | 99 M / 146 ?? / **0 D** · 根 `src ' M'=0` |
| contracts / package / lockfile | 未触碰 |
| 服务 | 未启动 · 未调用任何模型 |

**禁项核验**：Plugin runtime / WebGL / Renderer / LangGraph / Agent Core 拆包 / 云端默认调用 / 新依赖 —— 均未触碰。`ActivitySourceId` 未扩展。

---

**状态**：🟡 停在 **P2-4.3.2 Review Node，未提交**。待裁决：① 是否提交 `src/llm/localGuard.ts`（单文件）② 本 Review 是否提交 ③ 是否进入 **4.3.3**（runner 异步化 + 真实执行入口；实施第一步 = 核实 `getLlmClient` 与抽取式调用的匹配性）。
