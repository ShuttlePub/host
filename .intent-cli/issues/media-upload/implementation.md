# media-upload Implementation Packet

## Goal

画像アップロード REST API (Emumet 固有設計、multipart + MIME/サイズ検証) を新設し、
アップロードされた画像を S3 互換ストレージへ保存、Image エンティティ登録
(blurhash 生成含む)、Profile icon/banner 紐付け (既存 PATCH フロー接続)、
Actor ドキュメントの icon/image 出力、変更時の Update(Person) フォロワー配送までを
一気通貫で実現する。

## Why

C1 (ストレージバックエンド・配信ドメイン) が 2026-08-12 の grill で解消され、
packet 化のブロッカーがなくなった。Image エンティティ/Repository と Profile
紐付けフローは実装済みで、欠けているのはアップロード API・ストレージ連携・
Actor 反映の 3 点のみ。

## Scope

- アップロード REST API (multipart、MIME/サイズ検証)。Mastodon /api/v1/media
  互換は Non-goal (ADR 0005)
- S3 互換ストレージ抽象化レイヤ + 第一実装 (S3 互換)。バイト保存・URL 生成
  (公開ベース URL + キー、ベース URL は設定差し替え式)
- Image 登録 (url/hash/blur_hash。blurhash 生成を含む)
- 開発環境: compose.yml への RustFS 追加と接続設定
- Profile icon/banner 紐付け (既存 PATCH icon_url/banner_url フローへ接続)
- Actor ドキュメントの icon/image 出力 (現在 None 固定を解消)
- アイコン/バナー変更時の Update(Person) フォロワー配送 (delivery.rs 流用)

## Out of scope

- 本番ストレージ選定・R2 カスタムドメイン構築 (抽象化で差し替え可能。運用側作業)
- リモートアクターの icon 取得・キャッシュ (別論点)
- リレーサーバー経由の Update 配送 (post-relay 側スコープ)
- ローカル FS バックエンド (抽象化の第二実装として将来追加可能)

## Verification

- アップロード→S3 保存→URL 発行→PATCH で Profile 設定→Actor 出力までの E2E
- Update(Person) 配送のテスト (既存 delivery のテストパターンに倣う)
- compose 起動のみで上記が通ること
- `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: intents/emumet/features/media-upload/overview.md (新規ノード不要)
- ADR candidate: なし (feature スコープの決定は features/media-upload/decisions.md に記録済み)
- Diagram candidate: なし
- Docs update: なし (document リポジトリ同期は Host-only backlog 項目)
- Closeout learning: RustFS compose 統合・S3 SDK 接続の知見 (write_back_required: false)

- Guide reachability (G645): packet.yaml の guide_reachability を参照
  (implementation-loop → media アップロード REST API エンドポイント)

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
