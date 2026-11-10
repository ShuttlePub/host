# registration-gate-admin-ui Implementation Packet

## Goal

D15 (registration-readiness-gate) の登録ゲートを管理者が emumet-web 上で扱えるようにする。管理者のみ操作でき、
状態・理由・開閉・手動再開・override (警告確認必須) を操作し、override 中の警告を管理画面内の全ページに常時表示し、
通知一覧・未読・既読、および外部 Webhook の状態・テスト送信・再試行を扱う。
**画面構成・文言・見た目は未決** (リード側モックをユーザーがレビュー中) のため、本 unit は「画面に依存しない部分 (BFF・API 接続・生成型・fixture)」を先行し、
画面実装はモック合意が host intent に記録された後に行う (下記「画面実装ゲート」)。

## 画面実装ゲート (最重要・必読)

- ユーザー方針: **「説明が多すぎる、Misskey/X を見て引き算」** (情報と説明文を絞る)。リード側モックはユーザーがレビュー中で、画面構成・文言・見た目は確定していない
- **このモックへのユーザー合意が host intent (`intents/emumet/features/registration-readiness-gate/` 配下) に記録されるまで、画面実装 PR を出さない**。
  画面実装 PR = PureScript の View/画面・ルート・Model/Message の画面状態・CSS・visual baseline を追加/変更する PR
- 合意の記録後、host 側から issue コメント等で child へ合意内容 (画面構成・文言・警告表示) が伝達される。それまでは待機する (推測で画面を作らない)
- **先行可 (画面構成に依存しない部分)**: BFF (認可・REST 変換・GraphQL スキーマ・mock/real クライアント)、API 接続、生成型の更新、全状態 fixture、BFF テスト。これらは画面実装と別 PR にする (画面実装を混ぜない)

## Why This Slice Exists Now

D15 は実 Kratos 経路で守れて初めて完了で、管理者向け操作面 (本 unit) と通知 (E15w) が D15 統合受け入れの一部。
API 契約 (E15a) が固まっているため、BFF と fixture は E15c/E15d/E15w と並行して先行できる。

## D15 決定の要約 (仕様の正本は host の grill 記録 d15-q01〜q11)

- q01 最低条件は「メール認証 OR BOT 対策」。q02/q03 設定喪失で自動停止し、復旧しても自動再開せず管理者の手動再開が必要 (再開時も最低条件未達なら不可、手動閉鎖は自動解除されない)
- q06 一時障害は一般登録のみ一時拒否で、復旧後は自動再開。q07 片方のみ障害なら動作中の対策のみ課して継続し防御低下を通知
- q09/q10 無対策でも管理者が警告を明示確認すれば開放できる override。明示解除まで有効で、有効中は通常の自動停止・障害時拒否判定を行わず、管理画面に常時表示
- q11 通知は管理画面内の通知一覧 + 未読表示と外部 Webhook (E15w)。メール通知は前提にしない
- override の確定細部 (host 記録): (1) override 中も準備済みの保護は登録時に課される (override は準備未完了・障害でも開放するだけ) (2) 解除で通常判定に戻る (3) override の開始・解除も通知 (一覧 + Webhook) に含まれる (4) 警告バナーは管理画面内の全ページに常時表示し、一般画面には出さない (文言・見た目はモック合意待ち)

## Current Observed State

- emumet-web (`apps/emumet-web`) は PureScript + Flame の SSR/hydration アプリ + Bun BFF (graphql-yoga)。`bff/schema.graphql` が GraphQL SDL の正本、`bff/emumet/{client.ts,real.ts,mock.ts}` が Emumet REST クライアント (real.ts が snake_case ↔ camelCase 変換、mock.ts は stateful mock)、`scripts/sync-graphql.ts` が SDL から `src/Generated/` の PureScript 型を生成する (手編集禁止)
- 管理系の先例: ratcap admin-moderation (`GET /api/v1/me` の `instance_roles`、admin 系 mutation)。登録ゲート用の管理画面・管理者領域のページ群は現状ない (管理者領域をどう構成するかはモック合意に従う)
- 依存 API は E15a (Emumet#65) と E15w が実装中。契約の正本は各 Emumet issue/PR と生成 `openapi.json`

## Accepted Baseline You May Assume

- 認可の正本は Emumet API (401/403)。BFF は `GET /api/v1/me` の `instance_roles` を UI 出し分けのヒントに使い得るが、権限判断を BFF/UI だけに置かない
- D15 の状態語彙: 判定 Accept / TemporaryReject (自動復旧) / Stopped (設定喪失ラッチ・手動再開が必要) / AdminClosed、override On/Off、防御低下。UI/BFF はこれらを混同しない
- 実ゲート (実 Emumet・実 Kratos) との組合せは D15 統合受け入れで確認する。本 unit の受け入れは mock/fixture と BFF の契約適合まで

## Target Repo / Path / Part

- Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `apps/emumet-web/bff, apps/emumet-web/src, apps/emumet-web/test`

- Target part: emumet-web 管理者向け登録ゲート管理 (BFF 認可・REST 変換・GraphQL スキーマ・mock/real クライアント・生成型・全状態 fixture を先行。画面はモック合意の記録後)

## In Scope

### 先行可 (画面実装ゲートの対象外)

- BFF: 状態取得 (override 中・ラッチ・理由・revision・防御低下を含む)、開閉、手動再開、override 有効化 (警告 ack 必須) / 解除、通知一覧、未読件数、既読化、Webhook 状態、Webhook テスト送信、failed の再試行を `bff/schema.graphql` / `client.ts` / `real.ts` (REST 変換) / `mock.ts` (stateful mock) / `resolvers.ts` に追加
- 認可: 管理者のみ。未認証・非管理者・権限不足は fail closed。401/403/409 (revision 競合)/5xx・タイムアウト (一時障害) を GraphQL エラーとして区別できる形で返す
- 生成型: `scripts/sync-graphql.ts` による再生成 (再現可能・差分が空になること)。手編集禁止
- 全状態 fixture と BFF テスト (下記 Acceptance Criteria)。fixture は Emumet の OpenAPI (E15a/E15w の契約) に照合する
- secret を含めない (Webhook は宛先 host・状態・結果分類のみを扱い、endpoint 全体 URL・secret・署名は扱わない)

### モック合意後 (画面実装 PR)

- 管理画面: 状態・理由・開閉・再開・override (警告 ack)・通知一覧・未読・既読・Webhook 状態/テスト/再試行
- override 中の警告バナー: 管理画面内の全ページに常時表示。画面遷移・再読込・SSR/hydration で消えない。一般画面には出さない
- SSR/hydration と visual (既存経路へ登録)。画面構成・文言・見た目はモック合意の記録に従う。説明文を増やさない

## Out Of Scope

- 一般の登録 UI 全体、secret のブラウザー表示/編集、Webhook endpoint・secret の設定 UI (サーバー設定の責務)
- モック合意前の画面実装、画面構成・文言・見た目の独自決定
- workspace・CI・visual の共通基盤の変更 (別レーン F0 の所有。既存の visual 登録経路への fixture/画面の追加のみ)
- 実 Kratos 経路・実 provider・実 Webhook 受信との結合確認 (D15 統合受け入れ)

## 編集競合と統合順

- `bff/schema.graphql` と生成型 (`src/Generated/**`) は別レーン FN (`profile-identity-web-adaptation`) と**直列に統合**する。互いに main の最新から再生成し、並行ブランチで同時に更新して衝突させない。先に merge された側の変更を取り込んでから再生成する
- workspace・CI・visual 共通基盤は F0 が所有する。本 unit はこれらを変更しない
- 生成物 (`src/Generated/**`、OpenAPI 由来の型) の手編集は禁止。変更が必要なら生成元 (SDL/OpenAPI) を直して再生成する

## Standalone Child Issue Contract

この issue は emumet-web に D15 登録ゲートの管理者向け操作を追加する。画面に依存しない BFF・API 接続・生成型・全状態 fixture を先に PR とし、
画面 (管理画面・override 常時警告・通知一覧/既読・Webhook 状態) は host intent にモック合意が記録され child へ伝達されるまで PR を出さない。
管理者のみ操作でき、revision 競合・一時障害・手動再開必要・閉鎖を混同せず、secret を表示しない。

## Acceptance Criteria

- 【先行可】BFF の状態取得・開閉・再開・override 有効化/解除 (ack と revision を送る)・通知一覧・未読件数・既読化・Webhook 状態/テスト/再試行が GraphQL と EmumetClient (REST 変換・stateful mock) に揃い、生成型が再現可能に更新される。非管理者・未認証は fail closed。secret は応答に含まれない
- 【先行可】全状態 fixture と BFF テスト: Accept (防御低下あり/なし)、TemporaryReject、Stopped (手動再開が必要)、AdminClosed、override On (準備済み保護あり/なし)、revision 競合 (409)、一時障害 (5xx/タイムアウト)、通知 (未読/既読/多数)、Webhook (未設定/設定不備/正常/再試行中/failed/テスト成功・失敗)。API 契約 (OpenAPI/E15a・E15w の契約) に照合される
- 管理者のみ操作できる (BFF 認可・REST 変換のテスト)。revision 競合・一時障害・手動再開必要・閉鎖が別の状態/エラーとして扱われ混同されない
- 【モック合意後】override 中の警告が管理画面内の全ページに常時表示され、画面遷移・再読込・SSR/hydration で消えず、一般画面には出ない
- 【モック合意後】管理者が状態・理由・開閉・再開・override (警告 ack 必須)・通知一覧・未読・既読・Webhook 状態/テスト/再試行を操作でき、成功・競合・一時障害・権限なしが区別できる。説明文を増やさず、画面構成はモック合意に従う
- 【モック合意後】SSR/hydration (全状態 fixture)、visual (mobile/desktop・全状態・override 警告) が既存経路で通る。生成物は手編集されず sync-graphql 再生成差分が空
- 既存の emumet-web (ログイン、アカウント一覧/詳細、moderation) の挙動は不変。実ゲートとの組合せは D15 統合受け入れで確認

## Verification

- BFF: `bun test` (認可、REST 変換 real.test.ts、mock の状態遷移、fixture の OpenAPI 照合、GraphQL エラー分類)
- 生成型: `bun scripts/sync-graphql.ts` 後に差分がないこと、`spago build` / `spago test`
- 【モック合意後】SSR/hydration テスト、visual (既存の frontend-visual 経路。baseline 追加は画面実装 PR のみ)、`git diff --check`
- 既存テスト全緑 (回帰)。PR 本文に実行したコマンドと結果を記載する

## 親状態の所在

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
child は host 側の packet / intent / queue / ラベルを調査・変更しない。

## Related Links

- 設計 (host リポ): `intents/emumet/features/registration-readiness-gate/{overview,packets,acceptance}.md`
- ユーザー決定の正本: host リポ `intents/shuttlepub/packets/candidates.md` D15 節、`intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json` (d15-q01〜q11)
- 参照 (ratcap の既存 feature。リンクのみ): `intents/ratcap/features/admin-moderation/`、`intents/ratcap/features/settings-hub/`
- 依存 API: E15a `registration-gate-control-plane` (Emumet#65)、E15w `registration-admin-notification-webhook`。並行: FN `profile-identity-web-adaptation` (schema/生成型の直列統合)、F0 (共通基盤)

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/registration-readiness-gate/overview.md` (primary) + packets.md の F15 に完了リンク追記 (host 側で実施)。モック合意は RG 配下に記録される
- ADR candidate: none
- Diagram candidate: none
- Docs update: BFF 認可・状態語彙・警告の常時表示範囲・検証境界を acceptance.md へ (host 側 closeout writeback)
- Closeout writeback expected: yes

## Guide Reachability (G645)

role-facing surface: emumet-web 管理者向け登録ゲート管理 (BFF GraphQL と管理画面。画面は合意後)。
guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
