# personal-domain-controls — packets

> 親状態（durable state・packet・intent・queue の正本）は ShuttlePub/host のみ。
> domain `emumet`、target `ShuttlePub/Emumet`（明記のあるものを除く）。
> 共通 `intent_placement`: primary は本 feature（DC）。supporting に
> [PF](../profile-federation/overview.md)・`intents/shuttlepub/packets/candidates.md` D08 節・
> `intents/shuttlepub/product/social-experience.md` I08・grill 記録・Emumet ADR 0002/0003/0007・既存 ap-federation/block-mute 要求。

## Execution units

| # | unit | 概要 | 依存 | 状態 |
|---|---|---|---|---|
| E8 | `profile-domain-policy-api-contract` | Profile identity・Follow・個別 block/mute・domain-controls の認可・revision・エラーの OpenAPI 契約。username 段階移行を OpenAPI へ明記。実装は含まない | なし（共有ファイルの merge 順は E15a の後） | **マージ済み**（[Emumet#66](https://github.com/ShuttlePub/Emumet/issues/66) / [PR #70](https://github.com/ShuttlePub/Emumet/pull/70)、squash `0bfa437`、2026-11-10。queue completed。packet: `.intent-cli/issues/profile-domain-policy-api-contract/`） |
| D8P | `profile-domain-policy-storage` | Profile × 正規化 domain の mute/block 実保存・取得・更新・削除、revision、現在の所有者による認可。block 書込 route は D8R まで本番未 mount（packet では mute/block とも本番未 mount で統一。mute のみ先行公開するかは未決） | E8 | **queue 登録済み・issue 公開済み**（[Emumet#73](https://github.com/ShuttlePub/Emumet/issues/73)、2026-11-10。packet: `.intent-cli/issues/profile-domain-policy-storage/`）。E8（Emumet#66 / PR #70）のマージ後に実装マージ |
| D8G | `profile-domain-follow-guards` | inbound/outbound 新規 Follow 拒否、古い Accept 反映防止、未送信 Follow/Accept の配送前判定。既存関係の一括解除・投稿操作拒否は含まない | P3o, P3i, D8P（P4 前でも隔離 fixture で検証可） | **queue 登録済み・issue 公開済み**（[Emumet#83](https://github.com/ShuttlePub/Emumet/issues/83)、2026-11-10。packet: `.intent-cli/issues/profile-domain-follow-guards/`）。P3o・P3i のマージ後にマージ。Follow だけが実適用対象（投稿操作の後続 owner は ShuttlePub） |
| D8R | `profile-domain-block-detach` | block 設定、following/follower 両方向解除、不要 job 取消、最小通知予約の原子的実行と公開 API 接続。個別 actor block の AP Block / Undo(Block)（ユーザー決定による範囲追加）。復元・domain block の AP Block・投稿操作制御は含まない | D8G, P4 | **マージ済み**（[Emumet#84](https://github.com/ShuttlePub/Emumet/issues/84) / [PR #93](https://github.com/ShuttlePub/Emumet/pull/93)、squash `82fa49b`、2026-11-12、queue completed、issue closed）。domain-controls（mute・block とも）を本番 root router に mount 済み。確定契約は acceptance.md『D8R 確定契約』。D08 の Emumet 部分（Follow 制御）のみ実適用 |
| F8 | `personal-domain-controls-web-ui` | domain mute/block 設定、解除時非復元の説明、実 Emumet 接続、投稿表示面の S8 準拠 mock。**domain `shuttlepub` / target `ShuttlePub/shuttlepub-frontends`** | F0, FA, E8, S8, D8R（mock 部分は E8/S8 確定後に先行可） | **queue 登録済み・issue 公開済み**（domain `shuttlepub`、[shuttlepub-frontends#35](https://github.com/ShuttlePub/shuttlepub-frontends/issues/35)、2026-11-10。packet: `.intent-cli/issues/personal-domain-controls-web-ui/`）。【先行可】BFF 変換・型生成・stateful mock・S8 準拠 fixture のデータ層／【モック合意後】画面構成／【D8R マージ後】実 Emumet 接続の最終受け入れ。S8 は shuttlepub domain で別レーンの登録待ち（queue 登録後に dependencies へ追加） |

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
| Emumet の Follow 制御（D8P/D8G/D8R） | **実装済み（Emumet 部分。D08 全体は未完了）**。D8P（domain 方針の保存）・D8G（domain block の Follow への実適用、[Emumet PR #89](https://github.com/ShuttlePub/Emumet/pull/89)）・D8R（block 書込時の両方向解除と domain-controls の本番 mount、[Emumet PR #93](https://github.com/ShuttlePub/Emumet/pull/93)）はいずれもマージ済み。投稿操作の実制御（ShuttlePub 後続）・F8 の残りは未完了 |
| ShuttlePub の投稿・通知・検索 filter、新規反応・返信・引用・リポスト受理／送信拒否 | 未実装・後続 unit（S8 は契約のみ） |
| frontends UI（F8） | **部分完了（第1段マージ済み）**。UI モック v5 合意済み。設定「ミュート・ブロック」画面（ドメイン・アカウント両タブ）＋ BFF ＋ 実 Emumet 接続を [shuttlepub-frontends PR #40](https://github.com/ShuttlePub/shuttlepub-frontends/pull/40)（squash `cb02b99`、Refs [#35](https://github.com/ShuttlePub/shuttlepub-frontends/issues/35)、issue は open）でマージ。実接続の受け入れは Emumet main 82fa49b（D8R・P4 マージ後）に対するローカル実 E2E で確認。投稿表示面（ui-spec 3-x・4-1・5-x）と「…」メニューは **S8 待ち**（第2段、別 PR） |

D08 全体は ready／完了ではない。queue 登録対象は E8 と D8P（および PF 側 P1・P2）の範囲だけで、実処理は後続 unit で段階的に進める。

## queue 登録の記録

- E8 `profile-domain-policy-api-contract`: 2026-11-10 に queue 登録・issue 公開（[ShuttlePub/Emumet#66](https://github.com/ShuttlePub/Emumet/issues/66)、`intent-target` 適用）。範囲は API 契約のみ。共有ファイルの merge 順は E15a（Emumet#65）の後。
- E8: 2026-11-10 に [Emumet PR #70](https://github.com/ShuttlePub/Emumet/pull/70) を squash マージ（`0bfa437`、E15a #67・#69 取り込み後の main 上で openapi.json 再生成）。確定した契約は [acceptance.md](acceptance.md) の「E8 確定契約」を参照。引き継ぎ: 共有 router 構成による未 mount 不在テストの強化（現状は `main.rs` の文字列検査）は P1/P4 で対応。
- D8P `profile-domain-policy-storage`: 2026-11-10 に queue 登録・issue 公開（[ShuttlePub/Emumet#73](https://github.com/ShuttlePub/Emumet/issues/73)、`intent-target` 適用）。依存 E8。範囲は domain 方針の実保存・revision・所有者認可で、Follow への適用・投稿 filter は含まない。domain-controls route は本番 root へ mount しない（計画上は block 書込のみ D8R まで未 mount だが、packet では判断に迷うため mute/block とも未 mount で統一。mute のみの先行公開は別途判断）。PF 側 P1 `profile-actor-identity-foundation`（[Emumet#71](https://github.com/ShuttlePub/Emumet/issues/71)）・P2 `profile-social-graph-storage`（[Emumet#72](https://github.com/ShuttlePub/Emumet/issues/72)）も同日 queue 登録・issue 公開済み（[PF packets](../profile-federation/packets.md)）。
- D8P: 2026-11-10 に [Emumet PR #76](https://github.com/ShuttlePub/Emumet/pull/76) を squash マージ（`b3e87f2`、P2 #77 取り込み後の main 上。queue completed、issue #73 closed）。独立レビューで Profile 移管との競合（所有者確認と CRUD の非直列化）の指摘を受け、同一 transaction ＋ Profile 行 `FOR SHARE` に修正して承認。確定した正規化規則・tombstone revision・所有者直列化・照合関数・未 mount 範囲は [acceptance.md](acceptance.md) の「D8P 確定契約」。migration `20260920000001_profile_domain_controls.sql` は本番 `migrations/` に含まれ P4 初期化の対象外。D8P はマージ済み。D8G は 2026-11-10 に [Emumet PR #89](https://github.com/ShuttlePub/Emumet/pull/89) を squash マージ（`931a686`、queue completed、issue #83 closed）。独立レビューで unfollow と配送前ガードの行ロック循環・Profile 削除 CASCADE と配送前ガードの逆順ロックのデッドロックを指摘され、関係ロック（unfollow）と Profile 行 `FOR SHARE`（配送前ガード）を追加して承認。確定形は [acceptance.md](acceptance.md) の「D8G 確定契約」。D8R は未着手。

- F8 第1段マージ: 2026-11-12 に [shuttlepub-frontends PR #40](https://github.com/ShuttlePub/shuttlepub-frontends/pull/40) を squash `cb02b99` でマージ（Refs #35、issue は open、closeout しない）。固定 Emumet OpenAPI は main 82fa49b、shuttlepub-frontends main（SNS 本体・quick reaction・ログイン UI）を取り込み済み。実 E2E は Emumet main 82fa49b の release ビルドで 2/2 pass ×2（方針保存・取得、自サーバー拒否、peer domain block での Follow 解除、解除後非復元、409、Profile 分離）。**第2段（投稿表示面・「…」メニュー）は S8 待ち**。引継ぎ: (1) F8 の実 Emumet E2E シナリオ（Kratos/Hydra ログイン → BFF → Emumet、自サーバー拒否・peer domain block での Follow 解除・解除後非復元・409・Profile 分離・アカウントタブ）はスクラッチで実行しリポジトリ未移設。shuttlepub-frontends の `apps/shuttlepub-web/e2e` へ移し、Keto を含む compose と `e2e/emumet-revision` を Emumet main 82fa49b 以降に更新する。(2) アカウントタブの行は Emumet の個別 relation 応答が canonical actor URL しか返さないため actor URL 表示（ui-spec 1-6 のアイコン・名前・acct には Emumet 側の API 追加が必要）。
- F8 第1段: 2026-11-11 に [shuttlepub-frontends PR #40](https://github.com/ShuttlePub/shuttlepub-frontends/pull/40) を作成（Refs #35、未マージ）。**F8 は部分完了で、残りは S8・F0 layout 待ち**。範囲は設定画面（ui-spec 1-x・2-x）・BFF（Emumet OpenAPI を 49acf9d で固定取込、domain-controls・blocks/mutes・following/followers の real adapter と E8/D8P/D8R 準拠 stateful mock、表示中 Profile を明示し切替後の書込みは PROFILE_CHANGED で拒否）。アカウントタブ（個別 blocks/mutes の一覧・解除）は ui-spec 1-2/1-6 に基づく範囲拡大（親判断、packet の revision_history）。Emumet の個別 relation 応答に名前・アイコン・acct が無いため行は actor URL 表示（Emumet 側 API 追加の候補）。ローカル実 E2E（実 Kratos/Hydra ログイン → BFF → D8R `2627a50` ＋ RX のローカルビルド、実 PostgreSQL・Keto）で、画面からの domain block による双方向 Follow 解除、block 中の新規 Follow 422、解除後に関係が戻らないこと、revision 競合・Profile 分離を確認。D8R/P4 マージ後に同じ E2E を再実行する。投稿表示面と「…」メニューは S8 確定・F0 layout マージ後の第2段。
- D8G・D8R・F8 と PF 側 P4: 2026-11-10 に queue 登録・issue 公開（第4便、unit 範囲のみ。D8G [Emumet#83](https://github.com/ShuttlePub/Emumet/issues/83)、D8R [Emumet#84](https://github.com/ShuttlePub/Emumet/issues/84)、F8 [shuttlepub-frontends#35](https://github.com/ShuttlePub/shuttlepub-frontends/issues/35)、P4 [Emumet#82](https://github.com/ShuttlePub/Emumet/issues/82)。いずれも `intent-target` 適用）。D8G は P3o・P3i の後、D8R は D8G と P4 の後（P4 マージ後に D8R が domain-controls の block 書込を有効化）、F8 は F0・FA・E8・D8R（S8 は別レーンの登録待ち）に依存。P4 のマージ・本番切替の前にはユーザー確認が必須（[PF packets](../profile-federation/packets.md)）。D08 全体は ready／完了ではない。

## UI 実装の前提（ユーザー指示）

- **F8 の画面構成（domain mute/block 設定画面、解除時非復元の説明、投稿表示面）を決める UI 実装は、モック合意まで保留する。**
  「画面構成はモック合意後に実装」を前提に packet 化する。BFF・REST 変換など画面構成に依存しない部分のみ先行可。
- 上記の F8 行の「mock 部分は E8/S8 確定後に先行可」は、画面構成のモック合意が済んだ後の実装を指す。
- D8R: 2026-11-12 に [Emumet PR #93](https://github.com/ShuttlePub/Emumet/pull/93) を squash マージ（`82fa49b`、P4 #91 の `daeb625` 取込み後の main 上。queue completed、issue #84 closed、claim release 済み）。独立レビューの必須指摘（後始末の起算時刻、再ブロック時の古い Undo(Block)、actor 対ごとの settle 下限の永続化）を反映してから承認。ユーザー決定 question-e6dfa2b98a9dc74491b19bbcf2ba5ca4 により個別 actor block の AP Block / Undo(Block) を範囲に追加（domain block は送らない）。到達範囲と確定契約は acceptance.md『D8R 確定契約』。
