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

## C4: Emumet REST API (/api/v1) の Mastodon API 互換方針

- 背景: 2026-08-12 PR #21 (unfollow-api) レビュー後のオペレーター指摘。Emumet の
  `/api/v1/accounts/{account_id}/...` はパスが Mastodon API と一致するがセマンティクスが
  異なる。Mastodon ではパスの id は**対象アカウント**(例: `POST /api/v1/accounts/:id/unfollow`
  にボディ無しで呼ぶ)だが、Emumet ではパスの account_id は**ローカルのソースアカウント**で、
  対象はボディの `target` に取る。GET followers/following も Mastodon は公開データを
  第三者が取得可能だが、Emumet は account_sign 権限(本人のみ)で Relation DTO を返す。
  この非互換は unfollow-api で新規導入したのではなく、既存の follow/block/mute からの
  継続的な設計規約。intent 側に Mastodon クライアント API 互換を目指す記述はなく、
  「Mastodon E2E」は連合(server-to-server)相互運用の話でクライアント API 互換ではない
- 論点: (a) /api/v1 を Emumet 固有の BFF 向け API と明確に宣言し非互換のまま進めるか、
  (b) 将来 Mastodon クライアント互換を目指すなら、互換レイヤを別パス
  (例: `/mastodon/api/v1/...` や別サービス)に分離するか、(c) 現行ルート自体を
  Mastodon セマンティクスに改修するか(既存 BFF との非互換が発生)。
  Ratcap(BFF)が唯一の消費者である間は (a) が自然だが、外部クライアントを
  受け入れる構想(外部 ShuttlePub ホスト等)との関係で判断が必要
- 参照: PR ShuttlePub/Emumet#21、opencode-intent-loop-notes.md §5(レビュー観点への追加)
