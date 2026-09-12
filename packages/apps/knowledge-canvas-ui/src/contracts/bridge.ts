// P2-3.1 contract — Typed Bridge
//
// Part of the system ABI layer: type-level declarations only. No runtime code, no
// class, no function implementation, no adapter, no window injection, no plugin
// loader, no bus instantiation, no reads of business state.
//
// Allowed dependency direction:
//   contracts/bridge.ts -> sibling contract modules   (type only)
// Forbidden:
//   bridge -> store | knowledge | llm | mock | demo | packages runtime
//
// Target shape:
//   Plugin / External Runtime -> Typed Bridge -> ActivityBus
//
// POSITIONING (P2-3.1): this file is the TYPED CONTRACT BOUNDARY sitting between
//
//     Future Runtime Bridge        (above — not implemented here)
//              |
//     Typed Contract Boundary      (this file)
//              |
//     Current Host / Plugin Eco    (below — not implemented here)
//
// Neither end is implemented here. The goal of P2-3.1 is CONTRACT FREEZE: decide
// whether the contract is sufficient to carry a future runtime, not to build one.
//
// P2-3 ruling Q6: this file is the CONTRACT ONLY. No runtime adapter, no plugin
// loader, no sandbox, no marketplace. Those are deferred to the P3 / cordis
// migration, because building them now would create a second composition root,
// force dual maintenance of the window bridge, and add cost to the eventual move
// into packages/client.

import type { Unsubscribe } from './activityBus'
import type { ActivityEvent } from './activityEvent'

// ---------------------------------------------------------------------------
// 1. Bridge Result — unified error isolation
// ---------------------------------------------------------------------------

/**
 * Failure domains. A failure must be contained in its own domain: a plugin failure
 * may disable that plugin's source, but must never take down the bus or the
 * knowledge core.
 */
export type BridgeErrorDomain = 'plugin' | 'bridge' | 'bus' | 'core'

export interface BridgeError {
  readonly domain: BridgeErrorDomain
  readonly code: string
  readonly message: string
  /** Present for plugin-domain errors: which source failed. */
  readonly sourceId?: string
}

/**
 * Exceptions must NOT cross the bridge. Every bridge call returns this envelope so
 * a throwing plugin is converted into data at the boundary.
 */
export type BridgeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: BridgeError }

// ---------------------------------------------------------------------------
// 2. Lifecycle contract — described, not implemented
// ---------------------------------------------------------------------------

export type ActivitySourceHealth =
  | 'unknown'
  | 'healthy'
  | 'degraded'
  | 'failed'
  | 'disabled'

/**
 * Subsystem-style lifecycle: `initialize` and `dispose` must be symmetric, and the
 * host is the one that calls them. `health` reports containment state so a failing
 * source can be disabled without affecting anything else.
 *
 * No scheduler, no worker, no sandbox, no process manager is defined here.
 */
export interface ActivitySourceLifecycle {
  initialize(): BridgeResult<void>
  dispose(): BridgeResult<void>
  health(): ActivitySourceHealth
}

// ---------------------------------------------------------------------------
// 3. Activity source registration — protocol only
// ---------------------------------------------------------------------------

/**
 * EXTENSION RULE (P2-3 ruling): no catch-all `extra` bag. A real requirement
 * gets a NAMED field through contract review; an untyped bag would defeat the
 * purpose of a verified boundary.
 */
export interface ActivitySourceMetadata {
  readonly displayName?: string
  readonly version?: string
}

/**
 * Describes an external (typically plugin-provided) activity source.
 *
 * RESERVED NAMESPACE — P2-3 ruling Q7: `ActivitySourceId` is deliberately NOT
 * widened. It remains `'user' | 'ingestion'`. The `plugin:<id>` namespace is
 * reserved by this contract, but no event may be emitted with a `plugin:*` source
 * until an explicit ActivitySourceId evolution proposal has passed compatibility
 * review and migration.
 *
 * No kinds allow-list and no capability registry in this version (ruling Q9): there
 * is no real plugin source yet, so those would be designed in the dark.
 */
export interface ActivitySourceRegistration {
  readonly id: string
  readonly metadata?: ActivitySourceMetadata
  readonly lifecycle?: ActivitySourceLifecycle
}

/**
 * What a plugin hands to the bridge. Note the plugin does NOT receive the bus: it
 * only exposes `subscribe`, and the bridge owns the wiring — that is what makes
 * error isolation enforceable.
 */
export interface RegistrableActivitySource {
  readonly registration: ActivitySourceRegistration
  subscribe(next: (event: ActivityEvent) => void): Unsubscribe
}

// ---------------------------------------------------------------------------
// 4. Host contract
// ---------------------------------------------------------------------------

/**
 * The bridge OWNS the ActivityBus; the bus is deliberately NOT exposed here.
 *
 * Exposing it would let any holder of the bridge call `bus.register(...)` or
 * `bus.subscribe(...)` directly, bypassing the containment this contract exists to
 * provide — a throwing plugin subscriber would then propagate straight into the bus
 * instead of being disabled at the boundary (see BridgeErrorDomain).
 */
export interface TypedBridge {
  /**
   * Make a plugin-provided source known to the host. Signature only: no registration
   * logic, no dispatch, no unregister behaviour is defined here.
   *
   * Returns an unregister function on success; repeated failure disables THAT SOURCE.
   */
  registerActivitySource(source: RegistrableActivitySource): BridgeResult<Unsubscribe>
  /** Host teardown: release subscriptions and the append-only log. */
  dispose(): void
}

/**
 * The typed replacement for reading `window.*` directly. The bridge only states
 * THAT a capability exists; it does not expose internals and must not bind to any
 * specific model or provider.
 *
 * Ruling Q2: the existing `window.__kcuLlmHost` is NOT removed by this contract.
 * Migration is strangler-style — define the contract, wrap the global in an adapter,
 * route new consumers through the contract, and only consider removal once parity
 * is proven.
 *
 * Ruling Q8: `llmHost` stays `unknown`. The bridge guarantees the boundary exists;
 * it does not design a model API, expose Agent Core, or decide provider routing.
 */
export interface HostContract {
  readonly bridge: TypedBridge
  readonly llmHost: unknown
}
