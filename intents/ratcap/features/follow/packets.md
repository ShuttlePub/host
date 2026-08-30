# follow — packets

> [../../packets/](../../packets/) に domain-level packet がある場合は参照。

> **READY (2026-08-24 更新)**: 先行条件だった Emumet `unfollow-api` (外向き Undo(Follow)
> REST API + REST フォロー一覧) は issue #20 / PR #21 で 2026-08-12 マージ済み。
> ブロッカー解消済み。

## Execution units

### Packet 1: BFF 一覧 query + unfollow mutation
- **対象ファイル**: `apps/emumet-web/bff/schema.graphql`, `apps/emumet-web/bff/emumet/client.ts`, `apps/emumet-web/bff/emumet/real.ts`, `apps/emumet-web/bff/emumet/mock.ts`, `apps/emumet-web/bff/resolvers.ts`
- **作業内容**:
  1. `apps/emumet-web/bff/schema.graphql` に following/followers 取得 query と `unfollowAccount` mutation を追加する。
  2. `apps/emumet-web/bff/emumet/client.ts` に一覧取得と unfollow のメソッドを追加する。
  3. `apps/emumet-web/bff/emumet/real.ts` で Emumet の REST フォロー一覧と unfollow エンドポイントを呼び出し、camelCase に変換する。
  4. `apps/emumet-web/bff/emumet/mock.ts` でフォロー関係をインメモリ保持し、一覧と unfollow を模擬する。
  5. `apps/emumet-web/bff/resolvers.ts` に各リゾルバを追加する。
  6. `apps/emumet-web/bff/*.test.ts` に成功/未認証/404/権限不足のテストを追加する。
- **完了条件**: `bun test`（apps/emumet-web 配下） が全て通る。

### Packet 2: PureScript 型再生成 + 一覧 UI + unfollow
- **対象ファイル**: `apps/emumet-web/src/Generated/**/*.purs`, `apps/emumet-web/src/App/Api/GraphQL.purs`, `apps/emumet-web/src/App/Api/GraphQL/Types.purs`, `apps/emumet-web/src/App/Model.purs`, `apps/emumet-web/src/App/Message.purs`, `apps/emumet-web/src/App/View/AccountDetail.purs`, `apps/emumet-web/src/Client/Update.purs`
- **作業内容**:
  1. `(cd apps/emumet-web && bun scripts/sync-graphql.ts)` を実行して生成型を更新する。
  2. `apps/emumet-web/src/App/Api/GraphQL.purs` に一覧取得と unfollow の関数を追加する。
  3. アカウント詳細画面に following / followers 一覧セクションを追加する。
  4. 一覧項目に unfollow ボタンを配置し、成功後に一覧を更新する。
  5. mock モードで手動検証する(一覧表示 → unfollow → 一覧更新)。
- **完了条件**: `spago build` / `spago test` が成功し、手動で一覧表示と unfollow が動作する。
