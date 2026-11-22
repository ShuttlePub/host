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

### 2026-11-22: S1 signed delivery / operator recovery の実装結果と closeout

- 根拠: [Emumet PR #125](https://github.com/ShuttlePub/Emumet/pull/125)、再レビュー承認 head
  `1895554930fb2e9c7f33b742aa1ca6488265f56e`、squash
  `e26fcede7d3d1f6936c821cb668f9a6f262688cd`。must なし、merge 直前 CI は 21/21 SUCCESS。
  S1 の完了であり、I1 の inbox 受付有効化、T1 の監視供給、本番負荷 SLO の認定ではない。
- **送信境界・固定上限**: 送信開始は許可 transaction の commit 応答確認。commit 成否不明は送らない。
  自動は min(authorized_at＋10 s, received_at＋72 h)、人手は min(authorized_at＋10 s, 元の隔離期限)。
  許可前の単調時計 marker から pool/lock/commit 時間を保守的に消費し、DNS/TLS/HTTP/応答まで
  同じ絶対期限を使う。HTTP 中の DB 接続/transaction/行・advisory lock は 0。再起動で許可を再利用しない。
  全プロセス・人手で共有 global 16 / origin 4 枠、準備中 lease も占有数に含め、process 内 DB phase は 4。
  lease は 30 s、stale token/attempt/link generation で本文・quota を復活させない。
- **scheduler lock と R1/R2**: official claim は `post_relay_schedule` の SHARE ROW EXCLUSIVE table lock
  で短い snapshot/update を直列化する独立 transaction。上位 lifecycle gate を取得しない。
  期限 1 分以内の優先を origin 内順位付け・候補削減より前にも適用し、通常の Profile rotation / origin 公平性を維持。
  claim 専用の transaction-local lock timeout 2 s / statement 3 s / idle-in-transaction 5 s と、
  commit を含む transaction 全体 5 s を適用した。上限を緩和していない。
  claim は 1 件だけ非同期 in-flight とし、lock/pool 待ち中も maintenance と停止通知を処理する。
  停止クライアントが transaction object を保持したままでも、DB idle timeout で rollback/回収される。
- **鍵・transport**: K1 parsed RSA-2048 cache (上限 2、TTL 15 分、single-flight) を使い、実測 176,576 件で
  KDF 1 回。envelope bytes/receipt/宛先は不変、外側 Date/instance Cavage 署名だけ試行ごとに更新。
  HTTPS、redirect/proxy 拒否、試行ごとの DNS 検証・internal/mixed IP 拒否・接続先固定を維持。
  transport client cache は origin＋検証済み address set を key に最大 64 / idle 60 s とし、DNS 承認の cache ではない。
- **計測の位置づけ**: 冒頭 control harness (Q1 ports＋実 HTTP、KDF は経路外、CPU/メモリ非制限) は
  64 KiB 直列/並行 354.41/330.35 件/s、1,400,000 bytes は 192.59/275.56 件/s。
  これは最終 worker の合格根拠ではない。R1/R2 後の production code `0a15260` で再測定し、以後は試験/docs のみ変更。
  Ryzen 9 7900 上の release、sender cores 0–3 / `ulimit -v 8388608` (8 GiB-AS)、PostgreSQL 17 cores 4–7 /
  Unix socket、外部 streaming HTTP receiver cores 8–9、4 origins / 16 Profiles。
  64 KiB 直列/並行16 は **230.13/418.00 件/s** (目標 ≥100)、1,400,000 bytes は **149.79/259.85 件/s** (≥20)。
  30 s silent origin 混在の正常側は単独中央値 326.33 → 325.89 件/s、比率 **0.9987** (≥0.80)。
  600.18 s 継続は **176,576 件 / 294.20 件/s** (admission 込み)、120→600 s の RSS は 59,200→59,268 KiB、
  接続数 7→11 (pool cap 16、最後 120 s は 11)。全 11 回の batch 完了時に本文/job/attempt/隔離/audit/操作行は 0、固定行数不変。
- **R3 の分離計測**: local DB semaphore、実 pool acquire (BEGIN/SQL 除外)、明示的 relay lock 取得、
  各 job の due_at→claim DB 時刻を分離した。queue は preload を含み、意図した retry/backoff は含めない。
  600 s の平均 ms/job は pool **0.0961**、lock 取得 **4.613** (scheduler subset **0.00150**)、
  ready queue **92.801** (個別最大 **179.655 ms**)。lock は DB 往復/行読取を含む取得 latency であり、
  server-only blocked time や暗黙 UPDATE lock の完全な内訳ではない。個別 queue を count/sum/max に集約し、成功別の DB 行を残さない。
  200 ms pool / 100 ms scheduler lock 注入を別接続で行うと 201.31/102.24 ms、2 jobs の queue は各 1,000 ms。
- **実測の限界・未達判断**: 測った目標に未達はなく、目標/上限の変更は不要。ただし平文 loopback HTTP で TLS/RTT 未測定、
  AS 制限は cgroup ではなく、12-core host の physical pinning は 4-vCPU VM ではない。co-tenant 負荷も排除していない。
  4 origins / 16 Profiles を超える本番規模は未測定。100 arrivals/s で 1,000 ready backlog が約 5.15 s で解消する計算は
  実測能力が不変かつ期限内の場合の参考値で、本番 SLO/全容量保証ではない。
- **運営者入口**: `server --help` → `server post-relay --help` → preview / redeliver / discard / status。
  receipt または immutable Profile ID、UUID 操作 ID、操作者・理由・preview の COUNT:BYTES:BOUNDARY 確認を用いる。
  同じ操作 ID/元確認値で固定 selection を最大 128 件ずつ進め、新着失敗を無制限に追跡しない。
  稼働 worker と同じ gate/lease/fence/共有枠を使う。成功は本文削除、失敗は元の隔離期限へ戻り、72 h/30 d を延長しない。
  discard は別の明示操作で、自動容量対策として行わない。監査は body-free / 30 d、成功別の無期限行を残さない。
  操作 command は migration を適用せず、全 migration の version/success/checksum を厳密照合。
  AppModule/Ory/JWKS/S3/listener/通常 worker を起動せず、UUID と PostgreSQL sequence だけを使い、
  Snowflake/WORKER_ID 初期化・鍵再生成を行わない。redelivery は既存鍵/公開 origin/allowlist を再確認する。
- **送信停止**: `POST_RELAY_SENDER_ENABLED=false` を全 sending process に設定して再起動する。
  手動 redeliver も拒否するが、listener/inbox/他の Profile 配送と毎秒の relay expiry/purge は止めない。
  true/未設定で有効、それ以外は設定エラー。in-flight は bounded drain、既に許可した bytes の即時撤回ではない。
  緊急時は全 sending server/運営者 session 停止または egress 遮断。allowlist 除外だけを即時失効と見なさない。
  受付継続は共通 job/quarantine quota を消費し、80%/95%、期限間近 backlog、purge、lock timeout/接続待ちを監視する。
  隔離満杯では復旧・明示破棄・元期限まで最長 30 日の新規受付拒否があり得る。監視供給の組込みは T1。
- **宣言 docs と実記録先**: S1 packet の required docs `docs/post-relay-operations.md` は今回の merge に実在し、
  上記の運営者/停止/schema/保持手順を収録する。Q1 の宣言パス差異を S1 は解消した (過去 packet/証跡は改変しない)。
  数値・測定条件・R1–R3 対応表は追加の
  [docs/post-relay-measurements.md](https://github.com/ShuttlePub/Emumet/blob/e26fcede7d3d1f6936c821cb668f9a6f262688cd/docs/post-relay-measurements.md)。
  operations の監視説明だけで新しい wait 内訳を代用せず、この追加文書も参照する。
  guide_reachability 宣言の抽象的な recovery subcommand は実際には `server post-relay --help` であり、
  実行して preview/redeliver/discard/status と operations 文書への経路を確認した。

### 2026-11-22: I1 Profile inbox relay intake の実装結果と closeout

- 根拠: [Emumet PR #126](https://github.com/ShuttlePub/Emumet/pull/126)、独立再レビュー承認 head
  `7a273a25a2a5c0cdeacc0253788a8d48a7552f3b` (must なし)、S1 (squash `e26fcede`) の上へ
  rebase した最終 head `cb1494841e7cf16ba5d632148ea269bb29d1c671`、squash
  `b054788aa253ad99ea3c49c12f239e9baf5bba1c`。rebase は docs/DI/観測 tracing の機械的統合のみで
  I1/S1 のロジックは変更していない (下記「docs 実記録先」参照)。merge 直前 CI は 19/19 SUCCESS。
  S1 の処理量計測は目標すべて達成済みで、S1 merge 後の merge はユーザー包括許可
  (question-2b6c8e26aadec7ce5067c6f25433c6a6) による。**merge は inbox 転送の有効化ではない。**
- **有効化 gate**: `POST_RELAY_INBOX_ENABLED` は既定 false。リテラル `true` のみ有効、他の値は起動失敗。
  有効化には正規化済み HTTPS `PUBLIC_BASE_URL` origin が必須。未設定のまま誤って先行 deploy しても
  転送 job も未リンク集計も作られず、既存 Follow 処理と early-Undo 防御は継続する。false への切替は
  新規受付のみに効き、受理済み job/再試行/承認済み送信は止めない (S1 の緊急停止ではない)。
  有効化前に additive migration 適用、S1 配送/maintenance の deploy、DB ボリュームの最新容量 sample、
  `POST_RELAY_ALLOWED_ORIGINS`、instance 鍵、owner 承認済み home link を揃える。有効化自体は別の deploy 判断。
- **URL 上限の分離 (転送 2048 / 旧関係 1024)**: 転送契約の actor・Activity ID・鍵 ID・実検証 owner は URL_MAX=2048。
  旧 social-graph の型/DB 制約は 1024 byte のまま変更しない。1024 超は旧関係の変更/receipt を行わずに転送だけ継続し
  (400 にも他人名義の関係作成にもしない)、1025–2048 の Activity ID は envelope でそのまま、2048 超は null。
  envelope の owner は常に実検証 owner (body actor へ置換しない)。外側 Undo ID が旧 receipt に収まらない場合も
  内側 Follow 参照を捨てず、外側 receipt だけ省略して同一 Q1 transaction で receiver-scoped early-Undo guard を残す。
- **既知参照の判定 (D63)**: Follow/Block 自体は転送除外。Undo/Accept/Reject は非空の参照が**すべて**
  埋め込みまたは保存済みの Follow/Block と確実に分かるときだけ除外し、欠落/空/混在/不明は本文全体を転送。
  保存済み証拠は受信 Profile + Activity ID を signer 横断で引き、他 signer に関係変更権限は与えない。
  guard marker は証拠ではない: 既存 relation receipt に `observed_relation` を追加 (migration
  `20261122000500`, additive・backfill 付き)、実際に認証済み Follow/Block を受けたときだけ立て、元 type
  UndoFollow のまま purge/復活しない。既存の自ローカル Follow generation も確実な参照。Duplicate は関係変更を
  抑止するだけで転送受付は抑止しない。再送で別 receipt/envelope になり得る (at-least-once)。
- **受付の原子性**: 1 MiB 本文/2048 target/MIME 検査 → 生 byte に対する署名検証 (その検証が返した key/owner/
  scheme/time を使い 2 回目の鍵取得なし) → 重複 key・深さ32・node 10万拒否 → Q1 の 1 transaction で
  Account/Profile/関係/link gate・owner 再確認・quota/rate 予約・不変 job bytes または body なし hourly 集計。
  失敗/過負荷は全 rollback、202 は commit 後。独立 intake pool (最大4、lazy、同 DB、migration 再実行なし)で
  共有 API/projector pool の余力を守る。envelope は生 byte の Base64 を再 serialize せず 1 回だけ生成し S1 が同 bytes を使う。
- **受付計測**: Ryzen 9 7900、receiver と PostgreSQL 17 (fsync/synchronous_commit/full_page_writes on) を
  同じ論理 4 CPU に固定、release、本番 Axum handler・実 RSA 検証・実 PostgreSQL、1024 件/条件、16 件 burst/160 ms
  (100 req/s 提示)、48 KiB 本文 (envelope 約 66 KiB)、{リンク/未リンク}×{1/8 Profile}。4,096 件すべて 202、
  429/503 なし、予約整合は各条件後 true。202 p99 は 43.72/140.22/55.99/45.42 ms (未リンク1/未リンク8/リンク1/リンク8)、
  p95 は 32.88/51.05/47.21/37.61 ms、CPU 1.72–1.95 s、RSS peak 48.9–51.2 MiB、intake pool 使用は上限 4。
  限界: 各条件約 10 秒、cgroup 8 GiB/4 vCPU VM ではない、TCP/TLS/遠隔鍵取得なし (鍵は fixture cache)、
  最大 throughput・最大本文・10 分継続・長時間 RSS・WAL/vacuum は未測定、本番 SLO ではない。lock wait は
  約 10 ms sampling で完全な lock 時間ではなく、tx begin 計測は pool 待ち+BEGIN の上界。
- **docs 実記録先**: packet 宣言の `docs/post-relay-operations.md` は S1 が先に同名で作成したため、I1 の受付境界/
  gate/URL 分離は同じ merge で新規 `docs/post-relay-inbox-intake.md` に置き、計測は
  `docs/post-relay-intake-measurement.md`。S1 の operations 文書は変更しない。rebase 時の追加差分は
  intake 文書の「S1 merge 前は merge/有効化しない」注意を「S1 merge 済み・有効化は別判断」に更新したことと
  measurement 文書内の参照名の修正、`driver` の `Transaction::begin` 後への debug tracing (`transaction_begin_us`、
  S1 の connection_wait 計測と併存) の統合のみ。packet 自体は書き換えない。

### 2026-11-22: `POST_RELAY_INBOX_ENABLED` が既定オフである理由の訂正と、オンにする時期 (D68)

上の I1 結果の「有効化 gate」の節は、`POST_RELAY_INBOX_ENABLED` を誤った先行 deploy への備えとして読める。
I1 の PR 説明などにあった「運用上の安全弁」という説明は誤りだったので訂正する (上の記録は書き換えない)。
正しくは [D68](../../../shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md) のとおり:

- 既定オフの理由は、転送先の ShuttlePub の受け口 (`POST /internal/v1/emumet/activities`) がまだないこと。
  オンにしても送信が失敗し、隔離に溜まるだけになる。
- 計画で決めていたのは「S1 より前に I1 をマージ・有効化しない」という順番だけで、既定オフは計画になく、
  I1 のレーンが追加したものを親が確認しないまま受け入れていた。
- オンにする条件: ShuttlePub の受け口の実装とデプロイ、準備 (HTTPS の `PUBLIC_BASE_URL`、サーバー鍵、許可 origin、
  承認済みのホームの link、容量の確認)、連合 E2E が通っていること。
- オンにする時期: Emumet の初回リリースの時点で受け口がそろっていればその時点。そろっていなければ受け口の完成時。
  どちらの場合も、ShuttlePub の受け口の完了条件と Emumet の初回リリース (`emumet-first-release`) の完了条件に入れてある。

### 2026-11-22: B1 Ory-independent runtime の実装結果と closeout

- 根拠: [Emumet PR #129](https://github.com/ShuttlePub/Emumet/pull/129)、独立再レビュー承認 head
  `65c738bf7c23181a47a07b2e77bc6b2a8b643368`、squash `5b0b7b53718cb5181e903efb46515404e2346fe9`。
  実装開始 base は I1 `b054788aa253ad99ea3c49c12f239e9baf5bba1c`。must/任意なし、merge 直前 CI 21/21 SUCCESS。
- **起動依存境界**: DB migration → Profile 鍵確認 → instance identity/鍵確認 → listener bind →
  非同期 JWKS warm-up と各 worker/HTTP serving。bind 失敗時に relay を残さず、Ory/JWKS 取得完了を
  listener・instance 文書・I1 inbox・S1 relay の起動条件にしない。inbox は router の一部であり別 queue を持たない。
  自身の DB/鍵/転送先などの依存が健全な場合、Ory の connection refused / 応答停止でも署名付き受付・転送が動作した。
- **認証境界**: discovery/取得/connect/応答 body と single-flight 待ちを期限付きにした。未取得/失敗時は JWT API が
  fail-closed。cached/uncached の成功、issuer/audience/expiry/kid の既存検証を維持し、A1 login/consent の
  URL/応答/cookie/scope/error は変更しない。鍵取得失敗を認証 bypass や起動成功の偽装には用いない。
- **停止境界**: SIGTERM/SIGINT で新規 claim を先に止め、HTTP/relay/webhook 等を並行 drain。S1 relay の 12 s、
  既存 webhook の 20 s は既定 25 s の全体期限内で動作する。async drain と Tokio runtime teardown は
  **同じ絶対期限**を共有し、`shutdown_timeout` に残予算のみを渡す。async drain が満了した場合は 0、追加猶予を与えない。
  reqwest の timeout/abort だけでは libc DNS の blocking task が残るため、暗黙 runtime Drop の無期限待ちを使わない。
- **反例の red/green**: Linux の実 `getaddrinfo` を 20 s 止める子プロセス試験を追加。JWKS 200 ms/停止 2 s で
  修正前は 4 s 以内に退出せず失敗。修正後は DNS のみ **2.003 s**、未完 HTTP body の drain 満了併用 **2.006 s**。
  resolver marker は開始済み・未完了を証明する。最終試験上限は 3 s (1 s は scheduling margin) で、
  drain 2 s + teardown 2 s を別々に与える誤実装も拒否する。SIGKILL は送信許可前/後で元の 30 s lease を
  実際に待って回収し、S1 の fencing/送信方針を変えない。
- **計画で具体名/値が未指定だった実装具体化** (リードへ報告済み):
  `JWKS_TIMEOUT_MS` 既定 3000 / 1..60000、`SERVER_SHUTDOWN_TIMEOUT_SECS` 既定 25 / 1..300。
  cold/empty JWKS の lazy retry は min(設定間隔, 1 s)、populated cache の unknown-kid 300 s 制限は不変。
  `EMUMET_TEST_RELAY_ORIGINS` は test-mode build の明示的なローカル転送先リストのみ。Linux DNS 故障注入の
  `cc` / `LD_PRELOAD` / `EMUMET_TEST_DNS_MARKER` は試験専用で production にリンクしない。
  DNS must 修正自体には新しい production 設定/既定値はない。新たな production enable/disable flag は追加しない。
- **回帰・限界**: 最新実 DB/実プロセス 5/5、JWKS/auth 13 件、workspace 実 DB 1414 件、既存 real-Ory E2E 6/6
  が成功。workspace 全件は production 同一の `20f446b`、最終 `65c738b` の追加差分は coverage で見つかった
  fixture/projector 競合を稼働子プロセス停止後の seed へ直した試験限定変更であり、最新 CI coverage/E2E も成功。
  first-time RSA provisioning の fixture 120 s と、その後の stalled-Ory 起動上限 30 s (JWKS 期限 60 s) は分離する。
  migration/OpenAPI/Hydra 設定は無変更。S1 sender 設定と I1 inbox 既定 false は不変で、D68 の受け口完成条件を変更しない。
  T1 の full real-user relay E2E/監視供給、実 TLS/本番 SLO の認定はこの closeout に含めない。
- **required docs** は merged child の
  [docs/post-relay-operations.md](https://github.com/ShuttlePub/Emumet/blob/5b0b7b53718cb5181e903efb46515404e2346fe9/docs/post-relay-operations.md)
  に収録 (host 配下の docs ではない)。required intent_tree/closeout_learning は本記録と acceptance に書き戻し、
  packet の nested 宣言は値を変えず root に移すことで CLI 0.27.1 の読み飛ばしを解消する。
