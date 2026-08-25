# post-relay — open questions

> See [../../clarifications/open.md](../../clarifications/open.md) for domain-level open questions.

## Open questions blocking this feature

- **ShuttlePub への転送プロトコル**: HTTP webhook / キュー(rikka-mq/Redis) / gRPC 等。
  ShuttlePub 本体側の受け口設計と合わせて決定が必要(durable queue 要件は確定済み。
  requirements 参照)。**deferred 継続 (C2)**: 再開条件「ShuttlePub 本体実装の構想が立つ
  こと」は未充足 (2026-08-25 operator 確認)
- ShuttlePub から内部署名 API を呼ぶ際の認証方式(サービス間認証。
  link capability の提示方法と一体で設計)。**deferred 継続 (C2/C3 と同条件)**

## Resolved

- ~~転送に失敗した場合の再送間隔・保管期間の具体値~~
  → **確定 (2026-08-25)**: 指数 backoff (初回30s、倍率2、上限1h、jitter 付き)。
  72h で再試行打ち切り、dead-letter 相当の監査記録へ移行。監査記録は 30日保管
- ~~署名 API の SLO と backpressure、Emumet 障害時の最大許容停止時間~~
  → **確定 (2026-08-25)**: SLO p99 100ms・エラー率 0.1% 未満。過負荷時は Emumet が
  429 + Retry-After を返し、ShuttlePub は queue backoff で応じる(Emumet 内に要求
  キューを持たない)。レート制限は profile(link)単位 + 全体上限の2段。最大許容停止
  時間 72h(ShuttlePub 側 durable queue 保持 72h と整合)
- ~~unlink 後の旧 namespace のプロキシ継続条件~~
  → **確定 (2026-08-25)**: 理由別ルール。ユーザー主体 unlink → read-only プロキシ
  無期限継続(upstream 応答する限り。7日連続到達不能で 502 化 → 30日後に 404)。
  運営切断(abuse/規約違反) → 即時遮断(全 object 404)。削除済み object は理由に
  関わらず Tombstone/410 優先。link 管理に unlink reason の記録を追加

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
- ~~outbox / followers コレクション URL は actor と同一ホスト必須か~~
  → **確定 (2026-08-24、Mastodon/Misskey ソース検証済み)**: **同一ホスト必須**。
  Misskey は actor 検証(`ApPersonService.validateActor`)で outbox/followers/following の
  異ホスト URL をアクター文書ごと拒否する。したがってコレクションの ShuttlePub 直貼りは不可。
  outbox も含めて全コレクションを Emumet ホストで配布(outbox は ShuttlePub への透過
  プロキシ、followers/following は Emumet のグラフから直接配布)で確定。
  参考: Mastodon はリモート outbox のコンテンツを pull しない(push 型)
