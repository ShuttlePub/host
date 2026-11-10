# personal-domain-controls — packets

> 親状態（durable state・packet・intent・queue の正本）は ShuttlePub/host のみ。
> domain `emumet`、target `ShuttlePub/Emumet`（明記のあるものを除く）。
> 共通 `intent_placement`: primary は本 feature（DC）。supporting に
> [PF](../profile-federation/overview.md)・`intents/shuttlepub/packets/candidates.md` D08 節・
> `intents/shuttlepub/product/social-experience.md` I08・grill 記録・Emumet ADR 0002/0003/0007・既存 ap-federation/block-mute 要求。

## Execution units

| # | unit | 概要 | 依存 | 状態 |
|---|---|---|---|---|
| E8 | `profile-domain-policy-api-contract` | Profile identity・Follow・個別 block/mute・domain-controls の認可・revision・エラーの OpenAPI 契約。username 段階移行を OpenAPI へ明記。実装は含まない | なし（共有ファイルの merge 順は E15a の後） | **queue 登録済み・issue 公開済み**（[Emumet#66](https://github.com/ShuttlePub/Emumet/issues/66)、2026-11-10。packet: `.intent-cli/issues/profile-domain-policy-api-contract/`） |
| D8P | `profile-domain-policy-storage` | Profile × 正規化 domain の mute/block 実保存・取得・更新・削除、revision、現在の所有者による認可。block 書込 route は D8R まで本番未 mount（packet では mute/block とも本番未 mount で統一。mute のみ先行公開するかは未決） | E8 | **queue 登録済み・issue 公開済み**（[Emumet#73](https://github.com/ShuttlePub/Emumet/issues/73)、2026-11-10。packet: `.intent-cli/issues/profile-domain-policy-storage/`）。E8（Emumet#66 / PR #70）のマージ後に実装マージ |
| D8G | `profile-domain-follow-guards` | inbound/outbound 新規 Follow 拒否、古い Accept 反映防止、未送信 Follow/Accept の配送前判定。既存関係の一括解除・投稿操作拒否は含まない | P3o, P3i, D8P（P4 前でも隔離 fixture で検証可） | 未 packet 化 |
| D8R | `profile-domain-block-detach` | block 設定、following/follower 両方向解除、不要 job 取消、最小通知予約の原子的実行と公開 API 接続。復元・AP Block・投稿操作制御は含まない | D8G, P4 | 未 packet 化 |
| F8 | `personal-domain-controls-web-ui` | domain mute/block 設定、解除時非復元の説明、実 Emumet 接続、投稿表示面の S8 準拠 mock。**domain `shuttlepub` / target `ShuttlePub/shuttlepub-frontends`** | F0, FA, E8, S8, D8R（mock 部分は E8/S8 確定後に先行可） | 未 packet 化（shuttlepub 側 unit） |

PF 側 unit（P1〜P4、FN）は [profile-federation/packets.md](../profile-federation/packets.md)。
ShuttlePub 側 S8（`personal-domain-content-api-contract`、E8 に依存）は shuttlepub domain の unit。

## 依存図

```text
E8 ─┬→ P1 ─┬→ P3o ─┐
    │      ├→ P3i ─┤
    │      └→ FN ──┤
    ├→ P2 ─→ P3o/P3i   └→ P4 ─┐
    ├→ D8P ─┐                 │
    │  P3o/P3i ┴→ D8G ───────┴→ D8R ──┐
    └→ S8 (shuttlepub) ───────────────┴→ F8  (+ F0, FA)
```

- D8G は P4 前でも隔離 fixture で検証可能だが、D8R は P4 が必須。
- F8 の mock 実装開始と、実接続を含む最終受け入れは区別する。

## D08 到達範囲（unit 分割後の整理）

| 範囲 | 状態 |
|---|---|
| Emumet の Follow 制御（D8P/D8G/D8R） | 未実装。queue 登録済みは E8（契約）と D8P（domain 方針の保存）のみ。D8G/D8R は未 packet 化 |
| ShuttlePub の投稿・通知・検索 filter、新規反応・返信・引用・リポスト受理／送信拒否 | 未実装・後続 unit（S8 は契約のみ） |
| frontends UI（F8） | 未 packet 化 |

D08 全体は ready／完了ではない。queue 登録対象は E8 と D8P（および PF 側 P1・P2）の範囲だけで、実処理は後続 unit で段階的に進める。

## queue 登録の記録

- E8 `profile-domain-policy-api-contract`: 2026-11-10 に queue 登録・issue 公開（[ShuttlePub/Emumet#66](https://github.com/ShuttlePub/Emumet/issues/66)、`intent-target` 適用）。範囲は API 契約のみ。共有ファイルの merge 順は E15a（Emumet#65）の後。
- D8P `profile-domain-policy-storage`: 2026-11-10 に queue 登録・issue 公開（[ShuttlePub/Emumet#73](https://github.com/ShuttlePub/Emumet/issues/73)、`intent-target` 適用）。依存 E8。範囲は domain 方針の実保存・revision・所有者認可で、Follow への適用・投稿 filter は含まない。domain-controls route は本番 root へ mount しない（計画上は block 書込のみ D8R まで未 mount だが、packet では判断に迷うため mute/block とも未 mount で統一。mute のみの先行公開は別途判断）。PF 側 P1 `profile-actor-identity-foundation`（[Emumet#71](https://github.com/ShuttlePub/Emumet/issues/71)）・P2 `profile-social-graph-storage`（[Emumet#72](https://github.com/ShuttlePub/Emumet/issues/72)）も同日 queue 登録・issue 公開済み（[PF packets](../profile-federation/packets.md)）。
- D8G・D8R・F8 と PF 側 P3o・P3i・P4・FN は未 packet 化。D08 全体は ready／完了ではない。

## UI 実装の前提（ユーザー指示）

- **F8 の画面構成（domain mute/block 設定画面、解除時非復元の説明、投稿表示面）を決める UI 実装は、モック合意まで保留する。**
  「画面構成はモック合意後に実装」を前提に packet 化する。BFF・REST 変換など画面構成に依存しない部分のみ先行可。
- 上記の F8 行の「mock 部分は E8/S8 確定後に先行可」は、画面構成のモック合意が済んだ後の実装を指す。
