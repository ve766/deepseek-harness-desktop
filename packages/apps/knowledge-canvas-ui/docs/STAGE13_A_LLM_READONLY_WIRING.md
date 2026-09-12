# S13-A: LLM 只读推理接线（设计）

> 范围：D2 ①。设计-only，编码前需本子项 Mini Plan 批准。
> 父文档：`STAGE13_DESIGN_DECOMPOSITION.md` §4（OA/OB/OC）。

---

## 1. 目标与约束
- **目标**：让 Employee 能基于其知识宇宙回答问题。路径 `Employee → LLM Router → Knowledge Access(Universe) → Response`，全程**只读**。
- **约束（D1）**：禁 Runtime / Workflow / Tool Execution / **KG Memory 写入**。即 `ask()` 只调用读方法（`listNodes` / `getNeighbors` / `getMemory` / 检索探针），**绝不** `importSource` / `importSourceAs`。
- 不引入新 runtime：cordis 已是框架，`llm-*` 是既有插件，非新 runtime（符合"不引入 Runtime"约束）。

---

## 2. 数据流

```
User(Q) → EmployeeKnowledgeDetail(问答 UI)
  → access.ask(Q)                          [新增 lens 方法，只读]
      → 检索上下文: backend.query(Q) 或 getNeighbors(seed, Q)   [OB seam]
      → 组装 prompt:
          system: "你是 X 员工，仅基于以下知识回答"
          context: 检索到的节点内容（top-K）
          user: Q
      → llmBridge.ask(prompt)              [OA: cordis bootstrap 或 host]
          → LlmRouter → OllamaAdapter → http://localhost:11434/v1 (qwen3:8b)
      → Response(可流式) → UI 渲染
  （无回写 KG）
```

---

## 3. 检索 seam（OB 推荐方案 = 探针）

新增类型（`src/types.ts`，**非接口方法**）：

```ts
export interface QueryHit { nodeId: string; score: number; snippet: string }
export interface KnowledgeQueryCapable {
  query(text: string, opts?: { topK?: number }): Promise<QueryHit[]>
}
```

- **探针**：`const capable = backend as Partial<KnowledgeQueryCapable>; if (typeof capable.query === 'function') ...`
- **MockBackend**：不实现 `query` → `ask()` 走空上下文或返回"无检索后端"提示（后端不支持 → 优雅降级，非未捕获异常）。
- **LightRAGBackend**：实现 `query(text)` → `this.client.query(text)`（复用 `lightragHttpClient.ts:88`），映射 `LightRAGQueryHit` → `QueryHit`。**不改 5 方法接口签名**。
- 与 `OwnedImportCapable` / `importSourceAs`（knowledgeAccess.ts:51-67 探针）**同构**，尊重 Stage 12 接口冻结纪律。

---

## 4. LLM 桥接（OA 推荐方案 = 分阶段）

新增 `src/llm/llmBridge.ts`：

- **原型模式（S13-A 首落点）**：本地新建 cordis `Context`，注册 `llm` + `llm-ollama` + `llm-router` + `ai-provider-manager`；Ollama 配置 `baseURL=http://localhost:11434/v1`，`model=qwen3:8b`；经 `ai-provider-manager.detect()` + `recommend()` 选 provider；`LlmRouter` 路由；返回生成结果。自包含，不依赖 host。
- **host 模式（后续生产）**：复用 Electron host 已注册的 `ctx.llm` / `ctx.llmRouter`（经 `KnowledgeUniverseSeamProbe` 同构的 window seam 暴露）。
- 统一接口：`llmBridge.ask(prompt): Promise<string>`（或流式 `AsyncIterable<StreamChunk>`）。

---

## 5. 文件改动清单（设计级，编码前需 Mini Plan 批准）
- 新增 `src/knowledge/lens/knowledgeQuery.ts`：检索探针 + `ask()` 逻辑（或扩展 `employeeKnowledgeAccess.ts` 加 `ask`）。
- 新增 `src/llm/llmBridge.ts`：cordis bootstrap / host 接入。
- 扩展 `src/components/EmployeeKnowledgeDetail.tsx`：问答 UI（输入框 + 回答区，可流式）。
- `src/types.ts`：加 `QueryHit` + `KnowledgeQueryCapable`（探针，非接口方法）。
- `src/knowledge/backends/lightRAGBackend.ts`：加 `query(text)` 方法（不改 5 方法签名）。
- `src/i18n/zh-CN.ts` + `en-US.ts`：问答相关 key。
- 注：MockBackend **不实现** `query`（探针自动降级）。

---

## 6. 验收断言（设计级）
- `ask(Q)` 返回基于检索上下文的回答；response 不含任何 KG 写调用。
- 检索走 `query` 探针时，LightRAG 返回 top-K 节点被纳入 context。
- MockBackend 下 `ask` 优雅降级（无检索后端提示），不抛未捕获异常。
- Ollama 不可达时错误可观测（经 `llm` 的 `LlmError` / `normalizeLlmFailure`）。
- 全程无 `importSource` / `importSourceAs` / `getMemory` 写调用。

---

## 7. 决策点
- OA（宿主）、OB（检索暴露方式）、OC（首落点）——见父分解 §4。
