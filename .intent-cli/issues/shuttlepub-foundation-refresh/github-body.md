## Goal

`dev` の土台を、次の単位 (代理投稿) の前に整える。外から見た挙動は変えない。

- nitinol を 0.9.0 に上げる。
- 使われていない集約と Projector のプロセスが、idle timeout で止まるようにする。止まったあとも、次の命令や出来事で元どおりに動く。
- テスト用の PostgreSQL のコンテナを、テストのプロセスをまたいで 1 つだけ使う。

## Why This Slice Exists Now

`shuttlepub-producer-intake` (PR #35) のレビューで、merge を止めない指摘が 3 つ残った。

- 投稿 1 件ごとに起動した集約のプロセスが止まらない (`ProcessSystem::new()` に idle timeout の既定がない)。
- 品質ゲートの `cargo nextest` はテスト 1 件ごとにプロセスを分けるので、「プロセスごとに 1 つ」のコンテナが 1 件ごとに起動する。ローカルの品質ゲートに約 11 分かかり、中断するとコンテナが残る。テスト用のデータベースも消していない。
- `scripts/ci/structural-checks.sh` が `port` の外部依存を検査していない。

nitinol 0.9.0 (2026-11-25) で、集約と Projector の idle timeout の指定と、止まった Projector を追記で起こし直す仕組み (projection activator) が入った。0.8 では、全体の既定を置くと静かな journal で Projector が止まったまま戻らなかったが、0.9 で直っている。次の単位 (代理投稿、D74) は配送の Projector をこの上に作るので、先に更新する (D76)。

## Current Observed State

基点は `dev` の `efb5bfc` (PR #35 の merge commit)。

- workspace は `kernel` / `port` / `application` / `driver` / `server` の 5 crate。`Cargo.toml` の `nitinol` は `0.8.0`
- `server/src/database.rs` の `event_source_system` は `ProcessSystem::new().await` と `EventSourceSystem::builder(..).build()` で System を作る。idle timeout の既定はない
- `server/src/delivery.rs` の `spawn_accept_delivery` は `ProjectorProps::spawn()` の戻り値を `AnyProxy` に変えて `AcceptDeliveryHandle` に持ち、`stop()` で止める
- 集約は `application/src/producer.rs` と `application/src/note.rs` で `aggregate_proxy::<..>(..)` から起動する
- `server/tests/support/postgres.rs` は、`SHUTTLEPUB_TEST_DATABASE_URL` があればそのサーバーを使い、なければ `tokio::sync::OnceCell` でプロセスごとに 1 つコンテナを起動する。プロセスの終了を待ってコンテナを消す `sh` の子プロセス (reaper) を持つ。テストごとに `shuttlepub_test_<uuid>` というデータベースを作り、消さない
- `scripts/ci/structural-checks.sh` は 5 crate の workspace 内の依存を検査する。`port` の外部の crate への依存は検査しない
- CI (`.github/workflows/lint-and-test.yml`) の `check` は `cargo test --workspace --all-features --locked` を使う。品質ゲート (TAKT) は `cargo nextest` を使う
- `/api/v1` は 15 操作すべてが 501 のスタブで、`openapi/shuttlepub.json` が契約の正本

## Accepted Baseline You May Assume

- 層は kernel / port / application / driver / server の 5 crate。`port` には抽象 (trait と `DependOn*`) だけを置き、具象は `driver` に置く
- `server` の AppHandler は `EventSourceSystem<PostgresStore>` を直接持つ。ストアの型引数も、ストアを切り替える cargo の feature も作らない (品質ゲートが `--all-features` で動くため)
- ストアは層ごとに決まっている。`kernel` は使わない。`application` のテストは `InMemoryStore`。`port`・`driver`・`server` のテストは PostgreSQL
- nitinol はシングルノードで使う。複数プロセスへの備えは入れない
- `/api/v1` の契約 (`openapi/shuttlepub.json`) には差分を出さない
- 作業ブランチの基点と PR の base は `dev`

## Target Repo / Path / Part

Repository: `ShuttlePub/ShuttlePub`

- Target paths: `Cargo.toml`, `Cargo.lock`, `application/`, `server/`, `scripts/ci/structural-checks.sh`, `docs/foundation.md`

Target part: "nitinol の版と System の組み立て、Projector の起動と停止、テスト用 PostgreSQL の用意、構造検査。`POST /inbox`・`GET /actor` の挙動、/api/v1 契約の定義と openapi/shuttlepub.json は変更対象外"

## In Scope

- nitinol を 0.9.0 に上げ、破壊的変更 (`EventSourceSystemBuilder::build` が async、`ProjectorProps::spawn` が `ProjectorHandle` を返す) に合わせる
- System の idle timeout の既定を置く。テストから短い値を渡せるようにする
- idle timeout で止まった集約と Projector が、次の命令・出来事で動くことを確かめるテスト
- テスト用 PostgreSQL のコンテナをプロセスをまたいで共有する。テストごとのデータベースを消す
- `scripts/ci/structural-checks.sh` に `port` の外部依存の検査を足す
- `docs/foundation.md` の更新

## Out Of Scope

- リレー用の部分 (`POST /inbox`、供給元の集約、Accept の配送) の削除や挙動の変更。次の単位で行う
- 代理投稿、Emumet のモック、Emumet Protocol の受け口
- 時間を置いた再試行、配送キュー、`nitinol-saga` の導入
- スナップショット、複数プロセスでの実行、TLS 付きの PostgreSQL への接続
- 新しい環境変数の追加。既存の環境変数の名前と既定値の変更
- cargo の feature の追加
- `/api/v1` のハンドラの実装、契約の定義 (`server/src/api_v1*`、`server/src/openapi.rs`、`server/src/bin/openapi.rs`)、`openapi/shuttlepub.json`、契約テスト・fixture の変更
- 品質ゲートのコマンドと、CI の既存の step のコマンドの変更
- `.takt/` 配下、`.gitignore`、`flake.nix` の変更
- `main` ブランチへの merge

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: `ShuttlePub/ShuttlePub` の nitinol を 0.9.0 に上げること。System に idle timeout の既定を置き、止まった集約と Projector が次の命令・出来事で元どおりに動くことをテストで確かめること。テスト用 PostgreSQL のコンテナをテストのプロセスをまたいで 1 つだけ使い、テストごとのデータベースを消すこと。`port` の外部依存を構造検査に足すこと。`POST /inbox`・`GET /actor` の挙動、`openapi/shuttlepub.json` と契約の定義は変えないこと。下の確認項目 (I1〜I5、P1〜P4) と Acceptance Criteria が完了の条件で、ほかの issue の完了を前提にしない。

## Design

基点は `dev` の `efb5bfc`。

### 参照するもの

- nitinol 0.9.0 の CHANGELOG (https://github.com/HalsekiRaika/nitinol の `CHANGELOG.md`、`[0.9.0] - 2026-11-25`)。記憶ではなく、CHANGELOG と crate のドキュメントを読んで合わせる
- `docs/foundation.md` (今の構成の説明)

### nitinol 0.9.0 への更新

- workspace の `nitinol` を `0.9.0` にする。`kernel` は `contract`、`application` は `eventsource`、`server` は `eventsource` と `postgres` という feature の割り当ては変えない
- `EventSourceSystemBuilder::build` は async になった。`.build().await` にする
- `ProjectorProps::spawn` は `ProjectorHandle` を返す。`AcceptDeliveryHandle` はこれを持ち、`stop` は `ProjectorHandle::stop` を呼ぶ。`AnyProxy` への変換はやめる
- イベントの保存形式 (family・型名・JSON の形) は変えない。保存形式を固定する既存のテストは、内容を変えずに通す
- ほかに 0.9.0 で変わった API があれば、同じ挙動になるように合わせる。挙動が変わる箇所は PR の説明に書く

### idle timeout

- `ProcessSystem::builder().with_default_idle_timeout(..)` で、System 全体の既定を置く。既定の値は 5 分とし、`server` の定数にする。環境変数は足さない
- `server::database::event_source_system` は idle timeout を引数で受け取る。`main` は定数を渡し、テストは短い値を渡す
- 集約と Projector は、System の既定をそのまま使う (`AggregateProps::with_idle_timeout`・`ProjectorProps::with_idle_timeout` で個別に変えない)。止まった Projector は、追っている出来事が追記されたときに projection activator が起こし直す
- ShuttlePub はシングルノードなので、projection watcher (ほかの書き手の追記を拾う仕組み) は nitinol の既定のままにする
- `AcceptDeliveryHandle::stop` は、Projector が idle timeout で止まっている間に呼んでも成功する

### idle timeout の確認項目

| # | 確かめること | 層 |
|---|---|---|
| I1 | 投稿の集約が idle timeout で止まったあと、同じ投稿をもう一度受け入れても、出来事は 1 つのまま (止まった集約が再生されて判定する) | `server` (PostgreSQL) |
| I2 | 供給元の集約が idle timeout で止まったあと、その供給元からの Create が受け入れ済みとして扱われる | `server` (PostgreSQL) |
| I3 | Accept の配送の Projector が idle timeout で止まったあと、新しい Follow が届くと Accept が配送される | `server` (PostgreSQL) |
| I4 | I3 のあと、Projector の位置が進んでいて、再起動しても同じ Accept を二度送らない | `server` (PostgreSQL) |
| I5 | 止まっている Projector に対して `AcceptDeliveryHandle::stop` を呼んでも失敗しない | `server` (PostgreSQL) |

「止まった」ことは、時間を待つだけで済ませず、観測して確かめる (`ProjectorHandle::is_active`、`ProcessProxy::state` など、nitinol 0.9.0 が公開しているもので)。

### テスト用 PostgreSQL

`server/tests/support/postgres.rs` を直す。

- `SHUTTLEPUB_TEST_DATABASE_URL` があるときの挙動は変えない
- ないときは、決まった名前 (`shuttlepub-test-postgres`) のコンテナを、テストのプロセスをまたいで共有する
  - その名前のコンテナが動いていれば、それを使う
  - 止まっているか、イメージの digest が今の定数と違えば、作り直す
  - 複数のプロセスが同時に起動しようとしても、コンテナは 1 つだけできる。負けた側は、勝った側のコンテナが準備できるのを待って使う
  - テストの実行が終わってもコンテナは消さない (次の実行が使う)。プロセスの終了を待ってコンテナを消す reaper はなくす
  - 実現の仕方 (testcontainers の再利用の機能を使うか、`docker` コマンドを直接呼ぶか) は実装で選ぶ。選んだ理由を PR の説明に書く
- テストごとのデータベース (`shuttlepub_test_...`) は、そのテストの終わりに消す
- 中断されたテストが残したデータベースは、後の実行が消す。作ってから 1 時間を超えた `shuttlepub_test_...` を、古いものとして消してよい (名前に作成時刻を入れるなど、判定の仕方は実装で選ぶ)。動いているほかのテストのデータベースを消さない
- Docker も `SHUTTLEPUB_TEST_DATABASE_URL` も使えないとき、テストは失敗する。黙って通らない
- イメージは今と同じく digest で固定する
- `docs/foundation.md` に、コンテナが残ること、その名前、消し方 (`docker rm --force --volumes shuttlepub-test-postgres`) を書く

### テスト用 PostgreSQL の確認項目

| # | 確かめること |
|---|---|
| P1 | `SHUTTLEPUB_TEST_DATABASE_URL` を外して `cargo nextest run --workspace --all-features` を 1 回実行したあと、`shuttlepub-test-postgres` という名前のコンテナが 1 つだけあり、ShuttlePub のテストが起動したほかの PostgreSQL のコンテナがない |
| P2 | 続けてもう 1 回実行しても、コンテナの ID が変わらない |
| P3 | 正常に終わった実行のあと、そのサーバーに `shuttlepub_test_` で始まるデータベースが残っていない |
| P4 | 古いデータベースを消す処理が、作ってから 1 時間以内のデータベースを消さないことを、テストで確かめている |

P1〜P3 は、実装した人が手元でコマンドを実行して確かめ、実行したコマンドと出力を PR の説明に書く。`cargo nextest` が入っていない環境では、`cargo test --workspace --all-features` で同じことを確かめ、そのことを書く。

### 構造検査

`scripts/ci/structural-checks.sh` に、`port` の検査を足す。

- `cargo tree -p shuttlepub-port -e normal` に、tokio・reqwest・axum・sqlx・`nitinol-runtime` が出ないこと
- 既存の検査は変えない

### 変えないもの

- `POST /inbox`・`GET /actor`・`GET /openapi.json` と `/api/v1` の挙動。`server/tests/federation.rs`・`persistence.rs`・`process.rs`・`delivery_origin.rs` の既存のテストは、検証内容を変えずに通す (組み立ての関数の引数が増えた分の書き換えだけを許す)
- 環境変数の名前と既定値
- `port` は抽象 (trait と `DependOn*`) だけ。具象は `driver`
- AppHandler・axum の state・router・ルートの関数に、ストアの型引数を足さない。cargo の feature を足さない
- `InMemoryStore` を使うのは `application` のテストだけ。`server` (テストを含む) には現れない

## Acceptance Criteria

- AC1 (nitinol 0.9.0): workspace の `nitinol` は `0.9.0` で、`Cargo.lock` もそれに合っている。feature の割り当て (`kernel` は `contract`、`application` は `eventsource`、`server` は `eventsource` と `postgres`) は変わらない。`cargo tree -p shuttlepub-kernel -e normal` に tokio・`nitinol-runtime`・axum・reqwest・sqlx が出ない。イベントの保存形式を固定する既存のテストが、内容を変えずに通る
- AC2 (idle timeout): System に idle timeout の既定 (5 分、`server` の定数) があり、`server::database::event_source_system` の引数で渡される。環境変数は増えていない。Design notes の I1〜I5 を満たし、それぞれ PostgreSQL を使うテストで確認されている。そのテストは「止まった」ことを観測してから次へ進む
- AC3 (テスト用 PostgreSQL): Design notes の P1〜P4 を満たす。P1〜P3 は実行したコマンドと出力が PR の説明にあり、P4 はテストがある。reaper の子プロセスはなくなっている。Docker も `SHUTTLEPUB_TEST_DATABASE_URL` も使えないとき、PostgreSQL を使うテストは失敗する
- AC4 (構造検査): `scripts/ci/structural-checks.sh` が `port` の外部依存 (tokio・reqwest・axum・sqlx・`nitinol-runtime`) を検査し、通る。`port` の `Cargo.toml` にその依存を足すと失敗することを、実装した人が確かめている
- AC5 (既存の挙動と契約の維持): `server/tests/` の既存のテストが、組み立ての関数の引数の書き換えを除いて検証内容を変えずに通る。`openapi/shuttlepub.json` は基点とバイト一致し、再生成しても差分が出ない。契約の定義・契約テスト・fixture に差分がない。AppHandler・axum の state・router・ルートの関数にストアの型引数がなく、cargo の feature は増えていない。`InMemoryStore` は `server` (テストを含む) に現れない
- AC6 (文書): `docs/foundation.md` が、nitinol 0.9.0、idle timeout の既定と止まったあとの動き、テスト用のコンテナの名前・残ること・消し方を説明している
- AC7 (検査): fmt / clippy `-D warnings` / test / build / `git diff --check` / structural-checks / openapi-schema が、ローカルで通る。CI (`dev` 向けの PR) での結果は、この実行単位の workflow の完了条件に含めず、PR の作成後に依頼者が確認する

## Verification

- `cargo fmt --all -- --check`
- `cargo clippy --workspace --all-targets --all-features --locked -- -D warnings`
- `cargo test --workspace --all-features --locked` (Docker か `SHUTTLEPUB_TEST_DATABASE_URL` が使える環境で)
- `cargo build --workspace --locked`
- `git diff --check`
- `scripts/ci/structural-checks.sh` が通る
- `cargo run --locked -p shuttlepub-server --bin openapi` のあと `git diff --exit-code -- openapi/shuttlepub.json` が差分なし
- `git diff efb5bfc -- server/src/api_v1.rs server/src/api_v1 server/src/openapi.rs server/src/bin/openapi.rs openapi server/tests/fixtures server/tests/openapi.rs server/tests/quick_reaction.rs server/tests/personal_domain.rs` が、アプリの組み立て方の差し替えを除いて空
- `cargo tree -p shuttlepub-kernel -e normal` に tokio・nitinol-runtime・axum・reqwest・sqlx が出ない
- I1〜I5・P4 を確認するテストがあり、番号との対応が追える
- P1〜P3 の確認: `docker ps -a --filter name=shuttlepub-test-postgres --format '{{.ID}} {{.Names}}'` を 2 回の実行の前後で比べる。`docker exec shuttlepub-test-postgres psql -U postgres -Atc "SELECT count(*) FROM pg_database WHERE datname LIKE 'shuttlepub_test_%'"` が 0
- `git diff efb5bfc --stat -- .takt .gitignore flake.nix` が空

## Related Links

- nitinol: https://github.com/HalsekiRaika/nitinol (crates.io `nitinol` 0.9.0、`nitinol-eventsource` 0.8.0、`nitinol-sqlx` 0.7.1)
- 契約の正本: `openapi/shuttlepub.json`
- 先行する issue: #34 (shuttlepub-producer-intake、PR #35)

## Knowledge Maintenance

- Intent placement: host の `intents/shuttlepub/intent-tree/00-map.md`。新しい intent ノードは不要
- ADR candidate: なし (決定は host の `intents/shuttlepub/decisions/2026-11-28-emumet-protocol-and-proxy-posting.md` に記録済み)
- Diagram candidate: なし
- Docs update: host の `intents/shuttlepub/technology/overview.md` に、nitinol 0.9.0、idle timeout、テスト用 PostgreSQL の用意の仕方を反映する。host 側の closeout で行い、実装リポジトリからは host を編集しない
- Closeout writeback expected: yes

## Guide Reachability (G645)

- guide surface: `guide workflow task implementation-loop`
- role: `implementation`
- target surface: `ShuttlePub/ShuttlePub` リポジトリ (`application/`、`server/`、`scripts/ci/`)

## Base Branch Policy

Policy: `direct-main` (host の既定)
Expected PR base branch: `dev`

本 issue は内部実装の置き換えの一部で、置き換えは `dev` ブランチで進める。子 PR は `dev` を基点に作り、`dev` に向けて開く。`main` へは、置き換えが動く形になった時点で別途 PR で merge する。
