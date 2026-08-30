# account-deactivation — packets

> [../../packets/](../../packets/) に domain-level packet がある場合は参照。

## Execution units

### Packet 1: BFF GraphQL + EmumetClient 拡張
- **対象ファイル**: `apps/emumet-web/bff/schema.graphql`, `apps/emumet-web/bff/emumet/client.ts`, `apps/emumet-web/bff/emumet/real.ts`, `apps/emumet-web/bff/emumet/mock.ts`, `apps/emumet-web/bff/resolvers.ts`
- **作業内容**:
  1. `apps/emumet-web/bff/schema.graphql` に `deleteAccount(id: ID!): Boolean!` を追加する。
  2. `apps/emumet-web/bff/emumet/client.ts` の `EmumetClient` に `deleteAccount(id: string): Promise<void>` を追加する。
  3. `apps/emumet-web/bff/emumet/real.ts` で `DELETE /api/v1/accounts/{id}` を呼び出す実装を追加する（Bearer 付与、204 ハンドリング）。
  4. `apps/emumet-web/bff/emumet/mock.ts` で対象アカウントと紐づく profile / metadata を削除する実装を追加する。
  5. `apps/emumet-web/bff/resolvers.ts` に `Mutation.deleteAccount` を追加する。
  6. `apps/emumet-web/bff/*.test.ts` に成功/未認証/404/所有権違反のテストを追加する。
- **完了条件**: `bun test`（apps/emumet-web 配下） が全て通る。

### Packet 2: PureScript 型再生成 + フロントエンド API 呼び出し
- **対象ファイル**: `apps/emumet-web/src/Generated/**/*.purs`, `apps/emumet-web/src/App/Api/GraphQL.purs`, `apps/emumet-web/src/App/Api/GraphQL/Types.purs`
- **作業内容**:
  1. `(cd apps/emumet-web && bun scripts/sync-graphql.ts)` を実行して生成型を更新する。
  2. `apps/emumet-web/src/App/Api/GraphQL.purs` に `deleteAccount :: String -> Aff (Either ApiError Boolean)` を追加する。
  3. 必要に応じて `apps/emumet-web/src/App/Api/GraphQL/Types.purs` に結果型を追加する（Boolean なのでそのままでも可）。
  4. `spago build` でコンパイルエラーを解消する。
- **完了条件**: `spago build` が成功する。

### Packet 3: UI 危険領域 + 確認ダイアログ + 遷移
- **対象ファイル**: `apps/emumet-web/src/App/Model.purs`, `apps/emumet-web/src/App/Message.purs`, `apps/emumet-web/src/App/View/AccountDetail.purs`, `apps/emumet-web/src/Client/Update.purs`（または `Client.purs` / 全体 Update）
- **作業内容**:
  1. `apps/emumet-web/src/App/Message.purs` に削除関連メッセージを追加する。
  2. `apps/emumet-web/src/App/Model.purs` に確認ダイアログ状態を追加する。
  3. `apps/emumet-web/src/App/View/AccountDetail.purs` に危険領域セクションと確認ダイアログを追加する。
  4. `Client/Update.purs`（または一元 Update ファイル）に削除 mutation 実行と成功後 `Navigate Home` + `FetchAccounts` 発行の処理を追加する。
  5. 実装したフローを手動で検証する（mock モードでアカウント作成 → 削除 → 一覧遷移）。
- **完了条件**: 手動でアカウントを削除し、一覧画面へ遷移できる。
