// Domain vocabulary: which NodeKinds belong to the "Growth" side of the
// Space / Growth boundary (see KNOWLEDGE_MODE_BOUNDARY.md §4).
//
// Domain layer — NOT fixture data. Until P2-1 this constant lived in
// `mock/data.ts`, so three UI components reached into the fixture namespace to
// learn a piece of domain truth. Direction of dependency now enforced:
//
//     Component → Domain Contract → Backend Adapter
//
// Fixtures may import the domain; the domain must never import fixtures, and no
// UI may import `mock/*` at all (P2-0 boundary F10).
//
// The value is reproduced verbatim from the previous definition so that UI
// behaviour is unchanged.
export const GROWTH_KINDS = new Set([
  'concept',
  'skill',
  'memory',
  'task',
  'learningPath',
])
