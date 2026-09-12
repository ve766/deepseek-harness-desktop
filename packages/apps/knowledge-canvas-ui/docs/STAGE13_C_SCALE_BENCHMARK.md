# S13-C: Knowledge Scale Benchmark（设计）

> 范围：D2 ③ + D6。设计-only。
> 父文档：`STAGE13_DESIGN_DECOMPOSITION.md` §2 / §4。
> 执行时机：harness 设计 + 数据集生成器设计在 S13 交付（不实际跑大规模）；大规模运行依赖 S13-B 环境就绪。

---

## 1. 目标
设计一套规模验证方案（harness 设计 + 数据集生成器设计），目标数据集与指标按 **D6**。S13 仅交付**设计 + 小规模 smoke（MockBackend 验证 harness 本身）**；大规模实际运行待 S13-B 环境就绪后单独立项。

---

## 2. D6 目标与指标
- **数据集**：**100 PDF + 50 Web + 10 GitHub Repo**。
- **指标**：
  1. ingest 成功率
  2. query latency（p50 / p95）
  3. 内存占用（RSS 曲线）
  4. 稳定性（长跑无崩溃 / 超时）

---

## 3. 数据集生成 / 获取设计
- **100 PDF**：合成 PDF 生成器（可控页数 / 大小 / 语言，避免依赖实时网络与代理不稳）；或采样公开 PDF（离线优先）。
- **50 Web**：静态 HTML 快照（避免实时抓取不稳）；env 就绪后可经 Scrapling 抓真实页。
- **10 GitHub Repo**：克隆小仓库或生成 mock repo 结构（README / 源码）。

---

## 4. 后端
- 主：`LightRAGBackend`（真实环境，S13-B 就绪后）。
- 对照：`MockBackend`（仅验证 harness 逻辑，内存限制不适用大规模）。

---

## 5. 度量 harness 设计
- **ingest 阶段**：逐源 `importSourceAs(src, ownerAgent)`，记录成功 / 失败、耗时、错误类别；统计成功率。
- **query 阶段**：对 N 个代表性问题跑 `getNeighbors` / `query`，记录 p50 / p95 latency。
- **内存**：进程 RSS 采样（`process.memoryUsage()` + OS 级），绘制 ingest 曲线。
- **稳定性**：长跑（连续 query X 小时），记录崩溃 / 超时 / 恢复。

---

## 6. 报告
- 输出 Markdown + CSV：各指标值与阈值（建议 ingest 成功率 ≥ 95%，p95 latency < 设定上限）。
- 失败分类与瓶颈定位。

---

## 7. 执行时机
- harness 设计 + 数据集生成脚本设计 在 S13 交付（不实际跑大规模）。
- 小规模 smoke（如 5 PDF + 2 Web）可在 MockBackend 验证 harness 本身正确性。
- 大规模运行待 S13-B 环境就绪后单独立项执行。

---

## 8. 决策点
- 数据集来源（合成 vs 采样）
- 指标阈值设定
- 是否在 S13 内跑小规模 smoke
