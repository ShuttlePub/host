# emumet — packet backlog (2026-07-22 stack)

intent interview (../interview/2026-07-22-initial-shaping.md) と実装インベントリに基づく
順序付き backlog。packet 実体は `.intent-cli/issues/<unit>/`。

## Ready(切り出し可能)

| # | execution unit | 概要 | 依存 |
|---|---|---|---|
| 1 | `moderation-role-assignment` | Admin/Moderator ロール割当管理 API | — |
| 2 | `moderation-account-report` | 通報(AccountReport)機能。Ratcap admin-moderation と横断設計 | 1 |
| 3 | `mastodon-e2e-undo-coverage` | Mastodon 実機 E2E に Undo(Follow) 相互運用シナリオを追加(unfollow-api の Undo 配送を実 Mastodon 相手に検証。S7-S9 は完成済み) (2026-08-12 C4 grill より) | — |
| 4 | `media-upload` | 画像アップロード API + S3 互換ストレージ (開発: RustFS) + Actor icon/image 反映 + Update 配送 (2026-08-12 C1 grill でブロッカー解消、packet draft 済み) | — |

## 完了

- `block-mute-federation` — issue #22 / PR #23 マージ済み(2026-08-13)。
  block-mute feature の acceptance 全項目達成。レビュー観測のフォローアップ候補
  (重複 Block 時の follow 再解除・inbox エラーパス単体テスト拡充・S10 の Undo 受信検証) は
  [../features/block-mute/decisions.md](../features/block-mute/decisions.md) に記録
- `unfollow-api` — issue #20 / PR #21 マージ済み(2026-08-12)
- `mastodon-e2e-completion` — S7-S9 シナリオ完成、CI (e2e.yml → run-ap-e2e.sh) で
  実 Mastodon コンテナ相手に常時実行中。backlog 記述が stale だっただけで実体は達成済み

## Deferred(open question 解消が先)

| feature | ブロッカー |
|---|---|
| post-relay | ShuttlePub への転送プロトコル、サービス間認証。**再開条件: ShuttlePub 本体実装の構想が立つこと** (2026-08-12 grill) |
| shuttlepub-link | 連携先との認証方式、ShuttlePub 本体側の実装状況。**再開条件: 同上 (C2 と同時)** (2026-08-12 grill) |

## Host-only(publish 対象外)

- docs 同期: ShuttlePub/document の data-structure.md が実装より古い
  (Moderation「未実装」記載、StellarAccount の再解釈)。Emumet issue ではなく
  document リポジトリ側で対応する。

## 運用メモ

- 一度に publish するのは先頭 1 件のみ(stack のデフォルト境界)。
- 各 packet 完了時に対応する features/*/packets.md へ issue リンクを追記する
  (各 packet の knowledge_updates.intent_tree 参照)。
