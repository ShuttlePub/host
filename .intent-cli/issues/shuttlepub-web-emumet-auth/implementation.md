# shuttlepub-web-emumet-auth Implementation Packet

## Goal

apps/shuttlepub-web の Bun BFF に、booskiff-web を先例とする Hydra OIDC ログイン・callback・session・logout と、Emumet API への Bearer 転送、認証済み Profile 選択を実装する。既存 packages/auth-core・auth-bun と booskiff-web の実認証経路・E2E を流用し、独自 IdP や token のブラウザ保存は行わない。

## Why

SNS メイン UI は Profile 単位の設定(常用絵文字など)を扱うため、Emumet(Ory)で認証した利用者が自分の Profile を選べる必要がある。ただし D03 の UI は S3 準拠の mock で受け入れでき、実認証(本ユニット)を待たない。本ユニットは UI 土台(F0)の上に実認証の経路を安全に載せる。

## Scope

- Hydra OIDC ログイン(認可コード + PKCE + state)、callback、HttpOnly session、logout
- ID token 検証(署名・issuer・audience・expiry)、token 更新方針(booskiff-web 準拠)
- app 間で混線しない session(cookie 名・属性・パス・署名鍵の分離)、safe return URL、mutation の CSRF 対策
- Emumet API への Bearer 転送(Emumet 実設定に合う access token audience)
- 認証済み Profile 選択と Profile context への反映
- 未認証・期限切れ・権限不足の fail closed 処理
- booskiff-web の実 OIDC E2E を流用した新アプリ用 E2E(Kratos/Hydra 実スタック)
- 【モック合意後】ログイン画面・Profile 選択画面の画面構成の実装(ゲート対象。実装前に host intent の合意記録を参照)

## Out of scope

- 独自 IdP の実装、Ory 設定の方針変更
- token の localStorage 等ブラウザ保存
- D15 の一般登録 UI・登録ゲート
- Profile の作成・編集機能、ShuttlePub backend 認証の実装
- モック合意前の画面構成の独自決定

## Design notes

- session cookie 名・署名鍵・パスは app ごとに分離し、emumet-web / booskiff-web と混線させない
- return URL は相対パスのみ許可し、検証に失敗したら既定の遷移先へ
- 認証フロー・BFF は先行し、ログイン画面・Profile 選択 UI はモック合意後(host intent の合意記録を参照してから実装)。それまでは機能検証用の最小の無装飾 UI に留める

## Verification

- booskiff-web の実 OIDC E2E を流用した新アプリ用 E2E(Kratos/Hydra 実スタックでログイン→Emumet 読取→logout)がグリーン
- 改ざん応答テスト(state/PKCE/ID token 署名・issuer・audience・expiry の不正で fail closed)
- Origin / CSRF 検査、cookie 属性(HttpOnly・混線なし)検査、token 漏洩検査(HTML・storage・ログに token が出ない)
- access token audience が Emumet 実設定に合うことの確認
- 既存 CI(purs-tidy check、spago build/test、bun test、tsc)と git diff --check がグリーン

## Knowledge Maintenance (G461)

- Intent placement: social-experience.md と candidates.md へ FA の unit・依存・到達範囲を追記(新規 intent ノード不要)
- ADR candidate: none(新認証方式なし。ratcap oauth2-consent の既存決定を参照)
- Diagram candidate: none
- Docs update: 認証経路と検証境界を technology/overview.md / social-experience.md に記録
- Closeout writeback expected: yes
