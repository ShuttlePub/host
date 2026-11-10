# registration-protection-readiness: 登録前メール proof (SMTP)・Turnstile Siteverify adapter・実検証 API・設定世代・readiness 鮮度期限・失敗分類・E15a 観測入力

## Goal

D15 (registration-readiness-gate) の保護 adapter と readiness 観測を Emumet に実装する。具体的には
(1) SMTP による**登録前 email challenge/proof** の発行・検証 (flow/email/config generation に束縛、有限 TTL、原子的消費、retry 冪等性)、
(2) **Cloudflare Turnstile Siteverify** adapter、(3) 実検証 API (business 結果を根拠にする)、(4) 設定世代 (config generation)、
(5) readiness の鮮度期限 (古い成功を無期限に使わない)、(6) 設定喪失・無効資格情報・一時障害・当該試行の拒否の分類、
(7) 分類結果の E15a 観測入力 (`RecordRegistrationObservationUseCase`) への反映、を提供する。
**health・ファイル存在・HTTP200・SMTP 250 だけで ready にしない。** 本番 registration hook への最終配線は E15d の所有で、本 unit は含まない。

## Why This Slice Exists Now

E15a (control plane, Emumet#65) と E15w (Webhook, Emumet#68) は main 済みで、状態機械は観測入力 (設定有無 + probe 結果) を受ける内部 port だけを持ち、
実際に provider を検証する adapter はまだ無い。E15b の ADR (host `intents/emumet/decisions/registration-protection-placement.md`、2026-11-10 Accepted) で
保護の所在が確定した: メール所有確認は Emumet が登録前 proof を発行・検証し password 登録を維持する (ユーザー決定 `question-88b36432ff84f589f1388699c8f40fa3` の A)、
BOT 検証は Emumet webhook + Turnstile Siteverify、ゲートも同 hook。E15d はこの unit の adapter・観測を実 Kratos hook に配線する。

## D15 決定・ADR の要約 (仕様の正本は host の grill 記録 d15-q01〜q11 と ADR)

- q01 最低条件は「メール認証 OR BOT 対策」。両方健全なら両方を課し、片方障害なら健全側のみ必須 (q07)
- q05 設定が有効なだけでは準備済みとせず、**検証 API の実応答**を確認して初めて準備済み。q06 設定を失わない一時障害は一時拒否で復旧後は自動再開。q02/q03 設定喪失は停止 latch で手動再開
- ADR: 実 secret の確認に dummy token/空 response の失敗だけを使わない。有効な当該 sitekey の token による business success が必要。不正な利用者 token で provider 全体を障害扱いしない
- ADR: 古い成功の無期限 cache は禁止。generation 不一致・期限切れ・probe 停止で旧成功を破棄 (unverified)。SMTP 接続/250 は所有確認ではない。canary の配送/確認成功は他の登録者の所有証明ではない
- ADR の失敗分類 (この unit が実装する)

| 条件 | 分類 | E15a への意味 |
|---|---|---|
| 未設定/空設定/明示無効、invalid/missing secret、SMTP 認証/設定不正 | `configuration_invalid` | 再設定が必要。旧成功を使わない。両対策とも設定喪失なら停止 latch |
| token/proof 不一致、期限切れ、duplicate、hostname/action 不一致、宛先拒否 (例: SMTP 550) | `attempt_rejected` | 当該登録だけ拒否。provider 全体を down にしない (観測を変えない) |
| HTTP 429/5xx、timeout/DNS/connect/TLS、malformed provider 応答、SMTP 接続失敗/timeout/4xx | `temporarily_unavailable` | 健全側へ縮退。両方なら一時拒否、復旧で自動再開 |
| business success + binding/freshness 一致 | `operational` | effective な保護。health/HTTP200 とは別 |
| 設定変更後 / 成功期限切れ / probe 停止 | `unverified` | 古い ready を継続しない (E15a では Unknown) |

HTTP provider の 429/5xx と SMTP の全 5xx を機械的に同一分類しない (SMTP 5xx のうち認証/設定不正は `configuration_invalid`、宛先拒否は `attempt_rejected`)。

## Current Observed State

- E15a (main): 観測入力は `RegistrationObservation { email, bot }`、各 `ProtectionObservation { configured: bool, probe: Healthy | Unhealthy | Unknown }`、`effective = configured && Healthy`。
  `RecordRegistrationObservationUseCase` (`application/src/service/registration_gate.rs`) は内部 use case で公開 HTTP の書込口は無く、制御状態が変わらない反復では revision・監査・通知を増やさない
- Emumet に SMTP クライアントは未導入 (`lettre` 等なし)。`reqwest` 0.12・`hmac`・`sha2` は依存済み。SSRF 検査の先例: `driver/src/http_signing/ssrf.rs`、E15w の Webhook クライアント
- E15b の実証成果物 (PR [#79](https://github.com/ShuttlePub/Emumet/pull/79)、head `bbf07136e9937520d828cce9a5027723ba2a82f5`、**E15b の merge 状況により main 未反映の可能性あり**):
  `e2e/registration-guard/{CONTRACT,RESULTS,README}.md`、隔離 compose (Kratos v1.3.1 + PostgreSQL + ローカル SMTP sink)、公式 Turnstile 公開テストキー 6 条件の実 API 結果 (`evidence/provider.json`)。
  merge 前なら PR head を参照し、merge 後は main の同ファイルを正とする。**E15b の merge を待たずに adapter 実装・テストは着手可** (fixture の再利用は merge 後の main から)
- `transient_payload.email_proof` / `transient_payload.bot_token` は Kratos flow から hook へ届くことが実証済み (未信頼入力。存在だけで許可しない)。Kratos hook の candidate identity ID は zero UUID になり得る (冪等キーにしない)

## Accepted Baseline You May Assume

- 保護の所在は ADR のとおり確定 (変更しない)。メール方式は A (Emumet 登録前 proof + password 登録維持)。Kratos native code 登録 (B)・Kratos courier 設定からの ready 推定は採用しない
- 管理者認可は E15a と同じ既存 admin 判定 (`instance:administrate`) を再利用する。新しいロールモデルを作らない
- E15a の状態機械・判定・通知イベント生成の意味は変更しない (入力を供給する側)。入力型の拡張が必要なら最小限にし、E15a の既存テストを維持する
- 特定の有料事業者との契約・本番 credential の取得は本 unit に含まれない。実 credential・有料契約・実メール配送が検証に必要になった場合は**取得せず、親 (host 側 Worker) に質問する**。テストは公式 Turnstile 公開テストキーとローカル SMTP 模擬で行う

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/src/entity, kernel/src/repository, application/src/service, driver/src, server/src/route, server/src/api, server/src/schema, server/src/openapi.rs, server/src/route.rs, server/src/main.rs, migrations, openapi.json, docs, e2e/registration-guard, .github/workflows`

- Target part: 登録保護の adapter と readiness 観測 (email challenge/proof + SMTP、Turnstile Siteverify adapter、実検証 API、設定世代、鮮度期限、失敗分類、E15a への観測入力、secret/PII 非漏洩、運用文書)

## 契約 (この節を仕様とする。型名・DB 列・パス・具体値は child が決めてよいが、満たすべき性質は固定。具体値を変えるときは理由を PR と docs に記録する)

### 1. 登録前 email challenge / proof (SMTP)

- 正規化 email + 実 registration flow ID + config generation に challenge を束縛する。SMTP 送信成功だけでは proof を発行しない。code または link の**確認で所有を検証した後**に推測困難な opaque proof を発行する
- DB は code/token/proof の **hash**・期限・試行回数・消費先 (flow/email/generation) を保持し、平文・本文・SMTP secret をログ/エラー/監査に出さない。code/proof の比較は定数時間
- 有限 TTL かつ flow 期限以内。**初期値案** (child が根拠つきで調整可): challenge 10 分、確認の試行上限 5 回 (超過で challenge 失効)、proof 15 分、送信 rate limit は 同一 email 60 秒に 1 通・1 時間 5 通、同一 flow 1 時間 3 通、送信元単位の上限も設ける (信頼できないヘッダーを根拠にしない)。期限境界 (期限ちょうど/直前/直後)・再送・並行確認を実 DB で試験する
- proof の消費は**原子的な一回性**。同一 flow・email・proof hash・generation の Kratos transport retry (hook は最大 3 呼出を観測) にだけ同じ検証済み事実を返し (短い再利用窓。初期値案 60 秒、設定可)、別 flow・別 email・旧 generation・期限切れ・改変・既消費の再利用は拒否する。**gate の許可 verdict 自体は cache しない** (毎回最新評価は E15d)
- provider readiness と登録者ごとの proof を分離する。canary/probe の成功は他の登録者の所有証明にならない
- 公開 API (パスは仮: `POST /api/v1/registration/email-challenges` 発行、`POST .../email-challenges/{id}/confirm` 確認) は未認証で呼ばれるため、メール爆弾・任意宛先への踏み台・user enumeration にならないこと (rate limit、応答差で宛先の状態を漏らさない、gate が閉鎖/停止中は任意宛先へ送信しない等。gate 状態の参照方針は child が決め理由を記録)。
  hook 側が呼ぶ検証 use case (proof の照合・消費) は内部 use case として提供し、**公開 HTTP の書込口にしない**。hook への配線は E15d

### 2. Turnstile Siteverify adapter

- `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`。HTTPS 固定・redirect 追従なし・接続/全体 timeout (provider deadline は 30 秒より十分短く、初期値案 3 秒。E15d の hook 全体 5 秒以内に収まること)・応答本文サイズ上限。テスト用の base URL 差し替えは test-mode 限定で本番設定から有効化できない (E15w の方針に倣う)
- `success:true` に加え expected hostname/action、token の期限・一回性 (duplicate)、当該 generation を照合する。**HTTP200 でも `success:false` は失敗**。error-codes を分類に写像する (例: `invalid-input-secret`/`missing-input-secret` → `configuration_invalid`、`invalid-input-response`/`timeout-or-duplicate`/hostname・action 不一致 → `attempt_rejected`、429/5xx/timeout/不正応答 → `temporarily_unavailable`)。実際の応答は E15b `evidence/provider.json` を fixture 化する
- 利用者の不正 token (空・invalid・duplicate) で provider 全体を `temporarily_unavailable`/`configuration_invalid` にしない
- 公式公開テストキーは protocol 検証であり**本番 credential の ready 証明ではない**。secret/token を応答・ログ・エラー・通知に出さない

### 3. 設定世代と readiness 鮮度

- config generation: 保護ごとの有効設定 (provider/type、enabled、非 secret の設定値、secret の**逆算できない** fingerprint) から決定的に導く。設定が変われば generation が変わり、旧 generation の readiness・proof・challenge は無効になる
- readiness 記録 (永続): provider/type、enabled、generation、非 secret fingerprint、status (`configuration_invalid`/`operational`/`temporarily_unavailable`/`unverified`)、reason (secret を含まない分類)、`checked_at`、`valid_until`。**無期限 ready cache の禁止**: `valid_until` 超過・generation 不一致・probe 停止 (最後の probe が一定時間以上前) は `unverified` として扱い、時刻は注入可能にして試験する
- **operational になる条件 (q05/ADR)**: 実 verification API の business 結果が根拠。health/ファイル存在/HTTP200/SMTP 接続・250 だけでは operational にならない。
  Turnstile は、当該 sitekey 由来の**有効 token による business success を当該 generation に束縛して記録**して初めて operational (dummy token/空 response の失敗だけでは不可)。
  メールは、Emumet が実際に使う SMTP 設定での送信と、承認済み canary mailbox での実 code 確認 roundtrip (または同等に business 成功を示す手段) を generation に束縛して記録して初めて operational。一回の配送成功から全宛先の到達を保証しない
- **bootstrap と継続検証の設計は child が決め、PR と docs に記録する**: 初回の operational 化 (未検証状態からの bootstrap。一般登録を通らずに検証できる管理者起動の検証経路を含む) と、有効期限内の継続 probe (例: secret が受理されていることを示す負の probe で `configuration_invalid` と一時障害を検出しつつ、operational 自体は business success の鮮度で維持する) の関係を明確にする。
  本番相当の検証に実 credential・canary mailbox が必要でそれが無い場合は、取得せず親に質問し、その保護は `unverified` (effective でない) のままにする
- 継続 probe の**周期実行 (scheduler/worker) と hook 時評価は E15d の所有**。本 unit は「1 回の probe を実行して結果を記録する use case」と「時刻・generation を引数に readiness から観測入力を導く純粋な評価」を提供する

### 4. 分類と E15a 観測入力への反映

- 上記の分類表を実装し、保護ごとの readiness 状態から `RegistrationObservation` を導く。**対応づけ (固定)**: `operational` → configured=true・Healthy、`temporarily_unavailable` → configured=true・Unhealthy、`unverified` → configured=true・Unknown、`configuration_invalid`・未設定・明示無効 → configured=false (両対策が該当すれば E15a が設定喪失として停止 latch)、`attempt_rejected` → **観測を変えない**
- 反映は `RecordRegistrationObservationUseCase` 経由のみ。反復 probe で revision・通知が増えないこと (E15a の性質) を統合テストで固定する。E15a の入力型で表現できない場合のみ最小限に拡張し、既存テストと意味を維持する
- 一方が故障しても他方の健全な対策は effective のまま。片方の `configuration_invalid` で他方の観測を巻き込まない

### 5. 実検証 API (管理者)

- 管理者のみ (非管理者 401/403) の REST (パスは仮: `/api/v1/admin/registration-gate/protections*`): 保護ごとの readiness 状態 (provider/type・enabled・generation・fingerprint・status・reason・checked_at・valid_until) の取得、検証の即時実行 (bootstrap・再検証)
- 応答に secret・token・proof・登録者メールを含めない。検証 API の結果は business 結果と HTTP 分類の両方を記録し、HTTP200 を成功と同一視しない

## In Scope

- email challenge/proof の永続化 (migration)・発行/確認 API・SMTP adapter (必要な最小限の依存追加を justification つきで)・proof の検証/消費 use case (内部)
- Turnstile Siteverify adapter・結果分類
- 設定の読込 (環境変数/secret ファイル。secret は DB に保存しない)・config generation・readiness 記録 (migration)・鮮度評価・分類・E15a 観測入力への反映
- 管理者の実検証 API・OpenAPI (utoipa) / `openapi.json` 再生成
- ローカル SMTP 模擬 (テスト用 sink) を使った検証経路・Turnstile 公開テストキーによる実 API 検証経路 (CI で外部ネットワーク依存になる場合は実行条件を明記し、fake provider による決定的 contract test を必須とする)
- 運用文書 (Emumet 側 docs): 設定項目、TTL/rate limit の値と根拠、generation/readiness の意味、分類表、bootstrap 手順、secret 取り扱い

## Out Of Scope

- 未検証 provider (他 CAPTCHA・他メール方式・OAuth 代替) の追加、Kratos native code 登録への切替
- 本番 registration hook への最終配線、hook 認証、継続 probe の周期実行、config attestation、Kratos 設定変更 (すべて E15d)
- E15a の状態機械・通知意味の変更、E15w の配送、管理 UI (F15)
- login の遮断、`POST /api/v1/accounts` へのゲート、新しい招待システム
- 実 credential・有料契約・実メール配送の取得 (必要なら親へ質問)

## Standalone Child Issue Contract

この PR は、Emumet に D15 登録保護の adapter と readiness 観測を導入する。SMTP による登録前 email challenge/proof (flow/email/generation 束縛・有限 TTL・原子的消費・retry 冪等) と
Turnstile Siteverify adapter、設定世代、鮮度期限付きの readiness、設定喪失・無効資格情報・一時障害・当該試行拒否の分類、管理者の実検証 API を実装し、
分類結果を E15a の観測入力へ反映する。health・ファイル存在・HTTP200・SMTP 250 だけで ready にせず、古い成功を無期限に使わない。
本番 hook への配線は含まない (E15d)。実 credential・有料契約が必要なら取得せず親に質問する。

## Acceptance Criteria

- email challenge は正規化 email・flow ID・generation に束縛され、code/link 確認後にのみ proof が発行される (SMTP 送信成功だけでは発行されない)。code/proof は hash のみ保存され、平文がログ/応答/エラーに出ない
- challenge/proof は有限 TTL (flow 期限以内)・試行上限・送信 rate limit を持ち、期限境界・再送・並行確認が実 DB で試験される。proof の消費は原子的な一回性で、同一 flow/email/hash/generation の retry のみ冪等に成功し、別 flow/別 email/旧 generation/期限切れ/改変/再 replay は拒否される
- Turnstile adapter は success:true + hostname/action + 期限・一回性・generation を照合し、HTTP200 の success:false を失敗とする。error-codes と HTTP/ネットワーク失敗が分類表どおりに写像される。利用者の不正 token で provider 全体が障害扱いにならない
- config generation が設定変更で変わり、旧 generation の readiness/proof/challenge が無効になる。readiness は `valid_until` 超過・generation 不一致・probe 停止で `unverified` となり、古い成功を無期限に使わない (時刻注入で試験)
- 空設定・無効資格情報 (invalid/missing secret、SMTP 認証失敗)・timeout・429/5xx・SMTP 宛先拒否 (例 550)・SMTP 接続失敗が区別され、E15a 観測入力への対応づけが契約どおり。一方が故障した場合に他方の健全な対策が effective のまま残る
- operational は実 verification の business success を generation に束縛して初めて成立する。health/ファイル存在/HTTP200/SMTP 250 だけでは ready にならない。bootstrap と継続検証の設計が docs に記録されている
- 分類結果は `RecordRegistrationObservationUseCase` 経由で E15a に反映され、実 DB 統合テストで `operational`→一時障害→復旧、設定喪失 (両方) → 停止 latch、設定変更→`unverified`、反復 probe で revision/通知が増えないことが確認される
- 管理者の実検証 API は管理者のみ (非管理者 401/403)。応答に secret・token・proof・登録者メールが含まれない。OpenAPI が再生成され差分検査に通る。既存 API (login・POST /api/v1/accounts・E15a/E15w の管理 API) の挙動は不変
- 本番 registration hook・Kratos 設定には接続していない (E15d)

## Verification

- adapter contract test: Turnstile (公式公開テストキー 6 条件の応答 fixture、429/5xx/timeout/malformed の fake provider)、SMTP (認証失敗・接続失敗・timeout・4xx・宛先拒否 550 の fake/ローカル SMTP 模擬)。分類の網羅表テスト
- 実 provider 検証経路: Turnstile 公開テストキーによる実 API (外部ネットワーク依存になる場合は実行条件と結果を PR に記載)、ローカル SMTP 模擬 (sink) での challenge 発行→確認→proof 発行の roundtrip
- 時刻・設定変更・復旧: 注入時計で TTL 境界 (期限ちょうど/直前/直後)・`valid_until` 超過・probe 停止・generation 変更・一時障害からの復旧を試験
- `DATABASE_URL` を設定した実 DB テスト: proof の原子的消費・並行消費・retry 冪等・replay 拒否・rate limit・readiness 永続化・E15a への観測反映・反復で通知が増えないこと。**実 DB テストが skip されただけの成功は不可**。実行したテスト名と DB 接続での実行結果を PR に記載する
- secret/token/proof/PII の非漏洩 (応答・ログ・エラー・DB・通知の検査)、管理者認可 (非管理者 401/403)
- OpenAPI 再生成 (`openapi.json`) と既存の差分検査、既存テスト全緑 (login・POST /api/v1/accounts・E15a/E15w の回帰)、`git diff --check`

## 共有ファイルと merge 順

`server/src/openapi.rs`、`server/src/route.rs`、`server/src/main.rs`、DI wiring、`migrations/`、`openapi.json` は他 unit (E8 `profile-domain-policy-api-contract`、P 系列、E15d 等) と共有する。
**共有ファイルは一件ずつ統合し、その時点の main から `openapi.json` を再生成する。** 別レーンの unit (E8 など) と同時に同じ共有ファイルを変更する PR を出さない
(他の PR が open なら先に merge されるのを待つか、親へ確認する)。migration 番号は統合時点の最新の次を採番する。共有ファイルの変更は最小限にし、他 unit の差分を巻き込まない。
Emumet には統合担当が一人固定されている前提で、最終更新の順序は親の指示に従う。

## 親状態の所在

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
child は host 側の packet / intent / queue / ラベルを調査・変更しない。

## Related Links

- 設計 (host リポ): `intents/emumet/features/registration-readiness-gate/{overview,packets,acceptance}.md`
- 保護の所在 ADR (host リポ、読み取り参照): `intents/emumet/decisions/registration-protection-placement.md`
- ユーザー決定の正本: host リポ `intents/shuttlepub/packets/candidates.md` D15 節、`intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json` (d15-q01〜q11)、メール方式の決定 `question-88b36432ff84f589f1388699c8f40fa3`
- E15b 成果物 (Emumet): [PR #79](https://github.com/ShuttlePub/Emumet/pull/79) の [CONTRACT.md](https://github.com/ShuttlePub/Emumet/blob/bbf07136e9937520d828cce9a5027723ba2a82f5/e2e/registration-guard/CONTRACT.md)、`RESULTS.md`、`README.md`、`evidence/provider.json`
- 依存: E15a (Emumet#65、main 済み)、E15b (Emumet#64 / PR #79)。後続: E15d `registration-gate-enforcement` (本 unit の adapter・観測を実 Kratos hook へ配線)

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/registration-readiness-gate/overview.md` (primary) + packets.md の E15c に完了リンク追記 (host 側で実施)
- ADR candidate: none (ADR は E15b の `registration-protection-placement.md` で確定済み。TTL/rate limit 等の具体値は acceptance.md と Emumet docs に記録)
- Diagram candidate: none
- Docs update: 観測契約 (設定世代・鮮度・分類・E15a 対応づけ)・設定項目・secret/障害分類・監視条件を acceptance.md へ (host 側 closeout writeback)。運用文書は Emumet 側成果物
- Closeout writeback expected: yes

## Guide Reachability (G645)

role-facing surface: 管理者向け REST API (`/api/v1/admin/registration-gate/protections*`)、登録前 email challenge 公開 API、サーバー設定 (SMTP・Turnstile)、運用文書、OpenAPI。
guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
