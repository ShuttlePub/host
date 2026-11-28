# shuttlepub-foundation-refresh Implementation Packet

## Goal

`dev` の土台を、次の単位 (代理投稿) の前に整える。外から見た挙動は変えない。

- nitinol を 0.9.0 に上げる。
- 使われていない集約と Projector のプロセスが、idle timeout で止まるようにする。止まったあとも、次の命令や出来事で元どおりに動く。
- テスト用の PostgreSQL のコンテナを、テストのプロセスをまたいで 1 つだけ使う。

## Why

`shuttlepub-producer-intake` (PR #35) のレビューで、merge を止めない指摘が 3 つ残った。

- 投稿 1 件ごとに起動した集約のプロセスが止まらない (`ProcessSystem::new()` に idle timeout の既定がない)。
- 品質ゲートの `cargo nextest` はテスト 1 件ごとにプロセスを分けるので、「プロセスごとに 1 つ」のコンテナが 1 件ごとに起動する。ローカルの品質ゲートに約 11 分かかり、中断するとコンテナが残る。テスト用のデータベースも消していない。
- `scripts/ci/structural-checks.sh` が `port` の外部依存を検査していない。

nitinol 0.9.0 (2026-11-25) で、集約と Projector の idle timeout の指定と、止まった Projector を追記で起こし直す仕組み (projection activator) が入った。0.8 では、全体の既定を置くと静かな journal で Projector が止まったまま戻らなかったが、0.9 で直っている。次の単位 (代理投稿、D74) は配送の Projector をこの上に作るので、先に更新する (D76)。

## Scope

- nitinol を 0.9.0 に上げ、破壊的変更 (`EventSourceSystemBuilder::build` が async、`ProjectorProps::spawn` が `ProjectorHandle` を返す) に合わせる
- System の idle timeout の既定を置く。テストから短い値を渡せるようにする
- idle timeout で止まった集約と Projector が、次の命令・出来事で動くことを確かめるテスト
- テスト用 PostgreSQL のコンテナをプロセスをまたいで共有する。テストごとのデータベースを消す
- `scripts/ci/structural-checks.sh` に `port` の外部依存の検査を足す
- `docs/foundation.md` の更新

## Out of scope

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

## Design notes

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

## Knowledge Maintenance (G461)

- Intent placement: `intents/shuttlepub/intent-tree/00-map.md`。新しい intent ノードは不要
- ADR candidate: なし。決定は `intents/shuttlepub/decisions/2026-11-28-emumet-protocol-and-proxy-posting.md` (D72-D76) に記録済み
- Diagram candidate: なし
- Docs update: `intents/shuttlepub/technology/overview.md` に、nitinol 0.9.0、idle timeout、テスト用 PostgreSQL の用意の仕方を反映する。host 側の closeout で行う (実装リポジトリからは host を編集しない)
- Closeout learning: nitinol 0.9.0 で集約と Projector を止めたときの挙動 (再生、起こし直し、遅れ)、テスト用のコンテナをプロセスをまたいで共有したときの品質ゲートの時間。`write_back_required: true`
- Guide reachability (G645): `guide workflow task implementation-loop` / role `implementation` / 対象は `ShuttlePub/ShuttlePub` の `application/`・`server/`・`scripts/ci/`
