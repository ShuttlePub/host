## Goal

D15 (一般登録の準備ゲート) の受け入れ確認で「未実装」と記録された 2 つの検証 (host `intents/emumet/features/registration-readiness-gate/acceptance.md`「E15x closeout」残余) を、回帰テストとして Emumet に追加する。

1. **tracing / ログに secret が出ないことの回帰テスト**: Webhook secret・暗号鍵・保護 provider の secret (Turnstile secret / SMTP 認証情報)・登録者メールアドレス・確認コード・email proof・bot token・guard の共有 secret・Webhook URL の path/query/userinfo が、tracing の全イベント (全レベル・全 target・span を含む) に出ない。
2. **Webhook 配送 worker・probe worker の停止 (shutdown / 再起動) で通知やジョブが消失・重複しないことのテスト**。

テストで実バグが見つかった場合は最小修正を含めてよい。範囲を超える修正は PR 本文で報告し、本 unit では行わない。

## Why This Slice Exists Now

E15x closeout (Emumet PR #100) と E15x/E15d 系の受け入れ確認で、上記 2 点だけが「未実装」のまま残った。D15 全体 (一般登録の公開) の準備ゲートとして、secret 漏洩と worker 停止時の通知消失・重複は運用事故に直結するため、F15 の Webhook タブ等の後続とは独立に先に固定する。

## Current Observed State

- tracing の出力元: `server/src/webhook_worker.rs` (`error = %error` で error_stack の Report を表示)、`server/src/registration_guard/{mod,probe,worker}.rs` (固定文言のみ)、`server/src/error.rs` (`{e:?}` で error_stack の Report を表示)、`application/src/service/registration_protection.rs` ほか。production の既定フィルタは `driver=debug,server=debug,tower_http=debug,hyper=debug,sqlx=debug`。secret が Report の attachment や `Debug` 派生に混入すれば、そのままファイルに出る。secret を出さないことを確認するテストは存在しない。
- Webhook worker (`server/src/webhook_worker.rs`): 協調 shutdown (`WebhookShutdown::trigger`) と in-flight サイクルの待ち合わせ (`JoinSet`) は `run` の中にあるが、`spawn` は `JoinHandle` を返さず、`server/src/main.rs` は `trigger()` の直後に return する。停止時の挙動 (in-flight 送信の結果記録、未送信イベントの保持、再起動後の再配送) を固定するテストはない。
- Probe worker: 強制 probe (`server/src/registration_guard/probe.rs` が `run_registration_enforcement_probe` を shutdown と `select!` し、shutdown でその future を drop する)、保護 maintenance (`worker.rs`)。maintenance の予約ロールバックのテスト (`aborted_cycle_rolls_back_due_reservation...`) はあるが、強制 probe を途中で打ち切った時の canary・evidence・gate 通知の不変条件を確認するテストはない。
- 配送の既存テスト: `driver/src/database/postgres/webhook_delivery/tests*`、`application/.../registration_gate_webhook/tests.rs`、`server/src/route/registration_gate/webhook_tests.rs` (実 DB、CI の `webhook-endpoints-db` ジョブ)。

## Accepted Baseline You May Assume

- E15w / E15x / E15d / E15b-c は Emumet main に merge 済み。Webhook の契約 (at-least-once・stable event ID・lease・指数バックオフ・最大 8 回/24 時間・failed は管理者の再試行まで再送しない・不達でゲート状態を変えない・失敗通知を再帰させない・応答本文は読み捨て) は変更しない。
- 「at-least-once」のため、**送信後・記録前にプロセスが死んだ場合の再送は仕様どおり** (lease 失効後に同じ event ID で再送)。本 unit の「重複しない」は、(a) 正常な協調 shutdown と再起動で同じ (送信先, event ID) が 2 回送られない、(b) 強制中断後の再送は lease 失効後に同じ event ID で 1 回だけ、他のイベントは重複・消失しない、(c) 通知イベント (gate event) と配送記録の行が重複・消失しない、の意味で固定する。

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/src/test_utils, kernel/Cargo.toml, server/src, application/src/service, driver/src/webhook, .github/workflows/lint-and-test.yml, docs`

Target part: tracing の secret 非漏洩の回帰テスト (共通のログ捕捉 test helper + Webhook 管理/配送・登録 guard hook・保護 provider/確認コードの各経路) と、Webhook 配送 worker・probe worker の shutdown / 再起動の消失・重複なしのテスト。実バグがあれば最小修正。CI で実 DB テストが skip されないことの検査。

## 検証の契約 (この節を仕様とする。型名・ファイル構成の細部は child が決めてよいが、満たすべき性質は固定)

### 1. tracing / ログの secret 非漏洩

- テスト用のログ捕捉 helper (production と同じ `tracing_subscriber::fmt` の出力形式。TRACE まで・全 target・span イベントを含む) を追加する。捕捉が空でないこと (自己検査: 意図的な canary イベントが見える、配送サイクルの情報ログが見える等) を各テストで確認し、捕捉の失敗で素通りしない。
- 検査対象の文字列 (テストごとに一意の値): Webhook の secret (作成時・更新時)、暗号鍵、Webhook URL の path / query / userinfo のトークン、保護 provider の secret (Turnstile secret・SMTP 認証情報)、登録者メールアドレス、確認コード、email proof、bot token、guard の共有 secret、probe canary の識別子から導かれるメールアドレス。意図して出す値 (例: 配送先ホスト名のみ) は許容リストを明示する。
- 経路: (a) Webhook 管理 API の作成・更新・テスト送信・再試行・削除と、失敗パス (不正 URL・userinfo 付き・重複・revision 競合・SSRF による拒否・復号不可・5xx・timeout) を実 DB で通し、HTTP 応答の経路 (`server/src/error.rs` の `{e:?}`) と配送サイクルのログを検査する。(b) 環境変数の送信先 (取り込みあり/なし) の起動ログ。(c) 登録 guard の hook (本物の `GuardApi` + 実 DB。許可 peer・secret 不一致・不正本文・受理/拒否/一時不可・canary) の経路。(d) 保護 (確認コードの発行・検証・失敗・provider 障害・maintenance) の経路。
- secret を保持する型の `Debug` / `Display` が secret を出さないことを、型ごとの表明で固定する (将来 `tracing::debug!(?value)` が追加されても漏れない)。

### 2. Webhook 配送 worker の停止・再起動

実 DB とローカル fake receiver (リクエスト数・event ID を記録) で、次を固定する。

- **協調停止 (サイクルの途中)**: 複数イベントの配送中に停止要求を出すと、次の送信に進まず終了する。送信済みは記録済み、未送信は due のまま (failed にならず、attempt が増えず、lease を保持しない)。再起動後 (別 worker ID) に残りが配送され、受信側が見る (送信先, event ID) は各 1 回。
- **worker の graceful shutdown (in-flight)**: 送信中に停止要求を出すと、`run` は in-flight の送信の結果記録を待ってから戻り、再起動後に同じイベントは再送されない。`main` が停止時にこの待ち合わせを行うこと (必要なら `spawn` が handle を返し、`main` が有界タイムアウトで待つ最小修正)。
- **強制中断 (プロセス死の模擬)**: 送信中に future/task を中断すると、lease が失効するまで別 worker は再送しない。失効後は同じ event ID で 1 回だけ再送され、最終的に delivered になる。他のイベントは重複・消失しない。
- **停止中に発生したイベント・再起動の冪等性**: worker 停止中に発生した gate イベントが再起動後に 1 回だけ配送される。再起動を繰り返しても配送記録の行・通知イベントの行が増えない。
- 停止・再起動はゲート状態を変えず、新しい通知イベントを生まない (E15w の契約)。

### 3. probe worker の停止・再起動

- **強制 probe (`run_registration_enforcement_probe`) の途中中断**: canary 準備後・送信中・クリーンアップ中の各時点で打ち切っても、(a) 打ち切りだけで gate が「準備済み/検証済み」になる (誤って fail-open) ことがない、(b) 打ち切りだけで通知イベント (outage 等) を捏造しない、(c) 未決済の canary は再起動後のサイクルで確認・クリーンアップされ、重複した canary や取り残しがない、(d) 予約 (schedule) は rollback され再起動後すぐ次のサイクルを実行でき、二重の gate 通知が出ない。
- **保護 maintenance の途中中断**: 任意の時点で打ち切って再実行しても、gate の通知イベントの重複・消失がない (中断位置を掃引するテスト)。
- worker の停止要求 (`GuardShutdown`) で probe / maintenance ループが戻ること、停止後に次の tick を実行しないこと。

### 4. CI

- 追加テストは実 DB (`DATABASE_URL`) で実行され、**skip のみの成功ではない**ことを CI が検査する (`passed ≥ 1`・`0 ignored` の既存の流儀。必要なら新しい job または step を追加)。

## In Scope

- ログ捕捉 helper (test-only。production の依存・挙動を変えない) と、上記 1〜3 のテスト。
- テストで見つかった実バグの最小修正 (例: `main` が worker の停止を待たない)。修正は PR 本文に実バグとして明記する。
- CI の実 DB テストの実行検査の追加、docs (`docs/` の運用記述) への検証内容の追記 (必要な場合のみ)。

## Out Of Scope

- Webhook / probe の仕様変更、新機能、OpenAPI の変更 (API は変えない)。`openapi.json` は変更しない。
- 鍵ローテーション、at-least-once を exactly-once に変える変更、worker 全般 (projection / profile delivery) の shutdown 見直し。
- 範囲を超える修正が必要な問題は、修正せず PR 本文で報告する。
- 実 Kratos E2E (既存の別ジョブ)。

## Standalone Child Issue Contract

この PR は、登録ゲート (Webhook・保護・probe) の (1) tracing に secret・登録者の個人情報が出ないこと、(2) Webhook 配送 worker と probe worker の停止・再起動で通知やジョブが消失・重複しないこと、を実 DB の回帰テストで固定する。テストで実バグが見つかれば最小修正を含め、範囲外の問題は報告にとどめる。API・仕様・OpenAPI は変えない。

## Acceptance Criteria

- 共通のログ捕捉 helper があり、各テストが捕捉の非空を自己検査する。Webhook 管理 (作成/更新/テスト/再試行/削除と失敗パス)・配送サイクル・環境変数の起動ログ・登録 guard hook・保護 (確認コード・provider 障害・maintenance) の全経路で、列挙した secret / メールアドレス / 確認コード / URL の path・query・userinfo / 暗号鍵が全レベルのログに出ない
- secret を保持する型の `Debug` / `Display` が secret を出さない表明がある
- Webhook 配送 worker: 協調停止 (途中)・graceful shutdown (in-flight)・強制中断 (lease 失効後に同じ event ID で 1 回だけ再送)・停止中イベントの再起動後の 1 回配送・再起動の冪等性が実 DB テストで固定され、受信側の (送信先, event ID) の重複と消失がない。`main` が停止時に worker の in-flight 完了を有界時間で待つ
- probe worker: 強制 probe と保護 maintenance の途中中断で、fail-open・通知の捏造・canary の取り残し・重複がなく、再起動後に収束する。停止要求でループが戻る
- 停止・再起動はゲート状態を変えず、新しい通知イベントを生まない
- 追加テストは `DATABASE_URL` 設定の実 DB で実行され、skip のみの成功ではない。CI がそれを検査する。既存テストは全緑、`openapi.json` は変更されない

## Verification

- `DATABASE_URL` を設定した実 DB で、追加テストと関連する既存テストを実行する (**skip のみの成功は不可**。実行したテスト名と passed / ignored 件数を PR に記載する): `cargo test -p kernel`、`cargo test -p driver webhook`、`cargo test -p application registration_`、`cargo test -p server` (追加分と webhook / registration_guard)
- 追加したログ捕捉テストが「secret を出すコード」を検出できること (一時的に漏洩を仕込んで失敗することの確認結果を PR に記載する)
- `cargo fmt --check`、`cargo clippy`、`git diff --check`、`cargo test -p server write_openapi_spec_to_file -- --ignored` 後に `git diff --exit-code openapi.json`

## 共有ファイルと merge 順

`server/src/main.rs` は他 unit と共有する。変更は worker 停止の待ち合わせに限定し、他 unit の差分を巻き込まない。

## 親状態の所在

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
child は host 側の packet / intent / queue / ラベルを調査・変更しない。

## Related Links

- 設計 (host リポ): `intents/emumet/features/registration-readiness-gate/{overview,packets,acceptance}.md` (acceptance.md の E15x closeout 残余)
- 依存: E15w `registration-admin-notification-webhook` (Emumet#68)、E15x `registration-webhook-endpoint-management` (Emumet#97 / PR #100 merge 済み)、E15b-c (保護・probe)、E15d (enforcement probe)
- 後続: D15 の一般登録の公開判断。

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/registration-readiness-gate/overview.md` (primary)。acceptance.md の「未実装」記述を、完了後に host 側で更新する
- ADR candidate: none
- Diagram candidate: none
- Docs update: 検証内容の運用記述 (必要な場合のみ)。host 側 acceptance.md への closeout writeback は host で実施
- Closeout writeback expected: yes

## Guide Reachability (G645)

role-facing surface: なし (テストと CI のみ。API・設定・文書の利用者向け面は増えない。`main` の停止待ちは運用者に見えない内部挙動)。
guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
