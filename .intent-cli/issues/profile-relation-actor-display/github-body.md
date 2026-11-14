## Goal

D08 の ui-spec 1-6 (アカウントタブの行は「アイコン・名前・acct」を出す。ユーザー決定『1. a』) を満たすため、Emumet の個別 block・mute の一覧応答に、対象 actor の表示用情報を**加算のみ**で追加する。

- `GET /api/v1/profiles/{profile_nanoid}/mutes`・`/blocks` の各 item (と、`POST` の 201 応答。同じ `ProfileRelationResponse`) に `target_actor` を加える: 種別 (local / remote)・actor URL・(local のとき) Profile nanoid・取得状態 `status`・`acct` (`preferredUsername@host`)・`preferred_username`・`display_name`・`icon_url`。
- ローカル Profile が対象のときもリモートと同じ形で返す。
- リモート actor の表示情報は、新設する永続キャッシュ `profile_remote_actor_cache` から返す。未取得・取得失敗のときは `status` で示し、画面が actor URL 表示へフォールバックできるようにする。
- **一覧取得 (GET) の処理でリモートへ同期取得しない**。取得・更新は block/mute 作成後と、一覧応答を返した後のバックグラウンドで行う。「応答を返した後」の定義 (リード判断、PR #106 の再レビュー対応): handler が応答を確定して返し、HTTP サーバーが応答本体を最後まで取り出した (Poll::Ready(None)) か、本体を破棄した (Drop) 後。ソケット書き込み完了・クライアント受信完了との前後は保証しない (hyper は本体を poll し切ってからソケットへ flush するため、本体の層では書き込み完了を保証できない)。保証するのは、応答の確定前と本体の取り出し中に取得を始めないことで、これにより遅い peer が一覧・作成の応答を遅らせず、transaction 内で外部 I/O をせず、連発を避ける。

frontends (BFF・画面) の変更は本 unit に含めない (後続の別 unit)。

## Why This Slice Exists Now

frontends main c88b96b (F8 第2段) の BFF は上記 API の `id / kind / profile_id / target / created_at` だけを使うため、アカウントタブは actor URL と追加日しか出せず、合意した ui-spec 1-6 と食い違っている (host `intents/emumet/features/personal-domain-controls/acceptance.md` F8『ui-spec との差』)。ユーザーは仕様どおりに直す (名前・アイコン・acct を出す) と決めたため、まず Emumet 側の API を拡張する。画面と BFF はこの API がマージされてから後続 unit で行う。

## Current Observed State

- `server/src/schema/profile_policy.rs` の `ProfileRelationResponse` は `id / profile_id / kind / target / created_at`。一覧は `application/src/service/profile_relation_list.rs` の `list_profile_relations` (所有者のみ・transaction 内で `profile_blocks` / `profile_mutes` を読み、ローカル対象は `find_by_id_unfiltered` で actor URL を組み立て、見つからなければ行を除外)。作成は `application/src/service/profile_relationship/relationship.rs` の `block_actor` / `mute_actor`。route は `server/src/route/profile_relationship.rs`、facade は `server/src/api/profile_relationship.rs`。
- 新モデルの `profile_blocks` / `profile_mutes` は対象を canonical actor URL (remote) か `target_profile_id` (local) でしか持たない。旧モデルの `remote_accounts` (名前等を持ち得た) は P4 の初期化 (`20261120000002_reset_legacy_federation.sql`) で破棄済み。**新モデルには remote actor の名前・アイコンを保存する既存のキャッシュが無い**。`driver/src/profile_delivery/resolver.rs` の `HttpRemoteActorResolver` は actor 文書を取得して inbox だけを返し、何も保存しない (`RemoteActorInfo` = actor_url + inbox)。
- したがって「既存キャッシュから返す」は成り立たず、本 unit で永続キャッシュを新設する。この調査結果は PR 本文に記録する。
- ローカル Profile の表示名・username・icon は `ProfileReadModel::find_by_id_unfiltered` と `ImageRepository::find_by_ids` から得られる (`get_profile_identity` が同じ手順で icon URL を解決している)。自サーバーの host は `DependOnPublicBaseUrl` から得る。

## Accepted Baseline You May Assume

- E8 / D8P / D8G / D8R / P4 は Emumet main に merge 済み。個別 block・mute の一覧は所有者のみ (`require_profile_owner`)、oldest first、cursor ページング (既定 20・最大 100)。
- 既存フィールドの名前・型・意味、パス、認可、ステータスコード、ページングは変えない。
- 外部 I/O を所有者 transaction の中で行わない規約 (`block_actor` は inbox の解決を transaction の前に行う) を守る。

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `migrations, kernel/src/entity, kernel/src/repository, kernel/src/test_utils, driver/src/database/postgres, driver/src/profile_delivery, application/src/service, application/src/dto, server/src/schema, server/src/route, server/src/api, server/src/handler.rs, server/src/openapi.rs, openapi.json`

Target part: 個別 block・mute 一覧 (と POST 応答) の `target_actor` 追加、remote actor 表示情報の永続キャッシュ (新テーブル・repository・取得 port・バックグラウンド更新)、実 DB テストと API テスト。

## API 契約 (この節を仕様とする。型名・ファイル構成の細部は child が決めてよいが、JSON の形と満たすべき性質は固定)

`ProfileRelationResponse` に必須フィールド `target_actor` (オブジェクト。省略も null もしない) を加える。

```json
{
  "id": "...", "profile_id": "...", "kind": "mute", "target": "https://remote.example/users/alice", "created_at": "...",
  "target_actor": {
    "kind": "remote",
    "actor_url": "https://remote.example/users/alice",
    "profile_id": null,
    "status": "resolved",
    "acct": "alice@remote.example",
    "preferred_username": "alice",
    "display_name": "Alice",
    "icon_url": "https://remote.example/avatars/alice.png"
  }
}
```

- `kind`: `local` / `remote`。`actor_url` は `target` と常に同じ値。`profile_id` は local のときだけ Profile nanoid、remote は null。
- `status`:
  - `resolved`: 表示情報がある。`acct` と `preferred_username` は非 null。`display_name`・`icon_url` は actor が持たなければ null (個別に null になり得る)。local は常に resolved (Profile の username が未設定の過渡期のみ `acct`・`preferred_username` が null)。
  - `pending`: remote で未取得 (取得予定または取得中)。`acct`・`preferred_username`・`display_name`・`icon_url` は全て null。後で再度一覧を読めば resolved か unavailable になり得る。
  - `unavailable`: remote で直近の取得が失敗 (不達・404/410・id 不一致・不正文書・宛先拒否など)。表示情報は全て null。期限後に再試行される。
  - 一度 resolved になった対象は、更新取得が失敗しても古い情報を resolved のまま返す (stale-while-error)。
- `acct` = `{preferred_username}@{host}`。remote の host は actor URL の host (明示 port があれば `host:port`、小文字)、local は自サーバー (`PUBLIC_BASE_URL`) の host (同様)。先頭の `@` は付けない (画面が付ける)。
- 既存の「ローカル対象の Profile が見つからなければ行を除外する」挙動は維持する。
- OpenAPI: `ProfileRelationResponse` に `target_actor` を加算し、新スキーマ (`ProfileRelationActor` 等) とフィールド説明を追加して `openapi.json` を再生成する。

## キャッシュと取得の契約

1. **新テーブル** (新 migration。番号は最新 migration より後ろ、P4 の初期化の対象外・既存テーブル無変更): `profile_remote_actor_cache`。主キー `actor_url` (1024 バイト以下の CHECK)、`status` (`pending` / `resolved` / `failed`)、`preferred_username`・`display_name`・`icon_url` (nullable)、`fetched_at` (最後に成功した取得時刻)、`next_refresh_at` (NOT NULL)。resolved のとき `preferred_username` は NOT NULL (CHECK)。Profile への外部キーを持たない (公開されている actor 情報だけ。所有者・関係の情報は持たない)。
2. **取得 port**: remote actor の表示情報 (`preferredUsername` / `name` / `icon`) を取得する port を `RemoteActorResolver` 系に追加し、`HttpRemoteActorResolver` が既存の `resolve` と同じ宛先検査 (https のみ・private 宛先拒否・redirect 拒否・タイムアウト・応答サイズ上限) と『actor 文書の `id` が要求した URL と完全一致』の検査で実装する (文書取得部は共有してよい)。test-mode の注入キャッシュ (`TEST_RESOLVED_ACTORS`) は inbox 専用で、表示情報の取得は対象外 (注入だけの actor は取得失敗になる)。
3. **検証・正規化 (保存前)**: `preferredUsername` は空・空白・制御文字・`@`・`/` を含まない 1〜256 文字 (満たさなければ文書不正として取得失敗)。`display_name` (`name`) は制御文字を除いて前後の空白を落とし 200 文字以内に切り詰め、空なら null。`icon` は object (`url` が文字列、または `href` を持つ object)・配列 (最初の有効な要素)・文字列を受け付け、userinfo なしの絶対 http/https URL で 1024 バイト以内のものだけ `icon_url` にし、それ以外は null (取得失敗にはしない)。値は plain text で、HTML として解釈しない。
4. **取得の起動** (いずれも API 応答の後・transaction の外。失敗は block/mute の成否・配送・API 応答に影響しない):
   - block/mute の作成が成功した後、remote 対象の actor URL を 1 件取得する。
   - 一覧応答を組み立てるとき、remote 対象のうちキャッシュ行が無い・`next_refresh_at` が過ぎている actor URL を最大 10 件選び、応答本体を取り出し終えた後 (または破棄後) に 1 つのバックグラウンドタスクで順に取得する (1 リクエスト 1 タスク)。一覧の処理中には一切リモートへ接続しない。
5. **重複取得の防止 (リース)**: 取得の前に、DB 上で `INSERT ... ON CONFLICT DO UPDATE ... WHERE next_refresh_at <= now` により `next_refresh_at = now + 60 秒` を原子的に確保できたときだけ取得する (行が無ければ `pending` 行を作る)。複数リクエスト・複数プロセスが同じ actor URL を同時に要求しても取得は 1 回。確保できなければ何もしない。
6. **結果の記録**: 成功 → `status=resolved`・各値・`fetched_at`・`next_refresh_at = now + 24 時間`。失敗 → 既存が resolved ならデータと status を保ったまま `next_refresh_at = now + 15 分`、そうでなければ `status=failed`・`next_refresh_at = now + 15 分`。
7. **一覧での状態の決定**: キャッシュ行が無い・`pending` → `pending`、`failed` → `unavailable`、`resolved` → `resolved`。
8. キャッシュの掃除 (どの関係からも参照されなくなった行の削除) は本 unit の範囲外 (公開情報のみで件数は distinct な対象数で有界。残余リスクとして報告)。

## 判断の記録 (PR 本文にも書く)

- 同期取得しない理由: (1) 1 ページ最大 100 件で、低速・不達の peer 1 件が一覧全体を遅延・失敗させる、(2) 所有者 transaction の外で外部 I/O を行う既存規約を一覧にも適用する、(3) 一覧を開くだけで任意 host への連続した外部リクエストが発生するのを避ける。
- 代償: block/mute 直後や既存行の初回表示では `pending` が返り得る。frontends 側は pending のとき actor URL 表示にフォールバックし、少し後の再取得で更新する (引継ぎ事項)。
- icon URL は remote が配る URL をそのまま返す。ブラウザからの直接ロードで利用者の IP が remote host に見える。proxy / 再配信の要否は frontends 側の判断 (引継ぎ事項)。

## In Scope

- migration・entity・repository trait (kernel)・postgres 実装 (driver)・取得 port と HTTP 実装・use case (一覧・作成・バックグラウンド更新)・schema・route・facade・`AppModule` 配線・OpenAPI 再生成。
- ローカル Profile 対象の表示情報 (username・表示名・icon) の解決。
- 実 DB テストと API テスト (下記)。
- 実バグが見つかった場合の最小修正 (PR 本文に明記)。

## Out Of Scope

- frontends (BFF・画面) の変更。ドメインタブ・domain-controls 応答の変更。following / followers 一覧 (`ProfileActorRef`) への表示情報の追加 (必要なら別 unit)。
- remote actor の表示情報の他用途への利用 (通知・検索・投稿表示)。キャッシュの掃除・手動再取得 API・WebFinger による acct の逆引き検証。
- P4 カットオーバー関連のコード (profile-federation の切替処理・既存 migration)。別 Worker が担当中。
- 既存フィールド・パス・認可・ステータスコードの変更。

## Standalone Child Issue Contract

Emumet の個別 block・mute 一覧 (`GET /api/v1/profiles/{profile_nanoid}/mutes`・`/blocks`、および作成の 201 応答) の各 item に、既存フィールドを変えずに `target_actor` (種別・actor URL・profile_id・status[resolved/pending/unavailable]・acct・preferred_username・display_name・icon_url) を追加する。ローカル Profile は Profile から直接、リモート actor は新設の永続キャッシュ (`profile_remote_actor_cache`) から返し、一覧取得時にリモートへ同期取得しない。キャッシュは block/mute 作成後と一覧応答後のバックグラウンドで、リース・期限・検証付きで取得・更新する。認可は現行どおり所有者のみ。実 DB テストと API テストを追加し、openapi.json を再生成し、CI を緑にする。frontends の変更は含めない。

## Acceptance Criteria

- GET の mutes / blocks (と POST 201) の各 item に `target_actor` が加わり、既存フィールドの名前・型・値は不変。既存の契約テストが変更なしで通る。
- local 対象は kind=local・profile_id・status=resolved・acct (自サーバー host)・preferred_username・display_name・icon_url (画像が無ければ null) を返し、remote と同じ形。
- remote 対象: 取得済みなら resolved (acct は actor URL の host)、未取得は pending、直近失敗は unavailable。取得済みの更新失敗は古い情報を resolved で返す。pending / unavailable でも `target` は返る。
- GET の処理中にリモートへ 0 リクエスト (リクエスト数を数える偽 peer で検査)。取得は作成後と応答後 (本体を取り出し終えた後か破棄後。上記の定義) のバックグラウンドで、各一覧リクエスト最大 10 件・同一 URL は同時要求でも 1 回 (リース)。成功 24 時間・失敗 15 分は再取得しない。
- 保存前の検証・正規化 (preferredUsername・display_name・icon_url) と、文書 id 不一致・404/410・タイムアウト・不正 JSON・宛先拒否が取得失敗として記録されること。API はエラーにならない。
- 認可は現行どおり所有者のみ (他人の Profile は 403/404、無認証は 401)。他 Profile・他 Account の設定は返らない。
- 実 DB テスト・API テストが追加され、DATABASE_URL を設定した環境で全て通る (skip のみの成功にしない)。openapi.json は再生成され差分は加算のみ。fmt・clippy -D warnings・CI の全 job が緑。

## Verification

- 実 DB (`DATABASE_URL`) で `cargo test` (workspace 全体。kernel / driver / application / server)。追加テストの例:
  - driver: キャッシュ repository (リース確保の単一勝者 = 並行 N 要求で 1 件のみ true、期限後の再確保、resolved / failed の記録、失敗時の古い情報の保持、`find_many`、URL 長 CHECK)。
  - application: 取得 use case (偽 actor サーバー: 正常・icon の各形・id 不一致・404/410・不正 JSON・巨大応答・タイムアウト・非許可の icon URL・username / display_name の検証)、一覧 use case の 4 状態 (local / pending / resolved / unavailable)、一覧処理中の接続 0 件、候補選択 (最大 10 件・期限)、他 Profile の設定が混ざらない、local Profile 削除時の行除外の維持。
  - server (route): mutes / blocks の JSON 形状と既存フィールドの不変、POST 201 応答、401 / 403 / 404、pending → (バックグラウンド取得) → resolved の収束 (偽 actor サーバー経由、ポーリングで待つ)、openapi のスキーマ検査。
- `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`git diff --check`、`cargo test -p server write_openapi_spec_to_file -- --ignored` 後に `git diff openapi.json` が `target_actor` の加算のみであること。

## 共有ファイルと merge 順

`server/src/handler.rs` (`AppModule` 配線)・`migrations/`・`openapi.json` は他 unit と共有する。別 Worker が profile-federation-in-place-cutover の修正を並行して担当している。変更は本 unit に必要な最小限の追加に留め、衝突したら最新 main を取り込んで解消する。migration 番号は取り込み後に最新より後ろへ採番し直す。

## 親状態の所在

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
child は host 側の packet / intent / queue / ラベルを調査・変更しない。

## Related Links

- 設計 (host リポ): `intents/emumet/features/personal-domain-controls/{overview,packets,acceptance}.md` (acceptance.md F8『ui-spec との差』)、`intents/shuttlepub/features/personal-domain-controls-ui/ui-spec.md` の 1-6。
- 前提: D8R (Emumet PR #93 `82fa49b`)、F8 (shuttlepub-frontends PR #40 / #46、squash `c88b96b`)。
- 後続: frontends の BFF・アカウントタブ (名前・アイコン・acct 表示、pending のときの URL フォールバックと再取得)。

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/personal-domain-controls/overview.md` (primary)。確定契約は完了後に host 側で acceptance.md へ writeback する
- ADR candidate: none (判断と根拠は packet と PR 本文、acceptance.md の確定契約に記録する)
- Diagram candidate: none
- Docs update: OpenAPI の説明 (本 PR に含む)。host 側 acceptance.md / packets.md の writeback は host で実施
- Closeout writeback expected: yes

## Guide Reachability (G645)

role-facing surface: なし (既存 API の応答への加算。新しい route・設定・文書の利用者向け面は増えない)。
guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
