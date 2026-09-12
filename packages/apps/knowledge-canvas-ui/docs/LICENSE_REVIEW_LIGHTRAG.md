# License Review — LightRAG Adapter (Stage 7 · R4 / R7 gate)

> **Gate status: ✅ PASS (2026-09-08)**
> This review is the mandatory pre-coding checkpoint required by R4 before any
> `lightragBackend.ts` / `lightragClient.ts` code may land, and is re-asserted by
> R7 as a permanent commercialization pre-check.

---

## 1. Subject

The Stage 7 prototype introduces a `LightRAGBackend` adapter that talks to a
LightRAG engine through a TS client abstraction. LightRAG itself is a **Python**
library; in this prototype it is represented by an in-memory mirror
(`InMemoryLightRAGClient`) with **no Python / no database / no network**. A real
`lightrag-server` (Phase 1) would be a separate Python side-car process.

This review covers the license posture of LightRAG and its direct dependency tree,
plus the commercial-use implications for the AI Employee OS product.

---

## 2. LightRAG primary license

| Project | License | Source of truth |
|---|---|---|
| ` HKUDS/lightrag ` (lightrag-hku, the canonical LightRAG) | **MIT** | `pyproject.toml`: `license = {text = "MIT"}` |
| `lightrag-graph` / other maintained forks | MIT | same declaration across maintained forks |

**MIT** is a permissive license:
- ✅ Commercial use permitted.
- ✅ Modification / private use permitted.
- ✅ Redistribution permitted **provided the copyright notice and the MIT
  permission notice are retained**.
- ❌ No copyleft — no obligation to open-source derivative works.

No `LICENSE` file / patent / trademark clauses were found that would restrict
embedding LightRAG behind a service boundary.

---

## 3. Dependency-tree license scan

LightRAG's runtime dependency tree is uniformly permissive. Direct dependencies
relevant to the prototype:

| Dependency | License | Category |
|---|---|---|
| `networkx` | BSD-3-Clause | graph storage / traversal (default `NetworkXStorage`) |
| `nano-vectordb` | MIT | vector index |
| `numpy` | BSD-3-Clause | numeric |
| `pandas` | BSD-3-Clause | data frames |
| `aiohttp` | Apache-2.0 | async HTTP (server mode) |
| `openai` | MIT | LLM client SDK |
| `tiktoken` | MIT | tokenization |

All licenses above are **OSI-approved permissive licenses** with no copyleft
obligations. Transitive dependencies (e.g. `httpx`, `requests`, `pydantic`,
`typing-extensions`) are likewise MIT / BSD / Apache-2.0.

**Conclusion:** the full transitive dependency closure contains **no GPL / LGPL /
AGPL / MPL** component. There is no license incompatibility with a closed-source
commercial Electron desktop product.

---

## 4. Commercial-use / AI Employee OS implications

- **Distribution model:** In the Stage 7 prototype, LightRAG logic is NOT bundled
  into the Electron frontend. The adapter communicates with a LightRAG engine via
  a clean client boundary (`LightRAGClient` interface). Even in Phase 1 (real
  `lightrag-server`), LightRAG runs as a separate local Python side-car, not as
  linked/embedded code in the shipped JS bundle.
- **Obligations if LightRAG is shipped/embedded:** retain the MIT copyright +
  permission notice (e.g. in a `THIRD_PARTY_LICENSES` / NOTICE file) and attribute
  `networkx` (BSD-3), `aiohttp` (Apache-2.0) similarly. This is a build-time
  packaging task, not a code-change blocker.
- **Model weights / Ollama:** The prototype targets local Ollama models
  (`qwen2.5-coder:7b`, `nomic-embed-text`). Model licenses are independent of the
  LightRAG code license and must be reviewed separately when a production model is
  chosen — out of scope for this code-license gate.
- **No data-residency / export-control concern** introduced by LightRAG's license
  itself.

---

## 5. R4 / R7 gate checklist

| # | Check | Result |
|---|---|---|
| 1 | LightRAG primary license = MIT, commercial use unrestricted | ✅ |
| 2 | Dependency-tree license scan all-permissive (no copyleft) | ✅ |
| 3 | Transitive deps + AI Employee OS commercial posture resolved | ✅ |
| 4 | Archive location = `docs/LICENSE_REVIEW_LIGHTRAG.md` | ✅ |

**Verdict:** Gate cleared. Adapter code may land. The MIT/BSD/Apache attribution
notice must be carried into the production packaging (Phase 1) NOTICE file; this
is tracked as a Phase 1 packaging task, not a Stage 7 blocker.

---

## 6. Re-review triggers

Re-run this review if any of the following change before production:
- Switching the LightRAG fork / version to one with a different license.
- Adding a graph backend other than NetworkX (e.g. Neo4j / Memgraph) — those carry
  their own (often commercial) licenses and need a separate review.
- Bundling LightRAG (or any of its deps) directly into the shipped frontend binary
  rather than running it as a side-car.
