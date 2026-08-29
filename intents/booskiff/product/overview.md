# Product Overview — booskiff

確定 2026-08-29 (grill Q1/Q9/Q10/Q14)。詳細な決定理由は `../interviews/booskiff.json`、
一覧は `../decisions/2026-08-29-initial-shaping.md`。

## 初動スコープ (Q1=B, Q14=B)

**`drive-foundation`**: 1 つの実行単位に以下を含める。

- **core (Rust)**: 認証 (信頼 issuer の JWT を JWKS 検証のみ) + Account 単位 Drive の
  CRUD (アップロード/一覧/表示/削除) + S3 互換保存基盤 + 課金ポリシー土台
  (Fluxer 式: コード内デフォルト + DB 上書き + 管理者 API)
- **web (TanStack Start, SSR off)**: OAuth/OIDC ログイン + セッション Cookie による
  Drive 一覧/アップロード/削除の最小 UI。BFF 責務 (セッション管理・トークン更新・
  core 内部呼び出し) をサーバー関数/API ルートに内包

## 機能境界 (何を「しない」か)

- **共有 (輸送) は初動に含めない** (Q9=A): 有料限定機能の候補として課金動作後の
  slice に切る。設計論点のメモ:
  - (a) リンク型 (期限・パスワード付き URL) vs (b) Account 指定型
    (Emumet Account 間の輸送、コピー or 参照) vs (c) 両方
  - 外部非ログインユーザへの公開の是非
- **Misskey Drive API 互換は持たない** (Q10=A): 「Misskey Drive を意識した」は
  UX 言及。独自 REST/OpenAPI。将来 Misskey 互換が必要なら Emumet 側の変換レイヤーで作る
- **Profile 概念は API に出さない** (Q4=A): Booskiff は Account コンテキストのみ。
  Profile ↔ ファイルの参照関係は Emumet 側が保持

## ファイルの公開範囲 (Q12=A)

2 値: デフォルト非公開 (owner のみ、認証 + 短命 presigned URL で取得) /
公開参照 (Emumet が Profile 参照を設定時に発行される推測不能キー付き公開 URL、
immutable キャッシュ)。followers 限定等の中間範囲は将来拡張。

## 受け入れ基準 (Q15=A)

1. core 単体・結合テスト: ドメインルール、課金計量の正確性 (受信バイト記録・
   容量上限超過拒否)、presigned 発行、公開フラグ/URL 制御
2. compose 上 E2E (API): 認証 → アップロード → 計量 → presigned ダウンロード →
   公開フラグ/URL → 削除 (MinIO + Postgres 実コンテナ)
3. web E2E (Playwright): ログイン → アップロード → 一覧 → 削除
   (セッション Cookie 経由で core 到達を含む)

## emumet からの受け渡し要件 (詳細は features/emumet-handoff-requirements.md)

- 組織 Account を Drive 所有者として許可すること (所有者モデルへの配慮は初動で実施)
- copy 系 API (Profile 移管時のコピー) — 後続 slice
