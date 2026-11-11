# profile-federation — packets

> 親状態（durable state・packet・intent・queue）の正本は ShuttlePub/host のみ。
> domain: `emumet`。target は明記のあるもの以外 `ShuttlePub/Emumet`。
> 全 unit 共通: `intent_placement.primary_intent` は本 feature（PF）の `overview.md`、
> supporting に [DC](../personal-domain-controls/overview.md)・`intents/shuttlepub/packets/candidates.md` D08 節・
> `intents/shuttlepub/product/social-experience.md` I08・grill 記録・Emumet ADR 0002/0003/0007・既存 ap-federation/block-mute 要求。
> ただし E8 は primary を DC に置く（[DC packets](../personal-domain-controls/packets.md)）。

## Execution units

状態は 2026-11 時点。全 unit が queue 登録済み（P4 は第4便）。D08 全体は ready／完了ではない。

| # | unit | 概要 | 依存 | ADR | 状態 |
|---|---|---|---|---|---|
| E8 | `profile-domain-policy-api-contract` | Profile identity／Follow／個別 block/mute／domain-controls の OpenAPI 契約と username 段階移行の明記（DC 側 packet、実装は含まない） | なし | — | マージ済み（[Emumet#66](https://github.com/ShuttlePub/Emumet/issues/66) / [PR #70](https://github.com/ShuttlePub/Emumet/pull/70)、squash `0bfa437`、2026-11-10）。[DC packets.md](../personal-domain-controls/packets.md) 参照 |
| P1 | `profile-actor-identity-foundation` | username 実保存・一回限り設定、Profile actor 情報・鍵の型と repository、WebFinger／actor 文書生成。本番 `/ap/profiles/...` は未 mount | E8 | [`decisions/profile-actor-identity.md`](../../decisions/profile-actor-identity.md) 新設済み | queue 登録済み・issue 公開済み（[Emumet#71](https://github.com/ShuttlePub/Emumet/issues/71)、2026-11-10。packet: `.intent-cli/issues/profile-actor-identity-foundation/`）。E8（Emumet#66 / PR #70）のマージ後に実装マージ。**マージ済み**（[Emumet#71](https://github.com/ShuttlePub/Emumet/issues/71) / [PR #78](https://github.com/ShuttlePub/Emumet/pull/78)、squash `e2e3b46`、2026-11-10、queue completed。本番 route・worker は未 mount・未接続）。確定形（username 設定 API・一意の DB 保証・移管との直列化・actor URL・鍵）と引き継ぎは [acceptance.md の「P1 確定契約」](acceptance.md) |
| P2 | `profile-social-graph-storage` | Profile 版 Follow・個別 block/mute・元 Follow activity ID・重複受信記録・配送 job の保存モデルと、in-place reset の隔離 DB 用 fixture。本番 migration は追加しない | E8 | — | queue 登録済み・issue 公開済み（[Emumet#72](https://github.com/ShuttlePub/Emumet/issues/72)、2026-11-10。packet: `.intent-cli/issues/profile-social-graph-storage/`）。E8（Emumet#66 / PR #70）のマージ後に実装マージ。P1 とは独立に並行可。**マージ済み**（[Emumet#72](https://github.com/ShuttlePub/Emumet/issues/72) / [PR #77](https://github.com/ShuttlePub/Emumet/pull/77)、squash `f523b86`、2026-11-10、queue completed。本番 migration・route・worker は未接続）。保存項目・enqueue interface・初期化対象/非対象・P4 申し送りは [acceptance.md の「P2 確定契約」](acceptance.md) |
| P3o | `profile-relationship-outbound` | Profile 単位 Follow/unfollow・個別 block/mute の送信側 use case、関係変更＋job 予約、内部署名、永続配送 worker（本番未接続） | P1, P2 | — | queue 登録済み・issue 公開済み（[Emumet#74](https://github.com/ShuttlePub/Emumet/issues/74)、2026-11-10。packet: `.intent-cli/issues/profile-relationship-outbound/`）。P1・P2 のマージ後に実装マージ。P3i とは P2 の enqueue interface 固定で並行可**マージ済み**（[Emumet#74](https://github.com/ShuttlePub/Emumet/issues/74) / [PR #86](https://github.com/ShuttlePub/Emumet/pull/86)、squash `fc11471`、2026-11-10、queue completed。本番 route・worker は未 mount・未起動）。確定形（use case・関係ロック規約・Local→Local の確定経路・Undo/Reject の ID と元 Follow 埋め込み・署名・送信 adapter の SSRF 対策・worker の lease/renew/budget・バックオフ・上限・acct 解決）と **AP Block 送信は保留中（ユーザー確認中、現状は送らない）** は [acceptance.md の「P3o 確定契約」](acceptance.md) |
| P3i | `profile-relationship-inbound` | Profile 用 inbox の Follow/Accept/Reject/Undo、followers/following 読取（本番未 mount）。P3o とは enqueue interface 固定で並行可 | P1, P2 | — | queue 登録済み・issue 公開済み（[Emumet#75](https://github.com/ShuttlePub/Emumet/issues/75)、2026-11-10。packet: `.intent-cli/issues/profile-relationship-inbound/`）。**マージ済み**（[PR #87](https://github.com/ShuttlePub/Emumet/pull/87)、squash `13a1cf8`、2026-11-10、queue completed）。到達範囲は Profile 用 inbox（Follow／Accept／Reject／Undo(Follow)、個別 block 時の Follow は Reject、本番未 mount）と followers／following 読取。確定形は [acceptance](acceptance.md) の「P3i 確定契約」。domain 方針（D8G）・本番 mount（P4）は未実装 |
| FN | `profile-identity-web-adaptation` | emumet-web の Account 作成に別入力の Profile username・変更不可説明・既存 Profile への一回限り設定。**target `ShuttlePub/shuttlepub-frontends`** | E8, P1（P4 に依存しない） | — | queue 登録済み・issue 公開済み（[shuttlepub-frontends#34](https://github.com/ShuttlePub/shuttlepub-frontends/issues/34)、2026-11-10。packet: `.intent-cli/issues/profile-identity-web-adaptation/`）。画面実装はモック合意まで保留（BFF・GraphQL・モック・生成型は先行可）。`bff/schema.graphql`・生成型は F15（[registration-gate-admin-ui](https://github.com/ShuttlePub/shuttlepub-frontends/issues/31)）と直列に統合。参照: [ratcap settings-hub links](../../ratcap/features/settings-hub/links.md) |
| P4 | `profile-federation-in-place-cutover` | 破壊的 SQL の本番 migration 化、旧連合データ初期化、新 Profile 鍵の一回限り生成、root router／worker 切替、username 必須化、旧 `/ap/accounts/...`・`/internal/v1/accounts/{id}/sign`・`.../public-key` 廃止、E2E 更新 | P1, P2, P3o, P3i, **FN** | [`decisions/profile-federation-in-place-reset.md`](../../decisions/profile-federation-in-place-reset.md) 新設済み | queue 登録済み・issue 公開済み（[Emumet#82](https://github.com/ShuttlePub/Emumet/issues/82)、2026-11-10。packet: `.intent-cli/issues/profile-federation-in-place-cutover/`）。P1・P3o・P3i・FN の全マージ後に着手・マージ（P2 はマージ済み）。**マージと本番切替の前に必ずユーザー確認を得る（ユーザー確認ゲート。lane root がリードへ質問）**。domain-controls route は block 書込を D8R が有効化するまで本番で受け付けない（mute のみ先行公開か全体未 mount かは未決、既定は未 mount のまま） |
| RX | `profile-identity-read-exposure` | AccountResponse（Account 取得・一覧・作成・更新）に `profile_id`（Profile nanoid）と `profile_username`（未設定は null）を追加する読取専用の追加。FN が既存 Profile を特定するために必要。組織 Account の複数 Profile は account あたり最小 profile id で決定的に選ぶ | P1（マージ済み）。FN・P4 の前にマージ | — | **計画外の追加 unit（ユーザー承認 question-da4ae5d616cf6197f307bfffdc86868a）**。queue 登録済み・issue 公開済み（[Emumet#94](https://github.com/ShuttlePub/Emumet/issues/94)、2026-11-11。packet: `.intent-cli/issues/profile-identity-read-exposure/`）。P4（PR #91）の Account 関連ファイルとの競合を避けるため変更は最小限 |

## 依存図

```text
E8 ─┬→ P1 ─┬→ P3o ─┐
    │      ├→ P3i ─┤
    │      └→ FN ──┤
    └→ P2 ─→ P3o/P3i   └→ P4 ─→ D8R (DC)
```

- P3o/P3i は P1 と P2 の双方に依存（P2 の enqueue 型を先に固定）。
- P4 は FN の merge（全既存 Profile の username 設定確認を含む）が必須。
- DC 側 unit（D8P / D8G / D8R / F8）との合成図は [DC packets.md](../personal-domain-controls/packets.md)。

## 編集競合・統合順序（Emumet 共有ファイル）

対象: `server/src/openapi.rs`, `server/src/route.rs`, 本番 router を組む `server/src/main.rs`, DI wiring, `migrations/`, `openapi.json`。

- 親が Emumet 統合担当を一人固定し、共有ファイルの最終更新を担当させる。
- 初動の merge 順は **E15a（D15 `registration-gate-control-plane`）→ E8**。E8 は E15a 取り込み後に OpenAPI を再生成してから merge。
- P2 は本番 migration を追加しない。P4 が最終 migration 番号を採番する。
- **migration の分担（親判断、2026-11-10）**: P1・D8P の非破壊の追加 migration（列・テーブル・index）は通常の `migrations/` に置き本番適用してよい。P4 が所有するのは旧連合データ初期化などの破壊的 migration と P2 の新関係・配送テーブルの本番採番。P1 packet（Emumet#71）の「本番採番は P4」記述はこの分担に是正済み（packet の revision_history 参照）。
- P3o は outbound／dispatcher、P3i は inbound を所有。共通 enqueue 型は P2 で固定。
- P4 が Profile route の本番 mount、旧 route 撤去、worker 起動を一括所有。
- 後続 unit も共有ファイルは一件ずつ統合し、その時点の main から OpenAPI を再生成する。

## UI 実装の前提（ユーザー指示）

- **FN の画面構成（Account 作成フォーム内の username 入力・説明・一回限り設定画面の配置）を決める UI 実装は、モック合意まで保留する。**
  合意前に実装してよいのは BFF・GraphQL・REST 変換などの画面構成に依存しない部分に限る。画面部分は「画面構成はモック合意後に実装」を前提に packet 化する。
- P4 の前提である「FN の merge」は、モック合意後の画面実装を含めて満たす。
