# registration-gate-control-plane Implementation Packet

## Goal

D15 (registration-readiness-gate) の「登録ゲート」を管理者が操作する control plane を Emumet に実装する。
管理者の開閉、設定喪失後の手動再開、override (警告確認必須・明示解除まで有効・常時表示)、revision、
監査、状態遷移、通知イベント、管理者別既読を、純粋状態機械 + 永続化 + 管理者 REST API として提供する。
**実 Kratos の遮断・実 provider の検証は含まない** (後続 unit)。この unit が完了しても、実際の新規登録はまだ守られない。

## Why This Slice Exists Now

D15 のユーザー決定 (d15-q01〜q11) は、判定ロジック・状態・通知を伴う。Kratos 側の遮断方式 (E15b で実証) や
provider 検証 (E15c) に先立って、状態表と通知イベント契約を単体で確定・検証できる。後続の E15c/E15d/E15w/F15 は
この契約に依存する。

## D15 決定の要約 (仕様の正本は host の grill 記録 d15-q01〜q11)

- q01 最低条件は「メール認証 OR BOT 対策」。どちらか一方でよい。両方は必須ではない。どちらもない状態は通常認めない
- q02 開放後の設定変更で両方が無効になったら新しい一般登録を自動停止 (一方が有効なら該当しない。既存利用者のログイン・利用は対象外)
- q03 停止後は復旧しても自動再開せず管理者の手動再開が必要。再開時も最低条件を満たさなければ開放不可。管理者の手動閉鎖を自動解除しない
- q05 設定が有効なだけでは「準備済み」ではない。検証 API が実際に応答した対策だけが有効な対策 (本 unit では観測入力として扱う)
- q06 設定を失わない一時障害で最低条件を満たす対策が残らない間は一般登録のみ一時拒否。障害発生・復旧を通知し、復旧後は手動再開なしで自動再開
- q07 両方を用意して片方のみ障害なら、動作中の対策のみを課して継続。防御低下を通知
- q09/q10 無対策でも管理者が警告を明示確認すれば開放できる override。明示解除まで有効で、有効中は通常の自動停止・障害時拒否判定を行わず、常時表示
- q11 通知は管理画面内の通知一覧 + 未読表示 + 外部 Webhook。メール通知は前提にしない (Webhook は E15w)

## Current Observed State

(観測時点: Emumet HEAD ef82462)

- 登録ゲートに相当する実装・テーブル・API はない。ローカル Kratos は registration/password 有効で verification・CAPTCHA 項目なし
- 管理系 API の先例: `server/src/route/report/admin.rs` (AdminReportApi、Keto による admin/moderator 判定)
- 直近 migration: `migrations/20260904000001_profile_transfer.sql`

## Accepted Baseline You May Assume

- 準備ゲートの対象は Ory self-service registration のみ。ログイン済み利用者の `POST /api/v1/accounts` と login は対象外 (q08)。本 unit は既存 API を変更しない
- 観測入力 (対策ごとの「設定有無」と「検証 API の観測結果」) は kernel の型 + port として定義し、テスト fixture と内部 use case からのみ供給する。公開 HTTP の無認可書込口は作らない
- 管理者認可は既存の admin 判定を再利用する。新しいロールモデルを作らない

## Target Repo / Path / Part

- Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/src/entity, kernel/src/repository, application/src/service, server/src/route, server/src/api, server/src/openapi.rs, server/src/route.rs, server/src/main.rs, driver/src/database/postgres, migrations, openapi.json`

- Target part: 登録ゲート control plane (純粋状態機械 + 永続化 + 管理者 REST API + OpenAPI 再生成)

## 状態表 (この表を純粋状態機械のテストで固定する)

用語: 対策 P ∈ {email, bot}。`configured(P)` = 設定上有効、観測 = Healthy / Unhealthy / Unknown。
`effective(P)` = configured(P) かつ観測が Healthy (q05。Unknown は有効扱いしない)。最低条件 = いずれかの P が effective。
管理者状態 = Closed | Open (初期状態は Closed。手動閉鎖は管理者のみが解除する)。

| 管理者状態 | override | ラッチ | 観測 | 判定 |
|---|---|---|---|---|
| Closed | * | * | * | AdminClosed (拒否)。override は閉鎖状態を開かない |
| Open | On | * | * | Accept。通常の自動停止・障害時拒否判定を行わない (q10)。ただし effective な (準備済みの) 対策があれば登録時に課す。override は準備未完了・障害でも開放するだけで、準備済み保護を外さない |
| Open | Off | ConfigLost | * | Stopped (拒否)。復旧しても自動で解除しない (q03) |
| Open | Off | なし | configured が 0 件 | ラッチ ConfigLost 成立 → Stopped (q02) |
| Open | Off | なし | configured ≥ 1 かつ effective が 0 件 | TemporaryReject (拒否)。いずれかが Healthy に戻れば自動で Accept (q06) |
| Open | Off | なし | effective ≥ 1 件 | Accept。課す対策は effective な対策のみ。configured だが非 effective な対策があれば防御低下 (q07) |

遷移操作 (すべて revision 必須・監査対象):

- open: 最低条件を満たす (effective ≥ 1) 場合のみ成功し、ラッチを解除する (手動再開を兼ねる)。満たさない場合は拒否 (422 相当)
- open + override (警告 ack 必須): 最低条件を満たさなくても開放でき、override=On にする。ack がなければ拒否
- close: 手動閉鎖。override/ラッチの値は保持するが判定は常に AdminClosed
- revoke override: override=Off にして通常判定へ戻る。解除時点の観測を上表で再評価する (configured が 0 件ならラッチ ConfigLost で Stopped、configured ≥ 1 かつ effective 0 件なら TemporaryReject、effective ≥ 1 なら Accept)。管理者状態は Closed にしない
- 観測の更新 (内部入力): 上表で判定を再計算する。ラッチの成立は『Open かつ override Off かつ configured 0 件』の観測時のみ

この表は提案ではなく受け入れ基準の具体化である。なお override の細部 (準備済み保護の扱い・解除後の挙動・通知・常時表示) は親が最終確認中で、本 packet の記述を現時点の仕様とする。変更があれば issue で連絡される。実装上の細部 (型名・DB 列・API パス) は child が決めてよい。
表と矛盾する要求・仕様の曖昧さを見つけた場合は実装を進めずに issue へ質問すること (勝手に拡張しない)。

## 通知イベントと重複排除

- 種別 (最低限): `outage_started` / `outage_recovered` (q06)、`protection_degraded` (q07。片方のみ障害)、`protection_lost_stopped` (q02 のラッチ成立。手動再開が必要であることを管理者が知るため)、`override_started` / `override_revoked` (override の開始・解除。誰が実行したかは監査記録にも残す)
- 各イベントは安定した event ID を持ち、状態遷移と同一 transaction で保存される (E15w が後で同じ永続イベントを配送する。本 unit では配送しない)
- 同一 episode (状態が継続している間) の probe/観測の反復では新しいイベントを作らない。episode が終わって再度発生した場合は新しい episode として生成する
- 既読は管理者ごとの独立した記録。未読件数 API は呼び出した管理者の未読だけを返し、別の管理者の既読を共有・上書きしない

## In Scope

- 純粋状態機械 (上の状態表) と観測入力の型 / port、通知イベント生成ロジック
- 永続化: ゲート状態 (revision 付き)、監査記録、通知イベント、管理者別既読。migration (最新番号の次)
- 管理者向け REST API (パスは仮: `/api/v1/admin/registration-gate*`): 状態取得 (override 中・ラッチ・理由を含む)、開閉、override 有効化/解除、通知一覧、未読件数、既読化
- 同時更新の競合 (revision 不一致 409)、管理者認可、OpenAPI (utoipa) と `openapi.json` の再生成

## Out Of Scope

- 実 Kratos registration の遮断・hook 配線・Kratos 設定/compose の変更 (E15d / E15b)
- 実 provider 検証 API 呼び出し・設定世代・鮮度期限 (E15c)
- 外部 Webhook 配送 (E15w)、管理 UI (F15)、メール通知
- 招待システム、login の遮断、`POST /api/v1/accounts` へのゲート適用、Account 数上限等の濫用対策

## Standalone Child Issue Contract

この PR は、Emumet に D15 登録ゲートの control plane を導入する。管理者は REST API でゲートを開閉・手動再開・override でき、
状態遷移と通知イベントは同一 transaction で保存され、通知は管理者ごとに既読管理される。
実 Kratos 遮断・実 provider 検証は含まないため、この PR 単体では新規登録は守られない。

## Acceptance Criteria

- 最低条件 (メール OR BOT) の判定が 4 例 (メールのみ/BOT のみ/両方/どちらもなし) で成立する
- 片方のみ障害: 動作中の対策のみ必須で継続し、防御低下の通知イベントが 1 回だけ生成される
- 両方が一時障害: 一時拒否 + 障害通知。復旧観測で手動再開なしに自動で受付に戻り、復旧通知が生成される
- 設定喪失: 停止ラッチ成立。復旧しても自動再開せず、手動再開のみで解除。再開時に最低条件未達なら拒否。手動閉鎖を自動解除しない
- override: 警告 ack 必須、明示解除まで有効、有効中は通常の停止・障害拒否判定をしない (準備済みの保護は登録時に課す)、解除後は通常判定へ戻る、開始・解除が通知イベントになる、取得 API で常時判別できる (管理画面の全ページ常時警告表示 F15 が参照できる)。状態表が純粋状態機械のテストで固定されている
- 状態遷移と通知イベントを同一 transaction で保存する。同一 episode の probe 反復で通知が増殖しない
- 既読状態は管理者間で共有されない
- revision による競合検出 (409)、監査記録、管理者以外は拒否 (401/403)。既存 API (login・POST /api/v1/accounts) の挙動は不変
- OpenAPI が再生成され差分検査に通る

## Verification

- 純粋状態機械の単体テスト: 状態表の全行、各遷移操作、ラッチと手動閉鎖の相互作用、override 解除時の挙動
- `DATABASE_URL` を設定した実 DB テスト (状態・revision・監査・通知・既読の永続化、同一 transaction、episode 重複排除、管理者別既読)。**実 DB テストが skip されただけの成功は不可**。実行したテスト名と DB 接続での実行結果を PR に記載する
- 管理者認可 (非管理者 401/403)、同時更新の競合 (409)、通知一覧・未読件数・既読 API のテスト
- OpenAPI 再生成 (`openapi.json`) と既存の差分検査、既存テスト全緑 (login・POST /api/v1/accounts の回帰を含む)、`git diff --check`

## 共有ファイルと merge 順

`server/src/openapi.rs`、`server/src/route.rs`、`server/src/main.rs`、DI wiring、`migrations/`、`openapi.json` は他 unit
(特に別レーン E8) と共有する。**この unit を E8 より先に merge する** (E8 は E15a 取り込み後に OpenAPI を再生成する)。
共有ファイルの変更は最小限にし、merge 時はその時点の main から OpenAPI を再生成すること。

## 親状態の所在

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
child は host 側の packet / intent / queue / ラベルを調査・変更しない。

## Related Links

- 設計 (host リポ): `intents/emumet/features/registration-readiness-gate/{overview,packets,acceptance}.md`
- ユーザー決定の正本: host リポ `intents/shuttlepub/packets/candidates.md` D15 節、`intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json` (d15-q01〜q11)
- 後続: E15c `registration-protection-readiness` / E15d `registration-gate-enforcement` (E15b の実証確認後に draft)、E15w、F15

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/registration-readiness-gate/overview.md` (primary) + packets.md の E15a に完了リンク追記 (host 側で実施)
- ADR candidate: none
- Diagram candidate: none
- Docs update: 状態表・通知イベント契約・「実登録はまだ守らない」境界を acceptance.md へ (host 側 closeout writeback)
- Closeout writeback expected: yes

## Guide Reachability (G645)

role-facing surface: 管理者向け REST API (`/api/v1/admin/registration-gate*`) と OpenAPI。
guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
