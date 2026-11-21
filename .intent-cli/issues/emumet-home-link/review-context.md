# emumet-home-link Review Context

Review that this slice moves operation toward the documented intent without widening scope.

Flag findings if the implementation:

- widens scope beyond the issue contract;
- launches AI providers from `intent-cli`;
- mutates GitHub or parent state when the issue is read-only;
- skips required contract sections.

## Approved Design Baseline

- This is L1 from the approved Emumet P1 plan (third edition), §8/§9. C0 (`emumet-p1-relay-contract`, Emumet issue #114) is the only dependency. K1 (`emumet-instance-identity`, issue #116) is independent; do not add a K1 dependency.
- Apply DC-01/06/09/10/11/15. The canonical emumet-post-relay v1 contract is in host commit `cc19ad0887409601999e66b3f00fb8d0735ebfc3`, under `intents/shuttlepub/contracts/emumet-post-relay/`.
- Preserve DC-09's per-Profile link/mode invariants; DC-10's transfer, hold, deactivation, and non-resurrection semantics; DC-06's shared lock order; DC-11's HTTPS/origin/DNS checks; and DC-15's additive migration/testing requirements.

## Review Follow-ups Included as Completion Criteria

The approved review's four optional implementation notes are explicit acceptance criteria, not a scope expansion:

1. A projector transaction taking the lifecycle gate handles one Account at a time, and makes no external call while the gate/transaction is held.
2. Apply bounded lock/statement/transaction waits only to the gate-bearing transaction; do not change global database timeout behavior.
3. Account deactivation unbinds links belonging to all of the Account's Profiles; test a multi-Profile Account and do not rely on deleting one Profile row.
4. Identify the authoritative owner lifecycle state and read it under the gate; do not rely on a lagging projection to authorize or restore links.

Also test the approved edge cases around same-batch deactivate/reactivate and replay of an older deactivation event after a newer link exists.

## Facet context

<!-- BEGIN GENERATED FACET CONTEXT (G530) -->
L1 `intent facet-check` output: `no_facet_data: false`; scope `valid-non-empty`; coverage gap `true`; warnings none. The six lexical terms (`main`, contract commit hash, `ShuttlePub`, `direct-main`, `stalled-work`, `improve`) have no related facet nodes and are unmatched. This is lexical scaffolding, not semantic verification; reviewers should assess the linked feature/DCs directly.
<!-- END GENERATED FACET CONTEXT (G530) -->

## Knowledge Writeback Expectation (G461)

If the packet's `closeout_learning.write_back_required` is `true`, confirm the
expected intent-tree / ADR / diagram / docs writeback landed in this PR or was
captured as a follow-up packet. If the packet declined all knowledge maintenance,
that is acceptable — note it rather than blocking.
