# emumet-post-relay-e2e Review Context

Review whether the T1 integration evidence verifies the approved post-relay P1 intent without
widening the trust boundary or confusing test evidence with production certification.

## Dependency and execution boundary

- C0, K1, L1, Q1 and S1 are merged. I1 is PR #126 and B1 is issue #127; the final E2E acceptance
  run must use the latest Emumet `main` after both are integrated and record its full base SHA.
- Support/test scaffolding can precede those merges, but it is not acceptance evidence.
- This host issue only scopes implementation in `ShuttlePub/Emumet`; it does not authorize
  child-side changes to host packet, queue, runs or intent state.

## Review invariants

Flag findings if the implementation:

- omits any mandatory §11.1 case or required §11.2 regression/measurement/physical-capacity
  verification;
- uses mocks instead of real Kratos/Hydra for authentication/link registration, or relies on a
  pre-published dev image instead of building from source;
- gives the P1 mock receiver link-state or generation synchronization requirements;
- does not identify and update a PostgreSQL-volume physical-capacity source at least every
  30 seconds, or treats information older than 90 seconds as fresh;
- fails open on unknown/stale/unsafe capacity or reports Emumet container free space as DB
  physical capacity;
- fails to verify non-empty release-image operator recovery while a normal worker is active;
- publishes an image to GHCR, creates a tag/release, includes rotation E2E, or modifies
  `ory/hydra/hydra.yml`;
- widens scope beyond DC-01 through DC-19, changes unrelated Profile delivery/auth behavior,
  launches AI providers from `intent-cli`, or leaves required docs/measurements/alerts
  undocumented;
- treats a skipped required database test, an unrun acceptance case, or an unmeasured goal as
  passing.

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

The lexical facet-check is evidence only; `no_facet_data: true` means it did not run and is
not a pass. Review semantic alignment against `intents/emumet/features/post-relay/overview.md`
and `acceptance.md` manually.

Recorded T1 pre-publish result (`intent-cli intent facet-check --domain emumet --packet
emumet-post-relay-e2e --format json`): `no_facet_data: false`; extracted terms were present,
but `coverage.nodes` was empty, `coverage.gap` was `true`, and the output reported unmatched
terms. This is a lexical scaffold result, not a pass or semantic approval; the intent has no
matching facet coverage for this packet, so the alignment was reviewed against the approved
plan and the post-relay overview/acceptance instead. No facet nodes were invented.

## Knowledge Writeback Expectation (G461)

If `closeout_learning.write_back_required` is `true`, confirm the post-relay acceptance record
and `docs/post-relay-operations.md` writeback landed in the PR or was captured as a follow-up.
The record must distinguish all required case results from exclusions; include actual Ory and
source-built-image evidence, capacity source/cadence/freshness, alert/recovery results,
worker-concurrent operator results and measured versus unmeasured performance. Do not call a
declared writeback complete if it is missing.

## Guide reachability (G645)

The packet declares that no new role-facing surface is added; T1 updates the established
operations documentation.
