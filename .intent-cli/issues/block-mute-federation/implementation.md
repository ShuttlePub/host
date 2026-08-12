# block-mute-federation Implementation Packet

## Goal

block-mute-core (issue #16 / PR #17) で完成したローカルのブロック/ミュート基盤に
ActivityPub 連合を接続する。ローカル → リモートへのブロック/解除を署名付き
Block / Undo(Block) アクティビティとして相手 inbox へ配送し、逆に inbox で受信した
Block / Undo(Block) をローカルの block 状態とフォロー関係へ反映する。
合わせて mock peer / Iceshrimp E2E にブロック連合シナリオを追加する。

## Why

feature block-mute の残スコープが連合部分のみであり、backlog 先頭の execution unit
として切り出し可能な状態。ローカル側のブロック成立ロジック (エンティティ、
Repository、REST API、双方向フォロー解除) は実装済みで、欠けているのは
アクティビティの送受信のみ。packet 作成時に確定させる事項だった 2 点は
本 packet で以下の通り確定する:

- Mute は連合に通知しない (ローカルのみ)。acceptance 基準とも一致
- Block は Follow と同様の純粋 CRUD を継続 (Event Sourcing 対象にしない)

## Scope

- 外向き Block 配送: block_account で destination が remote の場合、署名付き Block
  アクティビティを相手 inbox へ配送し outbox に記録する
  (outbound_unfollow.rs のパターンに倣う)
- 外向き Undo(Block) 配送: unblock_account で destination が remote の場合、
  署名付き Undo(Block) を配送し outbox に記録する
- inbox の Block ハンドラ: remote→local の block 作成と remove_follows_between
  による双方向フォロー解除への反映
- inbox の Undo(Block) ハンドラ: 該当 block の削除
- inbox/mod.rs の type_ dispatch への "Block" / "Undo" (object が Block) 分岐追加
- mock peer E2E (server/tests/e2e_ap_mock.rs) と Iceshrimp E2E
  (server/tests/e2e_ap_iceshrimp.rs) へのブロック連合シナリオ追加

## Out of scope

- Mute の連合 (通知しない。ローカルのみで確定)
- ブロック成立時の Reject(Follow) 送信 (requirements の「必要に応じて」に該当。
  相互運用の実害が出た時点で別 packet 化を検討)
- ブロック/ミュートに基づく投稿・タイムラインのフィルタリング (別論点)
- リモートアクター解決のキャッシュ戦略変更 (既存 remote_actor.rs を流用)

## Verification

- mock peer E2E: ブロックで署名付き Block が mock inbox に届くこと、解除で
  Undo(Block) が届くこと
- inbox 受信テスト: Block 受信で block 作成 + フォロー解除、Undo(Block) 受信で
  block 削除 (既存 inbox ハンドラのテストパターンに倣う)
- Iceshrimp E2E: 実リモート実装とのブロック相互運用シナリオ
- `git diff --check`

## Knowledge Maintenance (G461, optional)

Captured while the design context is fresh. Answer or explicitly decline:

- Intent placement: intents/emumet/features/block-mute/overview.md (新規ノード不要)
- ADR candidate: なし (Mute 非連合・Block 純粋 CRUD 継続は feature スコープのため
  features/block-mute/decisions.md に記録。cross-domain ADR は不要)
- Diagram candidate: なし
- Docs update: なし (document リポジトリ同期は Host-only backlog 項目)
- Closeout learning: Iceshrimp とのブロック相互運用で得た知見
  (write_back_required: false)

- Guide reachability (G645): `no_role_facing_surface: true` を宣言済み。
  REST API (block-mute-core) と inbox エンドポイントは既存であり、本 slice が
  追加するのはその背後の連合振る舞いのみで、新規の role-facing surface はない。

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
