# booskiff-web-auth-hardening Implementation Packet

## Goal

booskiff-web の real 認証に残る 2 つのリスクを修正する: (1) 同名 cookie のうち最初の値を採用する共有 cookie 処理 (cookie tossing によるログイン途中 state/PKCE・セッション cookie の差し替え)、(2) 認可要求に `prompt=login` がなく、Hydra の remembered login session により A→logout→B で B が A として認証され得ること。

## Why

shuttlepub-web-emumet-auth (PR #32/#41) のレビューで同種の不備が見つかり shuttlepub-web 側だけで修正された。共有 auth-core / auth-bun と booskiff-web は未修正のまま。

## Scope

- packages/auth-core の parseCookieValue: 同名 cookie が複数あれば null (fail-closed)
- packages/auth-bun の CookieJar.mergeBrowserCookies: 同名 ory_kratos* が複数ある名前はドロップ
- apps/booskiff-web/bff/auth-real.ts: logout の Kratos cookie 転送を CookieJar に統一、startRealOAuth に prompt=login
- 回帰テスト (bun test) と real E2E (A→logout→B、remember 有効 provider)、e2e compose の provider を remember 有効化し 2 人目の seed を追加

## Out of scope

- RP-initiated logout (id_token_hint + Hydra /oauth2/sessions/logout)。残余リスクとして PR に記録
- emumet-web の認可開始への prompt=login 付与、__Host- cookie プレフィックス、OIDC nonce 検証 (別 unit 候補)
- login 導線・id_token 検証・CSRF など認証ロジックの他の変更

## Verification

- bun test (apps/booskiff-web bff、packages/auth-bun、apps/emumet-web、apps/shuttlepub-web)、bunx tsc --noEmit
- booskiff-web mock E2E / real E2E は secret・Docker 不在でローカル実行できなければ未実行と PR に明記
- git diff --check

## Knowledge Maintenance (G461, optional)

- Intent placement: intents/ratcap/intent-tree/00-map.md (新規ノード不要)
- ADR candidate: decline (RP-initiated logout 不採用は PR 本文に残余リスクとして記録)
- Diagram candidate: decline
- Docs update: apps/booskiff-web/e2e/README.md に remember 有効 provider の記述を追記する場合のみ
- Closeout learning: write_back_required=false
- Guide reachability (G645): guide workflow task implementation-loop / role implementation / target ShuttlePub/shuttlepub-frontends (role-facing 新規 surface なし)
