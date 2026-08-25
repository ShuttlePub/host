# post-relay — design decisions

> See [overview.md](overview.md) for goals and [../../decisions/](../../decisions/) for cross-domain ADRs.

## Decisions

### 2026-08-25: 内向き転送の再送ポリシー(旧 open question Q3)

- 指数 backoff: 初回 30s、倍率 2、上限 1h、jitter 付き
- 72h で再試行打ち切り、dead-letter 相当の監査記録へ移行。監査記録は 30日保管
- 根拠: リモートは inbox 受付後に再送しないため durable queue が唯一の安全網。
  内部サービスの計画停止(数時間)は無損失で吸収しつつ、72h 超は再配送ツールによる
  人手復旧とする

### 2026-08-25: 署名 API の SLO・backpressure・停止許容(旧 open question Q4)

- SLO: p99 100ms、エラー率 0.1% 未満
- backpressure: 過負荷時は Emumet が 429 + Retry-After を返し、ShuttlePub は
  durable queue の backoff で応じる。Emumet 内に要求キューを持たない
  (ADR 0003 の責務分界と一致)
- レート制限: profile(link)単位 + 全体上限の2段
- Emumet 最大許容停止時間: 72h(ShuttlePub 側 durable queue 保持 72h と整合。
  Emumet 停止はデータ損失ではなく連合配送の遅延)

### 2026-08-25: unlink 後の旧 namespace プロキシ継続条件(旧 open question Q5)

- 理由別ルール:
  - ユーザー主体 unlink → read-only プロキシ無期限継続(upstream 応答する限り。
    7日連続到達不能で 502 化 → 30日後に 404)
  - 運営切断(abuse/規約違反) → 即時遮断(全 object 404)
- 削除済み object は unlink 理由に関わらず Tombstone/410 を upstream より優先
  (requirements 既存方針の維持)
- link 管理に unlink reason の記録を追加する(実装側への設計入力)

> 転送プロトコル・サービス間認証(旧 Q1/Q2)は deferred 継続。
> 再開条件「ShuttlePub 本体実装の構想が立つこと」が未充足
> (2026-08-25 operator 確認。[../../clarifications/open.md](../../clarifications/open.md) C2/C3 参照)