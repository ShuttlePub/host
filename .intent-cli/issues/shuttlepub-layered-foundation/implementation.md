# shuttlepub-layered-foundation Implementation Packet

## Goal

ShuttlePub の既存の内部実装を破棄し、`HalsekiRaika/architectured` (`main`) に倣ったレイヤード構成と cake-pattern DI の土台へ置き換える。置き換え後も、`/api/v1` の契約 (`openapi/shuttlepub.json`) はバイト一致のまま保ち、ActivityPub の Follow→Accept は新しい構成の上で従来と同じ外部挙動で動く状態にする。

## Why

ShuttlePub は nitinol 0.7 による CQRS+ES へ乗り換える (D17)。現在の内部実装は nitinol 0.4.2 のインメモリ実装と、層をまたいだ型の流用 (kernel の型をそのまま HTTP の DTO とイベントの保存形式に使う、`driver` が具体型のまま `server` に保持される) で成り立っており、乗り換えるとほとんどの項目が変わる。そのため既存コードは引き継がず、土台から置き換える (D15)。本ユニットはその最初の単位で、nitinol と永続化を入れる前に、層の分け方・DI の形・HTTP 層への接続・エラーの扱いを固定する。

## Scope

- `kernel` / `application` / `driver` の既存の中身を削除し、新しい構成で作り直す
- `server` のうち契約以外の部分 (`lib.rs`、`main.rs`、`routes.rs`) を新しい構成で作り直す
- 開発用ルート `/api/notes`、`/api/notes/{id}/reactions`、`/api/timeline` と、そのテスト (`server/tests/http.rs`、`server/tests/pagination.rs`) の削除
- 2023 年の残骸 (`migrations/`、`docker-compose.yml`、`.env`、`.idea/`) の削除
- workspace から nitinol への依存を外す (次のユニットで 0.7 として入れ直す)
- `POST /inbox` (Follow の受理と Accept の配送) と `GET /actor` を新しい構成で実装する
- 契約テストがアプリを組み立てる箇所を、新しい構成に合わせて差し替える
- `docs/foundation.md` を、置き換え後の構成の説明に書き直す
- `.github/workflows/lint-and-test.yml` の実行対象に `dev` を加える

## Out of scope

- nitinol 0.7、集約、イベント、プロジェクション、永続化 (PostgreSQL を含む) の導入
- フォロワーの保存、Announce の転送、Undo、配送キュー、再試行
- WebFinger、NodeInfo、`/inbox`・`/actor` のパスの変更
- `/api/v1` のハンドラの実装 (全操作は 501 のまま)
- 契約の定義 (`server/src/api_v1*`、`server/src/openapi.rs`、`server/src/bin/openapi.rs`) と `openapi/shuttlepub.json` の変更。文面 (doc コメント) の変更も含む
- 契約テストの検証内容の変更 (変更してよい範囲は AC4 のとおり)
- Emumet・Ory・Booskiff との接続。署名鍵は従来どおり起動時にメモリ上で生成する
- `main` ブランチへの merge

## Design notes

### 参照するもの

- 層と DI の形: `HalsekiRaika/architectured` の `main`
- HTTP 層への接続とリレー部分の構成: `HalsekiRaika/stargate` の `master`
- Follow→Accept で何を確認するか: 基点コミットの `driver/src/federation.rs`、`driver/src/signature.rs`、`server/src/routes.rs` と、そのテスト (`driver/tests/federation.rs`、`server/tests/federation.rs`)。削除する前に読み、下の「Follow→Accept の確認項目」と照合する

いずれも参照するのは構成・手順・確認項目で、コードの複写は目的ではない。stargate 由来のコードが残る場合に限り、`docs/stargate-license.txt` の表示を維持する。

### 層

| crate | 置くもの | 依存してよい workspace 内の crate |
|---|---|---|
| `kernel` | エンティティ、値オブジェクト、外部接続の口 (trait) と `DependOn*`、`KernelError` | なし |
| `application` | サービス (trait)、`DependOn*Service`、blanket impl、設定の口、`ApplicationError` | `kernel` |
| `driver` | `kernel` の口の実装 (HTTP クライアント、署名、鍵)、設定の読み込み、`DriverError` | `kernel` |
| `server` | `Handler`、`AppModule`、axum の router・ハンドラ・ミドルウェア、契約の定義、`main` | `application`、`driver`、`kernel` |

- `kernel` の型を HTTP の DTO や外部とやり取りする JSON の形としてそのまま使わない。変換は境界の層で行う。
- `kernel` は `tokio`・`axum`・`reqwest` に依存しない。

### DI の形

- 口は `kernel::interface` に置く。口ごとに、trait `Foo` と、関連型 `Foo` とアクセサ `foo(&self) -> &Self::Foo` を持つ `DependOnFoo` を対で定義する。
- サービスは `application` に置く。依存は supertrait で宣言し、処理は default メソッドに書く。`impl<T: DependOnA + DependOnB> FooService for T {}` の blanket impl と、`DependOnFooService` を対で定義する。サービスは struct もフィールドも持たない。
- `server` の `Handler` が `driver` の実体を保持し、すべての `DependOn*` を実装する。サービスの `DependOn*Service` は `type FooService = Self` で実装する。
- axum の state は `AppModule(Arc<Handler>)` とし、`Clone` と `Deref<Target = Handler>` を実装する。ハンドラは `State<AppModule>` を受け取り、`app.foo_service().execute(..)` の形で呼ぶ。
- trait の非同期メソッドは `async_trait` を使わず、`fn f(&self, ..) -> impl Future<Output = ..> + Send` の形で書く。

### 本ユニットで必要な口

名前は実装側で決めてよい。必要な責務は次のとおり。

- リモートの actor を取得する (接続先の制限、サイズ上限、タイムアウトを含む)
- 署名付きの Activity をリモートの inbox へ配送する
- 受信したリクエストの HTTP 署名を検証する
- 自身の actor の ID・inbox・公開鍵を提供する
- 設定 (`SHUTTLEPUB_BIND`、`SHUTTLEPUB_ACTOR`、`SHUTTLEPUB_REMOTE_ORIGINS`) を提供する。環境変数の名前と既定値は変えない

署名の検証は、stargate に倣って inbox のルートにだけ掛ける axum のミドルウェアから口を呼ぶ。ミドルウェアは `axum::middleware::from_fn_with_state` で `AppModule` を受け取る。

### エラー

- 層ごとに `thiserror` の enum を定義し、`error-stack` の `Report` で運ぶ (stargate の形)。
- 口が返すエラーは `kernel` の型に包み、`application` が `driver` の型を知らずに済むようにする。
- HTTP のステータスへの対応は `server` だけが持つ。
- workspace の lint (`unwrap_used`・`expect_used`・`todo`・`unimplemented` が deny、`unsafe_code` が forbid) は変えない。

### Follow→Accept の確認項目

基点コミットの実装が満たしている外部挙動。新しい実装でもすべて満たす。

| # | 条件 | 応答 |
|---|---|---|
| F1 | 正しい署名付き Follow | 202。Accept をリモート actor の inbox へ配送済み |
| F2 | リクエスト本文が 256 KiB を超える | 413 |
| F3 | 署名ヘッダは正しい形式だが、本文が Follow の JSON として解釈できない、または Follow の `id`・`actor` が URL として解釈できない | 400 |
| F4 | `Signature` ヘッダがない、形式が不正 (項目の重複、引用符なし、Base64 でない署名値を含む)、署名が合わない、ダイジェストが合わない | 401 |
| F5 | 署名対象に `(request-target)`・`host`・`date`・`digest`・`content-type` の 5 つが揃っていない | 401 |
| F6 | `Date` がない、解釈できない、または現在時刻から 300 秒を超えてずれている | 401 |
| F7 | アルゴリズムが `rsa-sha256` でない | 401 |
| F8 | 署名の `keyId` が、Follow の `actor` を取得して得た公開鍵の `id` と一致しない | 401 |
| F9 | 取得した actor の `id` が Follow の `actor` と一致しない、または公開鍵の `owner` が actor の `id` と一致しない | 401 |
| F10 | Follow の `object` が自身の actor の ID でない、または `Host` ヘッダが自身の actor のホスト (ポートを含む) と一致しない | 401 |
| F11 | Follow の `actor` または取得した actor の `inbox` が、`SHUTTLEPUB_REMOTE_ORIGINS` で許可したオリジンでない。スキームが http/https でない、URL に認証情報を含む場合も同じ | 403 |
| F12 | リモート actor の取得に失敗する、応答が 256 KiB を超える、取得した公開鍵が読めない、Accept の配送先がエラーのステータスを返す | 502 |

配送と取得の条件:

- リモートへの HTTP は全体 10 秒・接続 3 秒でタイムアウトし、リダイレクトを追わず、プロキシを使わない。
- Accept の `id` は Follow ごとに一意にする (基点では `{自身の actor}/accepts/{Follow の id}`)。`actor` は自身の actor、`object` は受け取った Follow。
- Accept のリクエストには `date`・`host`・`digest`・`content-type: application/activity+json` を付け、F5 の 5 つを対象に `rsa-sha256` で署名する。`keyId` は `{自身の actor}#main-key`。
- `GET /actor` は `application/activity+json` で、`@context`・`type: Application`・`id`・`inbox`・`publicKey` を返す。

F1〜F12 の番号は、テスト名か PR 本文で対応が追えるようにする。複数の条件に同時に当てはまるリクエストの応答は、基点コミットの判定順に従う。

## Verification

- `cargo fmt --all -- --check`
- `cargo clippy --workspace --all-targets --all-features --locked -- -D warnings`
- `cargo test --workspace --all-features --locked`
- `cargo build --workspace --locked`
- `git diff --check`
- `cargo run --locked -p shuttlepub-server --bin openapi` のあと `git diff --exit-code -- openapi/shuttlepub.json` が差分なし (AC4)
- `git diff <基点コミット> -- server/src/api_v1.rs server/src/api_v1 server/src/openapi.rs server/src/bin/openapi.rs openapi server/tests/fixtures` が空 (AC4)
- `cargo metadata` から得た workspace 内の依存が AC1 と一致する
- `cargo tree -i nitinol` が該当なしになる (AC3)
- F1〜F12 を確認するテスト (偽のリモートを立てる結合テストを含む) と、口を差し替えたサービス単体のテスト (AC5、AC6)
- 起動したバイナリに対するテスト (`server/tests/process.rs`) が、新しい構成でも通る

## Knowledge Maintenance (G461)

- Intent placement: `intents/shuttlepub/intent-tree/00-map.md`。新しい intent ノードは不要
- ADR candidate: なし。決定は `intents/shuttlepub/decisions/2026-11-15-role-boundary-and-rebuild.md` (D12-D19) に記録済み
- Diagram candidate: なし
- Docs update: `intents/shuttlepub/technology/overview.md` を置き換え後の構成に更新する。host 側の closeout で行う (実装リポジトリからは host を編集しない)
- Closeout learning: AppModule / Handler の形、層ごとのエラー型、署名検証ミドルウェアの制約、契約テストの切り離しで必要だった変更。`write_back_required: true`
- Guide reachability (G645): `guide workflow task implementation-loop` / role `implementation` / 対象は `ShuttlePub/ShuttlePub` の `kernel/`・`application/`・`driver/`・`server/`
