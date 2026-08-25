# post-relay — open questions

> See [../../clarifications/open.md](../../clarifications/open.md) for domain-level open questions.

## Open questions blocking this feature

- **ShuttlePub への転送プロトコル**: HTTP webhook / キュー(rikka-mq/Redis) / gRPC 等。
  ShuttlePub 本体側の受け口設計と合わせて決定が必要(durable queue 要件は確定済み。
  requirements 参照)
- ShuttlePub から内部署名 API を呼ぶ際の認証方式(サービス間認証。
  link capability の提示方法と一体で設計)
- 転送に失敗した場合の再送間隔・保管期間の具体値(durable queue 方針は確定済み)
- 署名 API の SLO(レイテンシ・エラー率)と backpressure 設計。Emumet 障害時の
  最大許容停止時間(ShuttlePub 側 durable queue の保持方針と一体)
- unlink 後の旧 namespace のプロキシ継続条件(read-only 継続がデフォルト。
  遮断条件・期間の運用ルール)

## Verification pending

- **outbox / followers コレクション URL のホスト制約**(2026-08-24 調査中):
  コレクション URL が actor と異ホストでも Mastodon/Misskey が fetch を受理するか。
  受理されるなら actor ドキュメントに ShuttlePub の outbox URL を直接記載でき、
  Emumet の outbox プロキシは不要になる(object URL のプロキシは ID 制約で残る)。
  followers は ADR 0002 の切替保証との相性から、互換性が確認できても Emumet-hosted
  を推奨(Oracle 助言 2026-08-24)

## Resolved

- ~~外向き配送で既存の内部署名 API(`POST /internal/v1/accounts/{id}/sign`)を
  そのまま使うのか、Emumet 主導の配送に置き換えるのか~~
  → **確定 (2026-08-24)**: 署名 API をそのまま使い、配送は ShuttlePub がハンドリングする。
  Emumet 主導の配送には置き換えない(ADR 0003 amended 参照)
- ~~署名時に Emumet が投稿を記録し、outbox を Emumet が提供する~~
  → **撤回 (2026-08-24 2回目 amend)**: 薄型境界の再構成により、コンテンツ保持・
  配布は ShuttlePub に委譲(delegated serving + 透過プロキシ)に変更。
  Emumet が保持するのは deletion marker のみ(ADR 0003 参照)
- ~~署名 API の認可境界(重い payload 検証 vs リンク権限)~~
  → **確定 (2026-08-24)**: Profile スコープの link capability(`sign:post` scope)+
  最小限の構造検証。事前登録・digest 照合は行わない(ADR 0003 参照)
- ~~Activity/Note ID の採番権~~
  → **確定 (2026-08-24)**: リンクごとの名前空間
  (`/objects/<link-id>/<local-id>`)を Emumet が発行し、local 部は ShuttlePub が採番
