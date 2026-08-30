# 決定一覧: 2026-08-29 初動 shaping grill (D1-D15)

grill Q1-Q15 の結論。決定の経緯・検討肢・理由の完全版は
`../interviews/booskiff.json` (セッション: booskiff)。外部調査に基づくものは
 librarian 調査レポートの内容を Q5/Q8 の回答に統合済み。

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D1 (Q1) | 初動スコープ | 連携 Drive 基盤 + 課金ポリシー土台を初動に含める。課金の後付け設計リスクを回避 | 確定 |
| D2 (Q2) | スタック | Rust + Axum + PostgreSQL + flake/just (Emumet 統一)。層構成は Booskiff 規模に再検証 | 確定 |
| D3 (Q3) | 認証 | 信頼 issuer の JWT を JWKS で検証のみ (ステートレス)。revocation は短命+期限切れ待ち。単体モード認証は後送り | 確定 |
| D4 (Q4) | Account/Profile | Booskiff は Account コンテキストのみ、Profile 概念を持たない。参照関係は Emumet が保持 | 確定 |
| D5 (Q5) | 転送経路 | ハイブリッド: アップロード=サーバー経由 (正確計量+検証)、ダウンロード=短命 presigned URL (S3 直)。Misskey/Mastodon/Dropbox 実例ベース | 確定 |
| D6 (Q6) | バックエンド | S3 互換のみ (MinIO 等)。Emumet フォールバック S3 とは論理分離 | 確定 |
| D7 (Q7) | 課金ドメイン | Booskiff が第一級で保持 (プラン・サブスク・容量)。Emumet は参照のみ | 確定 |
| D8 (Q8) | プラン定義 | Fluxer 式: コード内デフォルト + DB 上書き + 管理者 API (初動から)。価格/プロバイダは env。self-host は everyone/mirror モード | 確定 |
| D9 (Q9) | 共有 (輸送) | 初動スコープ外。リンク型 vs Account 型等の設計論点は features/ にメモ | 後続 slice |
| D10 (Q10) | API 表面 | 独自 REST/OpenAPI のみ。Misskey 互換なし (UX 言及に留まる)。独自フロントあり | 確定 |
| D11 (Q11) | フロント構成 | ~~TanStack Start (SSR off) がフロント+BFF 兼任~~ **Q16 (同日) で反転: PureScript + Flame (SSR + hydration) + Bun BFF (Ratcap パターン転用)。配置は shuttlepub-frontends モノレポの apps/booskiff-web (core リポジトリとは分離)**。Rust core は JWT 検証のみの純粋性を維持 | 確定 (Q16 で修正) |
| D12 (Q12) | アクセス制御 | 2 値: 非公開 (owner のみ、認証+presigned) / 公開参照 (推測不能キー付き公開 URL、immutable キャッシュ) | 確定 |
| D13 (Q13) | 配布形態 | ShuttlePub 標準形: flake + deploy/self-hosting/ + ghcr イメージ + tag リリース | 確定 |
| D14 (Q14) | 初動の境界 | core + web 最小限 (ログイン + Drive 一覧/アップ/削除) を 1 実行単位に含める | 確定 |
| D15 (Q15) | 受け入れ基準 | 3 層検証: core 単体結合 / compose E2E (API) / web E2E (Playwright)。計量正確性は初動の受け入れ条件 | 確定 |
| D16 (Q17) | フォルダ・サムネイル | 初動ドメインにフォルダ (フラット、D21 参照) を含める。サムネイル・画像変換は初動外 → 後続 slice。後続追加を非破壊にするため file レコードは「オリジナル + 派生オブジェクト」を許容する設計 (S3 キー prefix 規約 or file_objects 1:N) | 確定 |
| D17 (Q18) | 計量対象 | ストレージ使用量 (受信バイト) のみ。ダウンロード帯域・リクエスト数は初動外、必要時に拡張 | 確定 |
| D18 (Q19) | 管理者 API 認証 | 管理者トークン (X-Admin-Token 等) + 単一ロール (admin) で初動実装。ただし共通認証ミドルウェア (トークン → 固定 admin ロールの抽象化) 経由 + トークン個別識別 (named token / token id) で、RBAC / OIDC への後続拡張を endpoint 無変更で可能に | 確定 |
| D19 (Q20) | owner 抽象化 | owner を owner_type + owner_id のポリモーフィック設計で初動から抽象化 (個人 / 組織の両方を許容)。組織アカウントの管理機能 (メンバー招待・権限) は後続 slice | 確定 |
| D20 (Q21) | デフォルト制限 | 1 GB / user、100 MB / file、100 req/min。運用データを見て段階緩和 | 確定 |
| D21 (Q22) | フォルダ階層 | フラット (1 階層)。ファイル → フォルダは 0..1 の folder_id 参照 (parent_id 自己参照ツリーは採用しない)。共有 (D9) の共有単位に folder_id を使う設計と整合 | 確定 |

## 決定の反転記録

- **2026-08-29 Q16 (同日中の反転)**: D11 の Web スタックを TanStack Start から
  PureScript + Flame + Bun BFF へ反転。経緯・根拠の完全版は interviews/booskiff.json
  の Q16。発端は Ratcap の ShuttlePub フロントエンドモノレポ再編
  (design-tokens → styles → ui → FrontApp + BFF)。SSR off / サーバー関数 BFF /
  リポジトリ同居 (web を Booskiff リポジトリに同居させる方針) は廃止。
  D10 (独自 REST/OpenAPI) と D15 (3 層検証) は維持。

## 意図的に将来 slice に送った論点

- 共有 (輸送) の設計詳細 (D9、メモ: features/)
- サムネイル・画像変換 (D16/Q17。file レコードの派生オブジェクト許容設計は初動から、変換ジョブ基盤・ライブラリ選定は後続)
- 組織 Drive の課金・容量の組織単位適用 (emumet C1 委譲、メモ: features/)
- 組織アカウントの管理機能 (D19/Q20: メンバー招待・権限など)
- 管理者 RBAC / OIDC 連携 (D18/Q19: ミドルウェア抽象化とトークン個別識別は初動済み)
- copy 系 API (emumet C1 委譲、メモ: features/)
- 支払いプロバイダの具体実装 (Stripe 等。抽象化+無効モードは初動済み)
- 単体運用モードの認証 (Kratos 同居 or 簡易ローカル認証)
