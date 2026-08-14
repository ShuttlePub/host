# account-write-usecases Implementation Packet

## Goal

ADR 0006 (アーキテクチャ再配置) Stage 4。`CreateAccount` / `UpdateAccountDetail` /
moderation (suspend / unsuspend / ban / deactivate) のユースケースを
`TransactionManager::transaction()` ベースの Unit of Work (UoW) に移行する。
同時に `SigningKeyRepository::create` / `CreateSigningKeyUseCase` を executor
受け取りに変更し、`CreateAccount` 内で同一トランザクションを共有できるようにする。
Keto relation の書き込みは DB transaction 内から外し、commit 後の冪等
provisioning として再配置する (決定5)。さらに Stage 2 で導入済みの
`AggregateRepository<Account>` をユースケース層で本採用し、
`rehydrate_account()` ヘルパー経由の event store 直読みと
`AccountCommandProcessor` 内の `persist_and_transform` 直呼びを整理する。

## Why

`CreateAccount` は現状4つの独立した書き込み (account event + projection、
profile event + projection、Keto relation HTTP、signing key) を
auto-commit 接続で実行しており、DB 障害・Keto 障害・プロセスクラッシュの
いずれかのタイミングで中間状態が残る。これは ADR 0006 Context で指摘した
「現在進行形のデータ不整合リスク」の核心部分である。

`UpdateAccountDetail` のみが `get_transaction()` を使うが、これは低レベル API
直使いで `TransactionManager` 規約を活用していない。moderation 系も同様に
auto-commit のままである。

Stage 2 までに `AggregateRepository<Account>` port と `Rehydrated<A>` は完成
したが、アプリケーション層では未だ `rehydrate_account()` ヘルパー (event store
直読み) を使い、`DependOnAccountRepository` を要求するユースケースが存在しない。
Stage 4 の UoW 移行とセットで repository の本採用を行うことで、
「Service は closure で原子範囲を宣言するだけ」という ADR 0006 決定2 の構造を
完成させる。

Keto は PostgreSQL と別の外部 HTTP サービスであり、DB rollback では取り消せない。
決定5 の通り、DB commit 後の冪等 provisioning として配置する。

## 設計判断 (host 側で確定済み)

1. **UoW 対象**: ADR 0006 決定2 に列挙された5ユースケースのうち、
   本 Stage 4 で扱うのは以下4つに絞る:
   - `CreateAccount`
   - `UpdateAccountDetail`
   - moderation: `SuspendAccount` / `UnsuspendAccount` / `BanAccount` / `DeactivateAccount`
   - `Block` / `Inbox Follow` / `Inbox Block` は Stage 5 で tx + 配送 outbox 化する
   - `Mute` / `Accept` / `Undo Follow` / `Undo Block` は Stage 5 で冪等 repo 操作化する
   単一書き込みユースケースを Stage 4 で UoW 化しない理由は、
   find-then-write 競合を冪等 repository 操作と DB 制約で処理する方が
   業務ロジックを複雑化させないため (決定2)。

2. **TransactionManager の注入形状**: Stage 1 で確定した Box::pin closure signature
   (`for<'c> FnOnce(&'c mut Connection) -> Pin<Box<dyn Future + Send + 'c>>`)
   をそのまま使う。`DependOnTransactionManager` トレイトを kernel に新設し、
   Service は `transaction_manager().transaction(|conn| async move { ... })` で
   UoW を宣言する。`DatabaseConnection` トレイトを要求する既存の `DependOn*`
   は auto-commit 接続用途に残す。Service によりわかる名前で二つを区別する。

3. **AggregateRepository の本採用**: ユースケース層で `rehydrate_account()`
   ヘルパーを使わず、`DependOnAccountRepository` + `account_repository().load(id)`
   で `Rehydrated<Account>` を取得する。変更後は `rehydrated.into_parts()` または
   `rehydrated.aggregate` / `rehydrated.version` を使う。同一 UoW 内で連続 save
   する場合は、直前の save 結果 (`EventEnvelope.version`) を次のコマンドの
   `ExpectedVersion::At(v)` に連鎈させる (ADR 0006 決定3 Stage 2→4 入力)。

4. **`AccountCommandProcessor` の整理**: processor は adapter クレート解体途中の
   中間的存在。Stage 4 では、純粋な調停 (command → event 構築、
   権限ガードの呼び出し順など) を残し、永続化は `AggregateRepository::save` へ
   委譲する。最終的には processor ごと消す方向だが、本 Stage では「repository
   呼び出しに切り替える」まで。processor のテストは新/旧同値テストを維持。

5. **SigningKey の executor 受け取り化**: `SigningKeyRepository::create` の
   signature を `&mut self, executor: &mut E, signing_key: &SigningKey` 型に変更し、
   `CreateSigningKeyUseCase` も executor を引数に受け取る。
   `CreateAccount` 内では UoW 閉包の `conn` を渡す。これにより signing key の
   INSERT が account / profile と同一 tx になる。

6. **Keto post-commit provisioning**: DB transaction 内では Keto relation の
   create/delete を実行しない。commit 後に driver 層の small provisioning queue
   (または単純な `post_commit` コールバックスロット) で冪等実行する。
   失敗時は再試行可能な契約とし、厳密な saga は別途検討 (決定5)。
   CreateAccount 内では `permission_writer().create_relation` 相当を tx 内で呼ばず、
   commit 後に driver の KetoClient へ委ねる。DeactivateAccount の relation 削除も同様。

7. **unban / reactivate**: 現状コードには存在しない。本 Stage 4 では新規実装しない。
   acceptance criteria に「未実装のまま」と明記し、必要なら別 issue / Stage 7以降
   で対応。moderation 系は存在する 4 ユースケースの UoW 化に集中する。

8. **テスト戦略**:
   - UoW 移行前後の等価性テスト (characterization test 追加または既存テストの
     継続 green)
   - rollback テスト: tx 内で意図的に失敗させ、account / profile / account_events /
     signing_keys / auth_account / 投影テーブルが元に戻ることを確認
   - Keto provisioning は post-commit なので、e2e / mock server テストで
     provisioning 呼び出しが commit 後に行われることを確認
   - `AggregateRepository` 経由の load/save テストは Stage 2 の同値テストを継承・拡張

## 実装上の注意

- `TransactionManager::transaction()` は top-level ユースケース境界でのみ呼ぶ。
  ユースケース内部で nested 呼び出しを作らない (pool 枯渇による自己デッドロックの
  リスク。ADR 0006 決定2 Stage 1 制約)。
- `connection()` 取得と `transaction()` 取得を混在させない。UoW 対象ユースケースは
  全接続取得を `transaction()` 一本化する。
- route 層はまだ facade newtype 化 (Stage 8) されていないため、今回は
  `DependOnTransactionManager` / `DependOnAccountRepository` を route から AppModule 経由で
  注入できるようにする。生の `DatabaseConnection` 取得経路はそのまま維持。
- `application::projection` の `AccountProjector` は Stage 3 で完成。Stage 4 では
  コマンドパスの同期 projection 書き込み (create / account_detail update) を
  維持しつつ、それらを UoW 内に含める。
- `Profile` / `AuthAccount` / `Metadata` については、ES repository/projector パターン
  への移行は Stage 7 の対象。本 Stage では Profile create も同 tx に含めるが、
  repository 形状の大規模再設計はしない。

## 完了の定義

- PR マージ後、`CreateAccount` / `UpdateAccountDetail` / moderation 4種が
  `TransactionManager::transaction()` を使い、Service 内に begin/commit/rollback の
  呼び出しがない。
- `CreateSigningKeyUseCase` / `SigningKeyRepository::create` が executor 受け取り。
- Keto relation の書き込みは DB tx 内では実行されず、post-commit provisioning
  として配置される。
- ユースケース層で `DependOnAccountRepository` / `account_repository().load/save` を
  使用。`rehydrate_account` ヘルパーは削除またはテスト専用に縮小。
- `cargo test` (DATABASE_URL あり) / `clippy` / `fmt` / e2e が全緑。
- ADR 0006 決定2/3/5 に Stage 4 の確定値を writeback。
