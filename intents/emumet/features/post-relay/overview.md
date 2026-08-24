---
facets: [invariant, vocabulary]
---

# post-relay — overview

## Goals

アカウントの住所(acct)を Emumet ドメインで提供しつつ、投稿コンテンツの送受信を
Emumet が中継する。分散思想(本体サービスは ShuttlePub)と ActivityPub 仕様
(住所=配送先)のバランスを取る中核機能。

2026-07-22 interview で確定し、2026-08-24 に外向きの責務分担を修正した方針:

- **外向き**: ShuttlePub が組み立てた投稿アクティビティ(Create/Note 等)の
  配送リクエストに、Emumet が保持する秘密鍵で代理署名する(内部署名 API)。
  **リモート inbox への配送自体は ShuttlePub が行う**(ADR 0003 amended)
- **内向き**: inbox で Create/Note 等を受信し、そのアカウントの連携先 ShuttlePub
  サーバーへ転送する(転送先は Stellar ではなく ShuttlePub 本体。features/shuttlepub-link 参照)

## Scope

- inbox の Create/Note(および Like/Announce/Delete/Update 等)ハンドラ
- 連携先 ShuttlePub サーバーへの転送機構
- 代理署名の提供(内部署名 API `POST /internal/v1/accounts/{id}/sign`)
- 署名時に「どの ShuttlePub 発のどの投稿アクティビティか」を記録し、
  actor の outbox(`GET /users/{id}/outbox`)として公開する機構
  (住所=配送先の関係で outbox の fetch は Emumet に来る。ADR 0003 amended)
- 配送(ファンアウト・送信・再送・配送状態の記録)は ShuttlePub 側の責務であり本 feature のスコープ外

## Acceptance criteria summary

- リモートからの Create/Note が連携先 ShuttlePub に転送される
- ShuttlePub 発の投稿が Emumet の署名付きで ShuttlePub からリモート inbox へ配送される(E2E で検証)
- 署名済みの投稿アクティビティが Emumet の outbox エンドポイントから fetch できる

## Related

- [requirements.md](requirements.md) / [open-questions.md](open-questions.md) / [packets.md](packets.md)
- [../shuttlepub-link/overview.md](../shuttlepub-link/overview.md) — 転送先の設定元
- 既存資産: `application/src/service/activitypub/delivery.rs`, `kernel/src/entity/activitypub/outbox_activity.rs`
- 決定記録: ../../decisions/0002-account-address-on-emumet-domain.md, 0003-delegated-signing.md
