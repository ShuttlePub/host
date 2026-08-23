# isbot-editing — packets

> See [../../packets/](../../packets/) for domain-level packet list.

## Execution units

### Packet 1: 作成時 is_bot 設定(BFF + 型生成 + 作成フォーム) — 完了 (2026-08-24)

> **完了記録**: issue 未発行のまま実装済みであることを 2026-08-24 grill で確認。
> 実体は RatCap の初期 BFF コミット群(`79b745f` / `4b60abe`)に含まれ、backlog
> 起票(2026-08-11)以前から main に存在した。AC1-AC10 を 2026-08-24 に検証済み
> (bun test 51/51 pass、spago ビルド成功)。UI 受入の最終形は grill Q1 / D7 で確定
> (注意書きなしの裸チェックボックス)。AC11 (手動 smoke) は次回 UI 変更時に併せて実施。

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
