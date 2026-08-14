# 0006: アーキテクチャ再配置 — DataStore 完結トランザクションと domain/projection 分離

- Status: Accepted (2026-08-13)
- Deciders: operator (Sisyphus との設計対話セッション + Oracle コード検証 2 ラウンド)

## Context

現行構造を実コードで検証し、以下を確認した。

### 問題1: Transaction が Application 層に露出し、かつ偽装されている

- `application/src/service/**` の全ユースケースが
  `database_connection().get_executor()` で executor を取得し
  `&mut transaction` として下位に回している
- `get_executor()` は自動コミットのプール接続
  (`driver/src/database/postgres.rs` の `PostgresConnection::Connection`) を返す。
  真の transaction (`get_transaction()` + `commit()`) を使うのは
  `account_detail/update.rs` の1箇所のみ
- `kernel/src/database.rs` の `Executor::commit` がデフォルト no-op 実装で、
  実装漏れを正常終了に見せる構造的原因になっている
- 結果: CreateAccount (Account + Profile + SigningKey + 権限の4書き込み) が
  現状アトミックでない。atomicity 欠落は現在進行形のデータ不整合リスク

### 問題2: Entity がテーブルカラムと1対1で、ドメインモデルを吸収できていない

- kernel の `Account` が `version` / `nanoid` / `created_at` 等の永続化メタデータを内包
- ReadModel が projection DTO ではなくドメイン Entity をそのまま返す
- `AccountStatus` enum の復元ロジック (nullable カラム群の折り畳み・期限切れ判定) が
  `driver/src/database/postgres/account/row.rs` にあり、不変条件の知識が
  DB スキーマとマッピングコードに散在している

### 副次的な発見

- Signal (Redis) を event persist 直後に直接 emit している
  (`adapter/src/processor/account/command.rs:116,150`)。
  真の transaction 化すると commit 前に consumer が動く race が発生し、
  単に emit を commit 後に動かすだけでは crash 時に通知が永久欠落する
- KetoClient (外部 HTTP クライアント) が `server/src/handler.rs` にあり、
  Controller 層にインフラクライアントが混入
- projector (applier) が `server/src/applier/` にあり、cascade cleanup や
  Keto 復旧ポリシーが Controller 層に混入
- route helper が DB executor を直接取得できる
  (`server/src/route/activitypub/mod.rs:67`)
- AuthAccount は ES だがイベントは `Created { host, client_id }` のみで履歴価値がなく
  (ログイン履歴は Kratos 側の責務)、find-or-create のため
  同期 projection という例外を強いている
- adapter クレートは Clean Architecture のどの層にも対応しない
  blanket impl 置き場と化している

### オペレーターの目標アーキテクチャ

- ES+CQRS が必要な部分と CRUD でよい部分を混在させる
- 全体は Clean Architecture ベースの DataStore → Repository → Service → Controller
  - DataStore = RDB / Redis 等のストレージ単位 (実装は driver クレートに集約)
  - Repository = 性質の異なる DataStore を束ねる port
- 無理な共通化を避け、性質の違うものは複製を許容して分ける

## Decision

### 1. 層の定義と依存方向

- Controller (server) → Service (application) → Domain+Ports (kernel) ← DataStore (driver)
- **実行時呼出順とコンパイル時依存方向を区別する**。Repository interface は内側
  (kernel)、DataStore 実装は外側 (driver)
- adapter クレートは解体。責務は3分散する:
  純粋な状態遷移 → kernel、ユースケース調停 → application、
  event append + 通知 insert → driver の repository 実装内部

### 2. Transaction: 所有は DataStore、宣言は Service

- Transaction は PostgreSQL DataStore 内で begin/commit/rollback が完結する資源と定義。
  DataStore をまたがない (Redis 通知は outbox、Keto は post-commit provisioning)
- kernel に `TransactionManager` port を定義し driver が実装する。
  Service は closure で原子範囲を**宣言**するだけで、begin/commit/rollback には
  触れない (手段が存在しない形にする)
- Service-level の UoW (Unit of Work = 1 closure = 1 DB transaction) が必要なのは
  5 ユースケースのみ: **CreateAccount / UpdateAccountDetail / Block /
  Inbox Follow / Inbox Block**
- 単一書き込みユースケース (Mute, Undo Follow, Accept, Undo Block) は UoW 不要。
  find-then-write 競合は冪等 repository 操作 (`insert_if_absent` 等) と DB 制約で
  処理し、Service は結果の解釈のみを行う
- no-op default の `Executor::commit` は廃止する
- repository は外側の transaction に参加するだけで、nested transaction を
  独自に開始してはならない (外側 UoW を分断するため)
- **Stage 1 時点の既知の制約 (2026-08-13、Stage 1 review より)**:
  - `PostgresConnection` の `DerefMut<Target = PgConnection>` 経由で
    `sqlx::Connection::begin()` / 生 SQL の `COMMIT` が呼べるため、
    「Service は begin/commit/rollback の手段を持たない」は Stage 1 時点では
    **kernel trait レベルの規約**であり、concrete 型では強制されていない。
    Stage 4 のユースケース移行時に、Service に渡す connection capability を
    raw `PgConnection` へ deref できない port 型に閉じて強制化する
    (SQLx アクセスは driver の repository 実装内に限定)
  - `TransactionManager::transaction()` の nested 呼び出しは savepoint ではなく
    **別 pool 接続の独立 transaction** になり、pool 枯渇時に自己デッドロック
    しうる。`transaction()` は top-level のユースケース境界でのみ呼ぶ契約とし、
    Stage 4 で 5 ユースケース (CreateAccount / UpdateAccountDetail / Block /
    Inbox Follow / Inbox Block) の呼び出し構造を固定する際に構造で担保する。
    nested scope が実際に必要になった時点で、既存 connection を受け取る
    savepoint API を別途追加する
- **Stage 4 確定 (2026-08-14、PR #31 closeout より)**:
  - UoW 対象ユースケースは ADR 決定2 の5つから、本 Stage で **CreateAccount /
    UpdateAccountDetail / Suspend / Unsuspend / Ban / Deactivate** の4+2=6つを
    対象とした。Block / Inbox Follow / Inbox Block は Stage 5、
    Mute / Accept / Undo 系は Stage 5 で扱う
  - Service は `DependOnTransactionManager` trait を介して `TransactionManager` を
    注入。`transaction_manager().transaction(|conn| async move { ... })` で UoW を
    宣言。begin/commit/rollback は Service から不可視
  - 同一 UoW 内で同一集約に連続 `save` する場合は、直前の `EventEnvelope.version`
    を次の `CommandEnvelope` の `ExpectedVersion::At(v)` に連鎈させることを
    `CreateAccount` 実装で固定
  - `UpdateAccountDetail` から低レベル `get_transaction()` / `transaction.commit()`
    の直接呼び出しを解消し `TransactionManager::transaction()` へ統一

### 3. port 文法: 統一せず4系統を明示

- `AggregateRepository<A>` (ES 集約: `load → Rehydrated<A>`、
  `save(aggregate, ExpectedVersion)`)
- CRUD repository (`FollowRepository` 等: 素直な insert/delete + 冪等操作)
- `*Query` (CQRS read 側。projection DTO を返しドメイン Entity を返さない)
- `*ProjectionWriter` (projector 専用。version-gated upsert)
- CRUD に `expected_version` や `Rehydrated` を擬装する「型が嘘をつく」共通化は
  行わない。一体感は命名規則と依存方向の一貫性で作る
- **Stage 2 時点の確定 signature (2026-08-13、PR #27 closeout より)**:
  - `save` は文言通りの `save(aggregate, ExpectedVersion)` ではなく
    `save(CommandEnvelope)` とした。このコードベースでは集約が pending events を
    持たず `CommandEnvelope` が集約変更の表現であり、envelope が
    `ExpectedVersion` を内包するため。集約に pending events を持たせる再設計
    (文言通りの実装に必要) は Stage 2 のスコープ根拠がなかった
  - port は generic `AggregateRepository<A: EventApplier>` (`type Id` 付き)、
    DI は集約別の concrete wrapper (`DependOnAccountRepository`)。
    汎用 `DependOnAggregateRepository<A>` は関連型解決が読みにくく不採用
  - **Stage 4 への設計入力**: UoW closure 内で同一集約に連続 save する場合、
     直前の `EventEnvelope.version` を次のコマンドの expected version に連鎖
     させること (最初の `Rehydrated.version` を再利用すると自己競合する)。
      また legacy append SQL の CAS (`NOT EXISTS` / `MAX(version)=v`) は同時
      書き込み下で両方の transaction を通しうる (Oracle + 品質レビュー両方が
      指摘)。UoW 移行で楽観排他に依存する前に、UNIQUE 制約・advisory lock 等の
      原子的 CAS への強化を検証すること
  - **Stage 4 確定 (2026-08-14、PR #31 closeout より)**:
    - `AggregateRepository<Account>` / `DependOnAccountRepository` をユースケース層で
      本採用。`application/src/service/account/rehydrate.rs` の `rehydrate_account()`
      ヘルパーは削除。ユースケースは `account_repository().load(id)` で
      `Rehydrated<Account>` を取得し、`save(CommandEnvelope)` で永続化
    - `AccountCommandProcessor` (`adapter/src/processor/account/command.rs`) の
      `account_event_store().persist_and_transform()` 直呼びを解消し、
      `AggregateRepository::save(CommandEnvelope)` 経由に変更。processor は調停
      (command → event 構築) のみを担う形に整理
    - UoW 内での同一集約連続 save の version 連鎈は実装で固定。具体的には
      初回 save の戻り `EventEnvelope.version` を次の `CommandEnvelope` の
      `ExpectedVersion::At(v)` に設定
    - 楽観排他の原子性強化については、現行の UNIQUE / NOT NULL / 条件付き
      `WHERE version = $expected` による CAS に加え、必要に応じて advisory lock
      等を検討する方針を維持。本 Stage では advisory lock 導入までは至らず
  - **Stage 3 確定 (2026-08-14、PR #29 closeout より)**: projector 専用 port は
    `kernel::interfaces::projection` に 3 系統で確定 —
    `AccountEventLog` (seq 窓読み出し `find_by_seq_window(executor, from, limit)`)、
    `ProjectionCheckpointStore` (`get` / `set` で projector_name 単位)、
    `AccountProjectionWriter` (version-gated upsert)。DI は既存の
    `DependOn*` ケーキパターンで行い、`*Query` 系統 (決定3 の `*Query`) とは
    分離した

### 4. projection 通知: transactional log tailing

- event テーブルにグローバル連番 (`seq BIGSERIAL`) を追加し、projector が
  checkpoint テーブルと組み合わせて event テーブルを直接 tail する
- processor からの直接 Signal emit を停止する。Redis (rikka-mq) は
  「起きろ」の合図として残し、欠落保証は DB 行 (event) が担う
- applier は version-gated upsert で冪等化する (at-least-once 前提)
- ActivityPub 配送用 outbox (`outbox_activities`) とは**別物**。ペイロード・
  消費者・再試行規則が異なるため、テーブルも dispatcher ポリシーも統合しない
- **Stage 3 への設計入力 (2026-08-13、Stage 1 review より)**: `BIGSERIAL` の
  払出順は commit 順と一致しないため、`seq > checkpoint` の素朴な単調 tailing は
  commit 順序逆転時にイベントを取りこぼしうる。また 4 テーブルの `BIGSERIAL` は
  それぞれ独立した sequence であり、テーブル横断の単一順序 (グローバル連番) では
  ない。Stage 3 で tailing プロトコル (watermark/窓再読、counter 行による採番
  直列化、テーブル別 checkpoint の可否) を確定する際の検討入力とする。
  `seq` への index も現状未付与のため、tail query 確定時に追加する
- **Stage 3 確定値 (2026-08-14、PR #29 closeout より)**: tailing プロトコルは
  checkpoint + 重複窓再読で確定した。`projection_checkpoints`
  (`projector_name TEXT PK` / `last_seq BIGINT NOT NULL` / `updated_at TIMESTAMPTZ`)
  に checkpoint を保存し、1 poll で `seq > last_seq - W` (W=100) を
  `ORDER BY seq LIMIT 1000` で再読する。`last_seq` は窓内 max(seq) で単調更新し、
  **後退しない**。tail 読み出し → 投影書込み → checkpoint 更新は**同一
  transaction**。per-aggregate は version 順 fold + version gate で収束させ、
  書込みは per-aggregate savepoint で隔離 (他集約の wedge 防止)。
  `account_events(seq)` に index `idx_account_events_seq` を追加済み。
  グローバル tailing (seq 順) と per-stream fold (version 順) の順序分離
  (決定9 の Stage 3 入力) もこの通り実装した

### 5. 外部プロビジョニング (Keto)

- Keto 書き込みは DB commit 後の冪等プロビジョニングとして配置する。
  PostgreSQL の rollback では Keto relation を戻せないため
  「DB transaction と外部 provisioning は同じ原子単位と呼ばない」
- 失敗時は再試行可能という明示契約にする。厳密な収束保証が必要になった時点で
  process manager / saga の導入を別途検討する
- KetoClient は driver に移動する (server から除去)
- **Stage 4 確定 (2026-08-14、PR #31 closeout より)**:
  - `KetoClient` は既に `driver/src/keto.rs` に所在。server の `Handler` は引き続き
    `KETO_READ_URL` / `KETO_WRITE_URL` から生成し AppModule へ委譲するが、
    クライアント実装本体は driver crate 内に閉じる
  - `CreateAccount` / `DeactivateAccount` での Keto relation create/delete は DB
    transaction 内では実行せず、commit 成功後に driver 層の post-commit スロットで
    冪等実行する。実装では `PostgresTransaction` の commit 完了後に `KetoClient` を
    呼び出す構成を採用
  - 冪等化方針を固定: Keto relation create は HTTP 409 Conflict を「既存 relation
    あり」の成功扱い、delete は HTTP 404 Not Found を「既に存在しない」の成功扱い。
    これにより at-least-once 的な再試行が安全になる
  - 失敗時の再試行は現状「失敗を通知する」に留まり、厳密な saga / process manager
    は導入しない (決定5 本文通り)。ログと監視で運用カバーする

### 6. projector の配置

- 調停ロジック (event の fold、cascade cleanup、provisioning 判断)
  → `application::projection`
- SQL upsert / delete / checkpoint 更新 → driver
- worker の起動・shutdown 管理のみ → server
- **Stage 3 確定配置 (2026-08-14、PR #29 closeout より)**: `application::projection`
  に `AccountProjector` を新設し、調停は `ProjectAccountBatch` trait の
  `project_batch()` (poll 1回 = 窓再読 → fold → 書込み → checkpoint の1 transaction)
  に集約した。driver は `PostgresProjectionStore` (checkpoint / seq 窓 / version-gated
  upsert の SQL)。server は `ProjectionWorker` + `ProjectionShutdown`
  (watch channel による graceful shutdown、poll interval は
  `PROJECTION_POLL_INTERVAL_MS` で設定可、default 100ms = e2e 互換)

### 7. DI: ケーキパターン維持 + 境界の型レベル強制

- DependOn* パターンは維持する (service→service 非依存の規律と
  ドメイン貧血症防止の圧力は維持。ただしこれらは方式が強制するのではなく
  規約として守るものと明記する)
- route には use case メソッドのみを持つ facade newtype (`AccountApi<M>` 等) を
  渡し、生の port / executor へのアクセスを**コンパイル時に遮断**する
- `impl_database_delegation!` は配線専用の1型に集約し、AppModule の
  手書き委譲 (~220行) を撤去する
- object safety は取らない (ジェネリクス維持)。`TransactionManager` の
  signature は Stage 1 で `AsyncFnOnce` (`F::CallOnceFuture: Send`、Rust 1.85+)
  を spike 検証し、不可なら `Box::pin` 版で進める
- **spike 結果 (2026-08-13、Stage 1 closeout / PR #25 で確定)**: `AsyncFnOnce` は
  **不採用**。`F::CallOnceFuture: Send` の bound 指定は stable Rust 1.97 でも
  不安定機能 `async_fn_traits` を要求する (E0658) ため、HRTB 付き `Box::pin`
  closure 版 (`for<'c> FnOnce(&'c mut Connection) -> Pin<Box<dyn Future + Send + 'c>>`)
  を採用した。lifetime/Send の健全性 (escape 防止・二度呼び出し不可) は
  独立レビューで検証済み

### 8. AuthAccount は ES → CRUD に移行

- find-or-create を `INSERT ... ON CONFLICT (host_id, client_id) DO NOTHING`
  (既存の UNIQUE 制約を利用) の1文にし、競合なし・同期 projection 不要にする
- イベントは `Created` のみで履歴価値がないため ES 喪失の実害はない
- 既存 `auth_account_events` のデータ移行を含む

### 9. ドメイン / projection 分離

- `Rehydrated<A>` で aggregate と version を分離する
  (既存の `rehydrate_account` が返す `(Account, EventVersion)` が seam)
- `AccountStatus` の nullable カラム折り畳みはドメインの不変条件 API
  (例: `AccountStatus::suspended(reason, suspended_at, expires_at)`) に移し、
  driver は不正行を persistence corruption として扱う
- `AccountProjection` を Account で縦切り導入し、他 read model に横展開する
- 移行ルール: **新規 read query はドメイン Entity を返さない**
  (中間状態の恒久化を防ぐ)
- **Stage 2 時点の確定配置 (2026-08-13、PR #27 closeout より)**: `Rehydrated<A>` は
  `kernel::repository::aggregate` に配置 (aggregate + version のみ。
  `from_events` fold helper 付き)。`rehydrate_account` の `(Account, EventVersion)`
  タプル返しは `Rehydrated<Account>` に置換済み。`Account` が内部に持つ `version`
  は Stage 2 では残置し、`Rehydrated.version == aggregate.version` をテストで固定
- **Stage 3 への設計入力 (Stage 2 review より)**: グローバル tailing (seq 順) と
  per-stream rehydration (version 順) の順序規則を明示的に分けること。
  `Rehydrated::from_events` は入力列の最後の envelope を境界 version とするため、
  読み出し順を seq に変えてもそのまま利用できる
- **Stage 3 確定 (2026-08-14、PR #29 closeout より)**: account 投影は
  `AccountProjector` に一本化し、コマンドパスの直接 Signal emit (7箇所) と
  `AccountApplier` / `account_applier` キューを廃止した。コマンドパスの同期
  read model 書込み (create / account_detail update) は維持。profile /
  metadata / auth_account の Redis 経路は残置 (Stage 6 以降の対象)。
  Account の version ゲート付き upsert は `AccountProjectionWriter` が担う

### 10. 命名の正規化

検証過程で「実態と乖離した名前」「同じ語で別物を指す名前」が構造的な誤解の
原因になっていることが確認された (最たる例: auto-commit 接続を指す
`transaction` 変数)。移行に合わせて以下を正しい名前に整理する。

| 現行 | 新名 (案) | 理由 |
|---|---|---|
| `Executor` trait / `get_executor()` | `Connection` / `connection()` | 実体は接続ハンドル。`sqlx::Executor` とも衝突する紛らわしい用語 |
| `get_transaction()` | `TransactionManager::run` に吸収 | 決定2。begin/commit は Service に見せない |
| auto-commit 接続を指す変数名 `transaction` | `conn` (UoW 内は `tx`) | 嘘の除去。本問題の発見が遅れた直接の原因 |
| adapter クレート | 解体 (kernel / application / driver へ) | 決定1。層名として実態がない |
| `*CommandProcessor` | `AggregateRepository<A>` | 決定3。実態は ES 集約の save/load |
| `*QueryProcessor` | `*Query` | 決定3。実態は read model facade |
| `*ReadModel` (read+write 混在) | `*Query` + `*ProjectionWriter` | 決定3。"Read"Model が書き込みも行う矛盾 |
| `KnownEventVersion` (`Nothing` / `Prev`) | `ExpectedVersion` (`Nothing` / `At(v)`) | 決定3の port 形状に合わせ楽観排他の意味を明示 |
| server の `*Applier` / `ApplierContainer` | `*Projector` / projector worker | 実態は projection 更新。kernel の `EventApplier` (event→state fold) との同名衝突を解消 |
| application の `UpdateAuthAccount` 等 | `application::projection::*Projector` | 決定6。use case 風の命名だが実態は投影処理 |
| `Signal` | `ProjectionNotifier` (dispatcher 配下) | 決定4。直接 emit 廃止後は「commit 後の起動合図」が実態 |
| `transfer` モジュール | `dto` | Data Transfer Object の意。一般用語に合わせる |
| server の `Handler` | 配線専用1型に統合 (決定7) | DI root が "Handler" という名で HTTP handler と衝突 |
| `Nanoid` | `PublicId` (案。要互換性確認) | 実装ライブラリ由来の名前。外部公開 ID というドメイン意味を名乗る |

実施ルール:

- rename は**各 Stage 冒頭の純粋 rename commit** として分離し、
  挙動変更と混ぜない (レビュー可能性と blame の保全のため)
- 新しい名前で書き始めてから旧名を消す (parallel change) を徹底し、
  main green を維持する
- `Nanoid` のように外部表現 (API パス等) に影響しうるものは、
  シリアライズ互換を確認した上で型名のみ変更する

## 却下案と理由

- **ES/CRUD 共通の単一 `Repository<A>`**
  - 理由: CRUD 側にダミー version / `ExpectedVersion::Any` を強いり、型が嘘をつく。
    読み手に存在しない楽観排他を誤解させる
- **Transaction を完全に driver に隠蔽 (TransactionManager なし)**
  - 理由: 複数 repository の原子合成が「ユースケース専用の巨大 repository
    メソッド」に退化し、業務ルールの組み立てが DataStore 層に混入する
- **adapter の処理を一括して driver に吸収**
  - 理由: コマンド生成・調停・永続化が混ざったまま移動するだけで、
    責務の混在が解消されない
- **RAII guard による commit-on-drop**
  - 理由: Drop は成功/失敗を判別できず、Drop 内で async commit もできない
- **projection 通知と AP 配送 outbox のテーブル統合**
  - 理由: ペイロード・消費者・再試行規則・SLO が全て異なり、
    統合は双方に妥協を強いる

## Consequences

以下の8ユニットで段階移行する (各段階で旧 API を shim として残し main green を維持、
クレート削除は参照ゼロ後の最終段階):

1. `architecture-foundation` — characterization tests、no-op commit 廃止、
   `TransactionManager` port + signature spike (AsyncFnOnce vs Box::pin)、
   event テーブル seq 列追加
2. `account-aggregate-repository` — `AccountRepository` port + driver 実装、
   旧 CommandProcessor との同値テストで並走
3. `projection-outbox-projector` — event + 通知の同一 tx 化、Account projector を
   application に新設、直接 Signal emit 停止、applier 冪等化
4. `account-write-usecases` — CreateAccount / UpdateAccountDetail / moderation
   移行、SigningKey の executor 受け取り化、Keto post-commit provisioning
5. `crud-ap-transactions` — Block / Inbox Follow / Inbox Block の tx + 配送 outbox
   化、Mute 等の冪等 repo 操作化
6. `auth-account-crud-migration` — AuthAccount ES→CRUD、find-or-create 原子化、
   同期 projection 例外除去、既存イベントのデータ移行
7. `es-aggregates-migration` — Profile / Metadata を ES repository/projector
   パターンに移行
8. `di-cleanup-adapter-removal` — facade 化・委譲集約・依存遮断、
   adapter クレート削除

- atomicity 欠落は現在進行形のリスクのため、backlog の**先頭**に配置する
- 各ユニットは独立して publish 可能な execution unit とする
- 命名の正規化 (決定10) は各 Stage 冒頭の純粋 rename commit として実施する

## Links

- [packets/backlog.md](../packets/backlog.md) — Ready 先頭の 8 ユニット
- Emumet `AGENTS.md` Architecture 節 — 移行完了後に本 ADR の内容で更新する
