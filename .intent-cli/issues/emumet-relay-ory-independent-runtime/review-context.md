# emumet-relay-ory-independent-runtime Review Context

Review that the implementation matches the approved P1 runtime plan and keeps the named dependency boundaries intact.

## Controlling plan and constraints

- Approved P1 implementation plan, third edition: §2 (JWKS startup observation), §8 B1, §9 integration order, §10.2-10.3, and §11.1 cases 12 and 20.
- Final design constraints: DC-01, DC-04, DC-14, and DC-15.
- A1 login/consent boundary is merged in PR #113 (squash `29337f7`); its externally observable behavior must remain unchanged.
- S1 delivery is PR #125 and owns delivery worker, operator subcommand, and send-stop setting.
- I1 inbox intake is PR #126 and owns the inbox integration; `POST_RELAY_INBOX_ENABLED` defaults to `false`.
- B1 implementation starts only after S1 and I1 are merged. B1 integrates runtime wiring rather than reimplementing their worker or admission responsibilities.

## Review checklist

- [ ] JWKS discovery and retrieval/connect waits are finite; both connection refusal and a peer that never responds are covered.
- [ ] Cold start and listener availability do not depend on Ory/JWKS availability; instance document, enabled inbox reception, and relay delivery work when Ory is unavailable and their own dependencies are healthy.
- [ ] JWT-protected requests fail closed when a usable JWKS cannot be obtained; cached and uncached valid-key paths retain existing verification.
- [ ] SIGTERM stops new relay claims and performs only a bounded drain; an outbound non-responder cannot hold process shutdown indefinitely.
- [ ] Forced termination is recovered through S1 lease expiry/fencing; a restarted worker can reclaim eligible work and stale workers cannot mutate it.
- [ ] A1 login/consent behavior remains unchanged; the patch does not bundle a new A1 refactor.
- [ ] S1 stop configuration and I1's disabled-by-default inbox setting are preserved.
- [ ] No unrelated Ory/Hydra, existing delivery policy, or prior migration changes; any required migration is additive at `20261122000600` and tested on empty and populated DBs.

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

Write back actual JWKS timeout/startup behavior, Ory-outage availability, cached/uncached JWT results, A1 regression evidence, SIGTERM drain behavior, forced-termination lease recovery, and migration compatibility to `intents/emumet/features/post-relay/acceptance.md`. Update the established runtime/relay operations documentation and cite its actual path. If a declared writeback is not delivered, record a follow-up packet rather than silently dropping it.
