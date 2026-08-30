# admin-moderation — open questions

> ドメイン全体の未解決問題は [../../clarifications/open.md](../../clarifications/open.md) を参照。

## Open questions blocking this feature

- ~~**admin role のフロントエンドへの伝達方法**~~ **(2026-07-28 方針決定 / 2026-07-30 解決)**
  - 決定: Emumet にセッションコンテキスト解決エンドポイントを新設し (正源 Keto)、BFF は TTL キャッシュで利用する。詳細は [decisions.md](decisions.md) を参照。
  - ~~**ブロッカー**: Emumet 側エンドポイントの実装完了待ち。~~ **解決**: `GET /api/v1/me` が Emumet に実装・マージされた (ShuttlePub/Emumet#18、ADR 0004)。これにより `apps/emumet-web/bff/context.ts` / `apps/emumet-web/bff/session.ts` / `apps/emumet-web/src/App/Api/Auth.purs` / `apps/emumet-web/src/App/Model.purs` への組み込みが unblocked。

- **Mock モードでの admin ロール割り当て**
  - mock 認証では username が自由な文字列のため、どの username を admin として扱うか未決定。
  - 候補 1: `admin` または `admin@example.com` 固定。
  - 候補 2: パスワード `password` + 任意の identifier 入力時に全員 admin 扱い（セキュリティリスクのため非推奨）。
  - 候補 3: mock ログイン時に「admin モード」フラグをリクエストボディで受け取る。
  - 影響ファイル: `apps/emumet-web/index.ts` の `handleMockAuth`、 `apps/emumet-web/src/App/View/Login.purs`。

- ~~**admin 管理 UI の配置場所**~~ **(2026-08-23 解決)**
  - ~~管理操作をアカウント詳細画面にインラインで配置するか、 `/admin` 以下の別ルート（例: `/admin/accounts/{id}`）に分離するか未決定。~~
  - ~~インライン配置の場合: 既存 `AccountDetail` View の複雑化が懸念。~~
  - ~~別ルートの場合: `Route.purs`、 `PageModel`、 `mkUpdate` のルーティング対応が増加する。~~
  - **決定**: `/admin` ルートを新設し管理機能を集約する (`/admin/reports` キュー + 詳細、停止/BAN 操作も移動)。通報(AccountReport)統合設計の横断 grill (2026-08-23) で確定。詳細は [decisions.md](decisions.md) を参照。

- **BAN 済みアカウントの閲覧制限**
  - BAN 済みアカウントの詳細画面を admin 以外が閲覧できるようにするか、どのような表示制限を設けるか未決定。
  - 現時点では Emumet 側の `GET /api/v1/accounts/{id}` レスポンスに `moderation` フィールドが含まれるため、フロントエンド側でバッジ表示のみ行う。