## Goal

Emumet に、server 専用のコンテナイメージを作り、`v*` タグ (CalVer) から `ghcr.io/shuttlepub/emumet` へ安全に公開する仕組みを 1 つの PR で入れる。内訳は次のとおり。

- `server` だけを入れた非 root の Dockerfile と `.dockerignore`
- 起動確認専用の `GET /healthz`、SIGTERM でも graceful shutdown する停止処理、ファイルログを既定で止める `EMUMET_FILE_LOG_ENABLED`
- PR で動くビルド + smoke の CI (公開しない)、タグから動く公開 CI と GitHub Release
- 版・公開の検証 script とそのテスト、手順書

## Why This Slice Exists Now

Emumet には Dockerfile・イメージの公開 CI・タグ・Release がなく、本番を動かす前提のリリース物がない (P4 の残課題)。本番は未稼働で、最初の起動で最新の main から DB が自動作成されるためデータ移行は不要。ユーザーが範囲 (一般公開・amd64 のみ・CalVer・SIGTERM 対応・ファイルログの既定停止) を決めた。

## Current Observed State

- `.github/workflows/` は `e2e.yml` と `lint-and-test.yml` だけで、Dockerfile はない (E2E 用の Containerfile は frontends 側にある)。
- `server/src/main.rs` は SIGINT (Ctrl-C) だけを graceful shutdown に繋いでいる。`docker stop` の SIGTERM では 10 秒後に SIGKILL になる。
- ログは常に `./logs` へも書く (DEBUG)。read-only root やログ用 mount なしでは起動できない。
- HTTP の起動確認用の route がない。`HTTP_LISTEN_ADDR` でポートが変わる。

## Accepted Baseline You May Assume

- 基準は origin/main の `c4d6ea3a4f06e924e73ffa058e5ec6e2409f1e3d` 以降の最新 main (実装開始時に取得し、PR に完全な SHA を書く)。
- 起動に必須の外部サービスは Postgres のみ。Redis は現在接続しない。登録フックを有効にすると 2 つ目の listener (既定 `127.0.0.1:8081`) が開く。`profile-cutover-recovery` はイメージに入れず、server だけにする。
- `server/src/route/tests.rs:813-881` は `main.rs` を文字列として検査する。**このテストは変更せずに通す** (`tokio::spawn` を使わず、冒頭で `Signal` を作って後で poll する)。
- `EMUMET_FILE_LOG_ENABLED` は `.env` が読まれる前に必要になるため、プロセスの環境変数からだけ読む。`RUST_LOG` と `WORKER_ID` の読み方は変えない。
- `.env.example` の `EXPECTED_AUDIENCE=account` は変えない (コードの既定値は `emumet`。直すのは `CLAUDE.md` の説明だけ。`AGENTS.md` の symlink は保つ)。
- ruleset の設定、タグの push、GHCR への公開・公開範囲の変更、本番配置はこの unit では行わない。マージも親の指示があるまでしない。
- CalVer の日付を判定する時刻帯は未確定 (UTC / JST 固定 / UTC で 1 日先まで許容)。基準は定数 1 か所とテストの差し替えで変えられるようにし、いまは UTC で実装する。拒否時のメッセージに基準とした現在の日付を出す。

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `Dockerfile, .dockerignore, server/src/main.rs, server/src/root_router.rs, scripts/, .github/workflows/container-ci.yml, .github/workflows/release.yml, docs/releasing.md, docs/container-runtime.md, CLAUDE.md`

Target part: server 専用コンテナイメージ、`/healthz`、SIGTERM/SIGINT の graceful shutdown、ファイルログの任意化、PR のビルド+smoke CI、`v*` タグからの GHCR 公開と GitHub Release、手順書。

## In Scope

- **イメージ**: Rust の多段ビルド (builder の Rust は `rust-toolchain.toml` と同じ、bookworm、base は digest 固定)。`cargo build --locked --release -p server --bin server`。UID/GID 10001、`STOPSIGNAL SIGTERM`、exec 形式。コンパイラ・ソース・migration SQL・復旧 CLI・curl を入れない。`.dockerignore` は除外リスト形式 (frontends の real E2E も Emumet のルートを build context にするため。`Cargo.toml`・`Cargo.lock`・4 crate・`migrations` が context に残ることを確認する)。
- **runtime**: `GET /healthz` (認証不要・200・`ok\n`・DB/外部/鍵に触れない・openapi 非掲載)。SIGTERM/SIGINT を同じ停止経路に合流 (handler は長い待機の前に作る。migration は中断しない。JWKS 初期取得の待機は停止要求で中断できるようにすることを推奨)。`EMUMET_FILE_LOG_ENABLED` (未設定/`false` はファイルなし、`true` のみ `./logs`、他の値は起動エラー)。
- **smoke** (`scripts/smoke-container.sh`): 専用 network、digest 固定の Postgres (`postgres:16@sha256:1a6ab3f5345eb6dbe04a1349529caabdb0ab09293a09590fad07b2246bfa4b54`)、named volume 上のダミー鍵 (所有者 10001・0400)。read-only root・ログ mount なし・既定 UID で起動し、ホスト側から `/healthz` を確認、`docker logs` に起動ログ、`_sqlx_migrations` の件数、`/__test__/health` が 404、`docker stop -t 30` が exit 0 を確認。自分が作った資源だけ片付ける。
- **検証・公開 script と CI**: `scripts/validate-release.py` (CalVer・日付・main 祖先)、`scripts/publish-release.py` (registry の状態判定・push・Release)、`scripts/check-container-toolchain.py` (Dockerfile と `rust-toolchain.toml` の一致)、`scripts/tests/`。`container-ci.yml` (`pull_request`、公開しない、actionlint)、`release.yml` (`v*` タグ、タグ単位 concurrency、`packages: write` は image job だけ)。ローカルの registry に実際に push して照合する試験を PR CI に含めることを推奨。
- **文書**: `docs/releasing.md` (CalVer、公開の手順、段階別の復旧、初回が判定不能で止まった場合の復旧、判定の根拠の記録、ruleset、マージ後にユーザー許可で行う工程)、`docs/container-runtime.md` (環境変数表。コードから抽出、鍵、停止猶予 30 秒以上、本番向け `RUST_LOG` の推奨値)、`CLAUDE.md` (開発時のファイルログ、audience の既定値の訂正)。

## Out Of Scope

- 本番への配置、k8s の設定・操作、Kratos/Hydra の本番設定、frontends のイメージ、共通 `ShuttlePub/workflows` の変更。
- ruleset の設定、タグの push、GHCR への公開・公開範囲の変更、匿名 pull (マージ後にユーザーの明示許可のもとで行う)。
- マージ。`Cargo.toml` の version の変更。`latest` などの可変タグ。amd64 以外のアーキテクチャ。
- `route/tests.rs:813-881` の変更、`openapi.json` の変更、既存 API の挙動変更。
- 範囲が広がる・制約と矛盾する場合は止めて報告する。

## Standalone Child Issue Contract

この PR は、server 専用の非 root コンテナイメージと、それを PR で検証 (ビルド + smoke、公開なし) し `v*` の CalVer タグから `ghcr.io/shuttlepub/emumet` へ安全に公開する CI・検証 script・手順書を入れる。本番コードの変更は `/healthz`・SIGTERM/SIGINT の graceful shutdown・`EMUMET_FILE_LOG_ENABLED` の 3 点だけで、`server/src/route/tests.rs:813-881` は変更せずに通す。マージ・タグ push・ruleset 設定・GHCR 公開は行わない。

## Acceptance Criteria

- C1 範囲: 変更は Target paths の範囲に限る。k8s・本番配置・frontends・共通 workflows・Cargo の version は触らない。
- C2 本番コード: `/healthz`・停止・ファイルログだけ。`/healthz` は認証不要・200・`ok\n`・外部に触れない・openapi 非掲載。`route/tests.rs:813-881` は無変更で通る。
- C3 イメージ: server のみ、`--locked --release`、test-mode なし、UID/GID 10001。秘密・ビルド道具・migration SQL・復旧 CLI・curl を含まない。
- C4 migration: target を cache mount しない。空 DB で起動後 `_sqlx_migrations` の件数が `migrations/` の SQL 数と一致する。
- C5 停止: `STOPSIGNAL SIGTERM`。SIGTERM と SIGINT は同じ経路。通常起動後の `docker stop -t 30` が exit 0。migration は中断しない。既存の停止順序と Webhook worker の最大 20 秒待機は不変。
- C6 ログ: stdout を正とする。未設定/`false` はファイルなし、`true` のみ書く。それ以外の値と書込不能は起動エラー。read-only root で起動できる。`.env` からは読まない。
- C7 鍵: 既定 UID で 0400 の鍵を OS レベルで読める (smoke)。
- C8 PR CI: `pull_request`。`pull_request_target`・login・push・Release なし。最小権限、新しい action は SHA 固定。
- C9 タグ: CalVer、実在する日付、未来は拒否 (基準は定数 1 か所・UTC、拒否時に基準の日付を表示)、過去は制限なし、Cargo version と照合しない、タグの commit が origin/main に含まれる。判定不能は拒否。
- C10 公開: amd64 のみ、`v` を除いた CalVer のみ、smoke 済みの同一イメージを push、不存在が明確なら push・同じ revision なら省略・不一致と判定不能は停止、push 直前に再照会。
- C11 同時実行: タグ単位、取り消さない、タグ名は env 経由。
- C12 文書: 環境変数表はコードから抽出し、コマンド・結果・分類を PR に残す。`.env.example` の `EXPECTED_AUDIENCE=account` は不変。`CLAUDE.md` の既定値の説明だけ `emumet`。symlink を保つ。
- C13 初回公開: マージ後・明示許可のもとで行うと手順書に書く。この PR では行わない。
- C14 基準: `c4d6ea3` 以降の main、完全な SHA を PR に書く。
- C15 smoke: 専用 network、digest 固定の Postgres、named volume の鍵、自分の資源だけ片付け、ホスト側から health、秘密を出さない。ローカルと CI で同じ script。
- C16 ベース: bookworm、builder の Rust は `rust-toolchain.toml` と一致 (不一致は CI で拒否)、base は digest 固定。
- C17 Release と復旧: digest は registry から取る。既存 Release は一致なら no-op、不一致と確認不能は停止。段階別の復旧を手順書に書く (初回が判定不能で止まった場合を含む)。
- C18 タグ保護: ruleset で `v*` の更新と削除を禁じる手順を手順書に書く (設定自体は行わない)。
- 推奨 N3〜N8 (JWKS 待機の中断、初回タグ前の試走、鍵の named volume、registry への実 push 試験、`.dockerignore` の確認、`RUST_LOG` の推奨値) は採否を判断し、理由を PR 本文に書く。N4 (判定の根拠の記録と初回判定不能の復旧)・N5 (鍵は named volume)・N7 (`.dockerignore` は除外リスト)・N8 (`RUST_LOG` の推奨値) はできるだけ採用する。
- PR CI がすべて緑。PR は未マージで、PR 本文に基準の完全な SHA、環境変数の抽出コマンド・結果・分類、smoke の結果、C1〜C18 の検証結果、N の採否、未検証の範囲を書く。

## Verification

- `cargo fmt --all --check`、`cargo clippy` (既存 CI と同じ引数)、`cargo test` (DB テストを含む。既存の手順に従う)、`cargo test -p server route::tests` で `route/tests.rs:813-881` が無変更で通ること、`openapi.json` に差分がないこと。
- `docker build` (podman のみなら podman。差異を記録) と `scripts/smoke-container.sh` の実行結果 (exit code、migration 件数、`docker stop` の exit code、`docker logs` の起動ログ)。
- `scripts/tests/` (validate-release / publish-release / check-container-toolchain の正常・不正ケース。現在日時は注入)、`actionlint`、PR CI が全緑。
- 作ったコンテナ・volume・network・image を片付けたこと。
- `git diff --check`。

## Related Links

- 設計の経緯: host の thread-xxs52dcx の計画 (run-01m7mwcengxsfggtwmgpa7rcmy) とレビュー (run-01m7mwvqb0ymt0bcsn6x7d43fe)。
- 参照: `.github/workflows/lint-and-test.yml`、`e2e.yml`、`server/src/main.rs`、`server/src/root_router.rs`、`server/src/route/tests.rs:813-881`、frontends の `apps/shuttlepub-web/e2e/Emumet.Containerfile` (build context の参考)。
- 後続: ruleset の設定、最初のタグ、公開範囲の確認、匿名 pull (ユーザーの明示許可のもと)。

## Knowledge Maintenance

- Intent placement: `intents/emumet/intent-tree/00-map.md` (新規の intent ノードが必要。完了後に host の `intents/emumet/operations/release.md` へ書き写す)
- ADR candidate: none
- Diagram candidate: none
- Docs update: Emumet の `docs/releasing.md`・`docs/container-runtime.md`・`CLAUDE.md` (この PR で)。host への closeout writeback は host で実施
- Closeout writeback expected: yes

## Guide Reachability (G645)

role-facing surface: 運用者向けの `docs/releasing.md` と `docs/container-runtime.md`。guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.

## Additional Required Guidance

- durable state、packet、intent、queue の正本は ShuttlePub/host のみ。child は host 側の packet / intent / queue / ラベルを調査・変更しない。Emumet 側に親状態を作らない。
- ラベルを手で編集しない。`worker claim` が使えない場合は実装担当ではなくリードが claim を扱う。
- 親の指示なしにマージしない。タグの push、ruleset の設定、GHCR への公開をしない。
