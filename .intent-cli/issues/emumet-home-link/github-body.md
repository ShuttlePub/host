## Goal

Implement Emumet P1 home-link persistence, owner transfer, origin eligibility, and Account lifecycle coordination. The same Account-scoped gate must keep user unlink, Account deactivation/projector processing, and send authorization consistent, while preserving the canonical emumet-post-relay v1 contract.

## Why This Slice Exists Now

The approved P1 plan assigns C0 to the relay contract/schema/fixtures, K1 to the independent instance actor/signing identity, and L1 to home-link ownership and lifecycle. L1 is required before Q1 can safely use link state for delivery authorization. C0 is the only dependency; K1 is independent and is not a prerequisite.

## Current Observed State

The approved P1 plan does not yet have an L1 implementation issue. C0 (issue #114) establishes the protocol contract; this issue defines the missing link/lifecycle slice. It does not assume that these APIs or lifecycle guarantees already exist.

## Accepted Baseline You May Assume

- Approved Emumet P1 plan (third edition), §8/§9; apply DC-01/06/09/10/11/15.
- The approved Emumet `main` baseline is `1259c731af496bb09ae11286a9b869b132a88f4d`; fetch current `main` before implementation and record the actual full base SHA in the child PR.
- The one canonical contract is host commit `cc19ad0887409601999e66b3f00fb8d0735ebfc3`, `intents/shuttlepub/contracts/emumet-post-relay/` (v1 revision 1). Emumet `docs/contracts/` is a copy, not an independent source.
- DC-09 defines the per-Profile link invariant and three modes; DC-10 defines transfer, hold, deactivation, and reactivation semantics; DC-06 defines shared lock order; DC-11 defines eligible origins; DC-15 requires additive migrations and real database coverage.

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/, application/, driver/, server/, migrations/`

Target part: Home-link model and register/list/unlink/transfer APIs, eligible-origin checks, Account lifecycle gate, and consistency across unlink API / deactivation event / projector.

## In Scope

- Persist the owner, Profile, normalized origin, DC-09 mode, lifecycle state, and a generation/version that prevents stale operations or identifier reuse.
- Enforce current-owner authorization and DC-09's modes and per-Profile active-link invariant under concurrency. Transfer retains link ID, origin, and generation while changing the authoritative owner; the former owner loses access.
- Require HTTPS, exact normalized-origin allowlisting, redirect rejection, pinned DNS resolution, and rejection of private/non-public addresses. Eligibility/allowlist exclusion holds a link; it is not a user unlink.
- Identify the authoritative write-side Account lifecycle state and read/mutate it under the shared gate. Do not authorize or restore links from a lagging projector/read model.
- Use the same Account gate and DC-06 lock order for registration/transfer/unlink, Account deactivation event handling and projector processing, and send authorization. A committed unlink/deactivation blocks new authorization; previously authorized work may finish as allowed by the contract.
- Unbind every Profile link for a deactivated Account atomically with the lifecycle mutation. Do not rely on Profile-row deletion or FK cascade; preserve necessary link/ownership ledger state after Profile deletion.
- Prevent link revival on reactivation or projector replay. A stale earlier deactivation event must not unlink a newer link created after reactivation. Owner stop/BAN holds do not reset deadlines.
- Keep gate-bearing transactions bounded. A projector transaction taking the gate processes one Account and makes no network/external-service call while holding the gate/transaction. Set bounded lock/statement/transaction waits only on gate-bearing transactions, not as a global timeout.
- Provide the lifecycle/link interface Q1 needs, without implementing Q1's durable delivery queue or retry/quarantine worker.

## Out Of Scope

- K1 instance identity/signing key; L1 and K1 are independent children of C0.
- Q1 delivery queue, retry/quarantine worker, ShuttlePub production receiver, and delivery worker.
- P2 behavior, changes to Ory/Hydra configuration, and changes to the canonical C0 contract.
- Automatic revival of a prior link after Account reactivation.

## Standalone Child Issue Contract

Implement persistent Emumet home links and their authenticated register/list/unlink/transfer operations under the approved emumet-post-relay v1 and DC-01/06/09/10/11/15. Enforce the per-Profile active-link/mode invariant and exact eligible-origin checks. Make user unlink, Account deactivation event/projector processing, and send authorization share one Account lifecycle gate and lock order, using the authoritative write-side owner state under that gate. Deactivation must unbind every link for every Profile of the Account atomically, retain required ledger state after Profile deletion, and never revive links through reactivation/replay or let an old event erase a newer link. Keep critical sections bounded, avoid external calls inside them, and scope wait settings to gate-bearing transactions. Prove these behaviors with real-database multi-connection/process tests, including multiple Profiles, stale/replayed events, and same-batch deactivate/reactivate; add only backward-compatible migrations. C0 is the sole dependency; do not add a K1 dependency or implement the queue/worker.

## Acceptance Criteria

- [ ] Registration/list/unlink are authenticated and scoped to the current owner; transfer changes owner while retaining link ID, origin, and generation, and the old owner can no longer operate on it.
- [ ] Concurrent registration cannot create more active links than DC-09 permits per Profile; all three DC-09 modes and lifecycle states are represented and enforced.
- [ ] Registration/revalidation accepts only HTTPS origins exactly matching the normalized configured allowlist; redirects and private/non-public DNS results are rejected. Allowlist exclusion holds rather than immediately revokes/unlinks.
- [ ] The authoritative write-side Account lifecycle source is explicit and read under the gate; no lagging projector/read model can authorize or restore a link.
- [ ] User unlink, Account deactivation event handling, projector, and send authorization follow one documented DC-06 lock order. Once unlink/deactivation commits, no new send authorization succeeds; previously authorized work follows the contract.
- [ ] Account deactivation unbinds links belonging to all of its Profiles in the same transaction. A multi-Profile test proves this does not depend on deleting one Profile row.
- [ ] Profile deletion does not cascade away required link/ownership ledger state. Reactivation/replay cannot revive an old link; replay of a prior deactivation event cannot remove a newer link.
- [ ] Transfer, stop/BAN hold, deactivation, reactivation, event replay, and same-batch deactivate/reactivate obey DC-10; holds do not reset deadlines and reactivation requires explicit new registration.
- [ ] A projector transaction holding the gate processes one Account only and makes no external call while holding it. Lock/statement/transaction waits are bounded only for gate-bearing transactions; no global timeout change.
- [ ] Real-database tests with separate connections/processes cover concurrent registration and transfer/unlink/deactivation/authorization races, all links on multi-Profile Accounts, projector replay/stale events, and same-batch deactivate/reactivate. No required test is skipped; no duplicate active link, stale authorization, lost new link, or resurrection is observed.
- [ ] Additive migrations are tested from an empty database and the supported pre-change schema; rollback compatibility is assessed and existing Profile actor/key behavior does not regress.
- [ ] No Q1 queue/worker, K1 implementation, P2 behavior, Ory/Hydra change, or independent contract change is included.

## Verification

Run focused unit/integration tests and the repository's required full test/build checks. Use real database instances with separate connections/processes for concurrency; do not substitute in-memory-only tests or skip these cases. Verify migrations against an empty DB and the supported pre-change schema, assess rollback compatibility, and finish with `git diff --check`.

## Related Links

- C0 contract/schema/fixture issue: https://github.com/ShuttlePub/Emumet/issues/114
- Independent K1 issue (not a dependency): https://github.com/ShuttlePub/Emumet/issues/116
- Canonical contract at approved host commit: https://github.com/ShuttlePub/host/tree/cc19ad0887409601999e66b3f00fb8d0735ebfc3/intents/shuttlepub/contracts/emumet-post-relay/
- Approved P1 plan and DCs: https://github.com/ShuttlePub/host/blob/main/intents/shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md
- Existing feature overview: https://github.com/ShuttlePub/host/blob/main/intents/emumet/features/post-relay/overview.md
- Existing feature decisions: https://github.com/ShuttlePub/host/blob/main/intents/emumet/features/post-relay/decisions.md

## Knowledge Maintenance

Optional (G461). Tells the implementer/reviewer whether intent / ADR / diagram / docs
writeback is expected for this slice. Answer or explicitly decline:

- Intent placement: `intents/emumet/features/post-relay/overview.md` and existing supporting feature decisions/acceptance; no new intent node.
- ADR candidate: none expected; raise any material design deviation for review.
- Diagram candidate: none required unless implementation materially changes the approved state/gate model.
- Docs update: keep the host contract canonical; update implementation-facing docs only as needed.
- Closeout writeback expected: record the authoritative owner-state source, gate/lock ordering, bounded transaction behavior, and any multi-Profile/replay constraint; writeback is not mandatory.

## Guide Reachability (G645)

No new role-facing guide surface is added (`no_role_facing_surface: true`).

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
