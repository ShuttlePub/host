# Open Clarifications

2026-07-22 stack 時点で packet 化を deferred した事項。`grill` / `clarification` で解消する。

## C1: media-upload のストレージバックエンド

- 背景: Image エンティティ/Repository は存在するが、アップロード API とストレージ連携がない
- 論点: S3 互換 / ローカル FS / ShuttlePub 側で保持、の何にするか。配信ドメインも未決
- 参照: ../features/media-upload/open-questions.md

## C2: post-relay の ShuttlePub 転送プロトコル

- 背景: inbox で受けた投稿を連携先 ShuttlePub へ転送する方式が未決
- 論点: HTTP webhook / キュー(rikka-mq/Redis) / その他。ShuttlePub 本体側の受け口設計と
  セットで決める必要がある。サービス間認証方式も未決
- 参照: ../features/post-relay/open-questions.md

## C3: shuttlepub-link の連携先認証・ multiplicity

- 背景: docs の StellarAccount 定義(access_token/refresh_token)を踏襲するか未決。
  ShuttlePub 本体側の実装状況の確認が必要
- 論点: 認証方式、1アカウントの連携先は 1 つか複数か、登録主体は誰か
- 参照: ../features/shuttlepub-link/open-questions.md

## C4 (解消済み 2026-08-12): Emumet REST API (/api/v1) の Mastodon API 互換方針

- 結論: (a) で確定。`/api/v1` は Emumet 固有 API であり、Mastodon クライアント API
  互換は Non-goal。互換レイヤ分離(b)・現行ルート改修(c)は行わない。
  オペレーターの本来の関心は REST クライアント API ではなく ActivityPub 連合の
  相互運用性であり、そちらは実 Mastodon サーバーとの E2E(S7-S9)が CI で
  常時検証済みであることを実調査で確認した
- 決定記録: [../decisions/0005-rest-api-is-emumet-specific.md](../decisions/0005-rest-api-is-emumet-specific.md)
- 経緯・Q/A: [../interview/2026-08-12-c4-rest-api-mastodon-compat.md](../interview/2026-08-12-c4-rest-api-mastodon-compat.md)
- フォローアップ: Mastodon 実機 E2E の Undo(Follow) カバレッジ追加を
  packet backlog に登録(`mastodon-e2e-undo-coverage`)
