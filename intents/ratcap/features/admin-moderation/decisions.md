# admin-moderation — design decisions

> 目的は [overview.md](overview.md) を参照。ドメイン横断の ADR は [../../decisions/](../../decisions/) を参照。

## Decisions

- **GraphQL スキーマの再利用**
  - `Account.moderation` フィールドと `Moderation` / `ModerationType` 型は既存の `bff/schema.graphql` のものをそのまま利用する。
  - 新規追加は `suspendAccount` / `unsuspendAccount` / `banAccount` の 3 mutation のみとする。

- **BFF 認可設計**
  - admin 判定は BFF コンテキストで行う。 `GraphQLContext` に `isAdmin: boolean` のようなフラグを追加するか、 `SessionInfo` 相当の情報を context に注入する。
  - リゾルバは `requireAdmin(context)` ヘルパーを呼び出し、非 admin 時は `GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } })` を投げる。
  - Mock モードでは固定の admin ユーザー名（例: `admin@example.com`）または特定の username を admin として扱う。実装時に `open-questions.md` の解決に従う。

- **ロール解決の正源 (2026-07-28 方針決定 / 2026-07-30 Emumet 側実装完了)**
  - ロール / 権限の正源は Keto とし、 **Emumet にセッションコンテキスト解決エンドポイントを新設** する。Ratcap が権限モデルを二重に持たない分離とする。
  - **Emumet 側実装完了** (ShuttlePub/Emumet#18 マージ、ADR 0004)。エンドポイント契約:
    - `GET /api/v1/me` → `200 { "account_id": "<AuthAccountId>", "instance_roles": ["admin" | "moderator"] }`
    - ロールなしは `200` + `instance_roles: []` (403 ではない)。Keto 障害は `503` (空配列へのフォールバックなし)。未認証は `401`。
    - roles は Keto relation の direct 結果であり、 admin が moderator を暗黙に含まない。
    - `account_id` は `AuthAccountId` (1 auth identity が複数 Account に紐づきうるため AccountId ではない)。
  - Ratcap (BFF) 側は同エンドポイントの結果を **TTL キャッシュ** する。管理操作は低頻度のため短めの TTL (30〜60 秒程度) を想定。セッション確立時に呼び出し、 403 受信時に再取得する運用 (Emumet 側の想定運用に一致)。
  - ~~本 feature は Emumet 側エンドポイントの実装完了まで blocked。~~ **unblocked 済み。** BFF context への組み込みと `SessionInfo` への admin フラグ露出を実施可能。

- **EmumetClient 契約**
  - `suspendAccount(id, reason, expiresAt)` は `expiresAt` を ISO 8601 文字列または `null` で受け取り、 `POST /api/v1/admin/accounts/{id}/suspend` の body `{ reason, expires_at }` に変換する。
  - `unsuspendAccount(id)` と `banAccount(id, reason)` は 204 成功を期待する。

- **UI 配置方針（初期）**
  - 管理操作はアカウント詳細画面 (`src/App/View/AccountDetail.purs`) に「Admin」セクションとして配置する。
  - 別途 `/admin` ルートを作るかどうかは [open-questions.md](open-questions.md) の解決後に決定する。

- **状態反映方式**
  - 管理 mutation 成功後は `FetchAccountDetail` を発行して詳細を再フェッチし、 `Account.moderation` の更新を反映する。
  - 停止解除成功後は `moderation` が `null` になり、バッジが非表示になる。

- **確認ダイアログ**
  - BAN 操作は確認モーダル内でアカウント名 (`@name`) を入力させ、一致する場合のみ `BanAccount` Message を発行する。
  - 停止操作は理由入力のみ必須とし、期限は任意の datetime-local 入力とする。
  - 停止解除はボタン単発で実行するが、理由入力欄が空でない場合は確認メッセージを表示する（簡易ガード）。

- **実施順位と通報機能との統合設計 (2026-08-11 オペレーター決定)**
  - 本 feature の実施は slice 順序の**最後**とする。外部からの通報(AccountReport)機能と合わせて設計を詰めてから実施する。
  - 通報機能は Emumet 側 backlog に `moderation-account-report` packet として存在する(`intents/emumet/packets/backlog.md`)。モデレーション設計時に Emumet/Ratcap 横断で扱う。
- **通報(AccountReport)統合設計の確定 (2026-08-23 横断 grill)**
  - Emumet `moderation-account-report` との横断 grill が完了し、設計が確定した
    (Emumet 側記録: `intents/emumet/features/moderation/decisions.md` D4、
    interview `intents/emumet/interview/2026-08-23-moderation-account-report-grill.md`)。
  - **管理 UI は /admin ルート新設に集約する** (open-questions.md の「admin UI 配置」は
    これで決着)。`/admin/reports` (未対応キュー一覧) + `/admin/reports/{id}`
    (詳細・resolve/dismiss・対象アカウントへの suspend/ban 導線) を設け、
    停止/BAN 操作もアカウント詳細の Admin セクションから /admin へ移す。
  - 通報作成導線は一般ユーザー向けにアカウント詳細画面の「通報する」ボタン +
    カテゴリ選択 (spam/harassment/other) / コメントフォーム。
  - ナビゲーションの Admin メニューに未対応件数バッジを表示するため、
    BFF GraphQL に openReportCount 相当の件数クエリを追加する。
  - 通報ハンドリングの認可は Emumet の instance_moderate (Admin+Moderator) に従う。
    BFF は GET /api/v1/me の instance_roles (admin または moderator) で UI を出し分ける。
  - **実装順序**: Emumet の通報 API マージ後に本 feature を publish する
    (2026-08-11 決定「通報と合わせて実施」を直列順序で具体化)。
