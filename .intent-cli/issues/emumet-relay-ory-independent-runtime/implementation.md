# emumet-relay-ory-independent-runtime Implementation Packet

## Goal

Complete the approved P1 runtime wiring so Ory/JWKS outages cannot indefinitely block Emumet's listener or post-relay pipeline. Bound JWKS discovery and retrieval, preserve fail-closed JWT authentication, integrate instance/inbox/worker startup, and make worker stop, bounded drain, and forced-termination recovery safe. This unit is integration work only; implement after S1 and I1 have merged.

## Why

The approved plan identifies an unbounded wait during JWKS initialization. A refused Ory connection or an Ory peer that accepts a connection but never responds must not prevent Emumet from starting its Ory-independent surfaces. At the same time, authentication cannot become permissive when keys are unavailable. B1 brings A1's login/consent boundary together with S1's relay worker and I1's inbox wiring without changing A1 behavior or activating I1 before its dependency gate.

## Scope

- Bound both JWKS discovery and JWKS retrieval/connect waits with a finite configured timeout. A refused connection and a non-responding peer must both return control within that bound.
- Ensure listener and instance-document startup do not wait indefinitely for Ory/JWKS. When Ory is absent, instance-document serving and, when enabled, I1 reception and S1 relay operation remain available if their own dependencies are healthy.
- Keep every JWT-protected API fail-closed when there is no usable key set. Preserve existing validation on cached and uncached JWKS paths; do not accept unverifiable tokens, weaken issuer/audience/signature checks, or make Ory availability a precondition for unrelated endpoints.
- Integrate the startup sequence for listener, instance identity, inbox, and relay worker after A1, S1, and I1 are present. Keep the existing A1 URL, response, scope, cookie, and error behavior unchanged.
- On SIGTERM, stop new relay claims and drain in-flight work only within a bounded interval. A non-responding outbound peer must not make shutdown unbounded.
- On forced process termination, rely on S1 lease expiry/fencing so eligible work can be reclaimed without permanent loss and stale workers cannot mutate a reclaimed job.
- Preserve S1's send-stop setting and I1's `POST_RELAY_INBOX_ENABLED` default of `false`.
- Avoid schema changes. If one is necessary, add only migration `20261122000600` and verify compatibility on empty and populated databases.

## Out of scope

- Changes to login/consent semantics, externally observable A1 behavior, JWT validation policy, or unrelated Ory/Hydra configuration.
- Changes to S1's queue, retry, lease, fencing, send-deadline, or operator-command semantics; changes to I1's admission policy.
- Enabling inbox forwarding by default, enabling it before S1 is merged, or introducing a separate queue or process-local delivery mechanism.
- ShuttlePub production receiver, P2 link-state validation, K2 key rotation/revocation, and any non-additive migration.
- Changes to `ory/hydra/hydra.yml`.

## Runtime invariants

1. Ory/JWKS is an optional runtime dependency for listener availability, not a startup gate for the instance document or relay surfaces.
2. An authenticated API request still requires a verifiable JWT. Missing, refused, timed-out, malformed, or otherwise unusable JWKS fails closed.
3. Cached and uncached JWKS paths are both bounded and tested. A cache hit must retain current verification semantics; a cache miss may fetch only within the configured bound.
4. SIGTERM stops new relay claims before drain. Drain has a finite bound and then exits; shutdown never waits indefinitely on Ory or an outbound HTTP response.
5. Forced termination does not invent a second recovery protocol: S1's lease and fencing rules recover eligible work and reject stale results.
6. A1's refactor remains behavior-preserving and is not bundled with changes to runtime startup semantics.

## Verification

- Test cold start with a refused JWKS connection and with a server that accepts but never responds; assert both complete within the configured bound and the listener becomes usable.
- Test Ory absent while serving the instance document and, with I1 enabled, accepting inbox traffic and running S1 relay delivery.
- Test JWT authentication with cached keys, uncached successful retrieval, JWKS timeout/failure, and invalid tokens. Requests without a usable JWKS must fail closed.
- Test SIGTERM while idle, with a claimed job, during bounded drain, and while an outbound peer does not respond. Assert no claims occur after stop begins and process exit is bounded.
- Force-kill a worker around claim/authorization and verify lease expiry/reclaim, idempotent job recovery, and fencing against stale updates.
- Run A1 login/consent regression tests and compare externally observable URLs, responses, scopes, cookies, and error behavior.
- Verify inbox and worker configuration defaults, relevant integration tests, and any required migration on empty and populated databases. A required database test skipped is not a pass.
- Run relevant formatting, lint, build, and tests, then `git diff --check`.

## Knowledge Maintenance (G461)

- Intent placement: `intents/emumet/features/post-relay/overview.md` and `acceptance.md`; no new intent node.
- ADR candidate: none; this implements the approved plan and DC-01/04/14/15.
- Diagram candidate: none.
- Docs update: required; document Ory-independent startup, fail-closed JWT behavior during JWKS failure, bounded worker drain, and forced-termination lease recovery in the established runtime/relay operations documentation.
- Closeout learning: required; record actual timeout behavior, outage availability, A1 regression results, drain bound, lease recovery, and migration result.
- Guide reachability (G645): no new role-facing surface is added.

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
