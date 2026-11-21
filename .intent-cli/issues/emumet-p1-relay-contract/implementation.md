# emumet-p1-relay-contract Implementation Packet

## Goal

Emumet の内向き転送の契約 v1 (envelope・外側署名・受け手の検証・inbox の読み取りと振り分け・定数・fixture) を、host の正本から Emumet の `docs/contracts/` へ写し、写しの一致と契約内部の整合を CI のテスト (`server/tests/post_relay_contract.rs`) で確かめる。実装コードは書かない。後続の P1 単位 (K1・L1・Q1・S1・I1・T1) の共通の基準になる。

## Why

P1 の 9 単位の計画 (第 3 版) が承認され、契約を先に固定して K1・L1 を並行させる順序になった。契約の置き場所は host の `intents/shuttlepub/contracts/emumet-post-relay/` (D61)、決定は D61〜D66 に記録済み (host commit `cc19ad0887409601999e66b3f00fb8d0735ebfc3`)。

## Scope

- 詳細と受け入れ基準 C0-1〜C0-10 は GitHub issue 本文 (`github-body.md`) を正とする。
- 変更は `docs/contracts/` (写し・snapshot.json・README.md)、`server/tests/post_relay_contract.rs`、`server/Cargo.toml` の dev-dependency (`jsonschema`)、`Cargo.lock` に限る。
- 写しは host と一致させる。テストの参照受け手・参照読み取りはテスト内だけに置く。

## Out of scope

- 実装コード・migration・OpenAPI・workflow・`ory/hydra/hydra.yml`、他の P1 単位 (K1・L1・Q1・S1・I1・A1・B1・T1)、K2、P2、DCR、dev イメージ公開、GHCR 公開・タグ・リリース。
- 契約の内容の変更 (正本は host。誤りは報告して host を直す)。

## Verification

`nix develop` の中で `cargo fmt --check`、`cargo clippy -p server --all-targets -- -D warnings`、`cargo test -p server --test post_relay_contract`、写しと host の `cmp`、`git diff --check`、PR の CI 全緑。

## Knowledge Maintenance (G461)

- Intent placement: host の `intents/shuttlepub/contracts/emumet-post-relay/README.md` (新規ノード不要)。
- ADR candidate: none (ADR 0003 の限定例外は host commit `cc19ad0` で追記済み)。
- Diagram candidate: none。
- Docs update: Emumet の `docs/contracts/` (この PR で)。
- Closeout learning: 写しの検証で見つかった契約の曖昧さ、fixture 再生成の運用 (鍵が変わる)、後続単位が使った節と fixture。`write_back_required: false`。
- Guide reachability (G645): `no_role_facing_surface: true`。
