# emumet-home-link Implementation Packet

## Goal

Implement P1 home-link persistence and lifecycle coordination in Emumet: authenticated link registration/list/unlink, ownership transfer, origin eligibility, and a shared Account-scoped gate that keeps user unlink, deactivation events/projectors, and send authorization consistent. Preserve the approved emumet-post-relay v1 contract and the existing Profile identity/signing behavior.

## Why

The C0 contract/schema/fixture issue (#114) defines the relay boundary. L1 supplies the link and owner-lifecycle invariant required before Q1 can safely enqueue delivery. K1 (#116) supplies the independent instance actor/signing identity; L1 does not depend on K1.

## Scope

- Persist the per-Profile home link, normalized origin, DC-09 mode, lifecycle state, current owner, and generation/version needed to reject stale operations.
- Implement authenticated registration, list, unlink, and transfer behavior. Enforce DC-09's modes and active-link limit under concurrency; retain link ID, origin, and generation on transfer while changing owner.
- Validate eligible origins against the configured exact allowlist using HTTPS, redirect rejection, pinned DNS resolution, and private/non-public-address rejection. An allowlist exclusion/eligibility failure holds the link; it is not equivalent to an explicit user unlink.
- Define and document the authoritative write-side source for Account lifecycle status. Read and mutate that source under the shared Account gate; do not authorize from a lagging projector/read model.
- Apply the same gate and DC-06 lock order to user unlink, Account deactivation event handling/projector work, transfer/link mutation, and the send-authorization check. Unlink/deactivation commit prevents new authorization; already-authorized work may finish as specified by the contract.
- Deactivation unbinds every link belonging to every Profile of the Account in the same transaction as the lifecycle mutation. Do not rely on a Profile-row delete or FK cascade to find/remove links. Preserve the necessary link/ownership ledger when a Profile row is deleted.
- Prevent resurrection from Account reactivation, projector replay, stale earlier events, and same-batch deactivate/reactivate processing. Owner stop/BAN holds preserve existing deadlines; transfer preserves ID/origin/generation.
- Bound gate-bearing critical sections. A projector transaction that takes the gate handles one Account only and makes no network/external-service call while its transaction/gate is held. Set bounded lock/statement/transaction waits only on gate-bearing transactions, not globally.
- Provide the link/lifecycle interface needed by Q1 without implementing Q1's durable delivery queue or retry/quarantine worker.

## Out of scope

- K1 instance identity/key provisioning; L1 and K1 depend only on C0 and may proceed independently.
- Durable delivery queue, retry/quarantine worker, ShuttlePub production receiver, or delivery worker.
- P2 functionality, changes to Ory/Hydra configuration, or changes to the canonical C0 contract.
- Any behavior that automatically revives a link after Account reactivation.

## Verification

Run the focused unit/integration suite and the repository's full required test/build checks. Use a real database with separate connections/processes for concurrency cases; do not replace these with in-memory-only tests or skip them. Cover concurrent registration; transfer/unlink/deactivation races; authorization on both sides of unlink commit; all links on multi-Profile Accounts; projector replay/stale events; and same-batch deactivate/reactivate. Assert that no duplicate active link, stale authorization, lost post-reactivation link, or resurrection occurs. Test migrations from both an empty database and the supported pre-change schema; assess rollback compatibility. Finish with `git diff --check`.

## Knowledge Maintenance (G461, optional)

Captured while the design context is fresh. Answer or explicitly decline:

- Intent placement: existing `intents/emumet/features/post-relay/overview.md`, supported by `decisions.md` and `acceptance.md`; no new intent node.
- ADR candidate: no new ADR expected. If implementation must choose a new lifecycle source/lock semantic beyond the approved DCs, record it for review rather than silently expanding this slice.
- Diagram candidate: no diagram writeback required unless the implemented state/gate model differs materially from the approved design.
- Docs update: keep the host's emumet-post-relay v1 contract as the single source; update implementation-facing docs only as needed to explain the resulting API/lifecycle behavior.
- Closeout learning: record the authoritative owner-state source, gate/lock order, bounded transaction scope, and any multi-Profile or replay constraint; `write_back_required: false`.

- Guide reachability (G645): for every role-facing surface, name the guide surface, routing role,
  and target surface; if none is added, explicitly set `no_role_facing_surface: true`. A blank
  declaration is not a decision. `stalled-work` reports a declared route until the host records it.

No new role-facing guide surface is added (`no_role_facing_surface: true`).

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
