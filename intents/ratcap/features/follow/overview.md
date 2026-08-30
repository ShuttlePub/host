---
---

# follow — overview

> 関連: [requirements.md](requirements.md) / [acceptance.md](acceptance.md) / [decisions.md](decisions.md) / [open-questions.md](open-questions.md) / [packets.md](packets.md)

## Goals

- ユーザーが自身のアカウントの **following / followers 一覧**を Ratcap 上で確認できるようにする(2026-08-11 スコープ変更: 新規フォローのフォームは提供しない)。
- 一覧から **unfollow** を実行できるようにする。
- 新規フォロー操作は ShuttlePub 本体サービス側の UI フローに委ね、Ratcap はアカウント管理(一覧・解除)に専念する。Emumet は ShuttlePub サービスのアカウント管理機能を提供するという定位に整合。

## 前提(バックエンド依存)

- Emumet に unfollow の REST エンドポイントが存在しない(2026-08-11 確認)。Emumet 側の `unfollow-api` packet(外向き Undo(Follow) 配送 + REST フォロー一覧)の完了が先行条件。`intents/emumet/packets/backlog.md` 参照。
- following/followers の取得は現状 ActivityPub collections (`/ap/accounts/{id}/followers` 等) のみ。BFF から利用しやすい REST 一覧を Emumet 側 packet で併せて提供する。

## Acceptance criteria summary

- `apps/emumet-web/bff/schema.graphql` に following/followers を取得する query と `unfollowAccount` mutation が追加される。
- `apps/emumet-web/bff/emumet/client.ts` の `EmumetClient` 契約に一覧取得と unfollow のメソッドが追加され、`real.ts` / `mock.ts` の両方が実装される。
- `apps/emumet-web/bff/resolvers.ts` に各リゾルバが実装され、未認証時は `UNAUTHENTICATED` を返す。
- PureScript 側で生成型を再生成後、`spago build` が成功する。
- アカウント詳細画面(または設定ハブ)に following / followers 一覧が表示される。
- 一覧の各項目に unfollow ボタンがあり、実行後に一覧へ即座に反映される。
- 新規フォローの入力フォームは UI に存在しない。
- `bun test`（apps/emumet-web 配下） の BFF テストに一覧取得・unfollow のテストが追加され全て通る。
