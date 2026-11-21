# emumet-login-consent-boundary Implementation Packet

## Goal

`/oauth2/login`・`GET/POST /oauth2/consent` と Hydra/Kratos との連携を、将来 Stellar へ移せる独立したまとまりに分ける。kernel に境界型と port、application に `service/login_consent`、driver に Hydra 管理 API と Kratos session の client を置き、server の route は入出力の変換だけ、`OAuth2Api` はユースケースだけの公開にする。外から見える挙動は一切変えない。

## Why

決定 D52 (intents/shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md) と D38 (2026-11-18-p1-first-and-stellar-carve-out.md) により、P1 では DCR を実装せず、既存のログイン・同意のコードをモジュールとして分けるところまでを行う。現状は route が Hydra/Kratos を直接呼び、分岐・scope 検証・Cookie の絞り込み・email claim の付与まで route に入っている。

## Scope

- 詳細と受け入れ基準 A1-1〜A1-10 は GitHub issue 本文 (`github-body.md`) を正とする。
- 変更は kernel (境界型・port)・application (service/login_consent)・driver (Hydra 管理 API / Kratos session の client)・server (route・OAuth2Api・AppModule の配線)・CLAUDE.md の該当記述に限る。
- 既存の route テストは変更せずに通し、DB を使わないユースケースのテストと Ory のエラー別のテストを追加する。

## Out of scope

- 他の P1 単位 (C0・K1・L1・Q1・S1・I1・B1・T1)、DCR、client_id と origin の対応表、Stellar の実際の切り出し。
- JWT 検証・JWKS キャッシュ・Account/Profile/link・KratosRegistrationFlowDirectory・登録ゲートの移動。
- DB マイグレーション、新しい環境変数、新しい route、OpenAPI の変更。

## Verification

`cargo fmt --check`、`cargo clippy --workspace --all-targets -- -D warnings`、`cargo test --workspace` (DB テストを含む)、`cargo test -p server write_openapi_spec_to_file -- --ignored` の後の `git diff --exit-code openapi.json`、`git diff --check`、PR CI (lint-and-test・e2e) 全緑。

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/emumet/intent-tree/00-map.md` (新規ノードは不要。D52/D38 の規則をコード構造にする作業)。
- ADR candidate: 辞退 (決定は D52/D38 で済み)。
- Diagram candidate: 辞退。
- Docs update: Emumet の `CLAUDE.md` の Architecture / Auth Architecture / Server DI Architecture の OAuth2 関連記述をこの PR で直す。
- Closeout learning: 境界の module 名と配置、独立性の確認方法、既存テストを無変更で通せたか、Stellar へ移すときに残る結合。`write_back_required: false`。

- Guide reachability (G645): この slice は運用者・role 向けの新しい surface を追加しない (`no_role_facing_surface: true`)。
