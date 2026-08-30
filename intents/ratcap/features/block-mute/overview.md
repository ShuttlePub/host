---
---

# block-mute — overview

> 関連: [requirements.md](requirements.md) / [acceptance.md](acceptance.md) / [decisions.md](decisions.md) / [open-questions.md](open-questions.md) / [packets.md](packets.md)

## Goals

- ユーザーが自分のアカウントから見た「ブロック」「ミュート」の対象を**一覧で確認・解除**できるようにする(2026-08-11 スコープ変更: 追加操作の UI は提供しない)。
- ブロック / ミュートの**追加**は ShuttlePub 本体サービス側の UI フロー(投稿・タイムライン等)から Emumet API を通じて行われ、Ratcap はアカウント管理(一覧・解除)に専念する。Emumet は ShuttlePub サービスのアカウント管理機能を提供するという定位に整合。
- BFF レイヤーに `unblockAccount` / `unmuteAccount` の GraphQL mutation と、`blocks` / `mutes` の query を追加し、Emumet のブロック / ミュート REST API を呼び出す。バックエンドは一覧・解除ともに実装済みで、Emumet 側の先行 packet は不要。

## Acceptance criteria summary

- `apps/emumet-web/bff/schema.graphql` に `Relation` 型と `unblockAccount` / `unmuteAccount` mutation、 `blocks` / `mutes` query が追加される。
- `apps/emumet-web/bff/emumet/client.ts` の `EmumetClient` 契約に `unblock` / `unmute` / `listBlocks` / `listMutes` メソッドが追加され、`real.ts` / `mock.ts` の両方が実装される。
- `apps/emumet-web/bff/resolvers.ts` に各リゾルバが実装され、未認証時は `UNAUTHENTICATED`、成功時は `Boolean` または `RelationConnection` を返す。
- PureScript 側で生成型を再生成後、`spago build` が成功する。
- ブロック / ミュート一覧(Settings 配下のセクション)が追加され、対象の識別子と種別を表示する。
- 一覧項目から解除でき、解除後は一覧へ即座に反映される。
- ブロック / ミュート**追加**の操作 UI は存在しない。
- `bun test`（apps/emumet-web 配下） の BFF テストにブロック / ミュートリゾルバのテストが追加され全て通る。

## Related

- [requirements.md](requirements.md)
- [acceptance.md](acceptance.md)
- [decisions.md](decisions.md)
- [open-questions.md](open-questions.md)
- [packets.md](packets.md)
