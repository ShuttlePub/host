---
facets: [invariant]
---

# ap-federation — overview

## Goals

ActivityPub 連合との相互運用を提供する。**基盤は実装済み**で、残りは投稿系
アクティビティと Actor プロフィールの反映(post-relay / media-upload と連携)。

## 実装済みスコープ

- WebFinger(`/.well-known/webfinger`)、Actor ドキュメント(Person + publicKey)
- Inbox(Follow / Accept / Undo(Follow) のみ)・ Outbox(カーソルページネーション)
- Followers / Following コレクション
- Follow の外向き配送(署名付き)・リモート Actor 解決キャッシュ
- HTTP Signature(Cavage 検証 / Cavage+RFC9421 署名)・ SSRF 対策
- 外向き unfollow REST API(Undo(Follow) 配送、ローカル相手は削除のみ) +
  REST followers/following 一覧(承認済みのみ) — issue #20 / PR #21 (2026-08-12)
- E2E: Mock peer (S1-S6)、Iceshrimp / Mastodon 実機 (S7-S9)
  — `compose.ap-e2e.yml`, `server/tests/e2e_ap_mastodon.rs`。
  実 Mastodon / Iceshrimp コンテナ相手に CI (`.github/workflows/e2e.yml` →
  `e2e/run-ap-e2e.sh`) で常時実行

## 残スコープ

- Create/Note 等の投稿系アクティビティ → [../post-relay/overview.md](../post-relay/overview.md)
- Actor の icon/image 反映 → [../media-upload/overview.md](../media-upload/overview.md)
- Block アクティビティ → [../block-mute/overview.md](../block-mute/overview.md)
- Mastodon 実機 E2E の Undo(Follow) カバレッジ追加(packet:
  `mastodon-e2e-undo-coverage`、../../packets/backlog.md)

## Related

- [packets.md](packets.md)
- コード: `server/src/route/activitypub/`, `application/src/service/activitypub/`, `kernel/src/activitypub.rs`
