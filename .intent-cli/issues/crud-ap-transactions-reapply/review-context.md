# crud-ap-transactions-reapply Review Context

Review that this slice moves operation toward the documented intent without widening scope.

**This is a recovery packet.** Stage 5 (issue #32 / PR #33) was closed out while its
PR was still draft; the code never landed in main. This packet re-applies Stage 5's
intent on current main (post Stage 6/7/8). Verify:

- The implementation targets **current main's structure** (route facades, consolidated
  DI, no adapter crate, ES Profile/Metadata, CRUD AuthAccount) — not the old branch's
  structure. Cherry-picks or verbatim ports from `claude/crud-ap-transactions-stage5`
  that fight the current architecture are a finding.
- The delivery-before-write ordering in `block.rs` is actually inverted: AP delivery
  HTTP must happen only after the UoW commit succeeds.
- The ADR 0006 "Stage 5 確定" sections are **design input**, not evidence of landed
  code. Discrepancies between those recorded values and what this PR implements must
  be explained in the PR (the re-implementation may legitimately differ where
  Stage 6-8 changed the ground).

Flag findings if the implementation:

- widens scope beyond the issue contract (outbound Follow/Undo(Follow) tx 化、
  Reject(Follow) 送信、delivery worker 常駐化はすべて Out of scope);
- launches AI providers from `intent-cli`;
- mutates GitHub or parent state when the issue is read-only;
- touches host-side state (`intents/**`, `.intent-cli/**`) — ADR correction and
  Stage 9 writeback are host-side work;
- skips required contract sections.

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
captured as a follow-up packet. For this packet the ADR writeback is **host-side**
(host records Stage 9 確定値 at closeout); the child PR itself should not carry
`intents/**` changes. Note that rather than blocking.
