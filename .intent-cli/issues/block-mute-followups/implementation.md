# block-mute-followups Implementation Packet

## Goal

PR #23 (block-mute-federation) のレビュー観測事項 (features/block-mute/decisions.md
2026-08-13、非 blocking) 3 件を消化するテスト強化スライス。重複 Block 配送の
no-op 性を実 DB テストで固定し、inbox Block/Undo(Block) ハンドラのエラーパス
単体テストを拡充し、Iceshrimp E2E S10 に Undo(Block) の相手側観測ポーリング
assert を追加する。本番コードの挙動変更は行わない。

## Why

Block 連合の実装は PR #23 + Stage 9 re-apply (PR #42) で完了したが、レビューで
挙がった観測事項が未消化のまま decisions.md に残っている。特に重複 Block 配送時の
no-op 性は「tx 内 INSERT 失敗 → tx abort → commit-as-rollback」に依存する繊細な
設計 (handlers.rs:290-301) で、テストによる固定がないと将来のリファクタで壊れやすい。
E2E も unblock の 204 (配送成功) までしか見ておらず、相手側が Undo(Block) を
処理したことの相互運用保証が欠けている。

## Scope

- 重複 Block no-op の実 Postgres 統合テスト: 同一 Block アクティビティを 2 回
  配送し、2 回目も handler が Ok を返すこと、follow 再解除が再実行されないこと
  (first-delivery ガード、handlers.rs:293 の `if inserted` を固定)
- inbox Block/Undo(Block) エラーパス単体テスト (collections.rs の MockModule
  パターンに倣う):
  - 他人 inbox 宛 (ensure_local_actor_matches による拒否)
  - Block object が actor id でない → Rejected
  - Undo object が Block アクティビティでない → Rejected
  - unknown remote actor (Undo(Block) で find_by_url が None → Ok early return)
- Iceshrimp E2E S10 (server/tests/e2e_ap_iceshrimp.rs:295-342) に unblock 後の
  相手側観測ポーリング assert を追加: Iceshrimp 側で Block 状態が解消されたことを
  外部観測 (support/iceshrimp.rs に wait_for_* 系ポーリング helper を追加。
  Mastodon E2E PR #47 の wait_for_mastodon_followers_absent 等が先例)

## Out of scope

- 再フォロー防止機構 (decisions.md の前提注記「再フォロー防止機構ができるまでは
  実害なし」。別設計)
- outbound Block/Undo(Block) 側の変更
- 本番コードの挙動変更 (テストと観測の強化のみ。テスト追加に伴う最小限の
  可視性調整は許容)

## Verification

- `cargo test` (unit + integration) がグリーン
- `bash e2e/run-ap-e2e.sh` (Iceshrimp S10 含む、CI e2e.yml 相当) がグリーン
- `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: intents/emumet/features/block-mute/decisions.md (新規ノード不要)
- ADR candidate: なし
- Diagram candidate: なし
- Docs update: なし
- Closeout learning: なし (write_back_required: false)。decisions.md の
  フォローアップ候補 3 件を消化済みと更新する (knowledge_updates.intent_tree)

- Guide reachability (G645): テストのみのスライスのため
  `no_role_facing_surface: true` (mastodon-e2e-undo-coverage の先例に倣う)

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
