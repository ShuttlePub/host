---
facets: [invariant, vocabulary]
---

# post-relay — overview

## Goals

アカウントの住所(acct)を Emumet ドメインで提供しつつ、投稿コンテンツの送受信を
Emumet が中継する。分散思想(本体サービスは ShuttlePub)と ActivityPub 仕様
(住所=配送先)のバランスを取る中核機能。

2026-07-22 interview で確定し、2026-08-24 に二度修正した方針(最新は ADR 0003 2回目 amend。
「Emumet は Google Workspace 的なアカウント基盤とし、AP 責務は最大限 ShuttlePub に寄せる」
operator vision に基づく薄型境界):

- **外向き**: ShuttlePub が組み立てた投稿アクティビティ(Create/Note 等)の
  配送リクエストに、Emumet が保持する秘密鍵で代理署名する(内部署名 API)。
  **リモート inbox への配送自体は ShuttlePub が行う**
- **内向き**: inbox で Create/Note 等を受信し、その Profile の連携先 ShuttlePub
  サーバーへ転送する(転送先は Stellar ではなく ShuttlePub 本体。features/shuttlepub-link 参照)
- **配布**: 投稿コンテンツは Emumet に保存しない。Emumet ドメインの object/outbox URL
  への GET は、発行元 ShuttlePub への透過リバースプロキシで応答する

## Scope

- inbox の Create/Note(および Like/Announce/Delete/Update 等)ハンドラ
- 連携先 ShuttlePub サーバーへの転送機構(冪等性を担保する転送 envelope。durable queue あり)
- 代理署名の提供(内部署名 API。狭い API 形・link capability 認可。ADR 0003 参照)
- Emumet ドメイン object URL の透過プロキシ配布(document `id` 完全一致・
  `attributedTo` 検証・upstream リダイレクト拒否)
- outbox のプロキシ配布(コレクション URL のホスト制約は検証済み: Misskey が異ホスト
  コレクションをアクターごと拒否するため ShuttlePub 直貼りは不可。ADR 0003 参照)
- deletion marker(署名した Delete の `object_id` 等)の保持と Tombstone/410 応答
- 配送(ファンアウト・送信・再送・配送状態の記録)および投稿コンテンツの保存は
  ShuttlePub 側の責務であり本 feature のスコープ外

## Acceptance criteria summary

- リモートからの Create/Note が連携先 ShuttlePub に転送される(冪等 envelope で)
- ShuttlePub 発の投稿が Emumet の署名付きで ShuttlePub からリモート inbox へ配送される(E2E で検証)
- 発行済み object の Emumet ドメイン URL に対し、プロキシ経由で document が返る
  (Misskey strict 相当: request URL == document `id`、同一ホスト)
- Delete 署名済み object の URL が Tombstone/410 を返す(upstream の応答より優先)

## Related

- [requirements.md](requirements.md) / [open-questions.md](open-questions.md) / [packets.md](packets.md)
- [../shuttlepub-link/overview.md](../shuttlepub-link/overview.md) — 転送先の設定元
- 既存資産: `application/src/service/activitypub/delivery.rs`(外向き配送は ShuttlePub 責務に移るため転用可否を再評価)、`kernel/src/entity/activitypub/outbox_activity.rs`(Emumet の投稿保持は撤回されたため deletion marker 用途への転用可否を再評価)
- 決定記録: ../../decisions/0002-account-address-on-emumet-domain.md, 0003-delegated-signing.md
