# isbot-editing — packets

> See [../../packets/](../../packets/) for domain-level packet list.

## Execution units

### Packet 1: 作成時 is_bot 設定(BFF + 型生成 + 作成フォーム)

- 内容
  - `bff/schema.graphql` の `CreateAccountInput` に `isBot: Boolean` を追加する。
  - `bff/resolvers.ts` の `createAccount` リゾルバーで `isBot` を `is_bot` にマッピングして Emumet へ送信する(省略時 `false`)。
  - `bff/emumet/client.ts` / `real.ts` / `mock.ts` の `createAccount` DTO に `isBot`(または `is_bot`)を追加する。
  - `bun scripts/sync-graphql.ts` を実行し、`src/Generated/` 配下を更新する。
  - `src/App/Api/GraphQL.purs` / `src/App/Api/GraphQL/Types.purs` の作成系 DTO に `isBot` を含める。
  - `src/App/View/AccountNew.purs` の作成フォームに「bot アカウント」チェックボックスを追加する。
  - BFF テストに `isBot` 指定の作成ケースを追加する。
- 完了条件
  - `bun test` / `spago build` / `spago test` が成功する。
  - mock モードで bot フラグ付きアカウント作成が動作する。
- 推定規模:小(2026-08-11 のスコープ変更で編集 UI が不要になり 1 packet に集約)
