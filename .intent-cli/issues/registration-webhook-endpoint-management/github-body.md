# registration-webhook-endpoint-management: 登録ゲート Webhook 送信先の管理 API (複数送信先 CRUD・シークレット暗号化・通知種別選択・送信先ごとの配送/状態/テスト/再試行・失敗一覧ページング)

## Goal

E15w (Emumet main 実装済み) は Webhook の送信先をサーバー設定 (環境変数) の **1 件だけ**で管理し、登録・編集の API を持たない。
F15 管理 UI の確定仕様 (host `intents/emumet/features/registration-readiness-gate/ui-spec.md` 6「Webhook」) は、管理者が画面から
複数の送信先を登録・編集・削除し、URL は一部を伏せて一覧表示し、状態 (正常／配送失敗) を見て、テスト送信し、配送失敗を 1 件ずつ再試行することを求める。
この unit は Emumet に **管理者専用の送信先 CRUD API** を追加し、E15w の配送を **送信先ごと**に拡張する。
(ユーザー決定: question-433de6d63c710adbcaa304b4ba7d1ba6 「B: Emumet に送信先の登録・編集・削除 API を追加してから ui-spec どおり実装」)

**Webhook の不達・失敗は登録ゲートの状態を一切変えず、失敗通知は再帰しない** (E15w の契約を維持する)。

## Why This Slice Exists Now

F15 の Webhook タブ (shuttlepub-frontends#31、open のまま) は送信先の登録・編集・削除・一覧・テスト・失敗の 1 件再試行を画面に出す。
これらを支える API が Emumet に無いため、F15 の Webhook タブは本 unit の API 公開を待つ。F15 レビューでは、E15w の状態 API が返す
「直近 50 件」(`RECENT_DELIVERY_LIMIT`) の外にある古い failed 配送を **1 件ずつ再試行できない** 問題も指摘されており、本 unit で解消する。

## Current Observed State

- E15w (Emumet PR #69、`docs/registration-gate-webhook.md`): 送信先 URL・署名 secret は環境変数 (`REGISTRATION_WEBHOOK_URL` / `REGISTRATION_WEBHOOK_SECRET` または `_SECRET_FILE` / `REGISTRATION_WEBHOOK_POLL_INTERVAL_MS`)。未設定 = 無効、設定不備 = 起動失敗にせず状態 API に `misconfigured`。
  配送記録は event ID 単位の 1 テーブル (`registration_gate_webhook_deliveries`、event_id が主キー)。lease・指数バックオフ・最大 8 回/24 時間・`failed` は管理者の再試行まで再送しない。
  ペイロードは allowlist の固定 JSON、ヘッダー `X-Emumet-Event-Id` / `X-Emumet-Event-Type` / `X-Emumet-Delivery-Attempt` / `X-Emumet-Timestamp` / `X-Emumet-Signature: v1=<hmac-sha256 hex>` (署名対象 `"{timestamp}." + body`)。
  「Webhook を有効にする前のイベントは配送しない」ベースライン (`registration_gate_webhook_state`)。管理 API は `GET/POST test/POST retry /api/v1/admin/registration-gate/webhook*` (単一送信先前提、状態 API の直近配送は最新 50 件のみ)。
- 実装の所在 (Emumet main): `kernel/src/entity/webhook_delivery.rs`、`kernel/src/repository/webhook_delivery.rs`、`application/src/service/registration_gate_webhook.rs`、`driver/src/webhook/{endpoint,sender,signature}.rs`、`driver/src/database/postgres/webhook_delivery.rs`、`server/src/webhook_worker.rs`、`server/src/route/registration_gate/`。
  宛先検査は `driver/src/webhook/endpoint.rs` が既存 `driver/src/http_signing/ssrf.rs` (`is_blocked_ipv4` / `is_blocked_ipv6`) を流用している。
- 通知イベント種別 (E15a/E15d、`GateEventKind`): `outage_started` / `outage_recovered` / `protection_degraded` / `protection_lost_stopped` / `enforcement_lost_stopped` / `enforcement_restored` / `override_started` / `override_revoked` の 8 種別 (E15d が `enforcement_*` の 2 種別を追加済み)。
  なお現行の受信側文書 `docs/registration-gate-webhook.md` のイベント種別表は `enforcement_*` を載せていない (E15w 時点の記述)。本 unit の文書更新で併せて追記する。
- 管理者認可は E15a と同じ Keto の `instance:administrate` (ADR 0004)。revision 楽観ロックは E15a の流儀 (リクエスト本文の `revision`、競合は 409)。ページングは E15a 通知一覧の `before` / `limit` / `next_cursor` の流儀。
- F15 の BFF/API 部分 (shuttlepub-frontends PR #33) は Webhook を **未接続**で、frontends は E15w の Webhook API の消費者を持たない (README に「E15w は API 契約の公開待ちで未接続」と明記)。したがって E15w の集約 API は本 unit で置換できる。

## Accepted Baseline You May Assume

- E15w は main に merge 済み (PR #69)。通知イベントの永続化・stable event ID・全種別の配送契約・署名・SSRF 検査・lease・再試行・失敗状態は E15w の実装を土台にする。**E15w の契約 (不達でゲートを変えない・失敗通知を再帰させない・応答本文は読み捨て) は維持する**。
- 管理者のみ。新しいロールモデルは作らない。

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/src/entity, kernel/src/repository, application/src/service, driver/src/webhook, driver/src/http_signing, driver/src/database/postgres, server/src/route, server/src/api, server/src/webhook_worker.rs, server/src/openapi.rs, server/src/route.rs, server/src/main.rs, migrations, openapi.json, docs`

- Target part: 登録ゲート Webhook の送信先管理 (複数送信先の管理者 CRUD API + シークレットの暗号化保存と鍵の運用文書 + 通知種別の選択 + revision 楽観ロック + 監査 + URL 部分マスク表示) と、E15w 配送の送信先ごとへの拡張 (送信先ごとの署名・配送記録・状態・テスト送信・1 件ずつ再試行・cursor ページングの失敗一覧) + 既存環境変数 1 件の非破壊移行 + SSRF 対策の登録時/接続時の二段 + OpenAPI 再生成 + 受信側/運用者向け文書の更新

## 送信先管理の契約 (この節を仕様とする。型名・DB 列・ヘッダー名・パスの細部は child が決めてよいが、満たすべき性質は固定)

### 送信先 CRUD API (パスは仮: `/api/v1/admin/registration-gate/webhook/endpoints*`)

- 管理者のみ (既存 Keto `instance:administrate`)。非管理者は全 API で 401/403。送信先は **複数**登録できる (件数上限を設け、超過は明示エラー。上限値は child が決め docs に記載)。
- 送信先の属性: URL (HTTPS のみ)、シークレット (書き込み専用)、送る通知種別の選択 (下表の 4 カテゴリから 1 つ以上)、revision。作成・一覧・取得・更新・削除ができる。
- **更新は revision 楽観ロック**: 更新・削除はリクエストで `revision` を受け取り、不一致は 409 (E15a の流儀)。成功のたびに revision が増える。
- 更新で URL またはシークレットを省略した場合は「変更しない」。**全 URL・path・シークレットは API の応答に一切返さない**ため、編集 UI は URL/シークレット欄を空で開き、入力したときだけ置き換える (F15 側へ伝達する契約)。
- 重複する URL (正規化後) の登録は拒否する (同一送信先への二重配送を防ぐ)。
- 全操作 (作成・更新・削除・テスト送信・再試行) を **監査**として記録する (操作者・対象送信先 ID・操作種別・結果・revision)。監査にも URL 全体・シークレット・通知本文の個人情報を残さない。監査・送信先の変更・配送失敗は **新しい通知イベント (= Webhook 配送対象) を生まない**。

### 通知種別の選択と E15a/E15d の通知種別の対応表

UI の「送る通知」は 4 カテゴリ。カテゴリ識別子は OpenAPI で固定し、`GateEventKind` との対応は **exhaustive な match (ワイルドカード禁止)** で実装し、新しい `GateEventKind` が追加されたらコンパイルまたはテストで必ず分類を迫られるようにする。

| カテゴリ (UI) | 識別子 (固定) | 含まれる `GateEventKind` / Webhook `type` | UI 通知タイトルとの対応 (ui-spec 確定文言) |
|---|---|---|---|
| 障害 | `outage` | `outage_started`、`protection_degraded` | 「一般登録を一時停止しました」「{保護名}が応答しません」 |
| 復旧 | `recovery` | `outage_recovered`、`enforcement_restored` | 「{保護名}が復旧しました」「保護の適用が復旧しました」 |
| 自動停止 | `auto_stop` | `protection_lost_stopped`、`enforcement_lost_stopped` | 「一般登録を自動停止しました」 |
| 強制開放 | `override` | `override_started`、`override_revoked` | 「強制開放しました」「強制開放を解除しました」 |

- 保護が応答しなくなったことは「障害」で届く (ui-spec)。`webhook_test` はカテゴリに属さず、テスト送信でのみ送られる (選択の対象外)。
- 配送記録は、イベント発生時点でその送信先がそのカテゴリを購読していた場合のみ作る。選択の変更は、変更後に作られる配送記録にだけ効く (既存の pending/retrying/failed 記録の扱いは child が決め、docs とテストで固定する)。
- 上表の対応は受信側文書にも載せ、`docs/registration-gate-webhook.md` のイベント種別表へ `enforcement_lost_stopped` / `enforcement_restored` を追記する。

### URL・シークレットの扱い

- URL は HTTPS のみ・userinfo 不可・fragment 不可・長さ上限。一覧/取得の応答は URL を **部分マスク表示用の形**で返す: host (ポートがあれば含む) と、path があるときは伏せ字 + 末尾数文字 (例 `hooks.example.net/••••/a8f2`)。
  **全 URL・path・query・userinfo は返さない**。末尾の露出が path トークンの大半を明かさないよう、トークンが短い (例 12 文字未満) ときは末尾を出さず `host/••••` にする。マスクはサーバーで計算する (フロントが生 URL を受け取らない)。
- シークレットは **書き込み専用**: 作成・更新でのみ受け取り、API 応答・ログ・エラー・監査・通知・payload・OpenAPI の例のどこにも出さない (設定済みかどうかの真偽値のみ可)。16 バイト以上 (E15w と同じ)、上限あり。`Debug`/`Display`/tracing で出ない型にする。
- DB 保存時は **暗号化** (自前実装の暗号は不可。実績のある AEAD crate を最小限の依存追加で使う。送信先 ID を関連データ (AAD) に束縛する)。暗号文には鍵識別子を持たせ、将来の鍵ローテーションに備える (ローテーション機構自体は範囲外)。
- **暗号鍵はサーバー設定** (環境変数 または secret ファイル参照。変数名は child が決める) で与える。DB・リポジトリ・ログ・API 応答に鍵を出さない。鍵未設定のときは送信先の作成・シークレット更新を明示エラーで拒否し (secret を平文で保存しない)、既存送信先の配送はそれが復号できる限り続ける。
  鍵を失う・誤る・変えると保存済みシークレットは復号できない。このとき該当送信先は「シークレット復号不可」を理由分類として恒久失敗扱いにし (secret を含まない)、管理者がシークレットを再入力して復旧できる。他の送信先やゲートの状態に波及しない。
- 鍵の生成・長さ・保管・喪失時の影響・復旧手順 (シークレット再入力)・ローテーションが未対応であることを **docs 化**する (運用者向け文書)。

### 送信先ごとの配送 (E15w の拡張)

- 配送記録は **(送信先, event ID) 単位**。**event ID は送信先をまたいで同一** (通知イベントの ID)。再試行・再起動・再送・管理者の再試行でも不変。
- 署名は **送信先ごとのシークレット**で `X-Emumet-Signature` を作る (方式・ヘッダー・署名対象は E15w と同じで互換。送信先を識別するヘッダーを足してよい)。at-least-once・順序非保証・lease による同時二重送信回避・再試行表 (2xx/3xx/408/429/5xx/timeout/その他 4xx/SSRF) は E15w と同じ。ある送信先の失敗・遅延が他の送信先の配送を止めない (送信先ごとに独立)。
- **新しい送信先は作成後に発生したイベントだけ**を配送する (E15w の「有効化前のイベントは配送しない」を送信先ごとに適用)。過去イベントの遡及配送はしない。送信先の削除で、その送信先の未完了配送は配送されなくなる。
- 送信先の状態: **正常 (`healthy`) / 配送失敗 (`failing`)** (UI の状態チップ)。`failing` = その送信先に未解決の failed 配送がある (または復号不可など恒久失敗の理由がある)。状態の定義・遷移 (failed が再試行で解消されたら `healthy` に戻る) を docs に記載しテストで固定する。
- **テスト送信**: 送信先を指定して合成イベント `webhook_test` を同じ経路 (その送信先の署名・登録時と同じ宛先検査・timeout) で 1 回だけ送り、結果分類を返す。再試行せず、配送記録・通知一覧・未読件数・ゲート状態・送信先の状態チップに影響しない。
- **再試行**: **(送信先, event ID) を 1 件指定**して failed を再キューできる。送信先指定または全体の一括再キューも可。同じ event ID を再送する。対象が failed でなければ 404/409 (明示)。
- **配送失敗の一覧は cursor ページング** (`before` / `limit` / `next_cursor` の流儀)。**件数に関わらず古い failed にも到達でき、1 件ずつ再試行できる** (F15 レビュー指摘の「最新 50 件外の失敗を再試行できない」問題の解消)。
  並び順は安定 (例: failed になった時刻の新しい順 + ID で決定的)、送信先で絞り込める。各項目は 送信先 ID・event ID・種別・カテゴリ・失敗時刻・結果分類 (secret・URL 全体を含まない) を持つ。成功した配送の履歴は一覧に出さない (UI 仕様)。
  送信先ごとの failed 件数と、全体で failed があるか (タブの ● 用) を状態として取得できる。

### SSRF 対策 (登録時と接続時の両方)

- **登録時 (作成・URL 更新)**: HTTPS 限定・userinfo/fragment 拒否・host 表記の正規化と検査 (数値表記ゆれ、IPv6 ゾーン、末尾ドット、`localhost` 系)・リテラル IP の検査・名前解決結果の全アドレス検査。拒否は 4xx の明示エラー (拒否理由の分類は返してよいが、内部ネットワークの探索に使えるほど詳細な情報 (どの内部アドレスに解決したか等) は返さない)。
- **接続時 (毎回)**: 送信のたびに解決した全アドレスを再検査し、検査したアドレスへ接続を固定 (接続時再解決なし = DNS rebinding 防止)、TLS 証明書は元の host で検証、リダイレクト禁止 (3xx は恒久失敗)、proxy 環境変数を使わない、接続/全体 timeout、応答本文の読み捨て。登録時に通った送信先でも接続時に内部アドレスへ変わっていれば拒否され、恒久失敗として記録される。
- 既存 `driver/src/http_signing/ssrf.rs` (AP 鍵取得) と E15w の `driver/src/webhook/endpoint.rs` の検査を流用する。共通化は既存挙動と既存テストを変えない最小の抽出に留める。
- テスト用に http/内部宛先を許す例外は `cfg(test)` / test-mode 限定で、本番ビルドの設定・API から有効化できない (E15w と同じ境界)。

### 既存の環境変数 1 件の移行方針 (破壊的変更にしない)

E15w の環境変数 (`REGISTRATION_WEBHOOK_URL` ほか) で運用中の環境が、アップグレードだけで配送を失ってはならない。移行は次の性質を満たす (実装の細部は child が決め、docs とテストで固定する)。

- **暗号鍵が設定されている場合**: 起動時に、環境変数の送信先が有効 (設定不備でない) かつ未取り込みなら、**初期送信先**として DB へ一度だけ取り込む (全 4 カテゴリ、シークレットは暗号化して保存、E15w のベースライン・既存の未完了/failed 配送記録を引き継ぐ)。取り込みは冪等 (二重起動・再起動で重複しない)。取り込み後は DB が正本で、環境変数は無視する (管理者が編集・削除でき、削除しても再取り込みしない)。取り込みの済みはマーカーで記録する。
- **暗号鍵が未設定の場合**: 取り込まない。環境変数の 1 件は従来どおり配送され (読み取り専用の「環境変数の送信先」として状態に現れ、API からは編集・削除できない)、既存運用は止まらない。docs に「鍵を設定して再起動すると取り込まれる」移行手順を書く。
- 環境変数が未設定・設定不備のときの E15w の挙動 (無効/設定不備表示・起動失敗にしない・ゲートに影響しない) は維持する。シークレットの値・URL 全体はログ・応答に出さない (取り込みの記録・ログも含む)。
- migration は E15w の配送記録を **破壊しない** (消さない・event ID を変えない)。新テーブル/列への移行は up のみでよいが、既存データを失わないことを実 DB テストで確認する。
- E15w の集約 API (`GET/POST test/POST retry /api/v1/admin/registration-gate/webhook*`) は、送信先単位の API に置き換えるか、集約ビューとして残すかを child が決め、PR 本文と docs に明記する (frontends に消費者はない)。環境変数の取り込み後も運用手順 (テスト→再試行) が docs 上で一貫すること。

### 失敗通知・不達の隔離 (E15w 契約の維持)

- 配送の失敗・failed・設定不備・復号不可・送信先の CRUD は、それ自体が **Webhook 配送対象の新しい通知イベントを生まない**。型/テストで固定する。
- 配送処理はゲート状態遷移の transaction の外側 (別 worker) で動く。Webhook の不達・遅延・設定不備・worker 停止・送信先の登録/編集/削除でゲートの判定・状態・通知イベント生成は変わらない。
- テスト送信と送信先 CRUD はゲート状態・通知一覧・未読件数に影響しない。

## In Scope

- 送信先・配送記録・監査・取り込みマーカーの永続化 (migration)、E15w の配送記録を破壊しない移行
- 管理者 REST API (送信先 CRUD・テスト送信・1 件/一括再試行・failed 一覧の cursor ページング・状態) と OpenAPI (utoipa) / `openapi.json` 再生成
- シークレットの暗号化保存 (AEAD) と暗号鍵のサーバー設定、鍵の運用文書
- 通知種別カテゴリの選択と `GateEventKind` との exhaustive な対応
- 配送 worker の送信先ごと拡張 (送信先ごとの署名・状態・独立性)
- URL の部分マスク表示、登録時・接続時の SSRF 検査
- 既存環境変数 1 件の非破壊移行
- Emumet 側 docs の更新 (受信側文書、鍵の運用、移行手順、カテゴリ対応表、`enforcement_*` 種別の追記)

## Out Of Scope

- F15 の Webhook タブ (画面・BFF 接続。shuttlepub-frontends#31)。本 unit は API 契約と OpenAPI を公開するまで
- メール通知、汎用 integration 基盤、AP outbox の流用、送信先ごとの個別ペイロード形式、送信先の一時無効化トグル
- 通知イベントの生成・既読・一覧 (E15a)、実 Kratos 遮断・実 provider 検証 (E15c/E15d)
- 暗号鍵のローテーション機構、署名シークレットの二重受理ローテーション (暗号文の形式は将来対応できる形にするだけ)
- 過去イベントの遡及配送

## Standalone Child Issue Contract

この PR は、Emumet に登録ゲート Webhook の送信先管理 API を導入する。管理者が複数の送信先 (URL・シークレット・送る通知) を登録・編集・削除でき、
URL は部分マスクでのみ返り、シークレットは暗号化保存され応答に出ない。配送は送信先ごとに独立し (署名・状態・テスト送信・1 件ずつ再試行)、
配送失敗の一覧は cursor ページングで古い失敗にも到達できる。既存の環境変数 1 件は非破壊に移行され、不達はゲートの状態を変えず、失敗通知は再帰しない。

## Acceptance Criteria

- 管理者のみの送信先 CRUD API が動く (複数送信先・上限あり・重複 URL 拒否)。非管理者は全 API で 401/403。更新・削除は revision 楽観ロックで、不一致は 409。操作は監査される
- 一覧/取得の応答は URL を部分マスク形で返し、全 URL・path・query・userinfo を返さない。シークレットは応答・ログ・エラー・監査・通知・payload に出ない。DB には暗号文のみ (平文が DB に無いことを実 DB テストで確認)。暗号鍵はサーバー設定で、鍵の生成・保管・喪失時の影響・復旧手順が docs 化されている。鍵未設定では secret を平文保存せず明示エラーにする
- 送る通知は 4 カテゴリ (`outage` / `recovery` / `auto_stop` / `override`) から 1 つ以上選択でき、`GateEventKind` との対応が exhaustive match で実装・docs 化されている。選択したカテゴリのイベントだけが、イベント発生時点でその送信先を購読していた場合に配送される。`webhook_test` は選択対象外
- 配送は送信先ごと: event ID は送信先をまたいで同一かつ再試行・再送で不変、署名は送信先ごとのシークレット (E15w と互換のヘッダー・方式)、at-least-once、lease、再試行表は E15w どおり。1 つの送信先の失敗・遅延・復号不可が他の送信先とゲートに波及しない。新規送信先は作成後のイベントだけを配送し、遡及しない
- 送信先ごとの状態 (正常/配送失敗) が取得できる。テスト送信は送信先を指定して 1 回だけ送り、ゲート状態・通知一覧・未読件数・送信先の状態に影響しない。再試行は (送信先, event ID) 1 件単位と一括の両方ができ、同じ event ID を再送する
- 配送失敗の一覧が cursor ページングで取得でき、**最新 50 件より古い failed も到達・1 件再試行できる** (テストで固定)。送信先での絞り込みができ、成功履歴は出さない
- SSRF 対策が登録時と接続時の両方にある: HTTPS のみ、userinfo/fragment 拒否、全アドレス検査、接続固定、リダイレクト禁止、timeout、proxy 不使用。登録時に通った送信先でも接続時に内部アドレスを拒否し恒久失敗として記録する。fixture (内部アドレスへ解決するホスト名、IPv4-mapped IPv6、数値表記ゆれ、IPv6 ゾーン、末尾ドット、`localhost` 系、metadata アドレス、credentials 付き URL、`http://`、DNS rebinding、リダイレクト先が内部) で確認される。テスト用例外は本番設定から有効化できない
- 既存環境変数 1 件の移行が非破壊: 鍵あり = 初期送信先として冪等に一度だけ取り込み (既存の未完了/failed 配送を引き継ぐ)、鍵なし = 従来どおり配送され API から編集不可と分かる。取り込み後の削除で再取り込みしない。migration は E15w の配送記録を失わない。環境変数未設定/設定不備の挙動は E15w のまま
- E15w 契約の維持: Webhook の不達・failed・設定不備・復号不可・worker 停止・送信先 CRUD でゲートの状態は変わらず、これらが新しい通知イベント (配送対象) を生まない。テストで固定
- OpenAPI が再生成され差分検査に通る。既存 API (login・POST /api/v1/accounts・E15a の管理 API・通知一覧) の挙動は不変。E15w の集約 API を置換/維持した結果が PR 本文と docs に明記される

## Verification

- 純粋ロジックの単体テスト: カテゴリ ⇔ `GateEventKind` の対応 (全種別が必ずちょうど 1 カテゴリ)、URL のマスク (短い/長い path・query・ポート・IPv6 リテラル)、暗号化の往復と AAD 束縛 (他の送信先 ID では復号できない)、シークレット型の `Debug`/`Display` 非漏洩、送信先ごとの署名 (E15w のテストベクタと互換)、revision の競合判定、failed 一覧のカーソル計算
- **`DATABASE_URL` を設定した実 DB テスト** + ローカル fake receiver (**skip のみの成功は不可**。実行したテスト名と DB 接続での実行結果を PR に記載する):
  CRUD と revision 競合・上限・重複 URL、暗号文のみが DB にあること、送信先ごとの配送 (別シークレットで署名が異なる・event ID が同一)、1 つの送信先の障害が他へ波及しないこと、カテゴリ購読の選別、作成前イベントの非遡及、テスト送信が状態/一覧/配送記録に影響しないこと、1 件ずつの再試行と一括再試行、
  **failed が 50 件を超える状態で cursor を辿り最古の failed を再試行できること**、再起動 (in-flight の回収)・二重 worker の同時送信なし・429/5xx/timeout の再試行 (E15w の回帰)、環境変数の取り込み (鍵あり: 冪等・既存配送の引き継ぎ・削除後に再取り込みしない / 鍵なし: 従来配送の継続)、E15w の既存配送記録を持つ DB に対する migration、
  失敗・CRUD が新規通知イベントを生まずゲート状態が不変であること
- CRUD 認可 (非管理者 401/403)、secret 非漏洩 (全応答・ログ・エラー・監査・payload の検査)、URL マスク (全 URL・path が応答に無いこと)
- SSRF fixture (登録時と接続時の両方、上記の網羅リスト)
- OpenAPI 再生成 (`openapi.json`) と既存の差分検査、既存テスト全緑 (login・POST /api/v1/accounts・E15a/E15d/E15w の回帰を含む)、`git diff --check`

## 共有ファイルと merge 順

`server/src/openapi.rs`、`server/src/route.rs`、`server/src/root_router.rs`、`server/src/main.rs`、DI wiring、`migrations/`、`openapi.json` は他 unit と共有する。
**共有ファイルは一件ずつ統合し、その時点の main から `openapi.json` を再生成する**。migration 番号は統合時点の最新の次を採番する。共有ファイルの変更は最小限にし、他 unit の差分を巻き込まない。

## 親状態の所在

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
child は host 側の packet / intent / queue / ラベルを調査・変更しない。

## Related Links

- 設計 (host リポ): `intents/emumet/features/registration-readiness-gate/{overview,packets,acceptance,ui-spec}.md` (ui-spec 6「Webhook」)
- 決定: question-433de6d63c710adbcaa304b4ba7d1ba6 (送信先の登録・編集・削除 API を Emumet に追加してから ui-spec どおり実装)
- 依存: E15w `registration-admin-notification-webhook` (Emumet#68、PR #69 merge 済み)。通知種別は E15a (Emumet#65) / E15d (Emumet#81) の `GateEventKind`
- 後続: F15 `registration-gate-admin-ui` の Webhook タブ (shuttlepub-frontends#31、open のまま)。本 unit の OpenAPI 公開後に F15 が生成型を取り直して接続する

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/registration-readiness-gate/overview.md` (primary) + packets.md の E15x 行に完了リンク追記 (host 側で実施)
- ADR candidate: none (暗号鍵の運用は Emumet 側 docs。AEAD/鍵識別子の選定が設計上の重要判断になる場合は PR で ADR 候補として報告する)
- Diagram candidate: none
- Docs update: 受信側文書 (カテゴリ対応表・`enforcement_*` 種別・送信先ごとの署名)、鍵の運用文書、環境変数の移行手順は Emumet 側成果物。host 側 acceptance.md への closeout writeback は host で実施
- Closeout writeback expected: yes

## Guide Reachability (G645)

role-facing surface: 管理者向け REST API (`/api/v1/admin/registration-gate/webhook/endpoints*` ほか)、サーバー設定 (暗号鍵・既存環境変数の移行)、受信側/運用者向け Webhook 文書、OpenAPI。
guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
