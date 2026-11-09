## Goal

apps/shuttlepub-web の Bun BFF に、booskiff-web を先例とする Hydra OIDC ログイン・callback・session・logout と、Emumet API への Bearer 転送、認証済み Profile 選択を実装する。既存 packages/auth-core・auth-bun と booskiff-web の実認証経路・E2E を流用し、独自 IdP や token のブラウザ保存は行わない。

## Why This Slice Exists Now

SNS メイン UI は Profile 単位の設定(常用絵文字など)を扱うため、Emumet(Ory)で認証した利用者が自分の Profile を選べる必要がある。ただし D03 の UI は S3 準拠の mock で受け入れでき、実認証(本ユニット)を待たない。本ユニットは UI 土台(F0)の上に実認証の経路を安全に載せる。

## Current Observed State

- apps/booskiff-web は Hydra OIDC の実認証経路と実 OIDC E2E を持ち、packages/auth-core・auth-bun を共有している
- apps/shuttlepub-web は F0 で新設される前提で、認証・session・Profile 選択は未実装
- Emumet は Ory(Kratos/Hydra)で認証を扱い、Profile を持つ

## Accepted Baseline You May Assume

- ratcap oauth2-consent の既存決定(Hydra consent/OIDC の扱い)と booskiff-web の先例に従い、新しい認証方式を導入しない
- ブラウザに access token / ID token を置かない。token の localStorage 保存は禁止
- D15(一般登録 UI)は別。独自 IdP も作らない
- F0 が root lockfile・workspace・CI・schema 取込基盤を所有する。本ユニットは追加登録のみ行う
- 【モック合意ゲート】画面構成(レイアウト・画面遷移・デザイン)を決める UI 実装は、ユーザーとのモック合意が成立するまで実装 PR を出さない。モック合意は host の intent(ShuttlePub/host の intents/shuttlepub/ 配下)に記録される。画面実装を始める前にその合意記録を参照し(場所はこの issue 上のコメントで示される)、合意内容に従う。合意前に画面構成を独自に決めて実装しない。画面構成に依存しない部分は合意を待たずに先行してよい
- 範囲の分け方: 【先行可】認証フロー自体と BFF 側(OIDC・callback・session・logout・CSRF・Bearer 転送・fail closed・E2E)。【モック合意後】ログイン画面・Profile 選択画面など画面構成を決める UI(レイアウト・画面遷移・デザイン)。画面部分は、モック合意前は実装 PR を出さず、機能検証に必要な最小の無装飾なページ/エンドポイントまでに留める

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `apps/shuttlepub-web`, `packages/auth-core`, `packages/auth-bun`, `apps/shuttlepub-web/e2e`

Target part: "shuttlepub-web の Bun BFF における Hydra OIDC 認証、HttpOnly session、Emumet API への Bearer 転送、認証済み Profile 選択"

## In Scope

- Hydra OIDC ログイン(認可コード + PKCE + state)、callback、HttpOnly session、logout
- ID token 検証(署名・issuer・audience・expiry)、token 更新方針(booskiff-web 準拠)
- app 間で混線しない session(cookie 名・属性・パス・署名鍵の分離)、safe return URL、mutation の CSRF 対策
- Emumet API への Bearer 転送(Emumet 実設定に合う access token audience)
- 認証済み Profile 選択と Profile context への反映
- 未認証・期限切れ・権限不足の fail closed 処理
- booskiff-web の実 OIDC E2E を流用した新アプリ用 E2E(Kratos/Hydra 実スタック)
- 【モック合意後】ログイン画面・Profile 選択画面の画面構成の実装(ゲート対象。実装前に host intent の合意記録を参照)

## Out Of Scope

- 独自 IdP の実装、Ory 設定の方針変更
- token の localStorage 等ブラウザ保存
- D15 の一般登録 UI・登録ゲート
- Profile の作成・編集機能、ShuttlePub backend 認証の実装
- モック合意前の画面構成の独自決定

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: apps/shuttlepub-web の BFF に Hydra OIDC(PKCE/state、ID token 検証)ログイン・callback・HttpOnly session・logout、CSRF 対策、safe return URL、Emumet への Bearer 転送、認証済み Profile 選択を実装し、Kratos/Hydra 実スタックでのログイン→Emumet 読取→logout E2E と改ざん・Origin・cookie・token 漏洩の検査を通すこと。未認証・期限切れ・権限不足は fail closed。画面構成を決める UI 部分は、ユーザーとのモック合意後にのみ実装する。

## Acceptance Criteria

- PKCE と state を使った認可コードフローが成立し、state 不一致・PKCE 不一致は fail closed になる
- ID token の署名・issuer・audience・expiry を検証し、検証失敗はログインを成立させない
- session cookie は HttpOnly で、他のアプリ(emumet-web / booskiff-web 等)と混線しない(名前・属性・スコープ)
- ログイン後の return URL は安全な相対先のみ許可する(open redirect を許さない)
- 状態変更(mutation)リクエストに CSRF 対策(Origin / トークン検証)がある
- Emumet へ転送する access token の audience が Emumet 実設定に合う
- 未認証・期限切れ・権限不足は fail closed(明確なエラー/再ログイン)で、暗黙に認証済み扱いにしない
- 認証済み利用者が自分の Profile を選択でき、選択結果が shuttlepub-web の Profile context に反映される
- Kratos/Hydra 実スタックで、ログイン→Emumet 読取→logout の E2E が成功する
- 画面構成(レイアウト・画面遷移・デザイン)を決める UI 部分は、host intent に記録されたユーザーとのモック合意に従って実装され、その合意記録を参照して作られている(合意前の独自画面構成を含まない)

## Verification

- booskiff-web の実 OIDC E2E を流用した新アプリ用 E2E(Kratos/Hydra 実スタックでログイン→Emumet 読取→logout)がグリーン
- 改ざん応答テスト(state/PKCE/ID token 署名・issuer・audience・expiry の不正で fail closed)
- Origin / CSRF 検査、cookie 属性(HttpOnly・混線なし)検査、token 漏洩検査(HTML・storage・ログに token が出ない)
- access token audience が Emumet 実設定に合うことの確認
- 既存 CI(purs-tidy check、spago build/test、bun test、tsc)と git diff --check がグリーン

## Related Links

- 先行ユニット: shuttlepub-web-foundation({{F0}}、ShuttlePub/shuttlepub-frontends)
- 先例: apps/booskiff-web の認証経路・実 OIDC E2E、packages/auth-core・auth-bun
- 意図: intents/shuttlepub/product/social-experience.md、intents/shuttlepub/packets/candidates.md、ratcap oauth2-consent の既存決定

## Knowledge Maintenance

- Intent placement: social-experience.md と candidates.md へ FA の unit・依存・到達範囲を追記(新規 intent ノード不要)
- ADR candidate: none(新認証方式なし。ratcap oauth2-consent の既存決定を参照)
- Diagram candidate: none
- Docs update: 認証経路と検証境界を technology/overview.md / social-experience.md に記録
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が ShuttlePub/shuttlepub-frontends (`apps/shuttlepub-web`, `packages/auth-core`, `packages/auth-bun`, `apps/shuttlepub-web/e2e`) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
