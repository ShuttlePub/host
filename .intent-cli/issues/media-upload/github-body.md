# media-upload: 画像アップロード API + S3 互換ストレージ連携 + Actor icon/image 反映

## Goal

画像アップロード REST API (Emumet 固有設計) を新設し、S3 互換ストレージへの保存・
Image エンティティ登録 (blurhash 生成含む)・Profile icon/banner 紐付け・
Actor icon/image 出力・Update(Person) フォロワー配送までを実現する。

## Why This Slice Exists Now

2026-08-12 の grill で C1 (ストレージバックエンド選定・配信ドメイン) が解消され、
packet 化のブロッカーが消えた。確定事項: ストレージは S3 互換 (開発環境 RustFS)、
配信は別ドメイン直接配信 (公開ベース URL 差し替え式)、アイコン/バナー変更時は
Update(Person) をフォロワーへ配送する。

## Current Observed State

- `images` テーブル / ImageRepository / Profile の URL 指定紐付けフローは実装済み
- アップロード API・バイト保存・URL 生成・blurhash 生成は未実装
- Actor ドキュメントの icon は None 固定 (kernel/src/activitypub.rs:161)
- compose.yml にストレージサービスがない

## Accepted Baseline You May Assume

- ADR 0005: /api/v1 は Emumet 固有 API (Mastodon /api/v1/media 互換は Non-goal)
- 配信 URL = 公開ベース URL + オブジェクトキー。presigned URL は使わない
- 開発環境ストレージは RustFS (compose 追加、環境変数のみで起動)
- Update 配送は既存 delivery.rs の署名付き配送を流用

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `server/src/route, application/src/service, kernel/src/repository/image.rs, driver/src/database, compose.yml`

Target part: `画像アップロード REST API・S3 互換ストレージ抽象化・Profile icon/banner 紐付け・Actor icon/image 出力・Update(Person) 配送`

## In Scope

- アップロード REST API (multipart、MIME/サイズ検証)
- S3 互換ストレージ抽象化 + 第一実装、URL 生成 (ベース URL 設定差し替え式)
- Image 登録 (url/hash/blur_hash、blurhash 生成)
- compose.yml への RustFS 追加と接続設定
- Profile icon/banner 紐付け (既存 PATCH フローへ接続)
- Actor icon/image 出力 (None 固定の解消)
- Update(Person) フォロワー配送

## Out Of Scope

- 本番ストレージ選定・R2 カスタムドメイン構築
- リモートアクターの icon 取得・キャッシュ
- リレーサーバー経由の Update 配送 (post-relay 側)
- ローカル FS バックエンド

## Standalone Child Issue Contract

Emumet に画像アップロード REST API (multipart、MIME/サイズ検証、Emumet 固有設計) を
追加し、アップロードされた画像を S3 互換ストレージ (開発環境: compose に追加する
RustFS) に保存する。画像は Image エンティティとして登録し (url/hash/blur_hash、
blurhash は生成する)、配信 URL は「公開ベース URL + オブジェクトキー」で生成する
(ベース URL は設定で差し替え可能、presigned URL 不使用)。登録済み画像は既存の
PATCH /api/v1/accounts/{id} (icon_url/banner_url) で Profile に設定でき、
Profile の icon/banner は Actor ドキュメントの icon/image として出力される。
アイコン/バナー変更時には Update(Person) をフォロワー inbox へ署名付き配送する。

## Acceptance Criteria

- アップロード API で画像を登録でき、MIME/サイズ検証を通る
- 画像バイトが S3 互換ストレージ (RustFS) に保存され、images テーブルに
  url/hash/blur_hash が登録される (blurhash 生成を含む)
- 配信 URL が公開ベース URL + キーで生成され、ベース URL が設定で差し替え可能
- アップロード画像を PATCH icon_url/banner_url で Profile に設定できる
- Actor ドキュメントに icon/image が出力される
- アイコン/バナー変更時に Update(Person) がフォロワー inbox へ署名付き配送される
- compose 起動のみで画像アップロードまで通る

## Verification

- アップロード→保存→URL 発行→Profile 設定→Actor 出力の E2E
- Update(Person) 配送テスト
- `git diff --check`

## Related Links

- intent: intents/emumet/features/media-upload/ (overview / requirements / decisions)
- grill Q/A: intents/emumet/interview/2026-08-12-c1-c3-grill.md

## Knowledge Maintenance

- Intent placement: features/media-upload/overview.md / none new
- ADR candidate: none (feature decisions.md に記録済み)
- Diagram candidate: none
- Docs update: none (document 同期は Host-only backlog)
- Closeout writeback expected: no

## Guide Reachability (G645)

Route declared: implementation-loop → media アップロード REST API エンドポイント
(packet.yaml guide_reachability 参照)

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
