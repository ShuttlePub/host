# hydra-oidc-real-e2e Implementation Packet

## Goal

booskiff-web の real モード (USE_MOCK=false, Hydra OIDC) 認証フローを、Hydra+Kratos を含む実スタック compose で E2E 検証する基盤を追加する。mock モード E2E と単体テストでカバー済みの認証ハードニング (id_token 検証・fail-closed・method 制限・Origin 検証) が実設定でも正しく動くことを実地で確認する。

## Why

issue #10 (PR #9 レビュー残件) の Medium-2 として「real モードの E2E が存在しない」が指摘され、オペレーター決定で PR #14 から分離・延期された。PR #14 で real callback のハードニング (id_token 署名/issuer/audience/expiry 検証、missing_id_token の fail-closed 化) を入れたが、これらは mock JWKS サーバーによる単体テストのカバーであり、実 Hydra との結合は未検証のまま残っている。トークン交換・JWKS 取得・セッション発行の実設定での動作保証がこの slice の価値。

## Scope

- Hydra + Kratos (+ 必要な DB / マイグレーション / クライアント登録) を含む real モード用 compose 定義の追加 (compose.e2e.yml への追加または compose.e2e.real.yml の新設)
- Kratos identity の seed/provisioning (テストユーザー作成)
- Playwright による real E2E: ログイン画面 → Hydra 認可 → callback → セッション発行 → 認証済み drive 操作 (一覧/アップロード等、既存 mock E2E と同等の最低限) → logout
- 負の系: 実設定で再現可能な範囲での不正認証応答 (openid スコープ欠落クライアント等) による fail-closed の確認
- CI 統合: real スイートを既存 e2e ジョブに追加、または独立ジョブとして追加 (起動時間が大きい場合は並列ジョブ化を検討)
- child repo 側 README への real E2E ローカル実行手順の追記

## Out of scope

- 既存 mock モード E2E (16 件) の変更・削除 (壊さないこと)
- booskiff-web の新機能追加・認証ロジック自体の変更 (検証が目的。実設定で不具合が見つかった場合は別 issue 化して報告)
- Hydra/Kratos の本番デプロイ設定
- BFF・PureScript 側の単体テスト追加 (PR #14 でカバー済み)

## Verification

- real スイート全パス (実実行の出力を PR に記載)
- 既存 mock E2E 16/16、`bun test` (97 件)、`spago test` が引き続き全パス
- CI で mock/real 両スイート green
- `git diff --check` clean

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/ratcap/intent-tree/00-map.md` に行追加。新規ノード不要。
- ADR candidate: なし (Hydra/Kratos 採用は oauth2-consent-flow 系の既存決定に包含)。
- Diagram candidate: なし。
- Docs update: host 側はなし。child repo README に real E2E 実行手順を追記。
- Closeout learning: `write_back_required: true`、起動時間/安定性/CI コストと実設定で検出した挙動差異を `intents/ratcap/technology/overview.md` へ。
- Guide reachability (G645): `guide workflow task implementation-loop` → implementation → shuttlepub-frontends (apps/booskiff-web/e2e, compose.e2e.yml, .github/workflows)。
