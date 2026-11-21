# emumet-relay-ory-independent-runtime: Ory-independent relay runtime and bounded shutdown

## Goal

Integrate Emumet's listener, instance document, Profile inbox and post-relay worker so an Ory/JWKS outage cannot indefinitely block startup or relay operation. Bound JWKS discovery/retrieval, keep JWT authentication fail-closed, and make worker shutdown/drain and forced-termination recovery bounded and safe. This issue targets `ShuttlePub/Emumet` only.

## Why This Slice Exists Now

The approved Emumet P1 plan identifies an unbounded wait in initial JWKS discovery/retrieval. A refused Ory connection or a peer that stops responding must not prevent the listener and Ory-independent relay surfaces from becoming available. Authentication must not be weakened to achieve that availability. B1 is the integration slice that wires A1 and S1 together with the inbox; implementation starts only after S1 and I1 have merged.

## Current Observed State

- The approved plan records that JWKS initialization can wait indefinitely, preventing startup from reaching the listener.
- A1 login/consent boundary is merged in PR #113 (squash `29337f7`).
- S1 delivery is PR #125 and owns the sender/worker, operator subcommand, and send-stop setting.
- I1 inbox intake is PR #126 and owns inbox forwarding; `POST_RELAY_INBOX_ENABLED` defaults to `false`.
- B1 has not implemented any changes. At implementation start, inspect the latest `main` and record its full 40-character base SHA; the SHA from the planning investigation is historical context only.

## Accepted Baseline You May Assume

- Apply the approved P1 implementation plan, third edition: §2, §8 B1, §9, §10.2-10.3, §11.1 cases 12 and 20, and design constraints DC-01/04/14/15.
- A1 externally observable login/consent URLs, responses, scopes, cookies, and error behavior are fixed and must remain unchanged.
- S1 owns relay delivery, claim/lease/fencing, send deadlines, operator command, and send-stop configuration. I1 owns inbox intake and the disabled-by-default `POST_RELAY_INBOX_ENABLED` setting.
- B1 implementation must wait until S1 and I1 merge. B1 integrates their startup wiring and does not replace their behavior or ownership.
- Ory/JWKS is not required for instance-document serving or relay operation when their own dependencies are healthy. JWT-protected APIs remain fail-closed without a usable JWKS.
- No database migration is expected. If one is necessary, use additive timestamp `20261122000600` and test empty and populated database paths; do not change earlier migrations.
- Do not modify `ory/hydra/hydra.yml`.

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `server/, application/, driver/, tests/, config/`

Target part: B1 runtime integration — bounded JWKS discovery/retrieval, Ory-independent listener/instance/inbox/worker startup, fail-closed JWT behavior, and bounded worker stop/drain/recovery.

## In Scope

- Bound JWKS discovery and retrieval/connect waits with a finite configured timeout. Cover both connection refusal and a peer that accepts but never responds.
- Decouple listener and instance-document startup from Ory/JWKS. With Ory unavailable, keep the instance document, enabled inbox reception, and relay worker available when their own dependencies are healthy.
- Preserve strict JWT validation and fail closed if JWKS is missing, unusable, or cannot be obtained in time. Verify cached and uncached successful paths.
- Integrate startup order for the listener, instance identity, I1 inbox and S1 worker after their dependencies have merged.
- On SIGTERM, stop new relay claims and drain in-flight work only for a bounded interval. Ensure an unresponsive outbound peer cannot hang shutdown.
- Recover work after forced termination through S1's existing lease/fencing semantics, without permanent loss or stale-worker mutation.
- Preserve I1's `POST_RELAY_INBOX_ENABLED=false` default and S1's send-stop configuration.

## Out Of Scope

- Any change to A1 login/consent behavior, JWT validation policy, or unrelated Ory/Hydra configuration.
- Reimplementing S1's sender, retry/lease/fencing policy or operator command; changing I1 admission behavior or enabling inbox forwarding by default.
- Existing Profile-delivery policy changes, ShuttlePub production receiver, P2 link-state validation, K2 key rotation/revocation, or a new queue.
- Non-additive migrations and changes to `ory/hydra/hydra.yml`.

## Standalone Child Issue Contract

Implement B1 runtime integration in `ShuttlePub/Emumet` against the approved P1 plan and DC-01/04/14/15. Begin only after S1 and I1 merge. Bound JWKS discovery and retrieval so both refused connections and non-responding peers return within a finite configured timeout; do not gate listener, instance-document, enabled inbox, or relay startup on Ory availability. JWT-protected APIs must fail closed without usable JWKS, while cached and uncached successful authentication retains current validation. Integrate A1/S1/I1 startup without changing A1 behavior, preserve the inbox-disabled and relay-stop settings, stop new worker claims on SIGTERM, drain only within a bounded interval, and recover forced termination through S1 lease/fencing. No migration is expected; any required migration must be additive at `20261122000600` and tested on empty and populated databases. Do not modify `ory/hydra/hydra.yml`.

## Acceptance Criteria

- **B1-1 — bounded JWKS:** discovery and retrieval/connect are bounded by a finite configured timeout. A refused connection and an accepting-but-non-responding server both return control within that bound and cannot indefinitely block cold start or listener availability.
- **B1-2 — Ory-independent startup:** with Ory unavailable, Emumet can start and serve the instance document; with I1 enabled it accepts inbox traffic, and S1 relay delivery runs when its own dependencies are healthy.
- **B1-3 — fail-closed authentication:** protected APIs do not accept unauthenticated or unverifiable requests when JWKS is unavailable or unusable. Cached valid keys and uncached successful retrieval preserve existing JWT validation.
- **B1-4 — integrated wiring and A1 regression:** listener, instance identity, inbox and relay worker start in the intended order without changing A1's externally observable URLs, responses, scopes, cookies, or error behavior.
- **B1-5 — graceful stop:** SIGTERM stops new relay claims and drains in-flight work only within a configured finite bound. A stalled outbound peer or Ory does not make shutdown unbounded.
- **B1-6 — forced recovery:** after forced termination around claim/send authorization, a restarted worker can reclaim eligible work through S1 lease/fencing; no stale worker can mutate reclaimed work and no eligible job is permanently lost.
- **B1-7 — configuration defaults:** preserve S1's send-stop setting and I1's `POST_RELAY_INBOX_ENABLED` default of `false`; do not start delivery while stopped or enable inbox forwarding by default.
- **B1-8 — scope and migration:** make no unrelated delivery-policy, authentication, or Ory/Hydra changes. Do not modify `ory/hydra/hydra.yml`. If a migration is required, it is additive at `20261122000600`.
- **B1-9 — database compatibility:** verify relevant startup/migration paths against empty and populated databases; a required DB test skipped is not a pass.

## Verification

Test JWKS refusal and non-response against the configured bound; cold-start with cached, uncached-success, and unavailable JWKS; and fail-closed behavior for authenticated APIs when no usable keys exist. With Ory stopped, verify instance-document serving, enabled inbox intake, and S1 delivery where dependencies permit. Test SIGTERM while idle, with active relay work, and with a non-responding outbound peer; prove new claims stop and drain exits within its bound. Force-kill workers around claim/authorization and verify lease reclaim plus fencing. Run A1 login/consent regression tests and confirm externally observable behavior is unchanged. Verify config defaults, relevant integration/build/lint/format tests, empty and populated migration paths if applicable, and `git diff --check`; do not count required database tests skipped as passing.

## Related Links

- A1 login/consent boundary, merged PR #113 (squash `29337f7`): https://github.com/ShuttlePub/Emumet/pull/113
- S1 post-relay delivery PR #125: https://github.com/ShuttlePub/Emumet/pull/125
- I1 inbox relay PR #126: https://github.com/ShuttlePub/Emumet/pull/126
- Post-relay intent: https://github.com/ShuttlePub/host/tree/main/intents/emumet/features/post-relay
- Approved P1 implementation plan, third edition: `thread-rd4012ty`, run `run-01m7yc2nagh0z7g2jh14g6qb8x`
- Final B1 design constraints DC-01/04/14/15: `thread-rd4012ty`, run `run-01m7yd22411cm1n36mybvg0xcv`

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/post-relay/overview.md` and `acceptance.md`; no new intent node.
- ADR candidate: none; this implements the approved plan and constraints.
- Diagram candidate: none.
- Docs update: required; update the established runtime/relay operations documentation with Ory-independent startup, fail-closed JWT behavior, bounded drain, and forced-termination recovery.
- Closeout writeback expected: yes; record actual JWKS, outage, A1 regression, shutdown, lease-recovery, and migration results.

## Guide Reachability (G645)

No new role-facing surface is added.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open the child implementation PR against `main`. It must include `Closes #<this B1 issue number>` and must not begin until S1 and I1 have merged.

## Additional Required Guidance

- Implement and test only in `ShuttlePub/Emumet`; do not change host packet, queue, or intent state from the child repository.
- Preserve DC-01/04/14/15 and the approved P1 plan. If an actual contract gap is found, request approval for a separate change rather than widening this issue.
- Do not ask `intent-cli` to launch an AI provider. Do not modify `ory/hydra/hydra.yml`.
