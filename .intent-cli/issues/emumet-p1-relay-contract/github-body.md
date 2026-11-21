## Goal

Emumet が Profile の inbox で受けた Activity をホームの ShuttlePub へ転送するときの契約 (v1) を、Emumet の `docs/contracts/` に**写し**として置き、写しが正本と一致していること、および schema・fixture・署名ベクトル・P1 の受け手の検証・inbox の読み取りの規則が矛盾していないことを、CI で走るテストで確かめる。実装コード (鍵・link・キュー・inbox の変更) は書かない。

- 正本は host (`ShuttlePub/host`) の `intents/shuttlepub/contracts/emumet-post-relay/` にある 1 つだけ。Emumet の写しは host の commit・版・checksum を `post-relay-v1.snapshot.json` に持ち、独立に編集しない。
- 後続の単位 (K1 instance 鍵、L1 link、Q1 保存、S1 配送、I1 inbox 接続、T1 E2E) は、この契約と fixture を共通の基準として使う。

## Why This Slice Exists Now

P1 の 9 単位 (C0・K1・L1・Q1・S1・I1・A1・B1・T1) の計画が承認された。envelope の形・外側署名・受け手の検証・inbox の振り分け・上限の数値・lifecycle の規則が単位ごとにばらばらに実装されると、Emumet と ShuttlePub の受け手が食い違う。C0 で契約と検証用の fixture を先に固定し、K1 と L1 が並行して進める前提をそろえる。

## Current Observed State

- Emumet に内向き転送の契約・schema・fixture はない。`docs/` には container・登録ゲート・Profile 連合切替の文書だけがある。
- instance actor・instance 鍵・link・転送キューは未実装 (それぞれ K1・L1・Q1 以降)。Profile の inbox (`profile_inbox.rs`) は raw body を DTO で失い、Content-Type の完全一致と型付き Activity で拒否する。
- 契約の正本・決定は host に記録済み: `intents/shuttlepub/contracts/emumet-post-relay/` (v1 revision 1) と `intents/shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md` の D61〜D66。写しの元にする host commit は `cc19ad0887409601999e66b3f00fb8d0735ebfc3`。

## Accepted Baseline You May Assume

- 基準は origin/main の `1259c731af496bb09ae11286a9b869b132a88f4d` 以降の最新 main (実装開始時に取得し、PR に完全な SHA を書く)。
- 契約の本文・schema・fixture の内容は決定済みで、この PR では変えない。内容に誤りを見つけたら、host の正本を直す必要があるので PR に書いて親へ報告する (Emumet 側で直さない)。
- 契約の bounded な定数 (envelope 2 MiB、元本文 1 MiB、元ヘッダ 16 KiB、Date 許容差 ±300 秒、JSON 深さ 32、要素数 100000 など) は `post-relay-v1.constants.json` と `post-relay-v1.md` の表にある。
- CI の `Check server` は `cargo fmt --check`・`cargo clippy --all-targets -- -D warnings`・`cargo build`・`cargo test` を server で実行する。テストは DB・Ory・ネットワークを使わない。
- ローカルでは openssl の dev パッケージが要るため、リポジトリの flake (`nix develop`) の中で cargo を実行する。
- `ory/hydra/hydra.yml` の未コミット変更 (ユーザーのもの) は変更せず、PR に含めない。作業は専用の worktree で行う。
- マージは親の指示があるまでしない。

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `docs/contracts/, server/tests/post_relay_contract.rs, server/Cargo.toml, Cargo.lock`

Target part: host の契約 v1 の写し (`post-relay-v1.md`・`post-relay-v1.schema.json`・`post-relay-v1.constants.json`・`post-relay-v1-fixtures/`・`post-relay-v1.snapshot.json`・`README.md`) と、それを検証する `server/tests/post_relay_contract.rs`。`server/Cargo.toml` は dev-dependency への `jsonschema` (default-features = false) の追加だけ。

## In Scope

- host commit `cc19ad0887409601999e66b3f00fb8d0735ebfc3` の契約 v1 を `docs/contracts/` へ写す。ファイル名の対応は `post-relay-v1.snapshot.json` に書く (`v1.md` → `post-relay-v1.md`、`v1.schema.json` → `post-relay-v1.schema.json`、`v1.constants.json` → `post-relay-v1.constants.json`、`fixtures/` → `post-relay-v1-fixtures/`)。
- `post-relay-v1.snapshot.json`: host リポジトリ名、host commit、契約名・版・revision、各ファイルの host 上のパスと SHA-256。
- `docs/contracts/README.md`: 写しであること、独立に編集しないこと、正本の場所、更新の手順 (host を変えて commit → 写し直す)、テストの実行方法 (`nix develop` の中で `cargo test -p server --test post_relay_contract`)。
- `server/tests/post_relay_contract.rs`: 写しの一致、定数の一致、schema の検証、P1 の参照受け手 (link 台帳なし) による全 fixture の再現、外側署名のベクトル、再送の不変条件、元署名の再検証、inbox の読み取りの参照実装による fixture の再現。参照実装はこのテストの中だけにあり、本番コードではない。
- `server/Cargo.toml` の dev-dependency に `jsonschema`、`Cargo.lock` の対応する更新。

## Out Of Scope

- 実装コード (kernel・application・driver・server の `src/`)、migration、OpenAPI (`openapi.json`)、CI の workflow、`ory/hydra/hydra.yml`。
- instance 鍵 (K1)、link (L1)、キュー・保存 (Q1)、送信 worker (S1)、inbox の接続 (I1)、起動順 (B1)、E2E (T1)、login/consent の境界 (A1)、K2 (鍵のローテーション・失効)。
- ShuttlePub 本番の受信・重複除去・保存、DCR、P2 (link 状態の同期)、dev イメージの公開。GHCR への公開・タグの push・リリース。
- host の packet・intent・queue を Emumet に移すこと。契約の内容の変更 (正本は host)。

## Standalone Child Issue Contract

この issue の PR は、host の契約 v1 (commit `cc19ad0887409601999e66b3f00fb8d0735ebfc3`) を、変更せずに `docs/contracts/` へ写し、写しの checksum・版・host commit を `post-relay-v1.snapshot.json` に記録し、`server/tests/post_relay_contract.rs` で次を CI 上で確かめる: (1) 写しの各ファイルの SHA-256 が記録と一致し、記録にないファイルがない。(2) 文書の定数の表・constants ファイル・schema・fixture の境界値が一致する。(3) schema が有効で、P1 の正常な envelope が通り、不正なものが通らず、元本文 1 MiB と元ヘッダ 16 KiB の境界が守られる。(4) link の台帳を持たない参照受け手が、P1 の全 fixture について期待する status・reason を再現し、約 33 日前の `received_at` と新しい外側 Date の組を受理し、P2 の fixture は事前状態を明記して分離されている。(5) 外側署名のベクトル・再送 3 回 (本文と Digest が同一で Date と署名だけが違う)・envelope 内の元署名の再検証が通る。(6) inbox の読み取りの 65 件の fixture が参照読み取りの結果と一致する。実装コードは変更しない。

## Acceptance Criteria

- C0-1 写し: `docs/contracts/` に `post-relay-v1.md`・`post-relay-v1.schema.json`・`post-relay-v1.constants.json`・`post-relay-v1-fixtures/` (host の `fixtures/` 全体)・`post-relay-v1.snapshot.json`・`README.md` がある。写しの各ファイルは host の対応するファイルとバイト一致し、PR 本文にその確認方法と結果を書く。`post-relay-v1.snapshot.json` は host リポジトリ名・host commit (40 桁)・契約名と版 (`emumet-post-relay` v1 revision 1)・全ファイルの host 上のパスと SHA-256 を持つ。`README.md` は「独立に編集しない。host の正本を変えてから写し直す」を述べる。
- C0-2 テストの対象と実行: `server/tests/post_relay_contract.rs` が CI の `Check server` の `cargo test` で走る。DB・Ory・ネットワークを使わず、skip や `#[ignore]` を使わない。確認する内容は C0-3〜C0-8。
- C0-3 写しの一致: `snapshot.json` に書かれた全ファイルの SHA-256 を再計算して一致する。`docs/contracts/` にある `snapshot.json` と `README.md` 以外のファイルがすべて `snapshot.json` に載っている。`host_commit` は 40 桁の 16 進数。
- C0-4 定数の一致: `v1.md` の定数の表・`v1.constants.json`・`v1.schema.json` の上限 (raw_body、header の数と長さ、省略名の数、origin・URL・request_target の長さ、link_generation の上限、version) が一致する。fixture の境界の例 (envelope 2 MiB+1、Date 許容差 300 秒と 301 秒、inbox の深さ 32/33・要素数 100000/100001・本文 1 MiB/1 MiB+1・type 配列 16/17) が定数から導かれる値と一致する。
- C0-5 schema: schema 自体が検証でき、P1 の正常な envelope が通り、不正な envelope (必須欄の欠落・未知の欄・不正な Base64・不正な origin・evidence の不整合) が通らない。元本文ちょうど 1 MiB が通り、Base64 の 1 グループ超過が通らない。保存する元ヘッダの合計がちょうど 16 KiB なら通り、1 バイト超えると拒否される。
- C0-6 P1 検証が link 台帳なしで実行できる: テスト内の参照受け手 (`v1.md` §7 の手順 0〜7) が、link 台帳を入力に持たないまま、P1 の fixture (正常 9 件・拒否 22 件) のすべてについて期待する status・reason・再送の分類を再現する。P1 の fixture に「古い generation の拒否」や link 状態に依存する理由がない。約 33 日前の `received_at` と新しい外側 Date の組が受理される。P2 の fixture は事前状態 (link 台帳) を明記して `p2/` に分離され、P1 の参照受け手は P2 の envelope を受理する (P2 の規則が P1 に混ざっていない)。
- C0-7 署名と再送: 外側署名のベクトル (正常 3 件、Digest 不一致、別の鍵) が、Digest・署名対象文字列・RSA-2048/SHA-256 の署名で検証される。同じ envelope の再送 3 回 (初回・1 時間後の自動再送・約 33 日後の人手再配送) で、本文と Digest は同一で、Date と Signature だけが違い、期待どおりに受理される。envelope に保存した元の署名が、envelope 内の証拠だけで再検証できる。fixture に秘密鍵が含まれない。
- C0-8 inbox の読み取り: 65 件の fixture (転送・除外・拒否) が、テスト内の参照読み取り (`v1.md` §8) の結果と一致する。全階層の重複キー (unescape 後を含む)・type 配列・ID なし・MIME・不明参照の Undo/Accept/Reject の転送・既知参照だけの除外・先行 Undo の仮記録を証拠にしないことを含む。
- C0-9 範囲: 変更は Target paths の範囲に限る。実装コード・migration・`openapi.json`・CI の workflow・`ory/hydra/hydra.yml` を変更しない。`Cargo.toml` の変更は server の dev-dependency への `jsonschema` の追加だけ。`Cargo.lock` はそれに伴う更新に限り、PR 本文に差分の内訳 (追加された crate と、依存解決で上がった既存 crate) を書く。
- C0-10 CI: PR の CI (lint-and-test の Check kernel/application/server・Check driver・各 DB job・openapi-check・coverage、container-ci、PR で走る e2e) がすべて緑。PR は未マージ。PR 本文に、基準の完全な SHA、host commit、写しの一致の確認結果、実行したテストの結果、未検証の範囲を書く。

## Verification

`nix develop` の中で: `cargo fmt --check`、`cargo clippy -p server --all-targets -- -D warnings`、`cargo test -p server --test post_relay_contract` (全件 ok・skip なし)、`cargo test -p server` (既存テストに影響しないこと)、`git diff --check`。写しの一致は、host の checkout の契約 directory と `docs/contracts/` の対応するファイルを `cmp` で比べ、結果を PR 本文に書く。PR の CI (lint-and-test・container-ci) 全緑。

## Related Links

- 正本 (host): `intents/shuttlepub/contracts/emumet-post-relay/` (`v1.md`・`v1.schema.json`・`v1.constants.json`・`fixtures/`・`README.md`)、host commit `cc19ad0887409601999e66b3f00fb8d0735ebfc3`。
- 決定 (host): `intents/shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md` (D54・D61〜D66)、`intents/emumet/decisions/0003-delegated-signing.md` (2026-11-21 追記)、`intents/emumet/features/post-relay/decisions.md`。
- 後続: K1 (instance 鍵)・L1 (link)・Q1 (保存)・S1 (配送)・I1 (inbox 接続)・T1 (E2E) がこの契約を使う。K2 (鍵のローテーション・失効) は後続。

## Knowledge Maintenance

- Intent placement: host の `intents/shuttlepub/contracts/emumet-post-relay/README.md` (新規ノードは不要)
- ADR candidate: none (ADR 0003 への限定例外の追記は host で記録済み)
- Diagram candidate: none
- Docs update: Emumet の `docs/contracts/` (この PR で)
- Closeout writeback expected: no

## Guide Reachability (G645)

この slice は運用者・role 向けの新しい surface を追加しない (no role-facing surface)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.

## Additional Required Guidance

- durable state、packet、intent、queue の正本は ShuttlePub/host のみ。child は host 側の packet / intent / queue / ラベルを調査・変更しない。Emumet 側に親状態を作らない。
- ラベルを手で編集しない。`worker claim` が使えない場合は実装担当ではなくリードが claim を扱う。
- 親の指示なしにマージしない。GHCR への公開・タグの push・リリースはしない。
