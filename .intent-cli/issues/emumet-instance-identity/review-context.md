# emumet-instance-identity Review Context

Review that this slice moves operation toward the documented intent without widening scope.

Flag findings if the implementation:

- widens scope beyond the issue contract;
- launches AI providers from `intent-cli`;
- mutates GitHub or parent state when the issue is read-only;
- skips required contract sections.
- uses an inbound Host header to form the instance actor/key URLs;
- shares instance private-key storage or signing behavior with Profile keys;
- repairs missing/corrupt/decryption-failing/origin-mismatched key state by silently generating replacement material;
- performs key rotation/revocation or adds relay delivery functionality in K1;
- runs a KDF per delivery or allows the in-process parsed-key cache to exceed its count/TTL bounds.

## Approved design constraints

- DC-01: implement only the Emumet-side P1 scope; do not change `ory/hydra/hydra.yml`, implement K2/P2 or ShuttlePub production behavior.
- DC-03: use instance—not Profile—signing identity for relay; the canonical receiver/relay contract is the host copy at `intents/shuttlepub/contracts/emumet-post-relay/` (host commit `cc19ad0887409601999e66b3f00fb8d0735ebfc3`).
- DC-12: encrypted instance key, one active key, non-reusable key IDs, multi-key public representation, fail closed on damaged/mismatched state, bounded process cache; rotation/revocation is later.
- DC-15: additive migration; test empty and supported existing schemas, do not count skipped DB tests as passing, and assess old-binary rollback compatibility.

## Dependencies and sequencing

K1 depends on C0 (`emumet-p1-relay-contract`, published as Emumet issue #114). L1 also depends on C0, but K1 and L1 have no dependency on each other and may proceed in parallel.

## Facet context

<!-- BEGIN GENERATED FACET CONTEXT (G530) -->
### vocabulary
- (none overlapping this packet's intent_references)
### invariant
- (none overlapping this packet's intent_references)
### decider
- (none overlapping this packet's intent_references)
### acceptance-property
- (none overlapping this packet's intent_references)
<!-- END GENERATED FACET CONTEXT (G530) -->

## Knowledge Writeback Expectation (G461)

If the packet's `closeout_learning.write_back_required` is `true`, confirm the
expected intent-tree / ADR / diagram / docs writeback landed in this PR or was
captured as a follow-up packet. If the packet declined all knowledge maintenance,
that is acceptable — note it rather than blocking.
