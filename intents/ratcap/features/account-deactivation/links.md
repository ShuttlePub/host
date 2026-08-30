# account-deactivation — links

> [overview.md](overview.md) を参照。

## Reference links

### ソースファイル
- `apps/emumet-web/bff/schema.graphql` — GraphQL SDL（`deleteAccount` mutation 追加先）
- `apps/emumet-web/bff/emumet/client.ts` — `EmumetClient` 抽象インターフェース
- `apps/emumet-web/bff/emumet/real.ts` — REST 実装（`DELETE /api/v1/accounts/{id}` 呼び出し先）
- `apps/emumet-web/bff/emumet/mock.ts` — インメモリ mock 実装
- `apps/emumet-web/bff/resolvers.ts` — GraphQL リゾルバ
- `apps/emumet-web/bff/*.test.ts` — BFF テスト群
- `apps/emumet-web/src/Generated/` — `(cd apps/emumet-web && bun scripts/sync-graphql.ts)` による生成型
- `apps/emumet-web/src/App/Api/GraphQL.purs` — PureScript GraphQL クライアント
- `apps/emumet-web/src/App/Api/GraphQL/Types.purs` — App 側 DTO 型
- `apps/emumet-web/src/App/Model.purs` — Model / form 状態
- `apps/emumet-web/src/App/Message.purs` — Message ADT
- `apps/emumet-web/src/App/View/AccountDetail.purs` — アカウント詳細画面（危険領域追加先）
- `apps/emumet-web/src/Client/Update.purs` — クライアント update 関数
- `apps/emumet-web/src/Client/Navigation.purs` / `apps/emumet-web/src/Client/Navigation.js` — 遷移 FFI
- `apps/emumet-web/src/App/Route.purs` — ルーティング定義（`Home` 遷移用）

### Emumet バックエンドエンドポイント
- `DELETE /api/v1/accounts/{account_id}` — アカウント削除（OAuth2 Bearer、Owner only、204 No Content、カスケード削除）

### 関連 intent ドキュメント
- `intents/ratcap/features/settings-hub/` — 設定ハブから danger-zone へ導線を貼る場合に参照
- `intents/ratcap/features/follow/` — フォロー機能（アカウント削除時にフォロー関係も連動する場合）
