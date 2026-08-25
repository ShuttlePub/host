# shuttlepub-link — requirements

> See [overview.md](overview.md) for goals. 責務境界の根拠は ADR 0002/0003 (2026-08-24 amended)。

## Functional requirements

- Profile ごとに連携先 ShuttlePub サービス(host 等)を登録・更新・削除できる
- リンク作成時に capability(`profile_id + link_id + scopes`)を発行する
  - 最低 scope: `sign:post`(署名要求 = 投稿許可)
  - scope は段階的に拡張(`sign:follow` 等)。Activity type の許可拡大と連動
- `link-id` は Emumet 発行の opaque ID。再利用禁止・発行時に Profile に固定
  (object ID 名前空間 `/objects/<link-id>/...` の接頭辞として使用)
- 1 Profile につき active な link は1つ(operator 判断 2026-08-24)
- unlink 時の挙動:
  - capability は即時失効(以後の署名要求を拒否)
  - 旧 namespace は read-only(既存 object のプロキシ配布は継続。遮断条件は
    post-relay の open question)
- relink(本体サービス切替):
  1. 旧 capability 失効 2. 旧 namespace read-only 化 3. 新 link/namespace 有効化
  4. inbox 転送切替 5. フォロワーグラフを新 ShuttlePub へ提供
- フォロワーグラフ(followers/following、Emumet が永続保持)の新 ShuttlePub 向け
  bootstrap/read API または export
- 連携先との認証に必要なクレデンシャル管理(docs の access_token/refresh_token 相当。
  ただし実際の方式は ShuttlePub 本体側の設計次第)
- post-relay が転送先・署名認可を解決するための参照インターフェース
- 永続化方式: 既存の CQRS/ES 方針に従う(Event Sourced entity 候補)
