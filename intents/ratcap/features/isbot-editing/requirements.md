# isbot-editing — requirements

> See [overview.md](overview.md) for goals。2026-08-11 スコープ変更(D6: 作成時設定のみ、
> 編集 UI 廃止)に伴い全面改訂。旧版(UpdateProfileInput / 編集フォーム前提の FR1-FR7)は
> D6 で破棄済み。

## Functional requirements

- FR1: `bff/schema.graphql` の `CreateAccountInput` に `isBot: Boolean`(nullable)を追加する。
- FR2: `bff/resolvers.ts` の `createAccount` リゾルバーが `input.isBot` を Emumet
  `POST /api/v1/accounts` の `is_bot` へマッピングする(省略時は `false`)。
- FR3: `bff/emumet/client.ts` / `real.ts` / `mock.ts` の `createAccount` DTO に
  `isBot`(Emumet 向けは `is_bot`)を追加し、mock でも保存・読み出しできること。
- FR4: `bun scripts/sync-graphql.ts` で `src/Generated/` を再生成し、App 側 DTO に
  `isBot` が反映されること。
- FR5: `src/App/View/AccountNew.purs` の作成フォームに「bot アカウント」チェックボックスを
  追加し、作成ミューテーションへ含める。
- FR6: アカウント詳細の編集フォームには is_bot 変更 UI を追加しない(作成時のみ設定)。
  詳細画面では isBot バッジ表示のみ行う。
- FR7: 作成フォームのチェックボックスは裸のままとし、注意書き・確認ダイアログ等の
  追加 UI は設けない(2026-08-24 grill Q1 / D7)。

## Non-functional requirements

- NFR1: 既存のアカウント作成フロー(name 入力・作成後遷移)を壊さない。
- NFR2: 新規ページ追加やルーティング変更を行わない。
- NFR3: BFF 側テストに isBot 指定の作成ケースを含める。PureScript 側は現状
  テストスイートが空のためビルド成功をもって足す。
- NFR4: `dev` / `mock` / `release` 全モードでビルド可能であること。
- NFR5: 型変換は BFF の DTO 変換層(`isBot` ↔ `is_bot`)に一元化する(D2 継続)。
