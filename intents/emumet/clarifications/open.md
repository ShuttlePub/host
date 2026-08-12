# Open Clarifications

2026-07-22 stack 時点で packet 化を deferred した事項。`grill` / `clarification` で解消する。

## C1 (解消済み 2026-08-12): media-upload のストレージバックエンド

- 結論: S3 互換 (開発環境は RustFS)。配信は別ドメイン直接配信
  (本番 R2 + カスタムドメイン想定、公開ベース URL は設定差し替え式)。
  アイコン/バナー変更時は Update(Person) をフォロワーへ配送する
- 決定記録・Q/A: [../interview/2026-08-12-c1-c3-grill.md](../interview/2026-08-12-c1-c3-grill.md)
- feature 側決定: [../features/media-upload/decisions.md](../features/media-upload/decisions.md)

## C2 (deferred 継続): post-relay の ShuttlePub 転送プロトコル

- 背景: inbox で受けた投稿を連携先 ShuttlePub へ転送する方式が未決
- 論点: HTTP webhook / キュー(rikka-mq/Redis) / その他。ShuttlePub 本体側の受け口設計と
  セットで決める必要がある。サービス間認証方式も未決
- 2026-08-12 grill 調査で判明: ShuttlePub 本体 (ShuttlePub/ShuttlePub) は
  2023-04 停止・受け口非存在。本体不在のまま IF だけ確定すると手戻りリスクが高い
- **再開条件: ShuttlePub 本体実装の構想が立った時点で再 grill する**
- 参照: ../features/post-relay/open-questions.md

## C3 (deferred 継続): shuttlepub-link の連携先認証・ multiplicity

- 背景: docs の StellarAccount 定義(access_token/refresh_token)を踏襲するか未決。
  ShuttlePub 本体側の実装状況の確認が必要
- 論点: 認証方式、1アカウントの連携先は 1 つか複数か、登録主体は誰か
- 2026-08-12 grill 調査で判明: docs 定義は実装で踏襲されておらず、Emumet の
  auth_hosts/auth_accounts (access_token カラムなし) は Hydra 認証クライアント
  管理として稼働中。C2 と同じく本体設計前提のため deferred
- **再開条件: ShuttlePub 本体実装の構想が立った時点で再 grill する (C2 と同時)**
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
