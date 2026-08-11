# follow — acceptance criteria

> [overview.md](overview.md) を参照。2026-08-11 にスコープ変更(フォローフォーム廃止、一覧 + unfollow に特化)。
> **BLOCKED**: Emumet 側 `unfollow-api` packet の完了が先行条件。

## Criteria

- [ ] `bff/schema.graphql` に following/followers を取得する query(例: `following(accountId: ID!): FollowConnection!`, `followers(accountId: ID!): FollowConnection!`)と `unfollowAccount(accountId: ID!, target: String!): Boolean!` mutation が追加されている。
- [ ] `bff/emumet/client.ts` の `EmumetClient` に一覧取得と unfollow のメソッドが追加されている。
- [ ] `bff/emumet/real.ts` が Emumet の REST フォロー一覧と unfollow エンドポイントを呼び出し、snake_case ↔ camelCase 変換を行う。
- [ ] `bff/emumet/mock.ts` がフォロー関係をインメモリで保持し、一覧取得と unfollow を模擬できる。
- [ ] `bff/resolvers.ts` の各リゾルバが未認証時に `extensions.code: UNAUTHENTICATED` を返す。
- [ ] `bun test` に一覧取得と unfollow のテストが追加され全て通る(既存テストも含めて 0 失敗)。
- [ ] `bun scripts/sync-graphql.ts` 実行後、`spago build` が成功する。
- [ ] アカウント詳細画面に following / followers 一覧が表示される。
- [ ] 一覧項目の unfollow ボタンで解除でき、一覧へ即座に反映される。
- [ ] 新規フォローの入力フォームが UI に**存在しない**ことを確認する。
- [ ] `spago test` が全件成功する。
