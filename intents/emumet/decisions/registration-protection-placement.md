# Registration protection placement: 登録前メール所有確認・BOT検証・ゲートの所在

- Status: Accepted（2026-11-10、**所在の設計判断**。E15c/E15d の実装・本番接続・D15 統合受け入れは未完了）
- Deciders: operator。メール方式は `question-88b36432ff84f589f1388699c8f40fa3` の **A「Emumet 側で登録前メール確認（パスワード登録を維持）」**。親 Worker 指示 msg-866 で伝達。
- 関連: E15b `registration-kratos-guard-contract` / [Emumet#64](https://github.com/ShuttlePub/Emumet/issues/64) / [PR #79](https://github.com/ShuttlePub/Emumet/pull/79)
- 実証 head: `679364abf3f4625a3931acbf1e706e7f4b3766ab`。PR は未マージ。本 ADR は本番で保護済みという宣言ではない。

## Context / 前提

[D15 / registration-readiness-gate](../features/registration-readiness-gate/overview.md) は、メール認証 **OR** BOT対策を最低条件とし、
両方健全なら両方、片方障害なら健全側だけを必須にする。両方一時障害は一時拒否/自動復旧、
設定喪失は停止 latch/手動再開、手動閉鎖は自動解除しない。override は明示解除まで有効だが、effective な保護は引き続き課す。
対象は **Ory self-service registration のみ**。既存 login と認証済み `POST /api/v1/accounts` は止めない。

E15b は本番設定を変えず、Kratos **v1.3.1 / build 36e624c716e45ab405599c71b42c384dd45bdfbb**、
隔離 PostgreSQL、実 Emumet server を使い、admin API と DB identity UUID 集合を突き合わせた。
再実行可能な [fixture/README](https://github.com/ShuttlePub/Emumet/blob/679364abf3f4625a3931acbf1e706e7f4b3766ab/e2e/registration-guard/README.md)、
[29ケースの結果表](https://github.com/ShuttlePub/Emumet/blob/679364abf3f4625a3931acbf1e706e7f4b3766ab/e2e/registration-guard/RESULTS.md)、
[証拠manifest](https://github.com/ShuttlePub/Emumet/blob/679364abf3f4625a3931acbf1e706e7f4b3766ab/e2e/registration-guard/evidence/manifest.json) を正本とする。
単なるhealth応答/ファイル存在はreadyの証拠にしない。

## Options considered

| 保護 | Kratos native | Emumet registration webhook | 選択 |
|---|---|---|---|
| メール所有確認 | password verification は登録後。passwordless code は登録前に所有確認できる（実証済み） | 登録前challenge/proofを発行・検証し、password登録を維持できる | **Emumet**（operator A） |
| BOT token | v1.3.1 schema にnative captcha methodなし。実バイナリもcaptcha設定を拒否 | transient_payloadを受領しTurnstile Siteverifyで検証できる | **Emumet** |
| gate | 静的登録enabledやflow開始時だけの制限では最新D15状態を担えない | 最終submit時にE15aの永続状態と新鮮なprovider観測を評価できる | **Emumet** |

- native code案（B）は技術的に不成立なのではない。正しいcodeの後、hookに verified:true が届き、拒否ならidentityなし/許可ならverified:trueでpersistした。
  ただし新規登録をpasswordlessに変え、登録後password設定やメール故障時のpassword fallbackを要するため、operatorがAを選択した。
- native password verificationだけ、登録後hook、UI/BFFだけのチェックは却下する。identity作成前の拒否にならない/直接APIを迂回できるため。
- global `registration.after.hooks`、deprecated `can_interrupt:true` はmethod-specific pre-persist hookの代用ではない。

## Decision

### 1. メール: Emumet 登録前 proof + SMTP

E15c が challenge発行/確認とproofの保管・検証を担い、E15d が共通registration hookへ接続する。
Kratos post-registration verification は本人所有確認の代用にしない。既存password登録/loginを維持する。

1. 正規化email・実registration flow ID・config generationへchallengeを束縛する。SMTP送信成功だけではproofを発行しない。
2. code/linkの確認で所有を検証後、推測困難なopaque proofを発行する。DBはhash・期限・試行回数・消費先を保持し、本文/secretをログへ出さない。
3. 有限TTLかつflow期限以内。具体TTL・送信/確認rate limit・試行上限はE15cで固定し、期限境界/再送/競合を実DBで検証する。
4. clientは `transient_payload.email_proof` にproofを渡す。hookは信頼した実flow/emailと照合し、期限切れ・改変・別flow/email・旧generationを拒否する。
5. 消費は原子的な一回性。同一flowのKratos retryだけは同じ検証済み事実を再利用可能とし、他flowへのreplayは拒否する。gate許可自体はcacheせず毎回最新評価する。
6. provider readinessと登録者ごとのproofを分離する。canaryの配送/確認成功は他の登録者の所有証明ではない。

mail providerは **SMTP transport** を基準とする（実証はlocal sink）。特定の有料事業者を契約せず、実credentialの取得・実配送は行っていない。
Emumetが実際に使うSMTP設定と実送信/確認結果を観測する。Kratos courier設定やSMTP250だけからreadyを推定しない。

### 2. BOT: Emumet webhook + Cloudflare Turnstile Siteverify

- `flow.transient_payload.bot_token` を受領できることを実証した。未信頼入力なので存在だけで許可しない。
- providerは `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`。
  business `success:true` と expected hostname/action、期限、一回性、当該generationを照合する。
- 公式公開test secretによるpass/reject/duplicate/空secret/無効secret/空responseの6条件を実APIで検証した。
  HTTP200にもsuccess:falseがある。公式test-key成功は本番credentialのready証明ではない。
- ~~実secretの確認にdummy token/空responseの失敗だけを使わない。有効な当該sitekeyのtokenによる成功が必要~~
  → 2026-11-12に改訂（末尾「Bootstrap revision」）: 入力なしの管理者検証で、ダミー tokenに対する`invalid-input-response`
  （secret有効）か`invalid-input-secret`/`missing-input-secret`（設定不正）かで判定する。不正な利用者tokenでprovider全体を障害扱いしない。

### 3. Gate: method-specific pre-persist Emumet webhook

`selfservice.flows.registration.after.password.hooks` に `web_hook` を置き、
`response: {parse: true, ignore: false}` を必須とする。
有効な全registration methodについて同じ配線と拒否matrixを検証する（code/OIDC/passkey/WebAuthn等の将来追加を含む）。
未保護のregistration入口は公開しない。既存loginを止めるglobal method toggleを安易な代用にしない。
本番Kratos設定/routerへの接続は **E15d** の所有であり、E15bは行っていない。

- hookはprivate/authenticated/TLS経路。fixtureのunauthenticated control endpointを本番へ持ち込まない。
- contextはemail、flow ID/type/transient_payload等のallowlist。credential/cookie/sessionを送らない。
- candidate identity IDはzero UUIDになり得る。冪等キーはflow/email/proof hash/config generation等を用いる。
- 最新E15a状態を最終submitごとに評価する。clientのfake override、古いflow、UI迂回は許可根拠にならない。
- override中もeffectiveな保護は課す。overrideはprovider未準備/障害時の管理判断であり、hook自体の不達をfail-openに変えない。
- login/settings/recovery・認証済みAccount追加には接続しない。admin identity APIはself-service対象外であり外部公開しない。

### 4. hook応答とretry

| hook応答 | 実証された意味 | 後続契約 |
|---|---|---|
| 204空本文 | 許可/persist | 許可の標準形 |
| 403 + Kratos validation messages | 拒否/identityなし | 閉鎖/設定不足/proof失敗の標準形 |
| 200 `allowed:false` | booleanは無視され作成 | 使用不可 |
| 200不正JSON / parse:true | 拒否 | エラーを200で返さない |
| 201不正JSON | parseせず作成 | 使用不可 |
| 429/503/TCP切断/不達 | retry後に拒否 | provider分類をそのままhook HTTPへ流さない |
| timeout | 約30秒x3+backoff=93.18秒、identityなし、publicはEOF | provider deadlineを十分短くする（例3秒、hook全体5秒以内） |

retryの3呼出を実観測した。proof検証は冪等化してもgate verdictは再利用しない。
タイムアウト時のKratos内部HTTP504とpublic EOFを区別し、statusだけでidentity作成有無を推測しない。

### 5. 実効設定・観測・設定喪失

Kratos admin `GET /health/config` はmerged実効configのSHA256を返す（fieldsは返さない）。`/admin/config` は404。
healthはhook削除後も200だった。実効hashの存在だけ、設定ファイル存在だけ、health200だけではreadyにしない。

E15c/E15dの観測契約:

- provider/type・enabled・config generation・非secret fingerprint・status/reason・checked_at/valid_until。
- generation不一致・期限切れ・probe停止では古い成功を破棄する。無期限ready cacheは禁止。
- 実verification APIのbusiness結果とbinding/freshnessを根拠にする。SMTP接続/250は所有確認ではない。
- 全replicaのbinary/image digest・実効config hashをtrusted deployment manifestと照合する。
  参照template/schemaは内容digestも別途照合し、config hashが外部ファイル内容まで覆うと仮定しない。
- 同じartifact/configの隔離positive/negative canaryとadmin/DB差分を記録する。

**hookそのものの喪失は、呼ばれないhookでは拒否できない。** 実験でもguard未呼出でidentityが作成された。
監視/pollだけでは消失直後のbypass windowを消せない。immutable config、起動時attestation、
未照合/不明replicaを公開しないingress/admissionが必要である。Kratos publicへの直接APIを含む全到達経路に迂回routeを残さない。
provider設定だけの喪失（hookは存在）とは別のenforcement喪失として扱う。
このproduction ingress保証はE15b未検証であり、E15d/deploymentの必須統合受け入れとする。

| 条件 | 分類 | 意味 |
|---|---|---|
| 未設定/空設定/明示無効、invalid/missing secret、SMTP認証/設定不正 | configuration_invalid | 再設定。旧成功を使わず、両対策の設定喪失なら停止latch |
| token/proof不一致、期限切れ、duplicate、hostname/action不一致、宛先拒否 | attempt_rejected | 当該登録だけ拒否。不正入力でprovider全体をdownにしない |
| HTTP429/5xx、timeout/DNS/connect/TLS、malformed provider応答 | temporarily_unavailable | 健全側へ縮退。両方なら一時拒否、復旧で自動再開 |
| business success + binding/freshness一致 | operational | effectiveな保護。health/HTTP200とは別 |
| 設定変更後/成功期限切れ/probe停止 | unverified | 古いreadyを継続しない |

SMTPの認証不正/空URL/TLS設定不正、接続/timeout/4xx、宛先拒否（例550）は分離する。
HTTP providerの429/5xxとSMTPの全5xxを機械的に同一分類しない。

**E15c独立レビューによる精緻化（2026-11-10、再改訂）**: SMTPは失敗した段階を保持して分類する。
公開発行要求で宛先を提示した後（RCPTコマンド送信以降）の失敗は、応答コード・段階・timeout・切断を問わず
すべて`attempt_rejected`とし、readiness・観測を更新しない（challengeの内部失効のみ）。
公開要求経路からreadinessを更新できるのは、宛先提示前の段階（接続/STARTTLS/認証/MAIL FROM）の失敗だけ
（`temporarily_unavailable`/`configuration_invalid`）。provider全体の一時障害・設定不正は、宛先を伴わない独立probeと
管理者canary（固定canary宛先）で判定する。公開要求の連続失敗はreadinessに積み上げない。
**分類は送信の目的で分ける**: 上記の「宛先提示後は常にattempt」は公開要求の送信だけに適用する。管理者canaryは固定の承認済み宛先で
攻撃者が選べないため、RCPT/DATA/timeout/切断を含むすべての段階の配送失敗をprovider障害として記録する
（4xx/timeout/切断は`temporarily_unavailable`、認証失敗・5xx・canary宛先の550系は`configuration_invalid`）。
**回復の範囲と単調性の原則**: より悪い既知状態は、それを解消する証拠かgenerationの変更でしか改善しない。
後続のより軽い失敗（configuration_invalidの後のtimeout）、時間経過（鮮度切れ）、対話を伴わない成功（code確認）、
検証していない段階の成功では、解除も軽減もしない。これにより既知の設定喪失がtimeoutで観測上消えず、両保護が
configured=falseのときのE15aの停止latch（復旧しても自動再開しない）が成立する。鮮度切れで`unverified`に戻るのは
成功（operational）だけで、既知の障害は戻らない。
**証拠の規則**: 検証結果は、どの段階まで検証したか（connect < start_tls < auth < mail_from < rcpt < data）と、そのSMTP対話が
実際に行われた時刻（evidence_at。記録時刻ではない）を持つ。障害は失敗した段階と観測時刻を保持し、同じ範囲
（connect〜mail_from＝接続範囲、rcpt・data＝配送範囲）に複数の失敗が来たら最も悪い分類・最も遅い段階と時刻を保持する。
**成功が既知の障害を解除できるのは、成功の段階が障害の段階を覆い、かつevidence_atが障害の観測時刻より後のときだけ。**
- code確認（登録者。canaryのcode確認は2026-11-12に廃止、末尾「Bootstrap revision」）はSMTP対話ではないので、それ自体は障害を解除しない（business鮮度の更新と所有確認にだけ使う）。
  障害前に送ったメールの確認（過去のメール所有）は現在のSMTPの復旧の証拠ではない。
- probeは宛先を提示せずMAIL FROMまで検証する（MAIL FROM→RSET→QUIT）。成功の証拠はmail_from段階で、接続範囲の障害
  （MAIL FROMを含む）を解除できるが、RCPT・DATAの障害は覆えない。
- RCPT・DATAの障害は、canaryの新規送信の成功（DATA受理。証拠時刻は成功したSMTP対話の開始時刻を保守的な下限とする）でのみ解除される。
**E15dへの引き継ぎ**: RCPT・DATAの障害はcanary配送の再検証成功でしか解除されないため、canary配送再検証の周期実行
（probe_max_ageより短い周期）が、配送障害・設定喪失からの自動復旧（自動再開）の前提になる。周期実行が無い間は
管理者がcanaryを手動で検証する。
理由: 公開発行APIは宛先の状態を応答から区別させてはならない（user enumeration防止）。宛先提示後の失敗は、
コードや段階だけでは宛先非依存と保証できず、readinessを変えると、宛先Aへの発行後に別宛先Bへ発行した応答（202/503）から
Aの受理/RCPT拒否/DATA失敗/timeoutが判別できてしまう。MAIL FROMの550（送信者不許可）等は宛先拒否ではなく
`configuration_invalid`とする。ADR本文の「4xx → temporarily_unavailable」は宛先提示前の段階にのみ適用される。
実providerの429/5xx/timeoutは誘発していない。これらはhook故障注入とE15c adapterの必須分類試験として区別する。

## Evidence / 反例

| 条件 | 観測 | 証拠 |
|---|---|---|
| browser JSON/form・API、閉鎖前flow | 400、新identity0 | PR fixture `deny_* / old_flow_*` |
| override相当/API・browser | 200、各identity1 | `override_*` |
| hook503/429/切断/不達 | fail-closed、identity0 | `server_error_api / rate_limit_api / disconnect_api / unreachable_api` |
| timeout | 93.18s、3呼出、public EOF、内部504、identity0 | `timeout_api / timeout_server` |
| post-persist拒否 | 502でもidentity残存 | `post_persist_deny` |
| global hook / hook削除 | hook未呼出、identity作成 | `global_hook_not_pre_persist / hook_removed_canary` |
| password native verification | identity作成時verified:false | `override_api` |
| native code正解 | hook verified:true、denyなら0、allowならverified:trueで作成 | `native_code / native_code_allowed` |
| login・同一JWTでAccount追加 | 200 / 201+201、invalid JWT401、hook増分0 | `login / account` |
| health/config | hook喪失でもhealth200、hash変化 | `config_endpoints / config_loss` |
| native verification無効・guard維持 | hash変化、health200、verification API400、登録拒否/identity0 | `verification_loss / verification_removed_guard_remains` |
| captcha / Turnstile | schema拒否 / 公開test-key API6条件pass | `unsupported_captcha / provider` |

レビュー後、`ory_session_token` も証拠出力から除外するよう修正し、実バイナリ全29ケース・公式Turnstile6条件を再実行して成功した。
保存済み全JSONのsession token除外とmanifest網羅性・verification喪失観測を含むoffline testは8件成功。

## Consequences / 後続

- E15c: SMTP challenge/proof、Turnstile adapter、credential/失敗分類、generation/fresh TTL付き観測、実DB・fake providerの境界/replay/競合/timeout試験。
  具体TTL・rate limit・API/schema・config invalidとE15a入力の対応をpacketで固定する。
- E15d: authenticated pre-persist hook、全method/全到達経路、E15a全状態（override中effective保護を含む）、
  config喪失/latch/手動再開、provider outage/自動復旧、login/Account回帰、未attest replica遮断の統合試験。
- 親が所在/provider/観測契約を確認するまでE15c/E15dをdraftしない。E15bのPR/ADRだけでD15受け入れを完了しない。
- hook評価後〜persist間の管理者閉鎖を二つのDB跨ぎで原子的にすることは未検証。評価済みの登録まで取り消せるとは主張しない。
- portable Dockerfile buildは未検証だが、実行済みNix/native再現手順を残した。実SMTP配送・本番credential/有料契約は未実施。
- teardownレビューtimeoutにより専用tmpfs stackと旧実験volumeはoperator手動cleanup依頼。保護の実証結果とは区別する。

## Links

- [RG acceptance](../features/registration-readiness-gate/acceptance.md) / [packets](../features/registration-readiness-gate/packets.md)
- packet: `.intent-cli/issues/registration-kratos-guard-contract/`
- grill: `discord-feature-grill-2026-10-15.json` d15-q01〜q11、追加方式決定 `question-88b36432ff84f589f1388699c8f40fa3`
- [E15c/E15d詳細契約](https://github.com/ShuttlePub/Emumet/blob/679364abf3f4625a3931acbf1e706e7f4b3766ab/e2e/registration-guard/CONTRACT.md)

## E15d refinement: 周期検証 API 応答による readiness 維持・復旧（2026-11-10）

出典: 親判断 question-273f21f1ce70800ab974ed89f9c8f6bd。d15-q05 の準備済み基準は、設定の存在ではなく検証 API の実応答である。受信ボックスでの roundtrip を継続的に要求する決定ではない。したがって、固定された承認済み canary 宛先への SMTP DATA 受理は、同一 generation の readiness の business TTL 更新と配送段階の障害解除に利用してよい。Turnstile も、公式 Siteverify の解釈可能な業務応答を維持・復旧の証拠とする。単なる TCP 接続・health・設定ファイル存在とは区別する。

E15d の技術選択は、各 generation の初回 bootstrap（メールは管理者 canary code 確認、BOT は有効 token の検証成功。**この初回 bootstrap の要件は 2026-11-12 に入力なしの管理者［再検証］へ改訂、末尾「Bootstrap revision」**）を保持し、以後は周期的な SMTP DATA 受理／Siteverify probe の業務応答で business TTL を更新する。過去の成功が TTL 超過していても同一 generation なら維持・復旧できる。generation 変更後に旧成功を持ち越さず、未 bootstrap の設定を周期 probe だけで operational にしない。MAIL FROM までの接続 probe はメール business TTL を更新しない。公開の任意宛先送信・不正 token は readiness の維持証拠にしない。

段階×時刻の証拠モデルは維持する。成功の evidence_at は、成功した対話の開始時刻を保守的な下限とする（対話中に観測された新しい障害を、遅れて完了した古い対話が解除しない）。障害の時刻は実際の失敗観測時刻。code 確認それ自体は新しい SMTP 障害を解除しない。設定喪失 latch は provider が復旧しても解除されず、手動再開が必要である。

これは E15d の設計精緻化であり、準備 PR や E15c 単体をもって実 Kratos enforcement／D15 全体の受け入れを完了とはしない。

## E15d refinement: enforcement 基盤の喪失は override と独立した停止（2026-11-10）

出典: 親判断 question-3eac94babf10decd062298d0f74a5c2a。hook の削除・未照合 replica・attestation の期限切れ等、登録判定そのものを迂回し得る構成喪失は、provider の準備未完了・一時障害とは別の設定喪失として扱う。enforcement が未確認の間、またはその停止 latch が残る間は、override より先に Stopped とする。provider 成功や通常の観測更新がこの状態を正常化してはならない。

既存の provider 起因の状態表は変更しない。override_info は基盤停止で暗黙に解除せず、明示解除まで保持する。API は override 有効と enforcement 停止を同時に表現できなければならず、F15 は override バナーだけをもって受付中と表示しない。

照合状態の復旧を通知しても停止 latch は自動解除しない。再開は、最新の enforcement 照合が有効な状態で管理者が明示的に行う。最低保護条件を満たす場合は通常の手動再開、保護の無い状態で継続中の override により再開する場合は警告確認を再度要求する。override の開始者・開始時刻はこの再開で書き換えない。基盤喪失と照合復旧の両イベントを通知一覧・E15w Webhook の配送対象とする。

これは実装に必要な状態契約の精緻化であり、実 Kratos・全到達経路の照合と fail-closed 試験が完了するまで D15/E15d を完了扱いしない。

## E15d part 2: 配備接続と black-box attestation の保証範囲（2026-11-11）

親の確定判断（Worker 引継ぎ）に従い、Docker inspector・独自 ingress は実装しない。リポジトリの本番 Kratos config に password method-specific pre-persist hook（response.parse:true / ignore:false / Authorization Bearer）を配線する。登録可能 method は password のみに固定し、追加 method は同等の hook カバレッジを確認するまで有効化しない。renderer の静的契約検査と実 Kratos CI の両方で固定する。

配備中の black-box attestation は negative canary のみ。API/browser の実 flow と独立したランダム password、予約 canary 宛先、DB に事前登録した nonce+flow を用いる。想定した否定応答だけで ready とせず、認証済み hook 受信 receipt の照合と Kratos admin API の identity 非作成も必要とする。通常30秒周期・60秒TTL。provider 観測から enforcement を正常化しない。想定外作成を検出した場合は、停止ラッチと E15w 対象通知を先に永続化し、予約 canary email の再照合後にのみ削除する。timeout の未確定 canary は10分間再観測する。positive 登録は同じ本番 hook/body を使う実 Kratos CI で検証し、周期 positive canary を追加しない。

**重要な限界**: hook が外れた状態では、Emumet 側の停止だけでその Kratos の登録を物理的に止められない。検査が当たる経路については次の周期検査で喪失を検出し、停止・通知を直ちに永続化するが、単一 LB URL に対する有限回 canary では未応答・非選択 replica や広告されない追加 method を決定的には網羅できない。不明 replica を公開しないこと、immutable artifact の配備、壊れた経路の切離しと物理的な登録停止は運用者の配備層責務である。アプリケーションに ingress/admission 保証が実装されたとは扱わない。

SMTP非列挙の時間差は、試行された公開送信の応答を4秒floor（SMTP総timeout3秒）に揃えて軽減するが、DB/ネットワーク停滞・scheduler jitter は残る。非同期化は必要時の追加検討であり、この unit の必須条件とはしない。

本記録は設計・運用契約の精緻化であり、PR/CI/独立レビューの証跡を伴う unit closeout までは E15d/D15 の完了記録ではない。D15 全体は F15 を含むため、この配備接続だけでも完了しない。


## Bootstrap revision: 入力なしの管理者［再検証］だけで初回から準備済みにできる（2026-11-12）

出典: ユーザー決定 d15-q05（設定が有効なだけでは足りず、有効な保護について実際に検証 API が応答することを確認して初めて準備済み）、リード承認 question-f24eeb05650d956c943da656275847ac。上記「E15d refinement」と、E15c の「有効な当該 sitekey の token による成功が必要」「メールは管理者 canary code 確認」は、次のとおり**改訂**する（過去の記述は当時の記録として残す）。

- **初回 bootstrap に管理者の入力・受信確認を要求しない。** 管理者の入力なし verify（`POST /api/v1/admin/registration-gate/protections/{protection}/verify` `{}`）の 1 回だけで、当該 generation を準備済み（operational）にできる。widget token・canary の code 入力は廃止する（旧入力は 400。F15 の BFF は入力なし verify だけを使うので影響しない）。周期 probe は引き続き**新しい generation を bootstrap できず**、設定だけでは準備済みにならない（q05）。
- **メール**: 固定の承認済み canary 宛へ実送信し、SMTP の **DATA 受理**を business success とする。受信箱での確認は求めない。RCPT/DATA を含む各段階の失敗は従来どおり分類して記録し、準備済みにしない。MAIL FROM までの受理・接続 probe だけでは business success にしない。
- **Turnstile**: 有効でない固定のダミー token で Siteverify を呼び、**応答の本文**で判定する。`invalid-input-response`（・`missing-input-response`・`timeout-or-duplicate`）= secret は有効で API が応答した → business success。`invalid-input-secret` / `missing-input-secret` = `configuration_invalid`。429/5xx/timeout・不正な本文・secret の有効性を示さない応答（`bad-request` だけ・未知の error code）= `temporarily_unavailable`。HTTP 200 だけを根拠にしない（公式テストキーで実証）。以前の「dummy token/空 response の失敗だけを使わない」は、**応答 code が secret の有効性を区別して返す**ことを確認したうえで改訂する。
- **維持する原則**: 設定ファイルの存在・health・HTTP 200 を ready の証拠にしない。E15c の証拠モデル（段階×時刻、DATA 受理を readiness 証拠、成功の evidence_at は対話の開始時刻の保守的下限、既知の障害は覆う段階の後の証拠か generation 変更でしか解除されない）。**登録者の** code 確認は SMTP 対話ではなく障害を解除しない。generation 変更で旧成功は無効。
- 実装: Emumet 修正 PR [ShuttlePub/Emumet#99](https://github.com/ShuttlePub/Emumet/pull/99)（Refs #80 #81。E15c/E15d の修正扱い）。
