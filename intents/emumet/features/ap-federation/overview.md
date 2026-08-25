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
- E2E: Mock peer (S1-S6)、Iceshrimp / Mastodon 実機 (S7-S9 + Mastodon S10
  双方向 Undo(Follow)、issue #46 / PR #47 2026-08-20)
  — `compose.ap-e2e.yml`, `server/tests/e2e_ap_mastodon.rs`。
  実 Mastodon / Iceshrimp コンテナ相手に CI (`.github/workflows/e2e.yml` →
  `e2e/run-ap-e2e.sh`) で常時実行

## 残スコープ

- Create/Note 等の投稿系アクティビティ → [../post-relay/overview.md](../post-relay/overview.md)
- Actor の icon/image 反映 → [../media-upload/overview.md](../media-upload/overview.md)
- Block アクティビティ → [../block-mute/overview.md](../block-mute/overview.md)

## 2026-08-24 境界改訂に伴う注記(ADR 0002/0003 amended)

- **Followers / Following コレクションは Emumet 保持を継続する**。フォロワー関係の
  永続権威は Emumet(ADR 0002 の切替保護の対象)。Follow/Accept の承認 UI・ポリシーは
  ShuttlePub 側に置けるが、最終状態遷移は Emumet に記録する
- **既存 Outbox 実装の配布方式は変更になる**: 投稿コンテンツは ShuttlePub 保持に
  なったため、outbox は ShuttlePub への透過プロキシに移行する(検証済み: Misskey が
  異ホストコレクション URL をアクター文書ごと拒否するため直接記載は不可。
  コレクション文書の `id` は要求 URL と一致させること)
- AP actor は Profile 単位(1 Profile = 1 actor)。現行実装の account = actor モデルは
  段階移行の対象(ADR 0002 amended)
- 投稿系の初期公開範囲は **Public / Unlisted のみ**(operator 判断 2026-08-24。
  followers-only 等の限定公開と dereference 認証の設計は別途 ADR 化してから実装)

## Related

- [packets.md](packets.md)
- コード: `server/src/route/activitypub/`, `application/src/service/activitypub/`, `kernel/src/activitypub.rs`
