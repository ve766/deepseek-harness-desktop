# UI Inspiration Registry — AI Employee OS

> **Standing rule (2026-09-07):** During ongoing UI research, if a valuable
> open-source project or design system is discovered, **proactively add it here**
> — do NOT wait for the user to request it. Each entry must capture *transferable
> principles only*; never copy code.
>
> **Differentiation boundary (hard):** AI Employee OS is **not** a macOS clone.
> Target language = **Apple restraint + Spatial depth + Agent-native interaction**.
> Avoid: traffic-light windows, Finder-style file managers, pixel-copy menu bars,
> system-level persistent Dock.

## Status legend
- `locked` — principles extracted & folded into a plan/doc
- `observing` — noted, not yet deeply mined
- `watch` — on the standing radar, re-check periodically

## Locked sources

| # | Source | Category | Key transferable principle | Status |
|---|--------|----------|----------------------------|--------|
| 1 | react-ui-os | Desktop OS shell | App Registry: *apps are data, one registration lights up Dock/MenuBar/Spotlight/shortcuts*. Theme = token bag. Motion 140–300ms, no bounce, no loops. Explicit anti-patterns list. | locked |
| 2 | macos-react | Desktop OS shell | Zustand window-state + per-app module + Framer Motion. Value = state/structure pattern, not visual recipe. | locked |
| 3 | StreamDeck (Tahoe Liquid Glass) | Glass material | `bg rgba(255,255,255,.12)` + `blur(40px) saturate(180%)` + **0.5px subpixel border**; dark glass *less* transparent `rgba(30,30,30,.55)` w/ heavier shadow; rejects Tailwind/CSS-in-JS (fights precise `backdrop-filter`). | locked |
| 4 | shadcn/ui | Component philosophy | `own-the-code` copy-paste model; semantic CSS-var theming; compose over configure. Maps to AIOS token ownership. | locked |
| 5 | Magic UI | Motion vocabulary | Entrance/exit vocabulary, bento, shimmer. Source for "thinking" states (no loop animations). | locked |
| 6 | Aceternity UI | Spatial accents | Light 3D tilt (≤6°), spotlight, spatial backgrounds. Source for Dock light-spot / card hover (reject heavy tilt). | locked |
| 7 | tldraw | Infinite canvas | Camera/depth/shape model. **Authority reference for Phase 2 Spatial Knowledge (D).** | locked |
| 8 | React Flow | Node graphs | Edge-flow animation, minimap. Feeds `lptrack` glow + Phase 2 minimap. | locked |
| 9 | Raycast | Command surface | Command palette, keyboard-first, actions-front. **Core reference for B · AI Command Center.** | locked |
| 10 | Linear | Calm density | Quiet information density, status model, issue card. Feeds B density + C/E status model. | locked |
| 11 | Apple HIG | Design authority | **Deference** (UI yields to content), **clarity**, depth via *subtle layering not heavy borders*, **restrained motion** (inherently respects reduced-motion), SF-Symbols-style monochrome iconography. Core of the "Apple 克制" pillar. | locked |
| 12 | visionOS / Spatial UI | Spatial design | Glass panels that **refract environment**, spatial depth via **z-distance + blur**, hover/active as the gaze/gesture metaphor, **no flat dashboard grids**. Core of the "Spatial 空间感" pillar. | locked |
| 13 | OpenDevin / OpenHands / Cua | Open-source AI Desktop | Agent-desktop surface patterns: task timeline, tool-use visualization, agent "presence" inside a workspace. Inform A (Presence) + future Employee Center. | observing |

## Standing watchlist (re-check periodically)
Per user direction, keep these areas continuously scanned:

- **Apple Human Interface Guidelines** — restraints, deference, depth, motion.
- **visionOS / Spatial UI** — glass depth, spatial panels, gaze/gesture metaphors.
- **Raycast** — command-surface evolution, extension model.
- **Linear** — calm density, keyboard navigation, issue lifecycle visuals.
- **tldraw** — infinite-canvas camera, shape system, multi-select.
- **React Flow** — graph edge semantics, minimap, viewport transforms.
- **AI Agent UI** — agent status, tool-use visualization, streaming thought.
- **Knowledge Graph UI** — cluster/force layouts, edge semantics, provenance.
- **Open-source AI Desktop / Agent OS** — e.g. OpenDevin/OpenHands UI, AutoGPT
  frontends, AgentZero, Cua, screenpipe — desktop-agent surface patterns.

## How to add an entry
Append a row to the relevant table with: source, category, the *one or two*
principles worth transferring, and status. If it changes a plan, note the plan
section it informs (A Home / B Command Center / C Employee Card / D Spatial /
E Visual Language). Keep it principle-level — no code, no clones.
