# registration-kratos-guard-contract Implementation Packet

## Goal

Kratos v1.3.1 の self-service registration で、identity を作成する前 (pre-persist) に registration を拒否できることを
隔離環境で実証し、D15 登録ゲートの「保護 (メール所有確認・BOT token 検証・ゲート判定) を Kratos ネイティブと
Emumet webhook のどこで担うか」を決める材料 (実験結果・観測契約・再現 fixture) を残す。
**本番 Kratos 設定への hook 接続は含まない** (E15d が所有)。

## Why This Slice Exists Now

D15 の後続実装 (E15c 保護 adapter / readiness、E15d 実 Kratos hook 配線) は、どの hook 段階で identity 未作成のまま
拒否できるか、hook 失敗時に fail-open か fail-closed か、実効設定をどう観測するかに依存する。これらは現在未確認で、
仮定のまま実装すると「設定ファイルがある/health が OK だから守られている」という誤った ready 判定を作り込む。
そのため実装前に Kratos 実バイナリで実証し、結果を親が確認するまで E15c/E15d は draft されない (draft ゲート)。

## D15 決定の要約 (仕様の正本は host の grill 記録 d15-q01〜q11)

- q01 最低条件は「メール認証 OR BOT 対策」。q05 設定が有効なだけでは準備済みではなく、検証 API の実応答が必要
- q06 設定を失わない一時障害は一般登録のみ一時拒否 (復旧で自動再開)。q07 片方障害は動作中の対策のみ課して継続
- q02/q03 設定喪失は自動停止、手動再開。q09/q10 管理者の明示 override
- q08 ゲートは Ory self-service registration のみが対象。ログイン済み利用者の `POST /api/v1/accounts` (追加 Account 作成) は対象外
- 実装所在・provider・観測契約は本 unit で決める材料を出す

## Current Observed State

(観測時点: Emumet HEAD ef82462)

- `compose.yml`: Kratos を `oryd/kratos:v1.3.1` の dev モードで起動 (kratos-migrate + kratos)。DB は postgres 内の kratos DB
- `ory/kratos/kratos.yml`: registration と password method が有効。verification・CAPTCHA・hook の設定は確認できない
- `ory/kratos/identity.schema.json`、`ory/kratos/seed-users.json` あり
- 認証済み Account 追加は `POST /api/v1/accounts` (AuthClaims 受け取り)。Kratos registration とは別経路

## Accepted Baseline You May Assume

- Kratos のバージョンは v1.3.1 に固定して実証する (他バージョンの結論を流用しない)
- 本 unit は調査・実証・fixture が成果物で、本番 Kratos 設定や既存アプリの挙動を変更しない
- hook の実行段階 (flow 作成時 / persist 前 / persist 後)、fail-open/closed、timeout 時の挙動は**仮定せず実験で確定する**

## Target Repo / Path / Part

- Repository: `ShuttlePub/Emumet`

- Target paths: `e2e/registration-guard` (新設: 隔離 compose override・Kratos 設定 fixture・実験スクリプト・結果記録)、`ory/kratos` (実験用 fixture のみ。本番設定の変更は禁止)

- Target part: registration 遮断実証 (identity 未作成の証拠)、保護の実装所在の決定材料、観測契約、再現 fixture

## 必須の実験・調査項目

1. 直接 registration: browser flow (`/self-service/registration/browser`) と API flow (`/self-service/registration/api`) の双方で、ゲートが拒否した場合に identity が作成されないこと
2. 閉鎖前に作成された flow: ゲートを閉じる前に作った flow を、閉鎖後に submit した場合の挙動 (flow 作成時の判定だけでは足りないか)
3. hook の timeout / 不達 / 非 2xx / 不正応答: registration が成功してしまう (fail-open) か拒否される (fail-closed) か。identity が残るか
4. override 相当: ゲートを通過させる設定 (管理者 override を想定) の挙動と、通常判定との切り替え方
5. 保護の所在の比較: (a) メール所有確認 (Kratos ネイティブ verification を registration 完了条件にできるか)、(b) BOT token 検証 (CAPTCHA 等の token 検証を誰が行うか。Kratos ネイティブで足りるか、Emumet webhook が必要か)、(c) ゲート判定 (Emumet の登録ゲート状態を hook でどう参照するか) を、実験結果に基づき Kratos ネイティブ / Emumet webhook のどちらで担うべきか推奨する
6. 実効設定の観測: Kratos が実際に使っている設定を外部からどう観測できるか。health 応答や設定ファイルの存在を ready の証拠にしない。設定喪失 (verification/CAPTCHA 設定の消失) の検出方法
7. 検証 API 応答の意味: 検証 API の 2xx / 4xx / 5xx / timeout / 空設定 / 無効資格情報 / 429 を、「準備済み」「一時障害」「設定喪失」のどれとして分類するか (provider と失敗分類。D15 q05/q06 に整合)
8. UI 迂回: UI を経由しない直接 API registration、直接 browser flow、他の self-service 入口でゲートが抜けない経路と、抜け道が残る条件
9. 非影響: 既存 identity の login、およびログイン済み利用者の認証済み Account 追加 (`POST /api/v1/accounts` 相当) がゲート設定で影響を受けないこと

## 成果物 (リポジトリに残す)

- 隔離 compose override と Kratos 設定 fixture (本番 compose/設定は変更しない。実験専用)
- 1 コマンドで全実験を再実行できるスクリプトと README (手順・前提・期待結果)
- 結果記録 (例: `e2e/registration-guard/RESULTS.md`): 実験ごとの再現手順、観測した Kratos 応答、identity 作成有無の証拠 (admin API / DB 観測)、結論、成立しない条件の影響と代案
- 保護の所在の推奨 (根拠つき)。最終決定は親が確認して host の ADR (`intents/emumet/decisions/registration-protection-placement.md`) に記録する

## In Scope

- 上記の実験・調査と、再現 fixture・スクリプト・結果記録の作成
- 必要最小限の実験用 webhook スタブ (隔離環境内。Emumet 本体の route/DI/migration は変更しない)

## Out Of Scope

- 本番 Kratos 設定 (`ory/kratos/kratos.yml`、compose.yml の既存サービス) への hook 接続 (E15d)
- 管理者の開閉・override・通知イベントの実装 (E15a)、保護 adapter・実検証 API・設定世代・鮮度期限 (E15c)、Webhook 通知配送 (E15w)、管理 UI (F15)
- 新しい招待システム、login の遮断、`POST /api/v1/accounts` へのゲート適用

## Standalone Child Issue Contract

この PR は、Kratos v1.3.1 の registration を identity 作成前に拒否できるかを隔離環境で実証し、保護の実装所在・
観測契約を決める材料と再現 fixture を Emumet リポジトリに残す。本番設定・既存挙動は変更しない。
成立しない条件が見つかった場合は、実装を進めず影響と代案を結果記録に明記して issue に報告する。

## Acceptance Criteria

- browser/API の直接 registration、閉鎖前に作成した flow、hook の timeout/不達/非 2xx、override 相当の実験結果が再現手順つきで記録されている
- 拒否した registration で identity が作成されていない証拠 (Kratos admin API と DB 観測) がある。pre-persist で拒否できる段階と、persist 後で identity が残る段階が区別されている
- login と認証済み Account 追加 (`POST /api/v1/accounts` 相当) がゲート設定の影響を受けないことが示されている
- メール所有確認・BOT token 検証・ゲート判定を Kratos ネイティブ / Emumet webhook のどちらで担うかの推奨が、実験結果に基づく根拠つきで記録されている
- 実効設定の観測方法・設定喪失の検出方法・検証 API 応答の意味・provider と失敗分類・UI 迂回経路が文書化されている。health 応答や設定ファイルの存在を ready の証拠にしていない
- 隔離 compose・設定 fixture・スクリプト・結果記録が再現可能な形で残り、README の 1 コマンドで再実行できる
- 本番 Kratos 設定・既存 compose サービス・既存アプリコードの挙動は変更されていない

## Verification

- Kratos v1.3.1 実バイナリ (隔離 compose) での全実験の実行結果 (実行コマンドと実際の出力/観測を結果記録に添付)
- identity 作成有無の観測: Kratos admin API (identity 一覧/取得) と DB の拒否前後の比較
- 既存の Emumet テスト・CI に回帰がないこと (`git diff` が e2e/registration-guard と実験用 fixture に閉じていること、`git diff --check`)

## 共有ファイル

Emumet の共有ファイル (`server/src/openapi.rs`、`server/src/route.rs`、`server/src/main.rs`、DI wiring、`migrations/`、`openapi.json`)
は変更しない (別レーン E15a/E8 が最終更新する)。本番 Kratos 設定変更は E15d が所有する。

## 親状態の所在

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
child は host 側の packet / intent / queue / ラベル / ADR を調査・変更しない。

## Related Links

- 設計 (host リポ): `intents/emumet/features/registration-readiness-gate/{overview,packets,acceptance}.md`
- ユーザー決定の正本: host リポ `intents/shuttlepub/packets/candidates.md` D15 節、`intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json` (d15-q01〜q11)
- 認証基盤の前提: host リポ `intents/emumet/decisions/0001-stellar-frozen-ory-authz.md`
- 後続: E15c `registration-protection-readiness` / E15d `registration-gate-enforcement` (本 unit の結果を親が確認するまで draft しない)

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/registration-readiness-gate/overview.md` (primary) + packets.md の E15b に完了リンク追記 (host 側で実施)
- ADR candidate: `intents/emumet/decisions/registration-protection-placement.md` を新設 (host 側 closeout writeback)。所在・provider・観測契約を記録
- Diagram candidate: none
- Docs update: 実証結果・観測契約を acceptance.md へ (host 側 closeout writeback)
- Closeout writeback expected: yes

## Guide Reachability (G645)

role-facing surface: `e2e/registration-guard` の隔離 compose・fixture・実験スクリプト・結果記録。
guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
