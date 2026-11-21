# Review Context — emumet-profile-inbox-relay

## Decision and source of truth

Review against the approved third-edition P1 plan and exact I1 constraints DC-01/02/04/07/08/16/19. The host contract `intents/shuttlepub/contracts/emumet-post-relay/v1.md`, revision 3, §8 and its inbox-reading fixtures are normative. Do not infer behavior from a stale Emumet docs snapshot or alter the contract in this unit.

## D63 is the critical routing rule

- No Activity-type allowlist.
- Follow and Block themselves are excluded from forwarding and retain existing relation handling.
- Undo, Accept and Reject are excluded only when every reference certainly identifies a stored or embedded Follow/Block.
- Unknown URL, absent object, empty array, or a mixed array containing an unknown reference forwards the whole body.
- Do not fetch an object URL to classify it. The early-Undo guard does not establish that a Follow was stored.
- A `type` array containing at least two recognized terms among Follow/Block/Undo/Accept/Reject is `400 ambiguous_relation`, with no relation mutation. Extension co-annotation alone does not reject or exclude.
- Preserve signer-to-actor verification, existing relation behavior and domain blocking; representation differences alone do not reject forwarding.

## Atomicity and data handling

Review the single-transaction boundary: receive record, any early-Undo guard, Q1 admission or body-free unlinked aggregate, and all reservation updates commit together; the handler returns 202 only afterward. `Duplicate` is not proof of relay admission. Fault injection must establish rollback and retry without losing a job. Raw Activity bytes, envelope bytes, receipt and destination are preserved; no Activity ID is fabricated. Unlinked intake retains no body or remote-selected identifiers.

Check the contract bounds and schema-compatible extracted values. All-depth duplicate keys, MIME handling, actor/type/ID forms, header-evidence omission and every inbox fixture need coverage. External JSON-LD contexts and object URLs are never fetched.

## Capacity, metrics and sequencing

Q1 owns shared PostgreSQL capacity/rate enforcement; I1 owns intake measurement. Check concurrent reservations and 429/503/5xx mapping. Performance results must identify linked/unlinked traffic, concentrated/distributed Profile load, shared quota/hour-bucket contention, environment and DB/connection/lock waits. The 100 requests/second plan target is not an unconditional SLO. S1's delivery results are a hard activation dependency: I1 must not merge or enable reception until S1 is merged, and if the target is missed the lead must decide first.

## Scope boundaries

This is Emumet-only, with additive migration `20261122000500`; no ShuttlePub production receiver, P2 generation/state validation, K2 rotation/revocation, Ory/Hydra change, new type allowlist, or existing Profile-delivery policy change. In particular, `ory/hydra/hydra.yml` remains outside the diff.

## Knowledge and documentation closeout

The packet requires host intent-tree writeback to existing `post-relay/decisions.md` and `acceptance.md`, plus actual I1 performance and activation decision. It plans to extend Emumet `docs/post-relay-operations.md`; if S1 lands operational content under a different real path, record that actual path in closeout evidence instead of claiming the planned path was changed. There is no new operator-facing surface; `guide_reachability.no_role_facing_surface` is explicitly true.
