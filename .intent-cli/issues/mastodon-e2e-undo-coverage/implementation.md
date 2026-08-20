# mastodon-e2e-undo-coverage Implementation Packet

## Goal

実 Mastodon サーバーとの E2E (`server/tests/e2e_ap_mastodon.rs`) に Undo(Follow) 相互運用
シナリオ (S10) を追加する。unfollow-api (PR #21) で実装した外向き Undo(Follow) 配送と、
既存の inbox 側 Undo(Follow) 受信処理の両方を、実 Mastodon 相手に CI で常時検証できる
状態にする。

## Why

2026-08-12 の C4 grill (interview/2026-08-12-c4-rest-api-mastodon-compat.md) で、
「疎通保証は Mastodon 実サーバーとの E2E を CI で常時検証するレベル (A)」が確定し、
S7-S9 の実装済みを実調査で確認した。同時に残余ギャップとして「CI の Mastodon E2E は
Undo(Follow) の相互運用をカバーしていない」ことが特定され、packet backlog #11 として
登録された。Undo(Follow) はフォロー系の取消しであり、ここが実機未検証のままだと
Mastodon との間でフォロー解除が反映されない退行を CI が検出できない。

## 設計ノート (2026-08-20 コード調査に基づく)

- **シナリオ配置**: `server/tests/e2e_ap_mastodon.rs` の単一テスト
  `mastodon_full_federation_scenario` (L45-) は S7 (Mastodon→Emumet Follow) /
  S8 (Emumet→Mastodon Follow) / S9 (署名付き Create/Note 配送) を結合実行する形式。
  S10 ステップは S9 の後に追加する。S7/S8 で双方向のフォロー関係が既に確立済みの
  ため、その両方向の解除をそのまま検証できる。Iceshrimp S10
  (`server/tests/e2e_ap_iceshrimp.rs` L295-343, Block/Undo(Block)) と同型の構成。
- **S10 の内容 (双方向)**:
  1. **Emumet→Mastodon**: `post_unfollow(jwt, account_nanoid, base_url, target)`
     (account_helper.rs L94, 既存) で Emumet ローカルユーザーが Mastodon actor を
     unfollow。204 を確認後、Mastodon 側 followers 一覧から Emumet actor が消えること
     (新ヘルパー `wait_for_mastodon_followers_absent`)、Emumet 側 following
     コレクションの totalItems が 0 に戻ること (`wait_for_emumet_collection_count`
     相当のポーリング) を検証。
  2. **Mastodon→Emumet**: Mastodon REST `POST /api/v1/accounts/{id}/unfollow` を叩く
     ため `MastodonClient` (server/tests/support/mastodon.rs) に
     `unfollow_account(account_id, token)` を新規追加 (既存 `follow_account` L219 の
     ミラー)。Mastodon が Emumet inbox へ Undo(Follow) を配送し、Emumet 側 followers
     コレクションの totalItems が 0 に戻ること (および Mastodon 側 following からの
     消失) を検証。
- **不足ヘルパー**: Mastodon 側の「followers/following から消えるまで待つ」ポーリング
  ヘルパーが存在しない (contains 系のみ)。`wait_for_iceshrimp_followers_absent`
  (server/tests/support/iceshrimp_setup.rs L249, 60 秒ポーリング) を型に
  `wait_for_mastodon_followers_absent` (必要なら `wait_for_mastodon_following_absent`
  も) を mastodon_setup.rs に追加する。
- **検証項目テンプレート**: mock peer 向け既存 E2E
  `outbound_unfollow_sends_undo_to_remote_inbox` (e2e_ap_mock.rs L168-222) が
  204/404/422 のステータス契約と Undo 配送検証の前例。実 Mastodon 相手では
  アクティビティの中身ではなく「相手側の関係一覧から消える」外部観測で検証する。
- **本スライスはテスト追加のみ**: 本体コード (application/, kernel/, server/src/) の
  変更は原則不要のはず。相互運用の失敗が本体バグに起因する場合は、PR 本文に再現手順と
  証跡 (ログ/レスポンス) を添えて報告し、修正は別スライスとする (本 PR で抱え込まない)。
- **番号体系**: Mastodon ファイルはヘッダで「S7-S9 equivalent」と番号を再利用して
  いる。新ステップは「S10 (Undo(Follow))」として README.md のシナリオ一覧表
  (L130-141) にも行を追加する (Iceshrimp S10 = Block/Undo(Block) とは別行)。

## Scope

- `server/tests/e2e_ap_mastodon.rs`: `mastodon_full_federation_scenario` に S10 ステップ
  (双方向 Undo(Follow)) 追加 + ファイルヘッダのシナリオ表記更新
- `server/tests/support/mastodon.rs`: `MastodonClient::unfollow_account` 追加
- `server/tests/support/mastodon_setup.rs`: `wait_for_mastodon_followers_absent`
  (必要に応じ `wait_for_mastodon_following_absent`) 追加
- `README.md`: シナリオ一覧に Mastodon S10 (Undo(Follow)) 行を追加

## Out of scope

- 本体コード (application/, kernel/, server/src/) の変更。本体バグが判明した場合は
  PR で報告し別スライス化する
- Mastodon 向け Undo(Block) / Accept / Reject / pending フォロー取り下げの E2E
- `e2e_ap_mock.rs` / `e2e_ap_iceshrimp.rs` の変更
- E2E ランナー (`e2e/run-ap-e2e.sh`) / CI (`.github/workflows/e2e.yml`) / compose の
  変更 (既存 section 13 が e2e_ap_mastodon を実行するため変更不要)

## Verification

- `bash e2e/run-ap-e2e.sh` がグリーン (CI `.github/workflows/e2e.yml` と同一経路。
  section 13 が e2e_ap_mastodon を `--ignored --test-threads=1` で実行)
- Mastodon 単体: `EMUMET_E2E_EXTERNAL_SERVER=1 cargo test -p server --test e2e_ap_mastodon -- --ignored --test-threads=1 --nocapture`
  (Mastodon コンテナ等の前提環境は run-ap-e2e.sh が用意)
- `cargo fmt --check` / `cargo clippy --workspace --all-targets -- -D warnings` クリーン
- `git diff --check` クリーン

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/emumet/features/ap-federation/overview.md` の関連スコープ
  「Mastodon 実機 E2E の Undo(Follow) カバレッジ追加」に直接対応。完了時に host 側で
  backlog #11 を完了へ移動し overview.md を更新 (host-only の closeout タスク)。
- ADR candidate: none (既存ハーネスへの追従のみで、逆転困難な決定なし)
- Diagram candidate: none
- Docs update: none (README.md のシナリオ表更新は child PR の in-scope 作業)
- Closeout learning: write_back_required: false。host 側の backlog/overview 更新は
  closeout 時に実施する。
- Guide reachability (G645): role-facing surface の追加なし
  (`no_role_facing_surface: true`)。テストのみのスライス。

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
