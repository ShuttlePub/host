# media-upload — design decisions

> See [overview.md](overview.md) for goals and [../../decisions/](../../decisions/) for cross-domain ADRs.

## Decisions

### 2026-08-12 grill 確定 (C1)

Q/A 詳細と選定経緯:
[../../interview/2026-08-12-c1-c3-grill.md](../../interview/2026-08-12-c1-c3-grill.md)

1. **ストレージバックエンド: S3 互換 (第一実装)。開発環境は RustFS**
   - NFR「差し替え可能な抽象化」を維持し、抽象化レイヤの後ろに S3 互換実装を置く
   - 開発環境 (compose.yml) には RustFS を追加 (環境変数のみで起動、Podman 公式
     サポート、Apache 2.0)。MinIO OSS は 2026-04 アーカイブ済みで不採用、
     Garage は v2.3.0 で自動化可能だが RustFS の手軽さを優先
   - 本番ストレージの選定 (R2 等) は抽象化で差し替え可能なため本 feature の
     スコープ外
2. **配信: 別ドメイン直接配信。Emumet はプロキシしない**
   - 配信 URL = 公開ベース URL + オブジェクトキー。ベース URL は設定で差し替え可能
   - 本番想定: Cloudflare R2 + カスタムドメイン接続 (Cloudflare エッジキャッシュ
     経由 = CDN 構成。エグレス料金ゼロ)
   - 開発環境: RustFS エンドポイント直結
   - presigned URL は不採用 (AP の icon/image はリモートが後から再 fetch するため)
3. **アイコン/バナー変更時: Update(Person) をフォロワー inbox へ署名付き配送**
   - 連合標準挙動。既存 `delivery.rs` を流用 (C2 post-relay には依存しない)
   - 対象はフォロワー配送のみ。リレーサーバー配送は post-relay 側スコープ

### 関連する既存 ADR

- [0005-rest-api-is-emumet-specific](../../decisions/0005-rest-api-is-emumet-specific.md):
  アップロード API は Mastodon `/api/v1/media` 互換を目指さず Emumet 固有設計でよい
- [0002-account-address-on-emumet-domain](../../decisions/0002-account-address-on-emumet-domain.md):
  アカウント住所は Emumet ドメイン (配信 URL は別ドメインで可、との整合は Q2 で確認済み)
