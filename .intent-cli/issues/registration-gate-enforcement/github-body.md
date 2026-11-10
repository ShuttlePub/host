# registration-gate-enforcement: 実 Kratos registration hook 配線・保護実行・継続 probe・通知統合・設定喪失検出 (D15 全状態の実 registration 検証)

## Goal

D15 (registration-readiness-gate) の登録ゲートを**実 Kratos の self-service registration に配線して実際に守る**。具体的には
(1) 有効な全 registration method に method-specific pre-persist hook (`response: {parse: true, ignore: false}`) を接続し、204 許可 / 構造化 403 拒否で identity 作成前に止める、
(2) hook の認証・allowlist context・deadline、(3) E15a の最新状態と E15c の保護 (email proof / Turnstile) を最終 submit ごとに評価する保護実行、
(4) 継続 probe の周期実行、(5) ゲート状態・通知イベント (E15a) と Webhook 配送 (E15w) の統合、
(6) 本番 Kratos 設定変更 (E15d が所有)、(7) 設定喪失 (hook 削除・config 不一致・未照合 replica) の検出と enforcement 喪失の扱い、
(8) D15 の全状態を**実 registration で確認する統合テストを CI で実行**する。
D15 全体の受け入れは E15d + E15w + F15 (画面実装を含む) が揃うまで保留で、本 unit 単独で D15 完了を主張しない。

## Why This Slice Exists Now

E15a (control plane)・E15w (Webhook) は main 済みで、E15b の実証と ADR (host `intents/emumet/decisions/registration-protection-placement.md`、2026-11-10 Accepted) により
hook の配線方式 (method-specific pre-persist + parse:true)・応答形式・失敗時 fail-closed・保護の所在が確定した。
E15c が保護 adapter と readiness 観測を提供する。この unit が最後の配線で、ここで初めて実登録が守られる。

## D15 決定・ADR の要約 (仕様の正本は host の grill 記録 d15-q01〜q11 と ADR)

- q01 最低条件は「メール認証 OR BOT 対策」(両方健全なら両方・片方障害なら健全側のみ必須: q07)。q02/q03 設定喪失で停止 latch・復旧しても自動再開せず管理者の手動再開 (再開時も最低条件未達なら不可、手動閉鎖は自動解除しない)
- q05 検証 API の実応答を確認して初めて準備済み。q06 設定を失わない一時障害は一般登録のみ一時拒否・通知し、復旧後は自動再開。q08 ゲート対象は Ory self-service registration のみ (login・認証済み `POST /api/v1/accounts` は対象外)
- q09/q10 override は無対策でも開放できるが、**override 中も effective な保護は登録時に課す** (hook 自体の不達を fail-open に変えない)。明示解除まで有効・解除で通常判定に戻る・開始/解除も通知 (一覧 + Webhook)・管理画面に常時表示。q11 通知は管理画面一覧 + 未読 + 外部 Webhook (メールは前提にしない)
- q04 特定相手への招待登録: 新招待システムは作らない。既存の対象限定招待が**存在する場合のみ**識別して除外し、現状存在しなければ何も追加しない

## Current Observed State

- 本番/dev 設定: `ory/kratos/kratos.yml` は registration (ui_url) と password method が有効で hook・verification・CAPTCHA 設定なし、`compose.yml` は `oryd/kratos:v1.3.1` を dev モードで起動。E15b は本番設定を変更していない
- E15a (main): `RegistrationGateView { state, decision }`・`evaluate`・`RecordRegistrationObservationUseCase`・通知イベント (同一 transaction)。E15w (main): 通知イベントの永続 worker 配送
- E15c: email proof の内部検証/消費 use case、Turnstile adapter、readiness 記録・鮮度評価・1 回 probe use case、観測反映 (この unit の前提。E15c が merge されるまでその PR 契約に合わせ、merge 後に main へ rebase)
- E15b 実証 (Emumet PR [#79](https://github.com/ShuttlePub/Emumet/pull/79)、head `bbf07136e9937520d828cce9a5027723ba2a82f5`、packet 化時点で未 merge): `e2e/registration-guard/{CONTRACT,RESULTS,README}.md`、隔離 compose・hook fixture (`hook.jsonnet`・`kratos.json`・`run.py`・`run.sh`)・29 ケースの結果。これを本番 hook と統合テストの出発点にする (merge 後は main の同ファイルを正とする)
- 実証済みの落とし穴: 200 JSON の `allowed:false` は無視され identity が作成される / parse:false (post-persist) は拒否でも identity が残る / global `registration.after.hooks` は pre-persist ではない (hook 未呼出で作成) / 201 不正 JSON は parse されず作成 / hook 削除は health 200 のまま identity が作成される / hook timeout は約 30 秒×3 + backoff ≒ 93 秒 (public は EOF にもなる) / candidate identity ID は zero UUID になり得る

## Accepted Baseline You May Assume

- 保護の所在は ADR のとおり確定 (Emumet hook + SMTP 登録前 proof + Turnstile)。Kratos native code 登録への切替・Kratos post-registration verification を所有確認の代用にしない。変更が必要になったら実装せず親に質問する
- hook の許可標準形は **204 空本文**、拒否標準形は **403 + Kratos validation messages**。200 `allowed:false`・200 でのエラー返却・201 を使わない。内部失敗分類 (429/503 等) をそのまま hook HTTP に流さない
- E15a の最新状態を**最終 submit ごとに評価**する。client の fake override・古い flow・UI 迂回は許可根拠にならない。gate の許可 verdict は cache しない (proof の冪等は E15c の検証済み事実のみ)
- 管理者認可は既存 admin 判定の再利用。E15a/E15w/E15c の契約を変更しない (enforcement 喪失の表現に最小限の拡張が要る場合は既存テスト・意味を維持して記録)
- 実 credential・有料契約・本番クラスタの資格情報が必要になったら取得・使用せず、親 (host 側 Worker) に質問する。本番クラスタ (`~/.kube` 等) を直接操作しない

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `application/src/service, kernel/src, driver/src, server/src/route, server/src/api, server/src/main.rs, server/src/route.rs, server/src/openapi.rs, migrations, openapi.json, ory/kratos, compose.yml, e2e/registration-guard, .github/workflows, docs`

- Target part: 実 Kratos registration hook 配線 (method-specific pre-persist・認証・allowlist・deadline)・保護実行・継続 probe 周期実行・通知統合・本番 Kratos 設定変更・config attestation と設定喪失検出・D15 全状態の実 Kratos 統合テスト (CI)・運用手順

## 契約 (この節を仕様とする。型名・DB 列・パス・具体値は child が決めてよいが、満たすべき性質は固定。具体値を変えるときは理由を PR と docs に記録する)

### 1. hook 配線 (Kratos 設定は E15d が所有)

- `selfservice.flows.registration.after.<method>.hooks` に `web_hook` を置き `response: {parse: true, ignore: false}` を必須とする。**有効な全 registration method を列挙して同じ配線と拒否 matrix を適用し、hook の無い有効 method を公開しない** (現状 password。将来 code/OIDC/passkey/WebAuthn 等を有効化するときは同じ hook と拒否試験が必要。未保護 method は無効化する)。CI に「有効な registration method の集合 ⊆ hook 付き method の集合」を検査する静的テストを置く
- global `registration.after.hooks`・`parse:false`・deprecated `can_interrupt:true` を代用にしない。login/settings/recovery・認証済み `POST /api/v1/accounts` には hook を接続しない (hook 呼出増分 0 を回帰テストで固定)。既存 login を止める global method toggle を代用にしない
- hook リクエスト本文は jsonnet 等で allowlist (`identity.traits.email`、`identity.verifiable_addresses`、`flow.id`、`flow.type`、`flow.transient_payload` の email_proof/bot_token 等) のみ。credential・cookie・session を送らない。本文テンプレートは immutable な参照 (`file://`) とし、その内容 digest も照合対象にする

### 2. hook 認証・経路・deadline・応答

- hook は private / authenticated / TLS 経路 (認証方式 — 共有 secret ヘッダー・mTLS 等 — は child が決め docs に記録)。到達元制限を設け、公開 ingress から到達できない。E15b fixture の unauthenticated HTTP/control endpoint を本番へ持ち込まない。認証の無い/不正な呼出は拒否 (許可を返さない)。hook 経路は公開 OpenAPI (`openapi.json`) に載せない
- provider 呼出 deadline は 30 秒より十分短く (初期値案: provider 3 秒、hook 全体 5 秒以内)。timeout・内部エラー・判定不能は **fail-closed の拒否 (403)** とし、Kratos の 3 回 retry を誘発する 5xx にしない (identity が作成されないこと)。hook 応答は 204 または 403 + validation messages のみ。拒否文言は登録者に過度な内部情報 (設定喪失・provider 名・内部エラー詳細) を漏らさず、一時拒否 (再試行可能) と恒久拒否 (閉鎖・proof 不正) を利用者が区別できる程度に分ける
- retry (最大 3 呼出) に対し proof 検証は冪等 (E15c)。gate 許可 verdict は毎回最新評価

### 3. 保護実行 (最終 submit ごとの評価)

- 評価順: E15a の最新 `RegistrationGateView` を取得し decision を判定。Accept (または override On) でなければ拒否 (TemporaryReject・Stopped・AdminClosed は 403)。
  Accept/override では E15a の `effective_protections` に応じ、**effective な保護だけを必須**とする: email effective なら有効な `email_proof` (flow/email/generation に束縛・原子的消費)、bot effective なら有効な `bot_token` (Siteverify の business success + hostname/action・一回性)。両方 effective なら両方、片方なら健全側のみ、effective が 0 件で override On のときだけ保護なしで許可 (**override 中も effective な保護は課す**)
- client の `override=true` 等の自己申告は権限でも proof でもない。`attempt_rejected` (不正 proof/token) は当該登録のみ拒否し provider 全体を障害扱いしない。hook 自身が provider 一時障害を検知した結果は E15c の分類経由で観測へ反映され、**hook ごとにゲート状態や通知を増殖させない**
- hook 評価完了後に始まった管理者閉鎖まで取り消せるとは主張しない (評価〜persist 間の閉鎖を二つの DB 跨ぎで原子化することは未検証。docs に制約として明記)

### 4. 継続 probe

- E15c の 1 回 probe use case を周期実行する worker (poll 駆動 + shutdown。`server/src/projection_worker.rs` / E15w worker の先例)。複数 replica/プロセスで動いても重複実行・通知増殖が起きない (lease/advisory lock 等)。周期は readiness の `valid_until` に対し十分短い (docs に値と根拠)
- probe 停止・再起動・遅延は readiness の鮮度期限で `unverified` へ落ちる (古い成功を使わない)。再起動後に最後の観測から再開し、不当な ready を復活させない。probe の反復で revision・通知を増やさない (E15a の性質を維持)
- 観測は `RecordRegistrationObservationUseCase` 経由。Webhook 不達は probe/ゲートを変えない (E15w の性質)

### 5. ゲートと通知イベントの統合

- 状態遷移 (一時拒否・復旧・防御低下・設定喪失の停止・override 開始/解除) が E15a の通知イベントとして同一 transaction で永続化され、E15w の配送記録が作られ (管理画面を開いていなくても Webhook に届く)、管理者別の既読/未読が機能することを実 registration を伴う統合で確認する。通知は状態遷移ごとの 1 件で、個々の hook 拒否は通知を生まない

### 6. 設定喪失の検出と enforcement 喪失 (ADR の引継ぎ)

- 前提: **hook 自体の削除は呼ばれない hook では拒否できない** (E15b で hook 削除後に identity が作成された)。監視/poll だけでは消失直後の bypass window を消せない。provider 設定だけの喪失 (hook は存在) と enforcement の喪失は別障害として扱う
- 必須: (a) immutable な Kratos 設定 (設定・hook 本文テンプレート・identity schema 等の内容 digest を trusted deployment manifest と照合。config hash が外部ファイル内容まで覆うと仮定しない)、(b) 起動時および継続の **config attestation** — Kratos admin `GET /health/config` の merged 実効 config SHA256 と binary/image digest を、全 replica について trusted manifest と照合 (health 200・設定ファイル存在・hash の存在だけでは ready にしない)、(c) **未照合/不明 replica を公開しない** ingress/admission (Kratos public への直接 API を含む全到達経路に迂回 route が無い)、(d) 同じ artifact/config での隔離 positive/negative canary (許可/拒否と admin/DB の identity 差分)
- attestation 失敗・未照合 replica・実効 config 不一致・canary 失敗を **enforcement 喪失**として E15a にどう反映するかを設計する (例: 停止 latch へ遷移し手動再開を要求、通知イベント生成)。E15a の入力型で表現できなければ**最小限に拡張**し、既存の状態表・テスト・意味を維持する。再開 (手動) 時は attestation が通ることを条件にする
- ingress/admission の本番クラスタ適用 (Emumet リポジトリ外の運用/マニフェストが必要な場合) は、リポジトリ内に再現可能な参照構成・検証手順・canary スクリプト・運用手順を残し、実クラスタ適用に認可/資格情報が要るなら取得せず親へ質問する。参照構成 (compose/proxy) で「未照合 replica へルーティングされない」ことを CI で実証する

### 7. D15 全状態の実 registration 確認 (CI)

- 実 Kratos (v1.3.1、image digest 固定) + PostgreSQL + 実 Emumet server + ローカル SMTP 模擬 + Turnstile 公式公開テストキー/fake provider の統合テストを **CI で実行**する。結果の identity 有無は Kratos admin API と DB の両方で突合し、拒否後は遅延 persist も再観測する
- E15b の fixture/runner を再利用・拡張してよい。ローカルで compose を使う場合は E15b の先例 (専用 project 名・tmpfs・自動 teardown しない・既存データを削除しない) に従い、実行環境の許可が得られない場合は親に質問するか CI で検証する

## In Scope

- `ory/kratos/kratos.yml`・hook 本文テンプレート・`compose.yml` (本番/dev 設定) への method-specific pre-persist hook 接続と、有効 method 網羅の静的検査
- hook endpoint (認証・allowlist・deadline・204/403)・保護実行 use case・継続 probe worker・`server/src/main.rs` での起動
- config attestation・enforcement 喪失の検出と E15a への反映 (必要最小限の拡張)・参照 ingress 構成・canary・運用手順
- D15 全状態の実 Kratos 統合テストと CI ジョブ・回帰テスト (login・`POST /api/v1/accounts`)
- 運用文書 (Emumet 側 docs): hook 構成、認証、deadline、attestation/canary 手順、設定喪失時の対応、手動再開手順、既知の制約

## Out Of Scope

- 新しい招待システム、login の遮断、`POST /api/v1/accounts` (追加 Account 作成) へのゲート適用
- 未検証 provider の追加、Kratos native code 登録への切替、E15c adapter の仕様変更、E15w 配送の変更
- 管理 UI (F15)。Webhook の受信側
- 本番クラスタへの実適用に必要な資格情報の取得・直接操作 (必要なら親へ質問)
- D15 全体の完了宣言 (E15w・F15 も揃うまで保留)

## Standalone Child Issue Contract

この PR は、Emumet の登録ゲートを実 Kratos self-service registration に配線して実際に守る。有効な全 registration method に method-specific pre-persist hook (parse:true/ignore:false、204 許可/構造化 403 拒否) を認証つきで接続し、
最終 submit ごとに E15a の最新状態と E15c の保護 (email proof / Turnstile) を評価する (override 中も effective な保護を課す)。継続 probe・通知イベントと Webhook の統合・config attestation による設定喪失検出 (hook 削除・未照合 replica) を実装し、
D15 の全状態を実 Kratos 経路の統合テストで CI 実行して確認する。login・追加 Account には影響しない。D15 全体の受け入れは E15w・F15 が揃うまで保留。

## Acceptance Criteria

- **D15 q01〜q11 の全状態を実 registration (実 Kratos・実 Emumet・実 DB) で確認**: メールのみ/BOT のみ/両方/どちらもなし (q01)、一方障害で動作中の対策のみ課して継続 + 防御低下通知 (q07)、両方一時障害で一時拒否 → 復旧で手動再開なしに自動再開 + 通知 (q06)、設定喪失で停止 latch → 復旧しても自動再開せず管理者の手動再開のみ・再開時に最低条件未達なら不可・手動閉鎖を自動解除しない (q02/q03)、設定済みだが未検証は effective でない (q05)、override は明示解除まで有効で effective な保護は override 中も課される・解除で通常判定に戻る・開始/解除が通知される (q09/q10)、通知一覧/未読/Webhook 配送記録 (q11)
- 有効な全 registration method に method-specific pre-persist hook があり、hook 無しの有効 method が無いことが静的検査と実拒否試験 (browser JSON/form・API・閉鎖前に作成済みの flow・UI を経由しない直接 API・設定変更後の flow) で確認される。拒否した registration で identity が作成されない (Kratos admin API と DB の両方で確認し、遅延 persist も再観測)
- hook は認証必須・私的経路・allowlist context・deadline (provider 3 秒/hook 全体 5 秒を目安) で、timeout/内部エラー/判定不能は 403 の fail-closed (identity 作成なし、Kratos retry を誘発しない)。204/403 以外を返さず、`allowed:false` 200 等の落とし穴を踏まない。client の fake override・不正 proof/token は許可根拠にならない
- 継続 probe worker が周期実行され、複数プロセスでも重複・通知増殖がなく、停止・再起動・遅延で古い ready が残らない (鮮度期限で unverified)。Webhook 不達でもゲートは不変
- ゲート状態遷移・通知イベント・Webhook 配送記録・管理者別未読が実 registration を伴う統合で一貫し、個々の hook 拒否が通知を増殖させない
- config attestation が全 replica の実効 config hash・binary/image digest・参照ファイル digest を trusted manifest と照合し、hook 削除・hash 不一致・未照合/不明 replica・canary 失敗を enforcement 喪失として検出して E15a に反映する (停止/手動再開、再開は attestation 成功が条件)。health 200・設定ファイル存在・hash の存在だけでは ready にならない。参照 ingress 構成で未照合 replica へ到達できないことが CI で実証される
- login (既存 identity) と認証済み `POST /api/v1/accounts` (追加 Account) はゲート閉鎖/障害でも影響を受けず、hook 呼出増分 0 が確認される。新招待システム・login 遮断・追加 Account へのゲートを追加していない
- 統合テストが CI で実行され、skip のみの成功は不可。実行したテスト名・件数・結果を PR に記載する。既存テスト全緑 (login・POST /api/v1/accounts・E15a/E15w/E15c の回帰)・OpenAPI 差分検査・`git diff --check`
- 運用手順 (hook 構成・認証・attestation/canary・設定喪失時の対応・手動再開・制約: 評価後〜persist 間の閉鎖) が docs に記録される

## Verification

- 実 Kratos 経路の統合テスト (CI): 実 Kratos v1.3.1 + PostgreSQL + 実 Emumet + ローカル SMTP 模擬 + Turnstile 公式公開テストキー/fake provider。ケース: 上記 D15 全状態 × browser JSON/form・API・作成済み flow・UI 迂回・設定変更後・hook timeout/切断/不達・Emumet 再起動・probe 停止/再開・通知生成と Webhook 配送記録・login/追加 Account 回帰。identity 有無は admin API と DB で突合
- hook 単体/契約テスト: 認証 (無/不正/正)・allowlist context・204/403 の形・不正入力・deadline・fail-closed・retry 冪等・override 自己申告の無視
- attestation/canary テスト: hook 削除・config hash 変化・参照ファイル digest 不一致・未照合 replica・image digest 不一致で enforcement 喪失を検出し、参照 ingress が非公開にすること。positive/negative canary の identity 差分
- `DATABASE_URL` を設定した実 DB テスト (probe の lease・状態遷移と通知・enforcement 喪失の反映と手動再開)。**skip のみの成功は不可**
- 有効 registration method ⊆ hook 付き method の静的検査、secret/token/proof/PII の非漏洩検査、OpenAPI 再生成と差分検査、既存テスト全緑、`git diff --check`。PR 本文に実行コマンドと結果を記載する

## 共有ファイルと merge 順

`server/src/openapi.rs`、`server/src/route.rs`、`server/src/main.rs`、DI wiring、`migrations/`、`openapi.json` は他 unit と共有する。
**共有ファイルは一件ずつ統合し、その時点の main から `openapi.json` を再生成する。** 別レーン E8 等と同時に同じ共有ファイルを変更する PR を出さない
(他の PR が open なら先に merge されるのを待つか、親へ確認する)。E15c の merge 後に rebase する。migration 番号は統合時点の最新の次を採番する。
Kratos 設定・`compose.yml`・CI workflow の変更は本 unit が所有するが、他レーンと衝突しないよう最小限にする。Emumet の統合担当は一人固定で、最終更新の順序は親の指示に従う。

## 親状態の所在

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
child は host 側の packet / intent / queue / ラベルを調査・変更しない。

## Related Links

- 設計 (host リポ): `intents/emumet/features/registration-readiness-gate/{overview,packets,acceptance}.md`
- 保護の所在 ADR (host リポ、読み取り参照): `intents/emumet/decisions/registration-protection-placement.md`
- ユーザー決定の正本: host リポ `intents/shuttlepub/packets/candidates.md` D15 節、`intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json` (d15-q01〜q11)、メール方式の決定 `question-88b36432ff84f589f1388699c8f40fa3`
- E15b 成果物 (Emumet): [PR #79](https://github.com/ShuttlePub/Emumet/pull/79) の [CONTRACT.md](https://github.com/ShuttlePub/Emumet/blob/bbf07136e9937520d828cce9a5027723ba2a82f5/e2e/registration-guard/CONTRACT.md)、`RESULTS.md`、`README.md`、`hook.jsonnet`、`run.py`
- 依存: E15a (Emumet#65、main 済み)、E15b (Emumet#64 / PR #79)、E15c `registration-protection-readiness`。並行: E15w (main 済み)、F15 `registration-gate-admin-ui` (shuttlepub-frontends#31)

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/registration-readiness-gate/overview.md` (primary) + packets.md の E15d に完了リンク追記 (host 側で実施)
- ADR candidate: none (所在は E15b の `registration-protection-placement.md` で確定済み)
- Diagram candidate: none
- Docs update: D15 の実遮断証跡 (CI 実行結果)・hook 構成・attestation/canary・設定喪失時と手動再開の運用手順・既知の制約を、RG 配下 (acceptance.md と運用手順 `operations.md`) へ host 側 closeout writeback。D15 全体受け入れは E15w/F15 も揃うまで保留。運用文書は Emumet 側成果物
- Closeout writeback expected: yes

## Guide Reachability (G645)

role-facing surface: Kratos 設定 (`ory/kratos`)・registration hook endpoint (内部)・継続 probe/attestation の運用手順、サーバー設定、運用文書。
guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
