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

### 2026-11-21: P1 実装計画での確定事項 (旧「転送 envelope の正確な形」ほか)

- 転送 envelope・外側署名・受け手の検証手順・inbox の読み取りと振り分けは、契約
  [../../../shuttlepub/contracts/emumet-post-relay/v1.md](../../../shuttlepub/contracts/emumet-post-relay/v1.md)
  (正本は host の 1 つ。Emumet の `docs/contracts/` は写し) で定めた。決定の記録は shuttlepub の
  [D61-D67](../../../shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md)。
- link 解除確定後は新しい送信・再送を許可しない (直前に許可したものは届いてよい)。参照先が不明な
  Undo / Accept / Reject は転送する。恒久失敗と 72 時間打ち切りだけ 30 日隔離して人手再配送できる
  (ADR 0003 の限定例外)。移管で link を引き継ぎ、退会後の再有効化で link は自動復活しない。
- 2026-08-25 の「監査記録は 30 日保管」は、本文の 30 日隔離を含む形に具体化した。

### 2026-11-21: Q1 durable storage の実装結果と closeout

- 根拠: [Emumet PR #122](https://github.com/ShuttlePub/Emumet/pull/122)、承認 head
  `32b6d8666a2bbfbebac980c3ee510d0a6fb3e043`、squash
  `7efe25c7b5e5237d4246e74b7c50903996040b14`。
  詳細な保存モデル・実測条件・試験対応表は同 commit の
  [docs/post-relay-storage.md](https://github.com/ShuttlePub/Emumet/blob/7efe25c7b5e5237d4246e74b7c50903996040b14/docs/post-relay-storage.md)。
  Q1 の保存 port の完了であり、I1 の inbox 受付、S1 の HTTP sender/recovery CLI、T1 の監視供給は未有効。
- **解除方式**: 全本文を解除 transaction 内で物理削除する方式は不採用。非圧縮の再現実験は
  8 Profiles × 2,000 本文 × 正確に 536,870,912 論理 bytes/Profile。1 Profile の物理削除は
  456.414 ms、残る 7 Profiles は statement timeout 3,000.221 ms で rollback した。
  許可済み fallback として L1 の owner unlink / Account command / Account projector の同一 transaction で
  link/generation を無効化し、link/Profile/global の論理予約を集計値で解放する。本文・job・attempt は
  永続 cleanup 条件から 1 Profile transaction あたり最大 128 本文ずつ後で物理削除する。
  stale worker や再 link で旧本文は復活せず、解除直前に commit 済みの送信許可だけ元の期限内で完了できる。
- 最終 adapter 試験も 8 Profiles × 2,000 本文 × 正確に 512 MiB/Profile
  (半分 job＋16 attempts、半分 quarantine＋audit)。Profile unlink 1.997 ms、残る 7 Profiles の
  Account deactivation 6.705 ms、commit 後の物理残存 16,000 本文、最大 128 本文 purge 16.915 ms。
  PostgreSQL 17.9/debug/Unix socket、Ryzen 9 7900/24 CPUs/64 GiB、`fsync=off` /
  `synchronous_commit=on` のローカル標本であり、本番 SLO の認定ではない。
  adapter fixture は圧縮可能であり、非圧縮の物理削除実験と区別する。L1 の 2 s lock / 3 s statement /
  5 s transaction の境界は緩和していない。論理解放は即時の disk/MVCC/backup 消去を意味しない。
- **共有予算**: 本文 job/quarantine は同一枠 (global 100,000 本文/20 GiB、Profile 2,000/512 MiB)。
  delivery metadata は global 1,800,000 行/1,800 MiB、Profile 48,000 行/60 MiB。
  未 link 集計は本文なしの Profile＋固定理由＋UTC 時間帯とし、header を含め global 100,000 行、
  Profile 1,000 行 (各 512 bytes) に独立制限する。operator audit は global 100,000 行、Profile 1,000 行
  (各 1,024 bytes) の保護枠。未 link 集計・レートの枯渇で linked 配送予約を消費しない。
  PostgreSQL の共有 bucket は global 1,000/s (burst 1,000)、Profile 200/s (burst 200)、
  未 link 専用 global 1,000/s (burst 1,000)。複数 OS process で共有する。
- **容量状態の運用入口**: `server --help` → `server capacity report --help` →
  `server capacity report --free-bytes N --total-bytes N --sampled-at RFC3339`。
  DB の最も制約の強い data/WAL/tablespace の実測を外部 monitor が最低 30 秒ごとに供給する。
  通常 startup 前に専用 connection で実行し、migration は適用しない。version/success/checksum が
  binary の全 migration と厳密一致しなければ拒否。未測定・未来・90 秒超の sample は新規受付を止める。
  10 GiB 未満または 10% 未満で停止、初期/復帰は 12 GiB 以上かつ 12% 以上。
  更新時刻は単調増加を要求する。取消・期限処理・明示復旧は unknown capacity でも妨げない。
  monitor の compose/E2E 組込みは T1 の責務。
- **隔離期限**: 恒久失敗/72 h 打切りの論理的終端時刻＋30 日 (=720 経過時間) が本文隔離と
  body-free failure audit の期限。72 h 打切りなら受信＋72 h が起点であり、遅い DB 回収時刻ではない。
  hold/restart/recovery/manual 再配送は期限を延長しない。初回回収が既に隔離期限後なら本文を除去し、
  redeliverable な隔離を新設しない。成功・取消による新しい件数比例の terminal 行を残さない。
- **期限内観測の優先**: 元の許可期限内に観測した成功/恒久失敗は、同一 attempt、現行 token、
  有効 lease、link generation を検証したうえで、結果保存が打切り時刻後でも観測結果を優先する。
  lease 失効・取消・別 attempt は stale とし、本文・終端・容量を変更しない。R1 では quota のロックと
  受付時初期化を分離し、30 日後の Profile quota purge 後も旧 token が header を再作成/変換しない。
  Account → Profile → 既存 relation → link → global quota → Profile quota → slots → body/job →
  attempt/audit の L1 順序を維持する (Account/Profile/link の複数行は ID 昇順)。
- **docs writeback の記録先**: packet 宣言は `docs/post-relay-operations.md` だが、Q1 の merge に
  同ファイルは含まれない。`docs/post-relay-storage.md` の「Physical-capacity writer」に容量コマンド・
  schema/freshness の要求が記録されており、closeout 時の design 確認で同等内容の記録先として認めた。
  宣言パスとの差は証跡に残す。計画 §10.1 の `docs/post-relay-operations.md` は S1/T1 で作成予定で、
  capacity report の運用手順はそちらへ集約する。packet 自体は書き換えない。
