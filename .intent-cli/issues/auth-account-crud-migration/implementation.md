# auth-account-crud-migration Implementation Packet

## Goal

ADR 0006 Stage 6。AuthAccount を Event Sourcing から CRUD に移行する。
find-or-create を `INSERT ... ON CONFLICT (host_id, client_id) DO NOTHING` ベースの
単一原子的操作に置き換え、コマンドパス内の同期 projection 書き込み例外と
Redis リペア経路を除去し、ES 基盤を削除する。既存 `auth_account_events` の
データ移行 (fold 補完 + drop) を含む。

## Why

AuthAccount のイベントは `Created { host, client_id }` のみで履歴価値がない
(ログイン履歴は Kratos の責務)。現行 find-or-create は3手順 (read model 検索 →
イベント書込 → 同期投影 INSERT) で、並行実行時に UNIQUE(host_id, client_id) 衝突
エラー → Signal → Redis applier リペアという例外経路が常設されている。
この例外は adapter 解体 (決定1) と projection 一本化 (決定4/6) の障害であり、
Stage 7 / Stage 8 の前提となる。

## 設計判断 (host 側で確定済み)

1. **CRUD port の形状**
   ADR 決定3 の CRUD 系統に従い `AuthAccountRepository` を kernel に新設。
   `ExpectedVersion` / `Rehydrated` の擬装はしない。最低限の操作は
   `find_or_create(host_id, client_id)` と `find_by_id`。
   `AuthAccountReadModel` port (find_by_id / find_by_client_id / create) は
   この repository に吸収または置換する。find_or_create が (host_id, client_id)
   の組で引くため、host 絞り込みなしの `find_by_client_id` は不要になる見込み
   (残す場合は用途を確認すること)。

2. **find-or-create の原子化**
   `INSERT ... ON CONFLICT (host_id, client_id) DO NOTHING` を使う。
   既存行があった場合に id を取る方法 (RETURNING は DO NOTHING では衝突時に
   行を返さないため、フォールバック SELECT または CTE 等) は実装で確定する。
   id 採番は既存どおり snowflake (`kernel::generate_id`) でよい。

3. **resolve_auth_account_id の新フロー**
   1. AuthHost を issuer URL で find-or-create (既存ロジック維持)
   2. `AuthAccountRepository::find_or_create(host_id, client_id)` を呼ぶ
   EventStore / CommandProcessor / QueryProcessor は経由しない。
   これにより client_id 単独検索の曖昧さ (host 絞り込みなし) も解消される。

4. **削除対象 (同期 projection 例外と ES 基盤)**
   - `adapter/src/processor/auth_account.rs` 全体
     (AuthAccountCommandProcessor / AuthAccountQueryProcessor /
     DependOnAuthAccountSignal)
   - `application/src/service/auth_account.rs` (UpdateAuthAccount) と
     service.rs の export
   - `server/src/applier/auth_account_applier.rs` と `server/src/applier.rs` の
     `impl_signal!` 登録、`server/src/handler.rs` の DependOnAuthAccountSignal 配線
   - `kernel/src/event_store/auth_account.rs` (AuthAccountEventStore port)
   - `driver/src/database/postgres/auth_account_event_store.rs`
   - `kernel/src/entity/auth_account.rs` の AuthAccountEvent / EventApplier impl。
     entity 本体は `EventVersion` を持たない plain struct にする
   - `kernel/src/test_utils/event.rs` の auth_account_create_command 等の helper

5. **データ移行**
   マイグレーションで `auth_account_events` を `auth_accounts` に fold し
   (event 側にあって auth_accounts にない (host_id, client_id) を補完)、
   `auth_account_events` を drop する。`auth_accounts.version` 列の扱い
   (drop or 残置+default) は実装で確定し closeout で ADR に writeback。
   test_mode.rs / server/tests/support/db.rs の TRUNCATE 対象を更新。

6. **影響を受けないもの**
   AuthAccountId の下流消費者 (CreateAccount の link_auth_account + Keto Owner、
   session_context、permission check、find_by_auth_id、AccountProjector) は
   永続化方式に依存しないため変更不要。

## Scope

- `AuthAccountRepository` CRUD port 新設 (kernel) + Postgres 実装 (driver)
- find-or-create の ON CONFLICT 原子化
- `resolve_auth_account_id` の書き換え
- 同期 projection 例外・Redis リペア経路・ES 基盤の削除 (上記4のリスト)
- データ移行マイグレーション (fold 補完 + auth_account_events drop)
- TRUNCATE 対象の更新
- 関連テストの追加・修正・削除

## Out of scope

- Profile / Metadata の ES 移行 (Stage 7)
- route facade newtype 化・adapter クレート自体の削除 (Stage 8)
- AuthHost の CRUD 化・フロー変更
- Keto provisioning・権限モデルの変更
- Kratos / Hydra / OAuth2 フロー自体の変更
- 本 Stage に直接関係しない命名正規化

## Verification

- 並行 find_or_create テスト: 同一 (host_id, client_id) で同時実行 → 同一 id、1行のみ
- マイグレーションテスト: auth_account_events に欠損行を seed → migrate → 補完確認 + テーブル drop 確認
- 等価性: 既存ルートテスト (me.rs 等) と e2e (compose) の認証フローが同一挙動
- 残存参照ゼロ: auth_account_events / AuthAccountEventStore / AuthAccountCommandProcessor /
  UpdateAuthAccount / auth_account_applier / DependOnAuthAccountSignal を grep で確認
- `cargo test` (DATABASE_URL あり) / clippy / fmt / e2e green
- `git diff --check` clean

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
- ADR candidate: yes — Stage 6 確定値を決定8/9/10 に writeback
- Diagram candidate: none
- Docs update: none
- Closeout learning: CRUD port signature、find_or_create SQL 形状、version 列の扱い、
  データ移行手順、Redis リペア経路除去の影響範囲 (write_back_required: true)
- Guide reachability (G645): `no_role_facing_surface: true`

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
