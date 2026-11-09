# profile-domain-policy-api-contract Implementation Packet

> **親状態の注記**: durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

D08 (個人単位の domain block/mute) と Profile 単位 federation 移行の第一歩として、Profile identity・Follow・個別 block/mute・domain-controls の認可・revision・エラーを **OpenAPI 契約として確定**し、`username` の段階移行 (optional・未実装エラー) を契約に明記する。

## Why

後続 unit (P1 username 実保存、P2 保存モデル、D8P domain 方針保存、ShuttlePub S8 の投稿抑制契約、frontends FN/F8) が同じ契約を参照して並行できるようにする。実処理を含めず契約だけを先に固定する。

## Scope

- Profile identity / Follow / 個別 block・mute / domain-controls (Profile × 完全一致 domain の mute・block の取得・設定・解除) の route・schema・認可 (現在の所有者のみ)・revision (競合 409)・エラーを OpenAPI に定義
- `POST /api/v1/accounts` の `profile_username`、Profile 作成 (`POST /api/v1/profiles`) の `username` を optional で追加
  - 指定時は形式 `^[a-z0-9][a-z0-9._-]{0,63}$` と予約語 (admin, administrator, root, system, support, security, moderator, api, ap, auth, oauth, oauth2, login, logout, register, settings, well-known) を検証 (暗黙の trim・小文字化なし)
  - 保存未実装の間は **作成副作用 (Account/Profile/イベント作成) の前に** 明示的な未実装エラーを返す。指定値を黙って無視しない
  - 省略した旧 payload は従来どおり動作
- Profile の読取表現で username の未設定を表現可能にする
- 将来用の Profile actor・関係・domain-controls route は本番未 mount であることを schema/route 説明文に記載
- `openapi.json` 再生成、contract test (旧作成 payload・新 payload・未実装エラーが副作用なし)

## Out of scope

- 新しい関係処理・domain 方針保存・username 保存の実装 (P1/P2/P3o/P3i/D8P/D8G/D8R)
- 本番 root router への新 route mount、配送 worker 起動 (P4)
- username 更新 API (通常の編集機能としては設けない。一回限り設定は P1)
- ShuttlePub 側の投稿受理・送信拒否・表示 filter (ShuttlePub の後続責務)
- 共有ファイルの他レーン変更 (D15 E15a) の取り込み作業そのもの

## Username の段階移行 (契約)

| 段階 | 作成 API |
|---|---|
| E8 (本 unit) | optional。指定時は検証し、保存未実装なら作成副作用前に明示エラー |
| P1〜P3 | optional のまま保存 |
| FN | 新 UI は必ず送信 |
| P4 以後 | required (OpenAPI も required)。省略は validation error |

一意性は DB で保証 (P1)。削除済み再利用なし。Account 名から自動導出しない。外部 ID は nanoid。

## Verification

- `openapi.json` 再生成後、`openapi_spec_matches_committed_file` が通る
- contract test: 旧作成 payload / username 付き新 payload / 形式・予約語違反 / 未実装エラー時に Account・Profile が作られない
- 既存 Rust CI (cargo fmt / clippy / test) が通る

## Merge order

共有ファイル (`server/src/openapi.rs`, `route.rs`, `main.rs`, DI, `migrations/`, `openapi.json`) は D15 の E15a `registration-gate-control-plane` のマージ後に main へ rebase し、`openapi.json` を再生成してからマージする。

## Knowledge Maintenance (G461)

- Intent placement: `intents/emumet/features/personal-domain-controls/overview.md` (primary、host で新設済み)。supporting は PF・candidates.md D08 節・I08・grill 記録・Emumet ADR 0002/0003/0007・ap-federation/block-mute
- ADR candidate: なし (username/Profile 移行の ADR は P1/P4 の unit で新設)
- Diagram candidate: なし (依存図は DC/PF の packets.md)
- Docs update: DC acceptance.md に契約・検証境界を記録済み。実装 PR の差分に応じて追記
- Closeout writeback expected: yes — username 段階移行と未実装エラーの確定形、本番未 mount route の OpenAPI 表現 (host の DC/PF packets.md へ。host 更新は親が行う)
