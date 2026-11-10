# registration-admin-notification-webhook Implementation Packet

## Goal

D15 (registration-readiness-gate) の通知イベント (E15a が永続化) を、管理画面を開いていなくても管理者へ届くよう、
サーバー設定で指定した単一の外部 Webhook endpoint へ配送する。stable event ID・HMAC 署名・timeout/再試行・失敗状態・
管理者のテスト送信/再試行を、永続 worker + SSRF 対策付き HTTPS クライアント + 管理者 REST API として提供する。
配送は at-least-once で、受信側が event ID で重複排除する前提を文書化する。
**Webhook の不達・失敗は登録ゲートの状態を一切変えない。**

## Why This Slice Exists Now

D15 のユーザー決定 q11 は「管理画面内の通知一覧 + 未読表示」と「外部 Webhook」を初回から含める。通知イベントの
永続化契約 (E15a) が固まれば、配送は E15c/E15d (実 Kratos 遮断・実 provider 検証) と独立して実装・検証できる。
F15 (管理 UI) は本 unit の状態/テスト/再試行 API を表示・操作する。

## D15 決定の要約 (仕様の正本は host の grill 記録 d15-q01〜q11)

- q11 障害・復旧・防御低下の通知を管理画面内の通知一覧と未読表示で届け、管理画面を開いていない場合にも届く外部 Webhook を初回から含める。メール通知は前提にしない。Webhook の設定・認証・payload・配送保証等の詳細は設計・検証に残されており、本 unit が契約化する
- override (q09/q10) の開始・解除も通知イベント (一覧 + Webhook) に含まれる。E15a が永続化した全種別 (`outage_started` / `outage_recovered` / `protection_degraded` / `protection_lost_stopped` / `override_started` / `override_revoked`) を配送対象とする
- 通知イベントの生成・重複排除 (episode)・管理者別既読は E15a の責務。本 unit はイベントを変更せず、配送記録だけを別に持つ

## Current Observed State

- 依存 E15a (`registration-gate-control-plane`, Emumet#65) は PR 実装中。通知イベントの永続化・stable event ID・管理者認可は E15a の契約に従う。E15a が main に入るまでは E15a PR の契約に合わせ、入った後はその時点の main へ rebase する
- SSRF 防御の先例: `driver/src/http_signing/ssrf.rs` (`validate_fetch_url` / `validate_public_ip`) と `driver/src/http_signing/fetch.rs` (解決済みアドレスへの接続固定、redirect 無効、timeout)。AP の公開鍵取得用であり、Webhook 用の要件 (HTTPS 必須、本文サイズ上限等) は別途満たす
- worker の先例: `server/src/projection_worker.rs` (poll 駆動 + shutdown handle)
- `reqwest` 0.12、`sha2` は既に依存にある (HMAC 実装の依存追加は最小限に)

## Accepted Baseline You May Assume

- 通知イベントは E15a が状態遷移と同一 transaction で永続化し、安定した event ID を持つ。本 unit は読み取り側として配送する (イベントの内容・生成条件は変更しない)
- 管理者認可は E15a の管理 API と同じ既存の admin 判定を再利用する。新しいロールモデルを作らない
- 初版の endpoint は 1 つ。サーバー設定 (環境変数/secret ファイル) で管理し、管理 UI/API から endpoint や secret を書き換えない (状態の表示・テスト・再試行のみ)

## Target Repo / Path / Part

- Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/src/entity, kernel/src/repository, application/src/service, driver/src/http_signing, driver/src/database/postgres, server/src/route, server/src/api, server/src/openapi.rs, server/src/route.rs, server/src/main.rs, migrations, openapi.json, docs`

- Target part: 登録ゲート通知イベントの外部 Webhook 配送 (配送記録 + 永続 worker + 署名 + SSRF 対策 HTTPS クライアント + 管理者 REST API + OpenAPI + 受信側向け文書)

## 配送契約 (この節を仕様とする。型名・DB 列・ヘッダー名の細部は child が決めてよいが、満たすべき性質は固定)

### 設定

- endpoint URL と署名 secret はサーバー設定のみ (例: 環境変数、secret ファイル参照)。未設定 = Webhook 無効 (エラーではない)。DB・API 応答・ログに secret を出さない
- 設定不備 (HTTPS でない・不正 URL・SSRF 検査で恒久拒否される固定宛先 等) は起動失敗にせず「設定不備」状態として状態 API に表示し、ゲート動作に影響しない
- 状態 API が示す宛先は host 部分のみ (userinfo・path・query は出さない。URL 内の認証情報は設定時点で拒否)

### ペイロードとヘッダー

- 本文は JSON。allowlist 方式のシリアライザで、event ID・種別・発生時刻・ゲート状態の要約 (override 中か、開閉/ラッチ/一時拒否 等のフラグ) だけを含める。登録者のメールアドレス・secret・内部エラー詳細は含めない
- ヘッダーに event ID (安定。再試行・再送で同一)、配送試行番号、timestamp、署名を付ける。署名は HMAC-SHA256 で、署名対象にタイムスタンプと本文を含める (リプレイ緩和)。受信側の検証手順 (許容時刻差・定数時間比較) と署名のテストベクタを文書化する

### 配送保証

- at-least-once。同一 event が複数回届き得る (再試行・crash 後の再送・管理者の再試行)。受信側は event ID で重複排除する。順序は保証しない (必要なら発生時刻で整列)
- 同一 event の同時二重送信を避けるため lease を使う。lease 期限切れで回収し再試行する。複数 worker/複数プロセスが同時に動いても同一 event を同時送信しない

### 再試行・失敗状態

| 結果 | 扱い |
|---|---|
| 2xx | 成功 (delivered) |
| 408 / 429 / 5xx / timeout / 接続失敗 (DNS 失敗含む一時的なもの) | 指数バックオフ + jitter で再試行。429 の Retry-After は上限付きで尊重。上限回数/最大期間を超えたら failed |
| 3xx | リダイレクトは追従せず恒久失敗 (failed) |
| その他の 4xx、SSRF 検査拒否、署名/設定不備 | 恒久失敗 (failed)。再試行しない |

- failed は理由分類 (secret を含まない) と試行履歴を持ち、管理者が再試行を指示するまで再送されない。再試行は同じ event ID を再送する
- 配送記録 (event ID ごと): 状態 (pending / in-flight / retrying / delivered / failed)、試行回数、次回試行時刻、最終結果分類、最終試行時刻、lease 情報

### SSRF 対策

- HTTPS のみ (平文 http は production 設定で不可。テスト用の例外は test-mode / `cfg(test)` 限定で、本番ビルドの設定から有効化できない。既存 `ssrf.rs` の方針に倣う)
- URL 内の認証情報禁止。リダイレクト追従なし
- DNS 解決後の全アドレスを検査し、loopback / private / link-local / CGNAT / multicast / unspecified / IPv4-mapped IPv6 / ULA / クラウド metadata アドレス等を拒否。検査したアドレスへ接続を固定し (接続時の再解決を許さない = DNS rebinding 防止)、TLS 証明書検証は元のホスト名で行う
- 接続 timeout・全体 timeout・応答本文サイズ上限 (応答は読み捨て、内容を記録しない)
- 数値表記ゆれ (10 進/16 進/短縮 IPv4)、IPv6 ゾーン、末尾ドット付き host、`localhost` 系は fixture で網羅する

### 管理者 REST API (パスは仮: `/api/v1/admin/registration-gate/webhook*`)

- 状態取得: 設定有無/設定不備、宛先 host、直近の成功/失敗、pending/retrying/failed 件数、直近の配送記録 (event ID・種別・状態・試行回数・結果分類)
- テスト送信: 合成イベント (種別 `webhook_test`、test 用 event ID) を同じ経路 (署名・SSRF 検査・timeout) で送り、結果を返す/記録する。**ゲート状態・通知一覧・未読件数に影響しない**
- 再試行: failed の配送 (または全 failed) を再キューする。同じ event ID を再送
- 管理者以外は全 API 拒否 (401/403)。全レスポンスに secret を含めない。管理操作は E15a の監査の流儀に合わせて記録してよい (必須ではない)

### 失敗通知の無限再帰の禁止

- 配送の失敗・failed・設定不備は、状態 API (と F15 の表示) で観測できる。それ自体が Webhook 配送対象の新しい通知イベントを生んではならない。管理画面内の一覧へ表示するための別種の記録を作る場合も、Webhook 配送対象外であることを型/テストで固定する
- 配送処理はゲート状態遷移の transaction の外側 (別 worker) で動く。Webhook の不達・遅延・設定不備・worker 停止でゲート判定・状態・通知イベント生成は変わらない

## In Scope

- 配送記録の永続化 (migration)、通知イベントからの配送記録の作成 (E15a のイベント永続化を変更せず、冪等に取り込む。Webhook を有効にする前に発生したイベントを配送するかどうかの方針を決めて文書化・テストする)
- 永続 worker (poll 駆動、lease、再試行、再起動時の回収、shutdown)、`server/src/main.rs` での起動 (未設定時は何もしない)
- HMAC 署名、SSRF 対策付き HTTPS クライアント (必要なら既存 `ssrf.rs` の検査を既存挙動を変えずに共有化)
- 管理者 REST API (状態・テスト送信・再試行) と OpenAPI (utoipa) / `openapi.json` 再生成
- 受信側向け文書 (Emumet 側の docs): ペイロード、ヘッダー、署名検証、at-least-once と event ID 重複排除、再試行の挙動、設定項目、運用手順 (テスト/再試行)

## Out Of Scope

- メール通知、汎用 integration 基盤、複数 endpoint、管理画面からの endpoint/secret の編集、AP outbox の流用
- 通知イベントの生成・既読・一覧 (E15a)、管理 UI (F15)、実 Kratos 遮断 (E15d)、実 provider 検証 (E15c)
- secret のローテーション機構 (二重 secret 受理等)。初版は単一 secret。必要なら後続

## Standalone Child Issue Contract

この PR は、Emumet に D15 登録ゲート通知の外部 Webhook 配送を導入する。永続化済みの通知イベントを、サーバー設定の単一 HTTPS endpoint
へ署名付き・at-least-once で配送し、再試行・失敗状態を記録し、管理者がテスト送信と failed の再試行を行える。
Webhook の不達は登録ゲートの状態を変えず、失敗通知が無限に再帰しない。

## Acceptance Criteria

- E15a の通知イベント (全種別、override の開始・解除を含む) が単一 endpoint へ配送される。event ID は再試行・再起動・再送でも同一。未設定なら配送せず「未設定」が観測でき、ゲート動作に影響しない
- at-least-once・受信側 event ID 重複排除・順序非保証が受信側向け文書に明記される
- HMAC-SHA256 署名 (timestamp + 本文)。secret はサーバー設定のみで、DB・API 応答・ログ・エラー・payload に出ない。署名のテストベクタと検証手順の文書がある
- SSRF 対策 (HTTPS のみ、リダイレクト禁止、接続時宛先検査と接続固定、全アドレス検査、timeout、本文サイズ上限)。SSRF fixture で拒否が確認され、拒否は恒久失敗として記録される。テスト用の http/内部宛先例外は本番設定から有効化できない
- payload とログに secret・登録者メール等の個人情報を含めない (allowlist シリアライザ、宛先は host のみ表示)
- 再試行 (429 の Retry-After 尊重含む) と恒久エラーの分類が上表どおり。上限超過/恒久エラーで failed、管理者の再試行まで再送されない
- 配送記録が永続化され、再起動後に未完了配送が回収される。二重 worker でも同一 event を同時に二重送信しない
- 管理者 API (状態・テスト送信・再試行) が動き、テスト送信はゲート状態・通知一覧・未読件数に影響しない。非管理者は 401/403。secret は応答に出ない
- Webhook の不達・failed・設定不備・worker 停止で登録ゲートの状態は変わらず、配送失敗が新しい Webhook 配送対象の通知イベントを生まない (テストで固定)
- OpenAPI が再生成され差分検査に通る。既存 API (login・POST /api/v1/accounts・E15a の管理 API) の挙動は不変

## Verification

- 純粋ロジックの単体テスト: 署名生成/検証のテストベクタ、結果分類 (2xx/3xx/408/429/5xx/その他 4xx/timeout)、バックオフ計算 (jitter・Retry-After 上限)、payload allowlist (禁止フィールドが出ない)
- SSRF fixture テスト: 内部アドレスへ解決するホスト名、リダイレクト先が内部、IPv4-mapped IPv6、数値表記ゆれ、metadata アドレス、credentials 付き URL、`http://`、DNS rebinding (検査後に別アドレスへ解決されても固定アドレスへ接続)
- `DATABASE_URL` を設定した実 DB テスト + ローカル fake receiver: 再起動 (in-flight の回収)、二重 worker (同一 event の同時送信なし)、429/5xx/timeout の再試行、恒久エラーの failed、管理者再試行、テスト送信がゲート状態・通知一覧に影響しないこと、失敗が新規イベントを生まないこと、ゲート状態が Webhook 失敗中も不変であること。**実 DB テストが skip されただけの成功は不可**。実行したテスト名と DB 接続での実行結果を PR に記載する
- 管理者認可 (非管理者 401/403)、secret/個人情報の非漏洩 (応答・ログ・エラー・payload の検査)
- OpenAPI 再生成 (`openapi.json`) と既存の差分検査、既存テスト全緑 (login・POST /api/v1/accounts・E15a の回帰を含む)、`git diff --check`

## 共有ファイルと merge 順

`server/src/openapi.rs`、`server/src/route.rs`、`server/src/main.rs`、DI wiring、`migrations/`、`openapi.json` は他 unit
(E15a・E8 等) と共有する。**E15a の merge 後に rebase し、共有ファイルは一件ずつ統合し、その時点の main から `openapi.json` を再生成する**。
migration 番号は統合時点の最新の次を採番する。共有ファイルの変更は最小限にし、他 unit の差分を巻き込まない。

## 親状態の所在

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
child は host 側の packet / intent / queue / ラベルを調査・変更しない。

## Related Links

- 設計 (host リポ): `intents/emumet/features/registration-readiness-gate/{overview,packets,acceptance}.md`
- ユーザー決定の正本: host リポ `intents/shuttlepub/packets/candidates.md` D15 節、`intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json` (d15-q01〜q11)
- 依存: E15a `registration-gate-control-plane` (Emumet#65)。後続/並行: F15 `registration-gate-admin-ui` (shuttlepub-frontends、本 unit の状態/テスト/再試行 API を表示する)、E15c / E15d

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/registration-readiness-gate/overview.md` (primary) + packets.md の E15w に完了リンク追記 (host 側で実施)
- ADR candidate: none
- Diagram candidate: none
- Docs update: 配送保証・署名方式・設定・SSRF 方針・失敗状態・運用手順を acceptance.md へ (host 側 closeout writeback)。受信側向け利用文書は Emumet 側成果物
- Closeout writeback expected: yes

## Guide Reachability (G645)

role-facing surface: 管理者向け REST API (`/api/v1/admin/registration-gate/webhook*`)、サーバー設定、受信側向け Webhook 文書、OpenAPI。
guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
