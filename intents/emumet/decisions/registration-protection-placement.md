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
- 実secretの確認にdummy token/空responseの失敗だけを使わない。有効な当該sitekeyのtokenによる成功が必要で、
  未検証状態とregistrationのbootstrapはE15cで設計する。不正な利用者tokenでprovider全体を障害扱いしない。

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
**回復の範囲**: canaryで記録した配送範囲の障害は、接続・認証だけを確認する接続probeの成功では解除しない。
解除は配送範囲の再検証（canaryの配送受理、またはcanary/登録者のcode確認の成功）でのみ。接続段階の障害（接続probe自体の失敗）は
従来どおり次の接続probeの成功で回復する。これにより、配送障害が続く間にメールがoperationalへ戻って
BOTのみへの縮退が解除されることを防ぐ。
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
