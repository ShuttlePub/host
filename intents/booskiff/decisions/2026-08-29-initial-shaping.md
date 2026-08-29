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
| D11 (Q11) | フロント構成 | TanStack Start (SSR off) がフロント+BFF 兼任。Rust core は JWT 検証のみの純粋性を維持。リポジトリ同居 | 確定 |
| D12 (Q12) | アクセス制御 | 2 値: 非公開 (owner のみ、認証+presigned) / 公開参照 (推測不能キー付き公開 URL、immutable キャッシュ) | 確定 |
| D13 (Q13) | 配布形態 | ShuttlePub 標準形: flake + deploy/self-hosting/ + ghcr イメージ + tag リリース | 確定 |
| D14 (Q14) | 初動の境界 | core + web 最小限 (ログイン + Drive 一覧/アップ/削除) を 1 実行単位に含める | 確定 |
| D15 (Q15) | 受け入れ基準 | 3 層検証: core 単体結合 / compose E2E (API) / web E2E (Playwright)。計量正確性は初動の受け入れ条件 | 確定 |

## 意図的に将来 slice に送った論点

- 共有 (輸送) の設計詳細 (D9、メモ: features/)
- 組織 Drive の課金・容量の組織単位適用 (emumet C1 委譲、メモ: features/)
- copy 系 API (emumet C1 委譲、メモ: features/)
- 支払いプロバイダの具体実装 (Stripe 等。抽象化+無効モードは初動済み)
- 単体運用モードの認証 (Kratos 同居 or 簡易ローカル認証)
