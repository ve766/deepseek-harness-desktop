# ROADMAP.md — AI Employee OS 未来阶段路线

> 状态：v0.1（规划草案）
> 说明：本文记录尚未进入 P4 的未来阶段，仅作方向记录，不影响当前 P4 产品化节奏。

## Document Intelligence Agent（未来阶段，不进入 P4）

### 定位
- **Knowledge OS 的输入层**：不是"简单文件上传"，而是把外部资料转化为结构化知识资产的流水线。
- 是 Knowledge OS 与真实世界资料之间的 ingestion 边界。

### 未来负责的输入格式
- Word（.docx）
- PDF
- PPT（.pptx）
- Markdown（.md）
- 网页（Web Source）
- 视频（Video）

### 流水线
```
Input（文档 / PDF / PPT / MD / 网页 / 视频）
   ↓ Extraction（结构 / 实体 / 要点抽取）
   ↓ Knowledge Asset（落入 Knowledge Space 作为「我有什么」）
   ↓ Growth（派生「我懂什么」概念节点，经 Relationship 桥接）
   ↓ Memory（沉淀为可检索记忆）
   ↓ Agent Capability（Nox 等员工获得领域能力）
```

### 与当前边界的关系
- 入口严格遵守 `KNOWLEDGE_MODE_BOUNDARY.md` 的 Import Rule：外部输入先入 Space，再经 AI 理解 + Relationship 派生 Growth，禁止直接生成 Growth 节点。
- Extraction / 真实 KG / Embedding 能力依赖真实 backend，而 P4 冻结"不接真实 backend / Embedding / KG"，故本阶段**不进入 P4**。
- 待 P4 完成、产品化节奏稳定后，作为 "Intelligence" 阶段（预计 P5+）评估接入。

### 不在本期范围
- 不实现 Extraction 引擎
- 不接真实 LLM / Embedding
- 不新增 ingestion UI（当前 P4-3 仅做设计，不含此 Agent）
