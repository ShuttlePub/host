# unfollow-api Review Context

Review that this slice moves operation toward the documented intent without widening scope.

## レビューの観点

このスライスは `intents/emumet/features/ap-federation/overview.md` の残スコープ
「unfollow REST API + REST フォロー一覧」(2026-08-11 追加)に対応し、Ratcap
`follow-management` の先行条件を解除するもの。以下を確認する:

- PR が issue 契約の 3 ルート(`POST .../unfollow`、`GET .../followers`、`GET .../following`)
  のみを実装し、スコープを広げていないこと(ページネーション、pending 取り下げ、
  follow 送信 API への変更が混入していないこと)。
- Undo 配送が `deliver_activity_to_inbox` を経由し、独自の署名/配送コードを
  持ち込んでいないこと。
- 配送失敗時に follow 行が残ること(ロールバック方針の対称性。AC 明記)。
- REST 一覧が承認済みフォローのみ返すこと(following が pending を含んでいないか)。
- `openapi.json` の再生成 diff が PR に含まれること。
- mock peer E2E で Undo が実際にリモート inbox に届き署名が有効であることの
  テスト証跡(CI または実行ログ)。

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

本パケットは knowledge maintenance を全て decline している(intent placement の
overview.md 更新と packets.md 追記は host-only の closeout タスクであり PR 外)。
`closeout_learning.write_back_required` は false。PR 側に write-back を要求しない。
packet 完了時にホスト側で `ap-federation/overview.md` の実装済みスコープ移動と
`packets.md` への issue リンク追記を行うことを closeout 時に確認する。
