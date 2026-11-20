# shuttlepub-producer-intake Implementation Packet

## Goal

ShuttlePub に nitinol 0.8 による CQRS+ES と PostgreSQL への永続化を導入し、連合を申し込んできた外のサービス (供給元) の受け入れと、そこから届いた公開投稿の記録までを一本通す。

- Follow が届くと、供給元の集約が「連合を受け入れた」という出来事を記録する。
- Accept の配送は、その出来事への反応として行う。
- 受け入れ済みの供給元から届いた Create (Note) を、投稿の集約が「投稿が届いた」という出来事として記録する。同じ投稿が 2 度届いても、出来事は 1 つだけ残る。

## Why

ShuttlePub が扱う問題は「Producer から送られた Activity を元に、タイムラインが構築されること」で、永続化はその過程の一部と決まった (D42)。Producer は 3 つあり (D43)、本 issue はそのうち「連合を申し込んできた外のサービス」を扱う。リレーサーバーの機能は多数の投稿を受けるための仕組みで、Follow は利用者から見れば購読だが、ソフトウェアから見れば Producer が 1 つ増える出来事である (D44)。

以前の単位 (#32、PR #33。merge せずに閉じた) は Follow を 1 行保存する形になり、ドメインとして扱うべきものが抜け、nitinol の使い方も CRUD に寄った。本 issue はそれを作り直す。タイムライン (Local TL・Global TL・ホーム TL) の読み出しは後の単位で、ここで記録した出来事から Projector で導く。

## Scope

- workspace に `port` crate を足す (D50)。nitinol 0.8.0 を入れる
- 各層の module を、まとまり (`community`・`producer`・`intake`・`note`・`delivery`) で切り直す
- 供給元の集約と投稿の集約 (コマンド・イベント・codec・問い合わせ) を `kernel` に定義する
- `POST /inbox` で Follow に加えて Create (Note) を受け付ける
- Accept の配送を、出来事への反応として `application` に置く
- PostgreSQL への接続 (`SHUTTLEPUB_DATABASE_URL`)、nitinol のマイグレーション、起動と終了の手順
- テスト (集約の単体、`InMemoryStore` を使う application のテスト、PostgreSQL を使う server のテスト、起動したバイナリ) と、開発用の `compose.yaml`
- `docs/foundation.md` と `scripts/ci/structural-checks.sh` の更新

## Out of scope

- タイムライン・検索・通知の読み出しモデルと Projector、それらを返す HTTP のルート
- Undo (連合の取り消し)、Update・Delete・Announce・Like などの受け入れ、届いた投稿のほかのサービスへの転送
- 配送キュー、時間を置いた再試行、打ち切り
- Emumet からの転送を受ける専用 API、利用者の投稿 (`/api/v1`)、Emumet・Ory・Booskiff との接続
- `/api/v1` のハンドラの実装 (全操作は 501 のまま)。契約の定義 (`server/src/api_v1*`、`server/src/openapi.rs`、`server/src/bin/openapi.rs`)、`openapi/shuttlepub.json`、契約テスト・fixture の変更。文面 (doc コメント) の変更も含む
- `POST /inbox` の Follow に対する検証内容と判定順 (F1〜F11、および F12 のうち actor の取得と公開鍵の失敗) の変更、`/inbox`・`/actor` のパスの変更
- アプリケーション独自のマイグレーション (読み出しモデルを持たないので、まだ要らない)、スナップショット、複数プロセスでの実行、TLS 付きの PostgreSQL への接続
- 署名鍵の永続化 (従来どおり起動時にメモリ上で生成する)
- `.takt/` 配下、`.gitignore`、`flake.nix` の変更
- `main` ブランチへの merge

## Design notes

基点は `dev` の `f12933b` (PR #31 の merge commit)。PR #33 のコードは使わない。

### 参照するもの

- nitinol 0.8.0 (crates.io)。集約と Projector の書き方は nitinol リポジトリの `examples/eventsource`、PostgreSQL への配線は nitinol-sqlx 0.7.0 の README。docs.rs と crate のソースを読んでから書く。記憶や推測で API を書かない
- 層と DI の形、非同期の書き方、エラーの扱いは、基点の `docs/foundation.md` のとおり。本 issue で変えるのは下に書いた点だけ

### 層と依存 (D16, D50)

| crate | 役割 | workspace 内の依存 | nitinol の feature |
|---|---|---|---|
| `kernel` | 集約・コマンド・イベント・値 | なし | `contract` |
| `port` (新設) | 実体のほとんどが外部サービスであるものの口。集約の知識 (識別子など) は使う | `kernel` | なし |
| `application` | ユースケースと、出来事への反応 | `kernel`・`port` | `eventsource` |
| `driver` | `port` の実装 (HTTP の配送、リモート actor の取得)、署名の検証と付与、鍵、設定 | `kernel`・`port` | なし |
| `server` | HTTP、組み立て、起動 | すべて | `eventsource`・`postgres` |

- `port` に置くのは、リモートの inbox への配送と、リモート actor の取得の 2 つ。基点の `kernel::interface` にあるもののうち、この 2 つを移す。自身の actor の提供と HTTP 署名の検証は外部サービスではないので、`port` に置かない。
- `kernel` は tokio・`nitinol-runtime`・axum・reqwest・sqlx に依存しない。`application` は axum・reqwest・sqlx に依存しない。
- `scripts/ci/structural-checks.sh` を 5 crate と上の依存に合わせる。検査を弱めない。
- nitinol の System を自前の型で包まない。`server` の AppHandler が `EventSourceSystem<PostgresStore>` をフィールドとして直接持ち、`application` は cake-pattern (`DependOn*`) でそれを受け取って `AggregateProxy` に `ask` する。AppHandler と axum の state・router・ルートの関数には、ストアの型引数を付けない (ストアの種類を axum 側に出さない)。ストアを切り替える feature も、`server` 用の検証用 Handler も作らない。`application` は `DependOn*` を通してストアに依らない形のままにし、そのテストだけが `InMemoryStore` を使う。Accept の配送の起動は PostgreSQL のトランザクションを使う 1 つだけにする。

### module の切り分け (D20, D47)

層の crate は保ち、各層の中の module をまとまりで切る。`kernel::entities` と `kernel::interface` (種類別の分け方) はなくす。

| まとまり | module 名 | 入るもの |
|---|---|---|
| コミュニティ自身 | `community` | 自身の actor、公開鍵、自身の actor を提供する口 |
| 供給元 | `producer` | 供給元の集約・コマンド・イベント、連合の申し込み (Follow) と受け入れ (Accept) の値 |
| 受け入れ | `intake` | 届いた Activity を検証して出来事にする処理、HTTP 署名の検証の口、リモート actor の値 |
| 投稿 | `note` | 投稿の集約・コマンド・イベント |
| 配送 | `delivery` | Accept を届ける反応、配送の口 (`port`) とその実装 |

- 層によっては空のまとまりがあってよい。空の module は作らない。
- 複数のまとまりから使う値 (`ActorId`・`ActivityId` など) の置き場所は実装側で決める。`identity` という名前は使わない (Identity Plane は Emumet を指す)。
- どの型をどの module に置いたかを `docs/foundation.md` に表で書く。

### 供給元の集約

- 集約 1 つが、連合を申し込んできたサービス 1 つを表す。集約の ID は、申し込んできた actor の URL の authority (ホスト名と、あればポート) から決める。届いた投稿の署名者は投稿者本人なので、「受け入れ済みの供給元から来たか」は authority で判定する。ID の文字列には、ほかの集約と衝突しない接頭辞を付ける。
- 状態は「連合していない」(`Default`) と「受け入れた」の 2 つ。「受け入れた」は、申し込んできた actor の ID・その inbox・受け入れた Follow の ID・Accept が届いたかどうかを持つ。
- コマンドとイベント:

| コマンド | イベント | 条件 |
|---|---|---|
| 連合を受け入れる (actor・inbox・Follow の ID) | 連合を受け入れた | 連合していない、Accept がまだ届いていない、または Follow の ID が前回と違う |
| 同上 | なし (成功として返す) | 同じ Follow の ID で、Accept がすでに届いている |
| Accept が届いたと記録する (Follow の ID) | Accept が届いた | その Follow の Accept がまだ届いていない |
| Accept が届かなかったと記録する (Follow の ID・理由) | Accept が届かなかった | 同上 |

- 状態への問い合わせ (nitinol の `Query`) で「受け入れ済みか」を答える。Accept がまだ届いていなくても、受け入れた時点で受け入れ済みとする。
- 判定 (`decide`) は純粋関数にする。I/O・時計・乱数を使わない。
- Undo (連合の取り消し) のコマンドとイベントは定義しない。

### 投稿の集約

- 集約 1 つが、Note 1 件を表す。集約の ID は Note (object) の ID から決め、接頭辞を付ける。
- コマンドは「届いた投稿を受け入れる」の 1 つ、イベントは「投稿が届いた」の 1 つ。イベントは、届いた Activity の JSON をそのまま持つ。あわせて、Activity の ID・Note の ID・投稿者の actor の ID・供給元 (authority)・受け取った時刻を持つ。時刻は呼び出し側が渡し、集約は時計を読まない。
- すでに届いている投稿をもう一度受け入れるコマンドは、拒否しない。イベントを増やさずに成功として返す。最初のイベントの書き込みが競合した場合の `AskError::AlreadyCreated` も、「既に知っていた」として成功にする。重複を除くための表を別に持たない。

### イベントの保存形式

- `family` は `shuttlepub.producer.`・`shuttlepub.note.` で始める (`nitinol` は予約されている)。codec は serde_json による JSON とし、集約の隣 (`kernel`) に置く。
- 保存形式 (family・型名・JSON の形) を固定するテストを置く。保存済みのイベントが読めなくなる変更を検知するため。

### POST /inbox

Follow と Create を受け付ける。それ以外の種類は従来どおり 400。

Follow:

- 検証内容と判定順は基点のまま (F1〜F11、F12 のうち actor の取得と公開鍵の失敗)。
- すべての検証を通ったら、供給元の集約に「連合を受け入れる」を `ask_with_retry` する。記録できたら 202 を返す。記録に失敗したら 500。
- Accept の配送を待たない。配送の結果は応答に出ない。

Create:

| # | 条件 | 応答 |
|---|---|---|
| N1 | 正しい署名付きで、受け入れ済みの供給元から届いた公開の Note | 202。投稿が届いたイベントが 1 つ記録される |
| N2 | N1 と同じ Note がもう一度届く (同じ Activity でも、別の Activity でも) | 202。イベントは増えない |
| N3 | Create の ID・actor・Note の ID が URL でない、object が Note を埋め込んでいない | 400 |
| N4 | 署名に関する失敗 (Follow の F4〜F9 と同じ検証) | Follow と同じ応答 |
| N5 | `Host` が自身の actor の authority と違う | 401 |
| N6 | actor の origin が許可されていない (`SHUTTLEPUB_REMOTE_ORIGINS`)、actor の取得に失敗する | Follow と同じ応答 (403・502) |
| N7 | Note の `attributedTo` が Create の actor と違う、または Note の ID の origin が actor の origin と違う | 401 |
| N8 | actor の authority が受け入れ済みの供給元でない | 403 |
| N9 | 宛先 (`to`・`cc`) に公開 (`https://www.w3.org/ns/activitystreams#Public`、`as:Public`、`Public`) が含まれない | 202。記録しない |

- 判定順は、Follow と共通の検証 (本文の大きさ → Signature ヘッダの形 → JSON の形 → 送り主の確認 → 署名) を先に行い、そのあと N7 → N8 → N9 とする。Follow と共通の部分は、同じ処理を通す。
- N3〜N8 で拒否した場合は、何も記録しない。

### Accept の配送 (出来事への反応)

- 「連合を受け入れた」イベントを受け取り、Accept を組み立てて、配送の口 (`port`) で相手の inbox へ届ける部品を `application` に置く。配送の口の実装は DI で渡す。
- 部品は nitinol の `Projector` と同じ形 (イベントを順に受け取り、位置を保存する) にし、全体の順序 (`catchup_from_global`) で読む。位置は nitinol の offset として保存するので、再起動しても過去の Accept を送り直さない。
- 届いたら「Accept が届いたと記録する」、届かなかったら「Accept が届かなかったと記録する」を供給元の集約に送る。配送の失敗では部品をエラーにしない。エラーにすると、応答しない相手 1 つが後ろのイベントをすべて止めるため。
- 届かなかった Accept を、時間を置いて送り直すことはしない。相手が Follow を送り直すと、「連合を受け入れた」がもう一度記録され、Accept がもう一度配送される。
- 同じイベントが 2 度届くことがある (at-least-once)。その場合は Accept が 2 度配送されてよい。
- 記録の直後に Accept が届くとは限らない (ポーリングで進む)。この遅れは仕様として `docs/foundation.md` に書く。
- `async-trait` は、nitinol 側が `#[async_trait]` で定義している trait の実装に限って使ってよい。それ以外の trait は従来どおり (宣言は `-> impl Future<Output = ..> + Send`、実装は `async fn`、`clippy::manual_async_fn` に掛かる書き方をしない)。

### PostgreSQL と起動

- 接続先は環境変数 `SHUTTLEPUB_DATABASE_URL` で受け取る。未設定、または接続できない場合は、起動時にエラーで止まる。既存の環境変数の名前と既定値は変えない。
- マイグレーションは、起動時に `PostgresEventStore::migrate` を呼ぶだけにする。nitinol 0.8.0 は自分のマイグレーションを `nitinol_migrations` に記録する。アプリケーション独自のマイグレーションは、読み出しモデルを足す単位で `sqlx::migrate!()` をそのまま使って入れる。本 issue では入れない。`Migrator` を手で組み立てたり、管理テーブルの名前を変えたりしない。
- 起動の順序: 設定 → 鍵 → PostgreSQL へ接続 → マイグレーション → `EventSourceSystem` の構築 → Accept を届ける反応の開始 → HTTP の待ち受け。終了時は、HTTP の待ち受けを止めたあとに反応を止める。
- nitinol は現在シングルノード用で、本 issue は 1 プロセスでの動作を前提とする。複数プロセスへの備え (排他、リーダー選出など) は入れない。これはこの段階の検証範囲であって、ShuttlePub の役割の指標 (水平スケーリングの効果が大きいものを担う) を変えるものではない。シングルノードで動かして分かったことを nitinol のクラスタリング機能へ還元する。この前提と、nitinol-sqlx が TLS を有効にしていないことを `docs/foundation.md` に書く。

### テストと PostgreSQL

- PostgreSQL を使わずに確認できるものは、使わずに確認する。
  - 集約の判定 (`decide`・`apply`) は `kernel` の単体テスト。
  - ユースケースと反応は、`InMemoryStore` と偽の `port` を使う `application` のテスト。
  - 層ごとに使うストアを決める。`kernel` は純粋関数のテストでストアを使わない。`application` は `InMemoryStore` と偽の `port` で組み立て、PostgreSQL を使わない。`port` は抽象だけなのでテストを持たない。`driver` は nitinol のストアに触れないが、外部 I/O を伴うテストでストアが要る場合は PostgreSQL を使う。`server` のテストは、`server/tests/federation.rs` を含めてすべて PostgreSQL (testcontainers、テストのバイナリごとに 1 つを共有) で組み立て、`InMemoryStore` を使わない。契約テスト (`server/tests/personal_domain.rs`、`quick_reaction.rs`、`openapi.rs`) は検証内容を変えず、組み立ての変更だけにとどめる。
- PostgreSQL を使うテストは、環境変数 `SHUTTLEPUB_TEST_DATABASE_URL` があればその DB を使い、なければ testcontainers で PostgreSQL を起動する。どちらも使えない場合は、テストを黙って通さずに失敗させる。コンテナはテストごとに起動せず、テストのバイナリごとに 1 つを共有し、テスト同士は schema か database で分ける。
- PostgreSQL を使って確認するもの: R6〜R8、および HTTP の `POST /inbox` から PostgreSQL のイベントまでを通す確認 (R1 と N1 を少なくとも 1 件ずつ)。
- `server/tests/federation.rs` の既存のテストは、次の 2 つを除いて検証内容を変えない。
  - Accept の到着を確認しているテスト (`f01_*` など) は、応答のあと期限付きで Accept の到着を待つ形にする。
  - `f12_accept_rejected_by_the_remote_inbox_is_answered_502` は、R3 を確認するテストに置き換える。
- CI (`ubuntu-latest`) は Docker が使えるので、testcontainers で動かす。CI の設定を変える必要がある場合に限り `.github/workflows/lint-and-test.yml` を変える。
- 開発用に PostgreSQL を起動する `compose.yaml` をリポジトリ直下に置き、起動手順を `docs/foundation.md` に書く。

### 確認項目 (R1〜R9)

テスト名か PR 本文で、番号 (R1〜R9、N1〜N9) との対応が追えるようにする。

| # | 条件 | 期待する結果 |
|---|---|---|
| R1 | 正しい署名付き Follow | 202。連合を受け入れたイベントが記録される。期限内に Accept が相手の inbox へ届き、Accept が届いたイベントが記録される |
| R2 | 検証で拒否される Follow (F2〜F11 のいずれか) | 応答は従来どおり。何も記録されず、Accept も配送されない |
| R3 | Accept の配送に失敗する | Follow への応答は 202。Accept が届かなかったイベントが記録される。同じ Follow を送り直すと、Accept がもう一度配送される |
| R4 | Accept が届いたあとに、同じ ID の Follow がもう一度届く | 202。イベントは増えず、Accept も配送されない |
| R5 | Accept が届いたあとに、同じ actor から別の ID の Follow が届く | 202。連合を受け入れたイベントが記録され、その Follow に対する Accept が配送される |
| R6 | サーバーを止めて同じ DB で起動し直す | 供給元は受け入れ済みのままで、N1 が成り立つ。起動し直しただけでは Accept は送り直されない。すでに届いている Note は N2 のとおりになる |
| R7 | 空の DB で起動し、止めて、もう一度起動する | 2 回とも起動に成功する |
| R8 | `SHUTTLEPUB_DATABASE_URL` が未設定、または接続できない | 起動時にエラーで止まる。HTTP を待ち受けない |
| R9 | 応答しない相手への Accept の配送が残っている状態で、別のサービスから Follow が届く | 別のサービスへの Accept は期限内に届く |

## Verification

- `cargo fmt --all -- --check`
- `cargo clippy --workspace --all-targets --all-features --locked -- -D warnings`
- `cargo test --workspace --all-features --locked` (Docker か `SHUTTLEPUB_TEST_DATABASE_URL` が使える環境で。`server` のテストはすべて PostgreSQL が要る)
- `cargo build --workspace --locked`
- `git diff --check`
- `scripts/ci/structural-checks.sh` が通る
- `cargo run --locked -p shuttlepub-server --bin openapi` のあと `git diff --exit-code -- openapi/shuttlepub.json` が差分なし
- `git diff f12933b -- server/src/api_v1.rs server/src/api_v1 server/src/openapi.rs server/src/bin/openapi.rs openapi server/tests/fixtures server/tests/openapi.rs server/tests/quick_reaction.rs server/tests/personal_domain.rs` が、アプリの組み立て方の差し替えを除いて空
- `cargo tree -p shuttlepub-kernel -e normal` に tokio・nitinol-runtime・axum・reqwest・sqlx が出ない
- `cargo metadata` から得た workspace 内の依存が「層と依存」の表と一致する
- R1〜R9・N1〜N9 を確認するテストがあり、番号との対応が追える
- `git diff f12933b --stat -- .takt .gitignore flake.nix` が空

## Knowledge Maintenance (G461)

- Intent placement: `intents/shuttlepub/intent-tree/00-map.md`。新しい intent ノードは不要
- ADR candidate: なし。決定は `intents/shuttlepub/decisions/2026-11-20-problem-domain-and-producers.md` (D42-D50) に記録済み
- Diagram candidate: なし
- Docs update: `intents/shuttlepub/technology/overview.md` に、層 (5 crate)、module の配置、nitinol の使い方、PostgreSQL の前提を反映する。host 側の closeout で行う (実装リポジトリからは host を編集しない)
- Closeout learning: nitinol の境界の置き方 (kernel は contract、AppHandler が EventSourceSystem を持つ)、出来事への反応を Projector の形で書いたときの挙動 (遅れ、重複、失敗の扱い)、シングルノードで動かして分かった nitinol への還元事項、テストでの PostgreSQL の用意の仕方。`write_back_required: true`
- Guide reachability (G645): `guide workflow task implementation-loop` / role `implementation` / 対象は `ShuttlePub/ShuttlePub` の `kernel/`・`port/`・`application/`・`driver/`・`server/`
