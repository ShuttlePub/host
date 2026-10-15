# ap-federation — packets

> See [../../packets/](../../packets/) for domain-level packet list.

## Execution units

1. `unfollow-api` — 外向き unfollow REST API(Undo(Follow) 配送) + REST followers/following 一覧
   ✅ issue [#20](https://github.com/ShuttlePub/Emumet/issues/20) / PR [#21](https://github.com/ShuttlePub/Emumet/pull/21)
   (2026-08-12 merge、packet: `.intent-cli/issues/unfollow-api/`)
2. `mastodon-e2e-completion` — Mastodon 連携 E2E テストの完成
   (packet: `.intent-cli/issues/mastodon-e2e-completion/`)

## 関連 packet(他 feature 管轄)

- `block-mute-federation` — Block アクティビティ連合([../block-mute/packets.md](../block-mute/packets.md))
- 投稿系アクティビティ(Create/Note 等)の送受信・転送は post-relay feature 側で
  open question 解消後にパケット化予定

## 受領した契約拡張候補 (2026-10-15、queue未登録)

- [D06](../../../shuttlepub/packets/candidates.md#d06): remote actor・関係情報の取得と自分の
  アカウントでのFollow導線。既存follow一覧/APIを前提に、取得範囲を調査する。
- [D09](../../../shuttlepub/packets/candidates.md#d09): remote emoji reaction互換性。
  投稿・reactionの主担当はShuttlePub。Emumet変更は必要な契約差分が判明した場合のみ。
- [D14](../../../shuttlepub/packets/candidates.md#d14): サーバー横断モデレーション証拠の
  検証方式を調査。IPハッシュの連合公開を実装仕様にしない。
