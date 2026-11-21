# Review Context: emumet-post-relay-delivery

## Packet contract and decision sources

- Canonical contract: `intents/shuttlepub/contracts/emumet-post-relay/`, v1 revision 3.
- Approved plan: thread `thread-rd4012ty`, run `run-01m7yc2nagh0z7g2jh14g6qb8x`, final message `#28.0` (third edition), especially §3.2, §5.2, §5.4, §6.2-6.3, §6.6, §7, §8 S1, §9, §10.3 and §11.1.
- Approved design constraints: run `run-01m7yd22411cm1n36mybvg0xcv`, final message `#37.0`; apply DC-01/03/04/05/06/10/11/12/16/18/19.
- Parent intent references and the 30-day quarantine exception are listed in packet.yaml.

## Dependency boundary

- K1 issue #116 / merged PR #119 supplies instance identity and parsed signing-handle cache.
- L1 issue #117 / merged PR #120 owns lifecycle gates, common lock order, and all three unlink paths.
- Q1 issue #121 / PR #122 under review supplies durable queue claim/authorize/record/finish ports.
- S1 must rebase on current Emumet main and use actual merged dependency interfaces. Do not copy or reimplement those responsibilities. If dependencies are not merged/available, stop implementation rather than coding against guessed interfaces.
- S1 does not enable I1; inbox activation follows S1.

## Reviewer focus

1. The authorization commit is the send-start linearization point. Confirm there is one absolute deadline from database-authorized_at (10 seconds initially), bounded by received_at+72h for automatic and original quarantine expiry for human recovery. No timeout refresh after queueing, restart, retry, or lease reclaim.
2. Confirm no transaction/DB connection/row/advisory lock spans HTTP, and unlink/deactivation/projector never wait for an HTTP response. Evaluate races and stale results at P0–P4 for all 3 unlink paths and operator delivery.
3. Confirm exact retry classes, backoff/jitter/Retry-After bounds, no redirects, HTTPS/DNS pinning/SSRF rejection, and fair shared global/per-origin concurrency.
4. Confirm payload, secrets, auth/cookies, receiver body and arbitrary IDs do not enter logs/audits/metric labels; success/cancel has no per-delivery terminal rows.
5. Confirm operator commands run from release image, do not apply migrations, reject incompatible schema, use a distinct worker identity, and do not initialize Ory, listener, S3 or unrelated services.
6. Confirm sender-only stop keeps reception active and operational docs explain full-server/egress alternatives, unretractable authorized sends, and quota consumption during stop.
7. Confirm human redelivery preserves envelope/receipt/destination and original deadline; explicit discard is separate, audited, never capacity-triggered, and refuses if audit cannot be secured.
8. Confirm logical terminal expiry rules: timeout at received_at+72h; permanent failure at observed failing-attempt time; 30 days from that terminal time, never from delayed purge. Human retries never cross quarantine expiry.
9. Treat §7.3 values as targets, not facts. Inspect recorded environment/results and require a lead decision before I1 if target is missed.
10. Verify no P2, K2, inbox activation, ShuttlePub receiver, unrelated existing Profile-delivery policy changes, or contract revision slipped into the PR.

## Packet-versus-PR delta

The packet is the approved S1 scope. Any proposed change to send-start semantics, expiry, worker-stop behavior, operator identity/schema safeguards, recovery/discard semantics, or performance acceptance is a design delta requiring explicit lead approval before the implementation scope changes.

## Packet-time facet check

The actual `intent-cli intent facet-check --domain emumet --packet emumet-post-relay-delivery --format json` output is retained in `facet-check.json`. It reports `no_facet_data: false`, `coverage.scope_status: valid-non-empty`, but `coverage.gap: true` with `nodes: []`; the listed terms are unmatched. This is lexical scaffolding only, not semantic verification or a pass. Do not manufacture facet annotations to make it green; reviewers must assess semantic alignment against the named intent references.
