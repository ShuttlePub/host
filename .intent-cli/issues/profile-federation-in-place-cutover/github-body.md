## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

旧 Account 単位の連合データだけを in-place で初期化し、Profile 単位の actor・Follow 関係・配送を本番へ切り替える。P2 の初期化 SQL と新関係・配送テーブルを本番 migration として採番・配置し、新 Profile 鍵を一回限りで生成し、本番 root router に Profile route・WebFinger・inbox を mount、旧 /ap/accounts/... と署名 API を廃止、新配送 worker を起動し、username を必須化し、E2E (mock peer・Iceshrimp・Mastodon) を新 Profile モデルで成功させる。旧 identity の保存・互換 Follow API・Move・無停止移行・DB 全消去は行わない。マージと本番切替の前にユーザー確認を得る。

## Why This Slice Exists Now

P1〜P3 の新機構は本番 root router 未接続のまま、稼働する actor・保存モデルは常に一種類という方針で積み上げられてきた。本 unit がそれを一括で切り替える唯一の unit で、D8R (block の関係解除) と F8 (UI の実 Emumet 接続) の前提になる。破壊的操作を含むため、対象限定・一回限り・停止手順・ユーザー確認ゲートで安全側に倒す。

## Current Observed State

- 本番は Account 単位の連合 (actor /ap/accounts/{id}、Account 鍵 signing_keys、/internal/v1/accounts/{id}/sign と .../public-key、Account 単位の follows/blocks/mutes/remote_accounts/outbox_activities)。Profile 単位の actor・関係・配送は実装されても本番 root router 未接続
- P2 の schema と旧連合データ初期化 SQL は隔離 DB 用 fixture (driver/fixtures/profile_social_graph/) にあり、本番 migrations/ には未配置。D8P の migration は本番に配置済み
- P1 (PR #78) はレビュー修正中、P3o (Emumet#74)・P3i (Emumet#75)・FN (shuttlepub-frontends#34) は実装中/未マージ。本 unit の着手・マージは全てのマージ後
- E2E (e2e.yml・run-ap-e2e.sh・server/tests/e2e_ap_*.rs) は旧 Account モデルと旧署名 endpoint を前提にしている

## Accepted Baseline You May Assume

- durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
- 確定済みの先行 unit: E8 (Emumet#66 / PR #70、squash 0bfa437)。P2 (Emumet#72 / PR #77、squash f523b86): 保存モデル・共通 enqueue interface・配送 worker 向け port・初期化対象/非対象一覧は host の PF acceptance.md『P2 確定契約』が正本。D8P (Emumet#73 / PR #76、squash b3e87f2): domain 正規化・tombstone revision・所有者認可・照合関数 FindDomainControlForActorUseCase (検証済み canonical actor ID の host と完全一致) は host の DC acceptance.md『D8P 確定契約』が正本で、domain-controls route は本番未 mount。P1 (Emumet#71 / PR #78) はレビュー修正中で、actor URL は {PUBLIC_BASE_URL}/ap/profiles/{nanoid}、Profile 鍵は新テーブル profile_signing_keys、本番 router 構築を server/src/root_router.rs に切り出す (確定形は P1 closeout で PF に記録される。P1 マージ前は PR #78 と Emumet#71 の契約に合わせ、曖昧なら issue で質問する)。P3o (Emumet#74)・P3i (Emumet#75)・FN (shuttlepub-frontends#34) は実装中または未マージ
- migration の分担 (親判断、2026-11-10): P1・D8P の非破壊の追加 migration (列・テーブル・index) は通常の migrations/ に置き本番適用してよい (D8P の 20260920000001_profile_domain_controls.sql は既に本番 migrations/ にある)。P4 (profile-federation-in-place-cutover) が所有するのは、旧連合データ初期化などの破壊的 migration と、P2 の新関係・配送テーブルの本番採番・配置 (driver/fixtures/profile_social_graph/ の 01 schema・02 reset)
- 方式は in-place reset (ADR intents/emumet/decisions/profile-federation-in-place-reset.md、host で新設済み): 旧連合データを新モデルへ変換・コピー・dual-write せず、対象を限定した versioned SQL で初期化して同じ DB を Profile モデルへ切り替える。専用の移行フレームワークは作らない。旧新の同時公開・機能フラグによる旧新切替・旧 identity の保存・互換 Follow API・Move/リダイレクト・無停止移行・DB 全消去は行わない。新運用開始後の旧モデルへの逆変換は保証しない
- 初期化対象 (P2 の driver/fixtures/profile_social_graph/02_reset_legacy_federation.sql、TRUNCATE TABLE で明示列挙・CASCADE なし): follows, blocks, mutes, remote_accounts, outbox_activities, signing_keys (旧 Account 連合鍵)。非対象 (保持): auth_hosts, auth_accounts, auth_emumet_accounts, accounts, profiles, metadatas, images, organization_members, profile_transfer_requests (+events), account_events, profile_events, metadata_events, account_report_events, account_reports, registration_gate_*, projection_checkpoints, profile_domain_controls (D8P), 新モデル (profile_follows 等) の全テーブル、P1 の username 列・profile_signing_keys。対象を参照する外部キーが非対象にあれば TRUNCATE は失敗させる (黙って巻き込まない)。失敗時は全体 rollback で台帳も残らない。この SQL と台帳テーブル profile_federation_resets (legacy-account-federation-v1 を確認と消去を同一 transaction で行う) をそのまま本番 migration にする
- 一回限り・再実行防止: 台帳により再実行しても再消去しない (初期化後に作られたデータは消えない)。新 Profile 鍵の生成も一回限りで、鍵を持たない Profile にだけ生成し既存鍵を再生成・上書きしない。保存先は P1 の profile_signing_keys。旧 signing_keys からの鍵変換はしない。生成のタイミング (migration 内・切替手順の初期化ステップ・初回アクセス時) は P4 が決めるが、切替後に鍵のない Profile が存在してはならない
- 署名: 公開鍵は新 actor 文書 ({PUBLIC_BASE_URL}/ap/profiles/{nanoid}) から取得させる。汎用 Profile 署名 REST API を代替として追加しない (署名は配送 worker 内の内部処理に限る。ADR 0003 の鍵所有境界を保つ)
- 現状の旧 route (server/src/main.rs と route.rs で組み立て): /ap/accounts/{account_id} (+ /inbox /outbox /followers /following、route_federation)、/.well-known/webfinger (Account 基準、route_activitypub)、/internal/v1/accounts/{id}/sign と .../public-key (server/src/route/signing.rs)、Account 単位の /api/v1/accounts/{account_id}/follow・unfollow・followers・following・block・unblock・blocks・mute・unmute・mutes (server/src/route/account/)。撤去対象の最終一覧は実装時にコードで確認して closeout に記録する。Account 管理 API (作成・取得・更新・無効化等) は維持する
- 旧 /ap/accounts/... は廃止応答 (新 actor へ redirect しない。旧 identity を引き継がない決定 q14)。/internal/v1/accounts/{id}/sign と .../public-key は廃止し、正当な認証でも署名・旧鍵取得ができない
- E2E: .github/workflows/e2e.yml → e2e/run-ap-e2e.sh (compose.ap-e2e.yml、mock peer・Iceshrimp・Mastodon) と server/tests/e2e_ap_mock.rs・e2e_ap_iceshrimp.rs・e2e_ap_mastodon.rs・e2e_basic_flow.rs。Iceshrimp/Mastodon の E2E は現在 /internal/v1/accounts/{id}/sign を使って署名しているため、旧署名 endpoint を使わない fixture (Profile 鍵・配送 worker・新 actor) に更新する。E2E の削除・skip・ignore による回避は不可
- 本番共有 router の検査 (E8/D8P からの持ち越し): 本番と検査が共有する router 構築 (P1 が切り出す server/src/root_router.rs) 上で、mount すべき route が存在し、撤去した旧 route が存在しない (廃止応答) ことを検査する。main.rs の文字列検査やテスト専用 router に頼らない
- route の mount 範囲: P4 は P1/P3i/P3o 由来の Profile actor・WebFinger・inbox・Profile 単位の Follow/個別 block/mute route と E8 の Profile identity route を本番 root router に mount し、旧 route を撤去し、新配送 worker を起動する。domain-controls route (D8P 実装済み・未 mount) は、block 書込を D8R が有効化するまで本番で受け付けない (block を保存するだけで関係解除をしない中途状態を作らない)。mute のみ先行公開するか domain-controls 全体を D8R まで未 mount とするかは未決であり、既定は全体を未 mount のまま維持する。変更したい場合は実装前に issue で質問する
- username 必須化: POST /api/v1/accounts の profile_username と POST /api/v1/profiles の username の省略を validation error にし、OpenAPI も required に変更する (副作用前に拒否)。切替前に全既存 Profile の username が設定済みであることを確認し、未設定が 1 件でも残れば切替を拒否する (migration の前提検査で abort する方式が自然。実装は P4 が選ぶ)。DB の NOT NULL 化は未設定ゼロ確認後に P4 が判断する
- 切替手順の制約: 旧 inbox・Account 単位の関係書込・旧配送 worker が停止している状態で切り替える (migrations/ は起動時に自動適用されるため、旧プロセスを停止してから新バイナリを起動する。新バイナリの起動が破壊的 migration の実行トリガになる)。破壊的 migration と P2 schema 適用 → 新 Profile 鍵の一回限り生成 → root router・worker 切替 → スモーク確認の順。手順は runbook として child 側に残す
- 【ユーザー確認ゲート】P4 のマージと本番切替は不可逆な初期化を含むため、実行前に必ずユーザー (operator) の確認を得る。確認はこの issue 上で lane root がリードへ質問して取得し、確認が取れるまで PR をマージせず、本番へ切り替えない (実装・テスト・レビューまでは確認前に進めてよい)。確認結果は issue 上に記録する
- 共有ファイル (server/src/openapi.rs, route.rs, main.rs, root_router.rs, DI wiring, migrations/, openapi.json) は他レーンと競合する。共有ファイルの統合は一件ずつ行い、その時点の main から OpenAPI を再生成する (openapi_spec_matches_committed_file を通す)
- 検証は DATABASE_URL を設定した実 DB テストで行う。DB テストを skip のみで通過させない (test_with::env による skip は検証として数えない)
- username 仕様 (E8 で確定): 形式 ^[a-z0-9][a-z0-9._-]{0,63}$ (ASCII 小文字 1〜64 文字)、暗黙の trim・小文字化なし。予約語 admin, administrator, root, system, support, security, moderator, api, ap, auth, oauth, oauth2, login, logout, register, settings, well-known。DB 一意・削除済み再利用なし・Account 名から自動導出しない。段階: E8/P1〜P3 optional → FN で UI 必須送信 → P4 で required
- D08 ユーザー決定 (grill d08-q01〜q15): Profile 単位、完全一致 domain のみ、mute は表示抑制のみ、block は双方向 Follow 解除＋新規操作拒否 (解除しても関係復元なし)、AP Block は送らない (フォロー解除に必要な最小限の通知のみ)、旧連合 identity は引き継がず新 Profile actor から開始 (旧連合データのみ初期化、DB 全消去ではない)、username は Profile ごとに一意・一度決めたら不変・移管後も維持

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`
Path: migrations/ (破壊的 migration と P2 の新関係・配送テーブルの本番採番・配置), driver/ (Profile 鍵の一回限り生成), application/src/ と server/src/route/account/ (旧 Account 単位 Follow/block/mute 操作の撤去。Account 管理 API は維持), server/src/ (root_router.rs・main.rs・route/ の mount と旧 route 撤去、旧 /ap/accounts/... と /internal/v1/accounts/{id}/sign・.../public-key の廃止、新配送 worker 起動、username required 化), openapi.json, server/tests/e2e_ap_*.rs・server/tests/e2e_basic_flow.rs・server/tests/support/, .github/workflows/e2e.yml, e2e/run-ap-e2e.sh, compose.ap-e2e.yml, 切替 runbook
Part: 旧 Account 単位の連合データを in-place で初期化し、Profile 単位の actor・関係・配送を本番へ切り替える (破壊的 SQL の本番 migration 化、新 Profile 鍵の一回限り生成、root router/worker 切替、旧 route・署名 API の廃止、username 必須化、E2E の新モデル化)

## In Scope

- P2 の初期化 SQL (対象限定・CASCADE なし) と台帳 profile_federation_resets、P2 の新関係・配送テーブル schema の本番 migration 化 (採番・配置)
- 旧連合鍵・関係・配送状態の初期化 (一回限り・再実行しても再消去しない) と、新 Profile 鍵の一回限り生成
- 切替前提検査 (全 Profile の username 設定済み。未設定が残れば切替拒否)
- 本番 root router (server/src/root_router.rs) への Profile route・WebFinger・inbox・Profile 単位 Follow/個別 block/mute route の mount、旧 route 撤去、新配送 worker の起動
- /ap/accounts/... の廃止応答、/internal/v1/accounts/{id}/sign・.../public-key の廃止、Account 単位の旧 Follow/block/mute 操作経路の廃止 (Account 管理 API は維持)
- username 必須化 (作成 API の省略は validation error、OpenAPI required)
- .github/workflows/e2e.yml・e2e/run-ap-e2e.sh・server/tests/e2e_ap_*.rs の新 Profile モデル化
- 切替 runbook (停止・起動順・スモーク) と、本番共有 router 上の mount/未 mount 検査

## Out Of Scope

- 旧連合 identity の保存・変換・コピー・dual-write、互換 Follow API、Move/リダイレクト、無停止移行、DB 全消去、新運用開始後の逆変換
- domain 方針の Follow への適用 (D8G) と block 設定時の関係解除・domain-controls の block 書込有効化 (D8R)。domain-controls route の本番 mount 方針は上記 baseline のとおり (既定は未 mount のまま)
- 投稿 Activity の認可・実受理 (ShuttlePub の後続責務)、UI (FN/F8)
- 新しい汎用 Profile 署名 REST API

## Standalone Child Issue Contract

旧 Account 単位の連合データだけを in-place で初期化し、Profile 単位の actor・Follow 関係・配送を本番へ切り替える。P2 の初期化 SQL と新関係・配送テーブルを本番 migration として採番・配置し、新 Profile 鍵を一回限りで生成し、本番 root router に Profile route・WebFinger・inbox を mount、旧 /ap/accounts/... と署名 API を廃止、新配送 worker を起動し、username を必須化し、E2E (mock peer・Iceshrimp・Mastodon) を新 Profile モデルで成功させる。旧 identity の保存・互換 Follow API・Move・無停止移行・DB 全消去は行わない。マージと本番切替の前にユーザー確認を得る。 本 PR は、旧 Account 単位の連合データのみを初期化して Profile 単位の連合を本番へ切り替える。受け入れ条件の 14 項目と ADR profile-federation-in-place-reset.md の方針 (対象限定・CASCADE 禁止・一回限り・停止して切替・逆変換非保証) を満たし、E2E を削除・skip せず新モデルで成功させる。ユーザー確認を得る前にマージ・本番切替をしない。

## Acceptance Criteria

1. 切替前提: FN (profile-identity-web-adaptation) がマージ済みで、全既存 Profile の username が設定済みであることを確認する。未設定が 1 件でも残っていれば切替 (破壊的 migration) を拒否し、何も変更しない
2. 旧 inbox・Account 単位の関係書込・旧配送 worker を停止した状態で切り替える手順が runbook (停止→migration→鍵生成→起動→スモーク) として定義され、手順どおりの実 DB 切替リハーサルで検証される
3. 非対象データ (AuthAccount, Account, Profile, 組織 membership, イベント履歴, 全体モデレーション, registration_gate, domain controls 等) が切替後も保持される (全テーブルの行数・内容 hash の前後照合)。初期化対象は空になる。再実行しても再消去・鍵再生成が起きず、初期化後に作られたデータは消えない
4. 旧 /ap/accounts/... は廃止応答を返し、新 actor へ redirect しない
5. /internal/v1/accounts/{id}/sign と .../public-key は廃止され、正当な認証でも署名・旧鍵取得ができない (OpenAPI からも除去)
6. Profile の公開鍵は新 actor 文書から取得でき、新 Profile 鍵が全 Profile に一回限り生成される。汎用 Profile 署名 API を代替として追加しない
7. Account 単位の旧 Follow/unfollow/block/mute 操作経路が廃止され、Profile 単位 API に置き換わる。Account 管理 API は維持される
8. .github/workflows/e2e.yml と e2e/run-ap-e2e.sh の mock peer・Iceshrimp・Mastodon E2E が、削除・skip なしで新 Profile モデル (旧署名 endpoint を使わない fixture) で成功する
9. 本番共有 router (root_router.rs) 上で、mount した route の存在と撤去した旧 route の不在 (廃止応答) が検査される。domain-controls の block 書込が本番で受け付けられないことも検査される
10. username が作成 API で必須になる (省略は validation error、OpenAPI は required)。許可 username 文字種 (E8 の形式・予約語) が WebFinger・actor・E2E (Mastodon/Iceshrimp) でも通る
11. 移行前 fixture→移行後 DB、署名付き Follow、個別 block/mute、Profile 移管後の identity (username・actor URI・鍵・関係) 維持が実 DB で検証される
12. ユーザー確認ゲート: ユーザー確認を得る前に PR をマージせず、本番切替をしない。確認の記録が issue 上にある
13. ADR profile-federation-in-place-reset.md の Open 項目 (最終 migration 番号、鍵生成の方式、前提検査の方式、旧 route 撤去の最終一覧、runbook) を closeout で write-back できる材料が揃っている
14. openapi.json は最新 main から再生成し openapi_spec_matches_committed_file が通る。既存 Rust CI と E2E が通る

## Verification

実 DB (DATABASE_URL 必須、skip のみ不可) での、移行前 fixture→移行後 DB の全テーブル行数・内容 hash 前後照合、再実行 (再消去・鍵再生成なし)、username 未設定での切替拒否、依存テーブルがある場合の rollback、署名付き Follow・WebFinger・actor 文書・個別 block/mute、Profile 移管後の identity 維持、許可 username 文字種。本番共有 router (root_router.rs) 上の mount/廃止応答/未 mount 検査。mock peer・Iceshrimp・Mastodon E2E (e2e.yml / run-ap-e2e.sh) が新モデルで成功。openapi 再生成。cargo fmt / clippy / test。

## Related Links

- host: intents/emumet/features/profile-federation/ (primary)、intents/emumet/features/personal-domain-controls/、intents/emumet/decisions/profile-federation-in-place-reset.md (ADR)、intents/shuttlepub/packets/candidates.md (D08)
- Emumet ADR 0002 / 0003 / 0007、profile-actor-identity ADR
- E8: Emumet#66 / PR #70、P1: Emumet#71 / PR #78、P2: Emumet#72 / PR #77、D8P: Emumet#73 / PR #76、P3o: Emumet#74、P3i: Emumet#75、FN: shuttlepub-frontends#34

## Dependencies

profile-actor-identity-foundation、profile-social-graph-storage、profile-relationship-outbound、profile-relationship-inbound、profile-identity-web-adaptation

## Merge Order

P1 (Emumet#71)・P3o (Emumet#74)・P3i (Emumet#75)・FN (shuttlepub-frontends#34、全既存 Profile の username 設定確認を含む) の全マージ後に着手・マージする (P2 はマージ済み)。マージと本番切替の前に必ずユーザー確認を得る。後続の D8R (domain-controls block 書込の有効化) は本 unit のマージ後。共有ファイルの統合は一件ずつ、その時点の main から OpenAPI を再生成する。

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/profile-federation/overview.md (primary)。supporting: intents/emumet/features/personal-domain-controls/overview.md、intents/emumet/features/ap-federation/overview.md、intents/emumet/features/block-mute/overview.md、intents/shuttlepub/packets/candidates.md ほか`
- ADR candidate: 新設済み: intents/emumet/decisions/profile-federation-in-place-reset.md (初期化対象・旧 API 廃止・切替手順・再実行防止・逆変換非保証)。実装確定値を closeout で write-back
- Diagram candidate: なし
- Docs update: P4 の確定契約を PF acceptance.md に記録し、ADR の Open 項目を write-back する
- Closeout writeback expected: yes — 破壊的 migration の最終番号と配置、新 Profile 鍵の生成方式と冪等性、前提検査の方式、旧 route 撤去の最終一覧と廃止応答の形、切替 runbook、E2E 更新で得た落とし穴、ユーザー確認の記録場所 (host の `intents/emumet/features/profile-federation/packets.md`、`intents/emumet/features/profile-federation/acceptance.md`、`intents/emumet/decisions/profile-federation-in-place-reset.md` へ。host 更新は親が行う)

## Guide Reachability (G645)

implementation-loop ガイド (host) → implementation ロール → Emumet server の本番 root router と migration・切替 runbook (ShuttlePub/Emumet)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
