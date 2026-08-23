# isbot-editing — acceptance criteria

> See [overview.md](overview.md) for goals。2026-08-11 にスコープ変更(作成時設定のみ、編集 UI 廃止)。

## Criteria

- [x] AC1: `bff/schema.graphql` の `CreateAccountInput` に `isBot: Boolean` が追加され、SDL に構文エラーがない。(2026-08-24 検証)
- [x] AC2: `bun scripts/sync-graphql.ts` を実行後、`src/Generated/` 配下の PureScript 型が `isBot` を含むよう更新される。(2026-08-24 検証: `src/Generated/Schema/Gql.purs` 等に反映済み)
- [x] AC3: `bff/resolvers.ts` の `createAccount` が `input.isBot` を `POST /api/v1/accounts` の `is_bot` として送信する(省略時は `false`)。(2026-08-24 検証: `real.ts` の `is_bot: input.isBot ?? false`)
- [x] AC4: `bff/emumet/real.ts` / `mock.ts` の `createAccount` DTO に `isBot`(または `is_bot`)が追加され、mock 状態でも保存・読み出しできる。(2026-08-24 検証)
- [x] AC5: `src/App/Api/GraphQL/Types.purs` 等の App 側 DTO に `isBot` が追加される。(2026-08-24 検証)
- [x] AC6: `src/App/View/AccountNew.purs` の作成フォームに「bot アカウント」チェックボックスが表示される。(2026-08-24 検証: `SetNewAccountIsBot`)
- [x] AC7: 作成ボタン押下で GraphQL `createAccount` ミューテーションが `isBot` を含み、作成されたアカウントの詳細表示で bot フラグが確認できる。(2026-08-24 検証: 詳細画面の isBot バッジ表示を確認)
- [x] AC8: `src/App/View/AccountDetail.purs` の編集フォームに is_bot 変更 UI が**存在しない**ことを確認する(作成時のみ設定の方針)。(2026-08-24 検証: 表示バッジのみ)
- [x] AC9: `bun test` が全件成功する。(2026-08-24 検証: 51/51 pass)
- [x] AC10: `spago test` が全件成功する。(2026-08-24 検証: ビルド成功。PureScript テストスイートは現状空)
- [ ] AC11: 既存のアカウント作成フローの手動 Smoke テストを行い、リグレッションがないことを確認する。(未実施。実装は backlog 作成以前から main に存在し運用実績があるため、次回 UI 変更時の smoke に併せて実施で可とする)
