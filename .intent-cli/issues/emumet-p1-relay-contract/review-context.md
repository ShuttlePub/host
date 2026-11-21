# emumet-p1-relay-contract Review Context

Review that this slice moves operation toward the documented intent without widening scope.

Flag findings if the implementation:

- widens scope beyond the issue contract;
- launches AI providers from `intent-cli`;
- mutates GitHub or parent state when the issue is read-only;
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
captured as a follow-up packet. If the packet declined all knowledge maintenance,
that is acceptable — note it rather than blocking.

## Packet-specific review points (C0)

- 写しが host の `cc19ad0887409601999e66b3f00fb8d0735ebfc3` の契約とバイト一致していること (`post-relay-v1.snapshot.json` の checksum と、host の checkout との `cmp`)。Emumet 側で契約の内容が編集されていないこと。
- 変更が `docs/contracts/`・`server/tests/post_relay_contract.rs`・`server/Cargo.toml` (dev-dependency の追加だけ)・`Cargo.lock` に限られ、実装コード・OpenAPI・workflow・`ory/hydra/hydra.yml` に差分がないこと。
- P1 の fixture が link 台帳に依存せず、古い generation の拒否を含まないこと。P2 の fixture が `p2/` に事前状態付きで分離されていること。約 33 日前の `received_at` の正常例があること。
- fixture に秘密鍵が含まれないこと。テストが DB・ネットワークを使わず、skip されないこと。
