# Stage 14 · P0 · S0 前置探测发现报告

> **类型**：S0 前置探测（**只读核实**，不写产品代码）；**design-only 提交**
> **Baseline**：`4aaf12e`（P0 Impl Plan）
> **上级**：`STAGE14_P0_PROVIDER_ABSTRACTION_IMPL_PLAN.md`
> **已批准 DP**：DP-IMPL-1（声明 workspace 依赖）· DP-IMPL-2（复用已有 provider，优先 llm-deepseek → llm-pi-ai → ollama）· DP-IMPL-3（运行时 discovery，禁硬编码 provider id）· DP-IMPL-4（默认 ollama/qwen3:8b）· DP-IMPL-5（密钥仅 process.env）· DP-IMPL-6（auth 不回退）· DP-IMPL-7（S0–S6，停 Acceptance Node）
> **状态**：🔴 **S0 发现与已批准的 DP-IMPL-2 优先序冲突，需裁决后才能进入 S1**
> 生成时间：2026-09-10

---

## 0. 执行摘要

S0 三项探测全部完成。**一项致命、两项前置阻塞**：

| # | 发现 | 影响 |
|---|---|---|
| **F1** 🔴 | **`llm-router` 的显式 provider 路径只认 `'deepseek'` 与 `'ollama'` 两个字面量；任何其它 id 立即抛 `EXPLICIT_PROVIDER_UNAVAILABLE`。而 `llm-deepseek` 注册的路由名是 `'deepseek-official'` → 无法经 router 到达。** | **已批准的 DP-IMPL-2 优先序（llm-deepseek 第一）在 router 路径下不可实现**，必须裁决 |
| **F2** 🟠 | `lib/` 被 `.gitignore`；`llm-router` / `llm-ollama` / `ai-provider-manager` **未构建**（`main` → `lib/index.js`） | DP-IMPL-1 声明依赖**不足以**让 Node 路径可达，**还需构建步骤** |
| **F3** 🟢 | `llm-pi-ai` 的 **route id = 我们配置的 profile key**（`[...profiles().keys()]`），且裸挂载零路由（dormant） | **提供解法**：把 profile key 命名为 `'deepseek'` 即可 router 可达，且其 `baseURL` 可指向 DeepSeek 官方**或任意 OpenAI 兼容端点** → 一个适配器覆盖 DP-IMPL-2 优先序 1+2 |

> **一句话结论**：**若保留 router，`llm-pi-ai`（profile key = `'deepseek'`）是唯一同时满足「OpenAI 兼容」与「不修改共享包」的路线；原生 `llm-deepseek` 需要绕过 router。**

---

## 1. F1 详述 —— router 显式路径只认两个 id（**致命**）

### 1.1 代码证据

`packages/llm/llm-router/src/resolve.ts`：

```ts
export function sourceOf(provider: string | undefined): ProviderSource {
  if (provider === 'deepseek') return 'deepseek'
  if (provider === 'ollama')   return 'ollama'
  return 'none'                       // ← 其他一律 none
}
export const SOURCE_TO_PROVIDER = { deepseek: 'deepseek', ollama: 'ollama', none: '' }
```

`packages/llm/llm-router/src/service.ts::prepareCall()`（显式模式）：

```ts
const candidates = mode === 'explicit' ? [sourceOf(request.provider)] : autoChainFrom(...)
for (let i = 0; i < candidates.length; i++) {
  const source = candidates[i]!
  if (source === 'none') break                       // ← 立即退出循环
  const providerId = SOURCE_TO_PROVIDER[source]
  if (!capability.available || !this.isRegistered(providerId)) continue
  ...
}
if (mode === 'explicit') {
  throw new LlmError(`requested provider "${request.provider}" is not available`,
                     EXPLICIT_PROVIDER_UNAVAILABLE)   // ← 必抛
}
```

`isRegistered()`：

```ts
return this.llm.listProviders().some(p => p.id === providerId)
```

### 1.2 可达性真值表

| 传入 `provider` | `sourceOf` | `SOURCE_TO_PROVIDER` | `isRegistered` | 结果 |
|---|---|---|---|---|
| `'ollama'` | `'ollama'` | `'ollama'` | `llm-ollama` 注册了 `'ollama'` ✅ | ✅ **可达**（= S13-A 现状） |
| `'deepseek-official'`（`llm-deepseek` 真实注册名） | **`'none'`** | — | — | ❌ **立即 break → 抛错** |
| `'deepseek'` | `'deepseek'` | `'deepseek'` | ❌ 无人注册 `'deepseek'` | ❌ **抛错**（`isRegistered` 失败） |
| 任意自定义 id（如 `'openai'`） | **`'none'`** | — | — | ❌ **立即 break → 抛错** |

### 1.3 全 llm 层实际注册的路由（穷举核实）

| 包 | `registerAdapter([...])` 实际值 | 证据 |
|---|---|---|
| `llm-ollama` | **`['ollama']`** | `src/index.ts:39` |
| `llm-deepseek` | **`[PROVIDER]` = `'deepseek-official'`** | `src/index.ts:46,256` |
| `llm-pi-ai` | **动态 = `[...profiles().keys()]`** | `src/index.ts:276` |
| `ai-provider-manager` | 不注册路由 | — |

> **没有任何包注册字面量 `'deepseek'`。**

### 1.4 附带发现：detect 的可用性判定方式不同

`ai-provider-manager/src/detect.ts`：

| provider | 判定 | 代价 |
|---|---|---|
| **deepseek** | **仅检查凭据环境变量非空**（`DEFAULT_DEEPSEEK_API_KEY_ENV = 'DEEPSEEK_API_KEY'`）→ `missing ${apiKeyEnv} credential` | **零网络** ✅ |
| **ollama** | **真实网络请求** `GET {baseURL 去掉 /v1}/api/tags` | 网络调用；不可达 → `available:false` |

⇒ 显式 `'ollama'` 在 Ollama 未运行时**会抛 `EXPLICIT_PROVIDER_UNAVAILABLE`**（seam 现有 catch 会转成 error chunk，行为可接受但需知晓）。

### 1.5 F1 与已批准 DP-IMPL-2 的冲突

| DP-IMPL-2 已批准优先序 | router 路径可行性 |
|---|---|
| ① `llm-deepseek` | ❌ **不可行**（路由名 `'deepseek-official'`，router 不认） |
| ② `llm-pi-ai` / OpenAI compatible | ✅ **可行**（若 profile key 命名为 `'deepseek'`；见 §3） |
| ③ `ollama` | ✅ 可行 |

> ⚠️ **必须裁决后才能进入 S1**：是要「调整优先序」还是「绕开 router」。

---

## 2. F2 详述 —— 构建产物缺失（前置阻塞）

| 项 | 事实 |
|---|---|
| `.gitignore` | `lib/` 被忽略（**构建产物不入仓**，新克隆无 `lib/`） |
| `lib/index.js` 存在性 | `llm` ✅ · `llm-deepseek` ✅ · `llm-pi-ai` ✅ · **`llm-router` ❌ · `llm-ollama` ❌ · `ai-provider-manager` ❌** |
| `package.json` `main` | 全部指向 `lib/index.js`；`exports` 含 `"./src/*": "./src/*"` |
| 依赖解析位置 | 根 `node_modules/@deepseek-ai/*` **全缺失**；`packages/llm`、`packages` 层**无 hoist**；仅**各叶包自身** `node_modules/@deepseek-ai/` 有链接（如 `llm-deepseek` → `dsh-llm` ✅；`llm-router` → **无任何链接，且其 `package.json` 零 `dependencies`**） |
| `examples/node_modules` 闭包 | 含 `dsh-llm` ✅ · `dsh-llm-deepseek` ✅ · `dsh-llm-pi-ai` ✅；**缺** `dsh-llm-router` ❌ · `dsh-llm-ollama` ❌ · `dsh-ai-provider-manager` ❌ → **不是完整 harness** |
| 规范构建入口 | 根 `package.json`：`build:lib:host` = `tsc -b tsconfig.host.json && tsdown --env.DSH_BUILD_FACE host` |

**结论**：
1. DP-IMPL-1（声明 workspace 依赖）**必要但不充分** —— 裸说明符解析到 `lib/index.js`，**必须构建**才能被 Node 加载。
2. `llm-router` 无依赖声明，其 `resolve.ts` 却 value-import `@deepseek-ai/dsh-llm` → 依赖由消费者提供（构建后由上层解析）。
3. 因此 **S0 无法完成运行时探测**（探测本身需要可加载的 router + ollama + provider-manager）。S0 的 route 事实由**源码语义穷举**得出（§1.3），可靠性等同。

---

## 3. F3 详述 —— `llm-pi-ai` 是解法（route id 可控）

`packages/llm/llm-pi-ai/src/index.ts`：

```ts
const routes = [...profiles().keys()]        // ← route id 完全由我们的配置决定
if (routes.length === 0) { /* dormant: 裸挂载零路由 */ }
registration = ctx.llm.registerAdapter(routes, adapter)
```

`src/config.ts` 的 `PiAiProviderProfile`：`apiKeyEnv?`（CredentialRef）· `baseURL?` · `models?` · `retryPolicy?` · `displayName?`

`catalog.ts` 基于 `@earendil-works/pi-ai@0.82.1`：内置 **20+ provider**（`openai` / `azure-openai-responses` / `deepseek` / `anthropic` / `groq` / `openrouter` / `moonshotai` / `qwen-token-plan` …），并有 `compat` + 类型 `OpenAICompletionsCompat` → 未收录路由可由 `settings.yaml` 完整描述。

**推论**：
- 把 profile key 命名为 **`'deepseek'`** → 注册路由 `'deepseek'` → `sourceOf('deepseek')` = `'deepseek'` → `SOURCE_TO_PROVIDER` = `'deepseek'` → `isRegistered('deepseek')` ✅ → **经 router 可达，且共享包零改动**。
- 该 profile 的 **`baseURL` 可控** → 指向 **DeepSeek 官方** *或* **任意 OpenAI 兼容端点** → **DP-IMPL-2 优先序 ① 与 ② 由同一适配器覆盖**。
- 前提：`ai-provider-manager.detect()` 需报 `deepseek.available = true` → **仅需 `DEEPSEEK_API_KEY` 非空**（零网络，见 §1.4）。

---

## 4. 三条候选路线（**需裁决**）

| 路线 | 做法 | 共享包改动 | 覆盖 DeepSeek | 覆盖 OpenAI 兼容 | 保留 router |
|---|---|---|---|---|---|
| **R-A（推荐）** | `llm-pi-ai`，profile key 命名 **`'deepseek'`**；`baseURL` 由配置切换（官方 / 兼容端点）；Ollama 用原生 `llm-ollama` 作 fallback | ❌ 无 | ✅ | ✅ | ✅ |
| **R-B** | seam **绕过 router**，直接 `ctx.llm.prepareCall({ provider: <discovered id> })`；可用原生 `llm-deepseek`（`'deepseek-official'`）与任意 pi-ai key | ❌ 无 | ✅ | ✅ | ❌ **改变 S13-A 架构**（router 被旁路） |
| **R-C** | 新增一个注册 `'deepseek'` 路由的适配器 | — | — | — | ❌ **被 DP-IMPL-2 明令禁止**（禁新建重复 provider 包） |

> **倾向 R-A**：唯一同时满足「OpenAI 兼容」+「不修改共享包」+「保留 router」+「不新建适配器」的路线。
> 若坚持 DP-IMPL-2 的「llm-deepseek 优先」，则必须走 **R-B**（旁路 router），需明确接受架构变更。

---

## 5. 对实施计划的影响

| 计划项 | 原设计 | S0 后修正 |
|---|---|---|
| **S0** | 三项探测 | ✅ **完成**（本报告）；**运行时探测因 F2 顺延** |
| **DP-IMPL-2** | deepseek → pi-ai → ollama | 🔴 **需重裁**（见 §4） |
| **DP-IMPL-3** | 运行时 discovery，禁硬编码 | ⚠️ **部分受限**：router 只认 2 个固定 id，discovery 结果**不能**直接喂给 router；须配合 R-A/R-B |
| **DP-IMPL-1** | 声明 workspace 依赖 | ⚠️ **需补充**：还需 `lib/` 构建（新增前置步骤 **S0.5**） |
| **S1–S6** | 不变 | 待 DP 裁决后按选定路线调整 |

### 新增建议步骤 **S0.5 — 构建前置**

| 项 | 内容 |
|---|---|
| 动作 | 运行根脚本 `npm run build:lib:host`（或仅构建缺失的 `llm-router`/`llm-ollama`/`ai-provider-manager`） |
| 影响 | 生成 `lib/`（**gitignored，不污染 git**） |
| 风险 | 全量 host 构建可能耗时较长 / 在本机可能失败 → 需评估是否只做 `--filter` 定向构建 |
| 产出 | 使 S2/S5 的运行时验收（B-2/B-3）可行 |

---

## 6. S0 交付物与状态

| 项 | 结果 |
|---|---|
| ① route id 枚举（运行时） | ⚠️ **改由源码穷举完成**（F2 阻塞运行时）；结论见 §1.3 |
| ② 依赖可解析性 | ✅ **完成**（F2） |
| ③ openai-compatible 承载 | ✅ **完成**（F3） |
| 红线 | `src/` 零改动；未装依赖；未构建；未起服务 |

---

## 7. 待裁决（进入 S1 前必须）

| # | 决策 | 选项 | 倾向 |
|---|---|---|---|
| **DP-S0-1** | route 策略（F1 冲突） | **R-A** pi-ai(profile key=`'deepseek'`) / R-B 旁路 router / 其它 | **R-A** |
| **DP-S0-2** | 是否接受新增 **S0.5 构建前置**（`build:lib:host` 或定向构建） | (a) 接受全量 (b) 仅定向构建缺失三包 (c) 不做构建，验收降级为静态 | **(b)** |
| **DP-S0-3** | 若选 R-B：是否接受「seam 直接调用 `ctx.llm`，router 退役」 | (a) 接受 (b) 不接受 | 取决于 DP-S0-1 |
| **DP-S0-4** | 默认 provider 探测代价：ollama 需网络请求，deepseek 仅需环境变量 | (a) 保持 DP-IMPL-4 默认 ollama (b) 其它 | **(a)**（DP-IMPL-4 已定） |

---

## 8. 状态（S0 阶段）

🔴 **S0 完成，但发现与已批准的 DP-IMPL-2 优先序冲突（F1），停在裁决点。**

- **未写任何产品代码**；`src/` 零改动；未声明依赖；未执行构建；未起服务。
- 进入 S1 前需裁决 **DP-S0-1 … DP-S0-4**（核心是 **DP-S0-1 路线选择**）。
- **不自动进入** S1 / S0.5，也不进入 ingestion optimization / LightRAG provider switch / video plugin。

---

# 附：S0.5 定向构建结果与新增阻塞（F4）

> **追加时间**：2026-09-10 · **触发**：用户裁决 DP-S0-1 = R-A · DP-S0-2 = 批准定向构建 · DP-S0-3 = 保留 router · DP-S0-4 = 默认 ollama

## 附-1 构建机制已探明（可复用）

| 步骤 | 命令 | 结果 |
|---|---|---|
| 1. 类型/JS 产物 | `tsc -p packages/llm/<pkg>` | ✅ 产出 `lib/types/*.js` |
| 2. 打包为包入口 | `tsdown --env.DSH_BUILD_FACE host -F '@deepseek-ai/<full-package-name>'` | ✅ 产出 `lib/index.js` |
| 过滤语义 | `-F` **必须用完全限定包名**（短名 `ai-provider-manager` / 正则 `/…$/` 均报 `No valid configuration found`） | ⚠️ 已记录 |

## 附-2 构建产物实况（独立命令复核，非同一命令自证）

| 包 | `lib/index.js` | 来源 |
|---|---|---|
| `llm` · `llm-deepseek` · `llm-pi-ai` | ✅ 存在（61.9KB / 30.9KB / 81.5KB） | 2026-09-04 原有 |
| **`llm-ollama`** | ✅ **本次新建 19.6KB** | S0.5 |
| **`ai-provider-manager`** | ✅ **本次新建 4.7KB** | S0.5 |
| **`llm-router`** | ❌ **ABSENT，且无 `lib/` 目录** | — |

## 附-3 🔴 F4（新阻塞）—— `llm-router` **无法经受制裁路径产出**

| 证据 | 值 |
|---|---|
| `packages/llm/llm-router/tsconfig.json` | **`"noEmit": true`**（且 `composite: false`） |
| `tsconfig.host.json` 中 `llm-router` 命中次数 | **0**（host 仅引用 `llm-deepseek`、`llm-pi-ai`） |
| `package.json` 脚本 | **无 `scripts` 字段**（无自建构建入口） |
| 全仓外部消费者 | **0**（仅本 app 的 `llmContext.ts` 引用 spec 字符串） |
| 目录实况 | **无 `lib/` 目录** |

⇒ **`llm-router` 不在 host 构建面内，且自身 `noEmit`，属"检查态/未发布态"包** —— 与 `ARCHITECTURE-AGENT-ROUTER-INTEGRATION.md` 标注"设计未实现"一致。

### 附-3.1 CLI 覆盖（`--noEmit false`）已被证伪，**不可用**

实测：`tsc -p packages/llm/llm-router --noEmit false [--outDir lib/types --rootDir src]`

- `--rootDir src` **按 CWD（仓库根）解析** → `error TS6059: File '.../packages/llm/llm-router/src/index.ts' is not under 'rootDir' '.../src'`（exit 2）
- 但 tsc **仍强制 emit**，且因 rootDir 默认取输入公共根，产物**直接落入 `src/`** → 生成 `index.js` / `*.js.map` / `*.d.ts` / `*.d.ts.map` 共 16 个文件，**污染源码目录**
- **已彻底清理并核验**：`src/` 现仅含 `index.ts` / `resolve.ts` / `service.ts` / `types.ts`；`llm-router` 整目录未被 git 跟踪，**tracked 文件零改动**；全仓基线 `' M' = 99` 未变
- 结论：**该手段不可用**（不可靠 + 污染 + 仍不解决 `.ts` 扩展名 import 问题）

## 附-4 对已批准裁决的影响

| 已批准项 | 影响 |
|---|---|
| **DP-S0-1 = R-A**（pi-ai profile key=`'deepseek'`，**经 router 可达**） | 🔴 **受阻** —— R-A 的前提是 router 在调用路径中；router **不可加载** |
| **DP-S0-3 = 保留 router，不退役** | ⚠️ 若要"保留并可用"，必须让 router 可加载 → 唯一途径是**改 `llm-router` 的 tsconfig / host 引用**（= 修改 package 边界，DP-S0-2 已禁止） |
| **DP-S0-2 = 定向构建、不改 package 边界** | ✅ 对 `llm-ollama` / `ai-provider-manager` 已达成；❌ 对 `llm-router` **在禁令下无法达成** |

### 结论

> **「保留 router」与「不修改 package 边界」在当前仓库状态下不可同时满足。**

## 附-5 待裁决（S0.5 新增，进入 S1 前）

| # | 决策 | 选项 | 说明 |
|---|---|---|---|
| **DP-S0.5-1** | router 问题的解决方向 | **(a) 承认现状 → seam 直接使用 `ctx.llm.prepareCall({ provider })`（router-free）**；**(b) 修改 `llm-router` 配置使其可构建**（解禁 `noEmit` / 加入 `tsconfig.host.json` refs → **触碰 package 边界，需显式豁免**）；**(c) 其他** | (a) 不改任何包、最小侵入、但 DP-S0-3 的"保留 router"落空；(b) 保住架构但越界 |
| **DP-S0.5-2** | 若选 (a)：`'deepseek'` 路由名的意义 | (a) **不再需要**（router 白名单约束消失），profile key 可自由命名；(b) 仍命名为 `'deepseek'` 以保持未来可切回 router | — |
| **DP-S0.5-3** | 若选 (b)：豁免范围 | (a) 仅 `noEmit:false` + `outDir`（最小）；(b) 追加 host refs；(c) 追加 build script | (a) 最小 |

## 附-6 S0.5 红线核验

| 项 | 状态 |
|---|---|
| 产品代码（`src/`）改动 | ✅ **0** |
| tracked 文件改动 | ✅ **0**（全仓 `' M'` = 99，与会话起点一致） |
| package 配置文件改动 | ✅ **0**（未改任何 `tsconfig` / `package.json`） |
| 未跟踪文件总数 | 142（含 `llm-router/` 整目录，会话起点即如此） |
| 构建产物 | 仅 `lib/`（gitignored）：`llm-ollama` + `ai-provider-manager` 两个 `lib/index.js` |
| 源码目录污染 | ⚠️ 曾发生（`llm-router/src/` 16 个生成物）→ **已全部清理并核验** |
| 起服务 / 装依赖 | ✅ 均未执行 |

## 附-7 状态

🔴 **S0.5 完成（部分达成），新增 F4 阻塞，停在裁决点。**

- ✅ 达成：定向构建机制探明 · `llm-ollama` 与 `ai-provider-manager` 产出 `lib/index.js`（运行时可达前置条件满足）
- ❌ 未达成：`llm-router` 在"不改 package 边界"约束下**无法产出**
- ⏸️ **S1 未开始**。S1（`providerConfig.ts`：profile 类型 / 三层解析 / 凭据引用 / 回退链）设计**基本与 route 策略正交**，但 profile 类型是否需携带"显式 route id"字段取决于 **DP-S0.5-2**，故一并等待裁决以免返工
- **不自动进入** S1 及后续；不进入 ingestion / LightRAG provider switch / video plugin
