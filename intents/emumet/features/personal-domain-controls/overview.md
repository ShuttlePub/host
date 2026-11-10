---
facets: [vocabulary, invariant]
---

# personal-domain-controls — overview

略号: **DC**。D08（個人単位のドメインブロック・ミュート）の Emumet 側 feature。
基盤となる Profile 単位への移行は [profile-federation](../profile-federation/overview.md)（PF）。

## Goals

- 利用者自身が、投稿用 **Profile ごと**に、domain 単位で mute / block を設定できる。
- block では対象 domain 利用者との既存 Follow／Follower 関係を自分側の関係記録から両方向解除し、
  新規 Follow を双方向に拒否する。mute は表示抑制のみで関係を切らない。
- 管理者による全体 HostModeration とは別物。Account 全体・サーバー全体へ自動適用しない。

## 出典（ユーザー決定）

- [candidates.md D08](../../../shuttlepub/packets/candidates.md#d08) /
  [I08](../../../shuttlepub/product/social-experience.md#i08) /
  [grill 記録](../../../shuttlepub/interviews/discord-feature-grill-2026-10-15.json) `d08-q01`〜`d08-q15`。

| 決定 | 要点 |
|---|---|
| q01 | mute は表示を抑え関係を切らない。block は表示抑制＋対象 domain 利用者との既存関係の両方向解除 |
| q02 | Profile 単位。同一 Account の別 Profile・他 Account の Profile に波及しない |
| q03/q04 | block 中は対象 domain からの新規 Follow・投稿操作と、自分からの新規 Follow・投稿操作を拒否。自動解除しない。mute には追加しない |
| q05〜q08, q11 | 表示抑制（timeline・検索・通知）、第三者コメント付き引用／純粋 boost の全体非表示、直接 URL は単一投稿 reveal、既存反応件数は維持 |
| q09 | **完全一致**のみ（`example.com` は `sub.example.com` を含まない） |
| q10 | block 解除しても関係を復元せず、復元用一覧も保持しない |
| q12 | **AP Block は送らない**。Follow 解除に必要な最小限の通知のみ |
| q13/q14/q15 | Profile 単位移行・実保存・Follow 解除を今回含める。旧連合 identity は破棄、Profile username は一意・不変 |

## 責務分割

| 領域 | owner | unit |
|---|---|---|
| Profile/domain policy の API 契約 | Emumet | E8 |
| domain mute/block の実保存・認可・revision | Emumet | D8P |
| 新規 Follow の受理・送信拒否、古い Accept 防止 | Emumet | D8G |
| block 時の双方向 Follow 解除・job 取消・最小通知 | Emumet | D8R |
| 設定 UI（Follow 制御は実適用、投稿部分は mock/未接続明示） | shuttlepub-frontends | F8 |
| 表示抑制（timeline・検索・通知）、引用・boost 全体非表示、reveal の**契約** | ShuttlePub | S8 |
| **返信・引用・リポスト・いいね／絵文字の新規受理・送信拒否の実処理** | **ShuttlePub（後続 unit・未実装）** | — |

- Emumet inbox に投稿内容の最終認可を重複実装しない。後続 ShuttlePub 実装で、転送された活動も受理前に検証する。
- したがって D08 全体の本番適用完了とは扱わない。Emumet 側の Follow 制御完了（D8R）後も、投稿制御は未実装として残す。

## ShuttlePub 側 UI

F8 の UI モック v5 は `d08-q16-ui-mock-v5-agreement` で合意済み。画面実装の基準は [personal-domain-controls-ui の ui-spec.md](../../../shuttlepub/features/personal-domain-controls-ui/ui-spec.md) の26項目とする。

## 技術方針（Emumet 側）

- 照合は**検証済み canonical actor ID の host**で行う。inbox／CDN host は使わない。IDNA 等の正規化は D8P で確定する。
- block と Follow 更新は共通ロック規約で直列化。local/local は両 Profile を一定順序でロック。
- block 書込 route は D8R 接続まで本番未 mount。
- Undo／Reject 等の後始末は block 中も許可。unblock 後に古い activity が再送されても関係は復活しない。
- 自分の Follow には元 Follow を参照する Undo、相手の Follow には Reject 等を使う。相手作成の Follow を自分が作者であるかのように Undo しない。

## Execution units

[packets.md](packets.md)（unit 一覧・依存図・到達範囲）／[acceptance.md](acceptance.md)（契約・検証境界）。

## Related

- ShuttlePub 側 UI（F8）: [personal-domain-controls-ui](../../../shuttlepub/features/personal-domain-controls-ui/overview.md)
- [profile-federation](../profile-federation/overview.md)（PF）
- [block-mute](../block-mute/overview.md)（既存の個別 block/mute。完了済み packet・acceptance は変更しない）
- frontends 側の参照: [ratcap block-mute](../../../ratcap/features/block-mute/overview.md) /
  [settings-hub](../../../ratcap/features/settings-hub/overview.md)（過去 packet は書き換えない）
