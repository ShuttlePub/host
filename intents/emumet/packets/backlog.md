# emumet — packet backlog (2026-07-22 stack)

intent interview (../interview/2026-07-22-initial-shaping.md) と実装インベントリに基づく
順序付き backlog。packet 実体は `.intent-cli/issues/<unit>/`。

## Ready(切り出し可能)

| # | execution unit | 概要 | 依存 |
|---|---|---|---|
| 1 | `block-mute-federation` | Block アクティビティの連合送受信 + E2E(REST API の block-mute-core は完了: issue #16) | — |
| 2 | `moderation-role-assignment` | Admin/Moderator ロール割当管理 API | — |
| 3 | `moderation-account-report` | 通報(AccountReport)機能。Ratcap admin-moderation と横断設計 | 2 |
| 4 | `mastodon-e2e-undo-coverage` | Mastodon 実機 E2E に Undo(Follow) 相互運用シナリオを追加(unfollow-api の Undo 配送を実 Mastodon 相手に検証。S7-S9 は完成済み) (2026-08-12 C4 grill より) | — |

## 完了(2026-08-12 ドリフト解消で整理)

- `unfollow-api` — issue #20 / PR #21 マージ済み(2026-08-12)
- `mastodon-e2e-completion` — S7-S9 シナリオ完成、CI (e2e.yml → run-ap-e2e.sh) で
  実 Mastodon コンテナ相手に常時実行中。backlog 記述が stale だっただけで実体は達成済み

## Deferred(open question 解消が先)

| feature | ブロッカー |
|---|---|
| media-upload | ストレージバックエンド選定、配信ドメイン |
| post-relay | ShuttlePub への転送プロトコル、サービス間認証 |
| shuttlepub-link | 連携先との認証方式、ShuttlePub 本体側の実装状況 |

## Host-only(publish 対象外)

- docs 同期: ShuttlePub/document の data-structure.md が実装より古い
  (Moderation「未実装」記載、StellarAccount の再解釈)。Emumet issue ではなく
  document リポジトリ側で対応する。

## 運用メモ

- 一度に publish するのは先頭 1 件のみ(stack のデフォルト境界)。
- 各 packet 完了時に対応する features/*/packets.md へ issue リンクを追記する
  (各 packet の knowledge_updates.intent_tree 参照)。
