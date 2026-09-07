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

## 実装時確定メモ (drive-foundation closeout, 2026-09-03)

drive-foundation 実装 (ShuttlePub/Booskiff PR #2、2026-08-30 マージ) で確定した事項。
初動 shaping で「再検討・再検証」としていた論点の結論と、API surface の確定形。

- **D2 層構成の再検証結果**: Emumet 式 4 層 (kernel/application/driver/server) は採用
  せず、単一 crate (`core/`) のドメイン別モジュール構成を採用
  (`admin/`, `auth/`, `billing/`, `drive/`, `storage.rs` 等)。Booskiff の現規模では
  モジュール境界で十分であり、層分割は将来規模が育った時点で再評価する。
- **D10 API surface 確定**: REST は `/v1/*` プレフィックス。
  `/v1/folders`, `/v1/files`, `/v1/files/{id}/download-url` (presigned),
  `/v1/files/{id}/publish` (公開 URL 発行), `/v1/billing/status`,
  管理者系 `/v1/admin/tokens`・`/v1/admin/billing/rules`・
  `/v1/admin/owners/{owner_type}/{owner_id}/{plan,usage}`。公開参照は `/public/{key}`
  (推測不能キー)。運用上の `/healthz`・`/readyz` あり。
- **D7/D8/D17 課金スキーマ確定形**: migration 上の 3 テーブル構成 —
  `billing_rules` (DB 上書き層), `storage_usage` (受信バイト計量), `plan_assignments`
  (プラン割当)。billing モジュールは plans/rules/resolve/assignments/usage/provider
  分割で、コード内デフォルト → rules → plan の解決順を保持。
- **D16 派生オブジェクト許容の実現方式**: `files` + `file_objects` (1:N) 方式を採用
  (S3 キー prefix 規約ではない)。命名標準方式として後続サムネイル slice を非破壊追加可。
- **D18 named token 実現**: `admin_tokens` テーブルでトークン個別識別 (named token) を
  実装。共通認証ミドルウェア経由で全 endpoint が固定 admin ロールを解決する形を確認。
- **D13 配布形態の具体化**: `deploy/self-hosting/` は compose.yml + Caddyfile +
  Containerfile (+ dockerignore) の構成。`e2e/` に compose 上 E2E を配置。

## 決定一覧: 2026-09-06 課金・容量 grill 第2ラウンド (D22-D28)

grill Q23-Q31 の結論。決定の経緯・検討肢・理由の完全版は
`../interviews/booskiff.json` (Q23-Q31)。試算・調査は librarian レポート
(市場価格比較 / R2 原価 / さくらのVPS / freemium 転換率 / PSP 比較 /
Proton・Mullvad 実例) を回答に統合済み。

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D22 (Q23) | 価格・容量確定 | free 5 GB / premium 100 GB・980円/月 / add-on +50GB・500円/月。単ファイル 100 MB・レート 100 req/min は現行維持。為替前提 $1=170円。損益: 有料1人あたり貢献利益 ~869円/月、損益分岐はオンプレ期 ≈ 有料1人 (総50-200人)、VPS 移行期 ≈ 有料13-16人 (2% 転換で総 650-800 ユーザー)。有料転換率は市場ベース (悲観 0.5-1% / 基本 2% / 楽観 5%) | 確定 |
| D23 (Q24/Q25) | over-quota 挙動 | read-only 縮退: 超過中はアップロード・新規フォルダ作成・新規 publish をブロック。DL・削除・閲覧と既存公開 URL の配信は継続。強制削除はしない。容量を下回れば即解除 | 確定 |
| D24 (Q26) | 削除ライフサイクル | ゴミ箱: 削除は論理削除 (deleted_at) + 7 日後に自動物理削除 (アプリ側スイープ GC、S3 ライフサイクル非依存)。ゴミ箱内も容量計上。ユーザー操作での完全削除 (即時 purge) と復元 API を提供 | 確定 |
| D25 (Q27) | ゴミ箱と公開参照 | ゴミ箱移動で公開 URL (/public/{key}) の配信停止 (404/410)。復元で公開設定も復活 (publish 状態を deleted_at と同時に保留) | 確定 |
| D26 (Q28) | 決済構成 | 前払い期間制 (1/3/6/12ヶ月購入・期限前リマインダー・支払いで延長)。自動引き落とし型サブスクは共通モデルにしない。チャネル: BTCPay Server 自前運用 (BTC オンチェーン + Lightning、円建て請求・受取時換算・即時円転) 主軸 + PayPal (fiat 主経路) + PayPay (国内単発、申込時に継続課金可否/UGC 承認/手数料区分を確認)。ETH は後回し。カード直接 PSP (Stripe/国内/ハイリスク系) は当面不採用、売上実績後に再交渉。skebcoin は外部決済不可と結論。有効化は DB フラグ + admin パネル (初期値 OFF) | 確定 |
| D27 (Q29) | 課金 UI 責務 | ユーザー課金ページ (容量・プラン・前払い期限・購入導線・ゴミ箱残量) と admin コントロールパネルは booskiff-web 内に実装。Emumet からは参照 API (残量サマリ等) のみ。統合アカウント画面への集約はしない | 確定 |
| D28 (Q30/Q31) | self-host と降格 | self-host 既定は mirror モード (全員 free 相当、運営者が admin で後から変更可。everyone も選択肢)。課金プロバイダ設定も管理画面に落とし込み、公式/セルフホストで同じ運用ができるオープンな構成 (クローズド化しない)。前払い期限切れは即降格 (猶予状態は作らない。保護は D23 の read-only 縮退) | 確定 |

## 第2ラウンドで意図的に後続に送った論点

- 組織単位の課金・容量適用 (依存: emumet 組織管理機能・copy API 未実装。後続 grill ラウンド)
- ETH 決済の追加 (需要確認後、別ウォレット・別会計)
- カード直接 PSP の再交渉 (UnivaPay / GMO-PG / CCBill 系。売上実績を作ってから)
- BTCPay の運用詳細 (VPS サイジング 8-16GB 目安、Lightning 流動性・運用負荷) は実装時確定事項
