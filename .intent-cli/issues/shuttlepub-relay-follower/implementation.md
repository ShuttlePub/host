# shuttlepub-relay-follower Implementation Packet

## Goal

ShuttlePub に nitinol 0.7 による CQRS+ES と PostgreSQL への永続化を導入し、最初の集約としてフォロワー (自身の actor をフォローしているリモート actor) を記録する。Follow を受理したときにフォロワーが保存され、サーバーを再起動しても残り、現在のフォロワーの一覧を読み出せる状態にする。あわせて、各層の中の module を責務のまとまり (KJ法) で切り直す。

## Why

土台の置き換え (#30) で、層と DI の形、Follow→Accept の受け口はできたが、何も保存していない。リレーサーバーとして動くには、誰に転送するか (フォロワー) を覚えている必要がある。進め方として、まずリレーサーバーとして動くことを優先し、最初の集約をフォロワーにすると決定した。フォロワーは範囲が小さく、ほかのサービスに依存しないので、集約・イベント・射影・永続化の一通りの形をここで固定し、以降の機能 (Announce の転送、投稿、タイムライン) をその形に乗せる。

## Scope

- 各層の module を、責務のまとまり (`relay`・`identity`・`persistence`) で切り直す。既存の型は移すだけで、名前と挙動を変えない
- workspace に nitinol 0.7.2 を入れる (`kernel` は `contract`、`driver` は `eventsource` と `postgres`)
- フォロワーの集約・コマンド・イベント・codec を `kernel::relay` に定義する
- フォロワーを記録する口と一覧する口を `kernel::relay` に定義し、`driver` で nitinol と PostgreSQL を使って実装する
- `AcceptFollowService::accept` に、フォロワーの記録を Accept の配送の前に入れる
- フォロワーの読み出しモデル (PostgreSQL のテーブル) と、それを更新する射影
- PostgreSQL への接続 (`SHUTTLEPUB_DATABASE_URL`)、nitinol とアプリのマイグレーション、起動と終了の手順
- テスト (集約の単体、サービスの単体、PostgreSQL を使う結合、起動したバイナリ) と、開発用の `compose.yaml`
- `docs/foundation.md` の更新 (module の配置、nitinol の使い方、PostgreSQL の起動手順、既知の制約)

## Out of scope

- Undo (フォロー解除)、Announce の転送、フォロワーへの配送、配送キュー、再試行
- フォロワーの一覧を返す HTTP のルート、`/api/v1` のハンドラの実装 (全操作は 501 のまま)
- 契約の定義 (`server/src/api_v1*`、`server/src/openapi.rs`、`server/src/bin/openapi.rs`)、`openapi/shuttlepub.json`、契約テスト・fixture の変更。文面 (doc コメント) の変更も含む
- `POST /inbox` の検証内容・判定順・F1〜F12 の応答の変更、`/inbox`・`/actor` のパスの変更
- スナップショット、saga、複数プロセスでの射影の実行、TLS 付きの PostgreSQL への接続
- 投稿・反応・タイムラインなど、フォロワー以外の集約
- Emumet・Ory・Booskiff との接続。署名鍵は従来どおり起動時にメモリ上で生成する
- 層の crate の追加・分割 (4 crate のまま)、層の依存方向と DI の形の変更
- `.takt/` 配下、`.gitignore`、`scripts/ci/structural-checks.sh`、`flake.nix` の変更
- `main` ブランチへの merge

## Design notes

基点は `dev` の `f12933b` (PR #31 の merge commit)。

### 参照するもの

- nitinol 0.7.2 (crates.io)。集約と射影の書き方は `examples/eventsource/3.projection`、拒否の返し方は `examples/eventsource/2.multiple-deciders`、PostgreSQL への配線と `TxProvider` の実装例は `providers/nitinol-sqlx/README.md`
- 層と DI の形、非同期の書き方、エラーの扱いは、基点の `docs/foundation.md` のとおり。本 issue で変えない

### module の切り分け (D20)

層の crate は保ち、各層の中の module を責務のまとまりで切る。本 issue で扱うまとまりは次の 3 つ。

| まとまり | module 名 | 入るもの |
|---|---|---|
| 連合の受け口と配送 | `relay` | Follow・Accept、フォロワー (集約・イベント・コマンド)、リモート actor、配送・リモート actor 取得・署名検証の口、フォロワーの記録と一覧の口 |
| 外部の身元 | `identity` | 自身の actor、公開鍵、自身の actor を提供する口 |
| 記録と実行の基盤 | `persistence` (driver)、起動部分 (server) | PostgreSQL への接続、マイグレーション、nitinol の起動、射影の実行 |

- `kernel::entities` / `kernel::interface` (種類別の分け方) はなくし、`kernel::relay`・`kernel::identity` に移す。`application`・`driver`・`server` も同じ名前の module に揃える。`KernelError` など層に 1 つのものは crate の直下に置く。
- 移すだけの型は、名前と挙動を変えない。`ActorId`・`ActivityId` のように複数のまとまりから使う値は `identity` に置く。
- どの型をどの module に置いたかを `docs/foundation.md` に表で書く。

### nitinol の入れ方 (D17)

| crate | feature | 使うもの |
|---|---|---|
| `kernel` | `contract` | `Aggregate`・`Decider`・`Decision`・`Event` (derive)・`Codec`・`AggregateId` |
| `driver` | `eventsource`・`postgres` | `ProcessSystem`・`EventSourceSystem`・`PersistenceProvider`・`PostgresStore`・`Projector`・`InMemoryStore` |
| `application`・`server` | 依存しない | — |

- `kernel` は `contract` だけを使い、tokio と `nitinol-runtime` に依存しない (`cargo tree -p shuttlepub-kernel -e normal` で確認する)。
- `application` は nitinol を知らない。フォロワーの記録と一覧は `kernel::relay` の口を通して呼ぶ。nitinol の型 (`AggregateProxy`・`AskError` など) を `application` と `server` のハンドラに出さない。
- sqlx は `nitinol::sqlx::sqlx` の re-export を使い、版を nitinol に揃える。
- `Projector` と `TxProvider` は nitinol 側が `#[async_trait]` で定義している。この 2 つの実装に限り `async-trait` を `driver` で使ってよい。それ以外の trait は従来どおり (宣言は `-> impl Future<Output = ..> + Send`、実装は `async fn`、`clippy::manual_async_fn` に掛かる書き方をしない)。

### フォロワーの集約

- 集約 1 つが、自身の actor をフォローしているリモート actor 1 件を表す。集約の ID はリモート actor の ID から決まる (同じ actor は必ず同じ集約になる)。ID の文字列は、ほかの集約と衝突しない接頭辞を付ける。
- 状態は「フォローしていない」(`Default`) と「フォローしている」(actor の ID・inbox・受理した Follow の ID を持つ) の 2 つ。
- コマンドは「Follow を受理する」の 1 つ。イベントは 1 つの enum にまとめ、本 issue では「フォローされた」の 1 種類だけを持つ。Undo (フォロー解除) のコマンドとイベントは本 issue では定義しない。
- 判定 (`decide`) は純粋関数にする。I/O・時計・乱数を使わない。
- 同じ actor からの Follow の再送 (すでにフォローしている) は拒否しない。イベントを増やさずに成功として返す。inbox が前回と違う場合の扱い (更新イベントを出すか、無視するか) は実装側で決め、決めた内容を `docs/foundation.md` とテストに残す。
- イベントの `family` は `shuttlepub.relay.` で始める (`nitinol` は予約されていて使えない)。codec は serde_json による JSON とし、`driver` ではなく `kernel` の集約の隣に置く (イベントの保存形式は集約の定義の一部のため)。`kernel` の集約以外の型は、これまでどおり HTTP や外部向け JSON の形として使わない。
- イベントの保存形式 (family・型名・JSON の形) を固定するテストを置く。保存済みのイベントが読めなくなる変更を検知するため。

### 口 (kernel::relay)

名前は実装側で決めてよい。必要な責務は次の 2 つ。どちらも `DependOn*` と対にする。

- フォロワーを記録する: actor の ID・inbox・Follow の ID を受け取り、集約へコマンドを送る。成功 (新規・再送のどちらも) か `KernelError` を返す。
- 現在のフォロワーを一覧する: 読み出しモデルから、actor の ID と inbox の組を返す。

`driver` の実装:

- 記録は `EventSourceSystem` から集約を引いて `ask_with_retry` する。`AskError::AlreadyCreated` (最初のイベントの書き込みが、すでに存在する集約と衝突した) は、その actor がすでにフォロワーとして存在するという意味なので、再送と同じく成功として扱う。Transient の失敗 (楽観ロックの衝突、バックエンドの一時的な失敗) の再試行は、nitinol の `AggregateProxy::ask_with_retry` と既定の `RetryPolicy` (3 回、待ちは 100 ms と 200 ms) に任せ、再試行の処理を自分では書かない。`ask_with_retry` が返した失敗 (再試行しても残った Transient と、Permanent) は `KernelError::Internal` にする。
- nitinol を使う実装は、ストアの型を差し替えられる形にする。本番は `PostgresStore`、テストは `InMemoryStore` を渡す。

### Follow→Accept への組み込み

`AcceptFollowService::accept` の順序を次のとおりにする。

1. フォロワーを記録する。失敗したら Accept を配送せず、500 を返す。
2. Accept を配送する。失敗したら従来どおり 502 を返す。記録は取り消さない。

記録を先にする理由: 配送してから記録に失敗すると、相手は「フォローできた」と認識しているのにこちらに記録がない状態になる。記録が先なら、配送に失敗しても相手が Follow を再送し、再送は拒否されずに Accept がもう一度配送される。

- 署名の検証、判定順、F1〜F12 の応答は変えない。記録は、基点で Accept を配送していた位置 (すべての検証を通過したあと) に入る。
- 検証で拒否された Follow (F2〜F11、および F12 のうち actor の取得・公開鍵の失敗) では、フォロワーを記録しない。

### 読み出しモデル (射影)

- 「フォローされた」イベントを、PostgreSQL のテーブル (フォロワー 1 件が 1 行、actor の ID が主キー、inbox を持つ) に反映する。
- 射影は全体の順序 (`catchup_from_global`) で読み、`with_tx_provider` を使って、読み出しモデルの更新と offset の保存を同じトランザクションで commit する。同じイベントが 2 回届いても結果が変わらない書き方 (upsert) にする。
- 射影はポーリング (既定 250 ms) で進むので、記録の直後に一覧へ現れるとは限らない。この遅れは仕様として `docs/foundation.md` に書く。
- 本 issue では、一覧を使う HTTP のルートは作らない。一覧の口はテストから呼び、次の単位 (Announce の転送) で使う。
- nitinol は現在シングルノード用で、1 つの射影を複数のプロセスで同時に動かすことを想定していない。本 issue はシングルノード (1 プロセス) での動作を前提とし、複数プロセスへの備え (排他、リーダー選出など) は入れない。この前提を `docs/foundation.md` に書く。
- シングルノードの前提は、この段階の検証範囲であって、ShuttlePub の役割の指標 (水平スケーリングの効果が大きいものを担う) を変えるものではない。まずシングルノードで動くことを確かめ、そこで分かったこと (射影を 1 つしか動かせないこと、楽観ロックの衝突と再試行の挙動、起動と停止の順序など) を nitinol のクラスタリング機能へ還元する。水平スケーリングは、nitinol がクラスタリングに対応した後の単位で扱う。この位置づけも `docs/foundation.md` に書く。

### PostgreSQL とマイグレーション

- 接続先は環境変数 `SHUTTLEPUB_DATABASE_URL` で受け取る。未設定、または接続できない場合は、起動時にエラーで止まる。既存の環境変数 (`SHUTTLEPUB_BIND`・`SHUTTLEPUB_ACTOR`・`SHUTTLEPUB_REMOTE_ORIGINS`) の名前と既定値は変えない。
- 起動時に、nitinol のマイグレーション (`PostgresEventStore::migrate`) と、アプリのマイグレーション (読み出しモデルのテーブル) の両方を実行する。
- nitinol のマイグレーションは sqlx の既定のテーブル `_sqlx_migrations` を使い、設定を変えられない。同じテーブルをアプリのマイグレーションと共有すると、互いに知らない version を見つけて失敗する見込みがある (sqlx 0.9 のソースからの推測で、未実行)。アプリのマイグレーションは別の管理テーブルを使う (`Migrator::dangerous_set_table_name` など) か、別の方法で衝突を避ける。どの方法でも、「空の DB で起動 → 停止 → 同じ DB でもう一度起動」が成功することをテストで確認する。
- アプリのマイグレーションのファイルは `driver` に置く。リポジトリ直下に `migrations/` を作らない。
- nitinol-sqlx は TLS を有効にしていない。TLS が必須の PostgreSQL には接続できないことを `docs/foundation.md` に書く。
- 起動の順序: 設定 → 鍵 → PostgreSQL へ接続 → マイグレーション → nitinol の起動 → 射影の開始 → HTTP の待ち受け。終了時は、HTTP の待ち受けを止めたあとに射影のプロセスを止める (nitinol にシステム全体の終了 API は見当たらないため、個別に `stop` する)。
- 署名鍵は従来どおり起動時にメモリ上で生成する。

### テストと PostgreSQL

- PostgreSQL を使うテストは、環境変数 `SHUTTLEPUB_TEST_DATABASE_URL` があればその DB を使い、なければ testcontainers で PostgreSQL を起動する。どちらも使えない場合は、テストを黙って通さずに失敗させる。
- テスト同士が干渉しないよう、テストごとに schema か database を分ける。
- PostgreSQL を使わずに確認できるものは、使わずに確認する。
  - 集約の判定 (`decide`・`apply`) は `kernel` の単体テスト。
  - `AcceptFollowService` は、口を偽の実装に差し替えた単体テスト (既存の `application/tests/accept_follow.rs` に、記録と配送の順序、記録の失敗、配送の失敗を足す)。
  - `server/tests/federation.rs` (F1〜F12 と判定順) は、`InMemoryStore` と偽の読み出しモデルで組み立て、PostgreSQL なしで通す。
- PostgreSQL を使って確認するもの。
  - マイグレーションの 2 回実行。
  - 記録 → 射影 → 一覧に現れること (期限付きで待つ)。
  - プロセスを作り直しても、同じ DB から集約の状態と一覧が復元されること。
  - 同じ actor の Follow を 2 回送っても、イベントと行が増えないこと。
  - 起動したバイナリに対するテスト (`server/tests/process.rs`)。
- CI (`ubuntu-latest`) は Docker が使えるので、testcontainers で動かす。CI の設定を変える必要がある場合に限り `.github/workflows/lint-and-test.yml` を変える。
- 開発用に PostgreSQL を起動する `compose.yaml` をリポジトリ直下に置き、起動手順を `docs/foundation.md` に書く。

### 確認項目 (R1〜R10)

テスト名か PR 本文で、番号との対応が追えるようにする。

| # | 条件 | 期待する結果 |
|---|---|---|
| R1 | 正しい署名付き Follow | 202。フォロワーが記録され、Accept が配送され、期限内に一覧へ現れる |
| R2 | 同じ actor から Follow をもう一度受ける | 202。Accept は再び配送される。イベントも一覧の行も増えない |
| R3 | 検証で拒否される Follow (F2〜F11 のいずれか) | 応答は従来どおり。フォロワーは記録されない |
| R4 | 記録に失敗する | 500。Accept は配送されない |
| R5 | 記録に成功し、Accept の配送に失敗する | 502。記録は残る。同じ Follow の再送は R2 のとおり成功する |
| R6 | 記録で Transient の失敗が起きる | nitinol の `ask_with_retry` が再試行する。その中で成功すれば R1 と同じ。最後まで失敗したら R4 と同じ。再試行そのもののテストは nitinol にあるので、ここでは書かない |
| R7 | サーバーを止めて同じ DB で起動し直す | 一覧と集約の状態が復元される。再起動後の同じ actor の Follow は R2 のとおりになる |
| R8 | 空の DB で起動し、止めて、もう一度起動する | 2 回とも起動に成功する (マイグレーションの衝突がない) |
| R9 | `SHUTTLEPUB_DATABASE_URL` が未設定、または接続できない | 起動時にエラーで止まる。HTTP を待ち受けない |
| R10 | 同じイベントが射影に 2 回届く | 一覧の内容が変わらない |

F1〜F12 と判定順 (`server/tests/federation.rs` の `f01_`〜`f12_`・`order_*`、および `/inbox` の POST 以外が 405 になること) は、基点と同じ結果のまま保つ。

## Verification

- `cargo fmt --all -- --check`
- `cargo clippy --workspace --all-targets --all-features --locked -- -D warnings`
- `cargo test --workspace --all-features --locked` (Docker か `SHUTTLEPUB_TEST_DATABASE_URL` が使える環境で)
- `cargo build --workspace --locked`
- `git diff --check`
- `cargo run --locked -p shuttlepub-server --bin openapi` のあと `git diff --exit-code -- openapi/shuttlepub.json` が差分なし (AC7)
- `git diff f12933b -- server/src/api_v1.rs server/src/api_v1 server/src/openapi.rs server/src/bin/openapi.rs openapi server/tests/fixtures server/tests/openapi.rs server/tests/quick_reaction.rs server/tests/personal_domain.rs` が、アプリの組み立て方の差し替えを除いて空 (AC7)
- `cargo tree -p shuttlepub-kernel -e normal` に tokio・nitinol-runtime・axum・reqwest・sqlx が出ない (AC2)
- `cargo metadata` から得た workspace 内の依存が AC1 と一致する
- R1〜R10 (R6 を除く) を確認するテストがあり、番号との対応が追える (AC4〜AC6)
- `git diff f12933b --stat -- .takt .gitignore scripts flake.nix` が空

## Knowledge Maintenance (G461)

- Intent placement: `intents/shuttlepub/intent-tree/00-map.md`。新しい intent ノードは不要
- ADR candidate: なし。決定は `intents/shuttlepub/decisions/2026-11-16-relay-first-and-module-slicing.md` (D20-D22) に記録済み
- Diagram candidate: なし
- Docs update: `intents/shuttlepub/technology/overview.md` に、module の配置、nitinol の使い方、PostgreSQL の前提を反映する。host 側の closeout で行う (実装リポジトリからは host を編集しない)
- Closeout learning: nitinol の境界の置き方 (kernel は contract のみ)、マイグレーションの同居の方法、射影の遅れと待ち方、シングルノードで動かして分かった nitinol への還元事項 (クラスタリングに必要なこと)、テストでの PostgreSQL の用意の仕方。`write_back_required: true`
- Guide reachability (G645): `guide workflow task implementation-loop` / role `implementation` / 対象は `ShuttlePub/ShuttlePub` の `kernel/`・`application/`・`driver/`・`server/`
