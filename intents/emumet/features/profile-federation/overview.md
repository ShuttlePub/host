---
facets: [vocabulary, invariant]
---

# profile-federation — overview

略号: **PF**。Emumet の連合 identity を Account 単位から **Profile 単位**へ移行する feature。
D08 [personal-domain-controls](../personal-domain-controls/overview.md)（略号 DC）の前提基盤。

## Goals

- Profile を ActivityPub actor・follow graph・個別 block/mute の主体にする
  （現行は Account = actor。ADR 0002 は 1 Profile = 1 actor を採用済みだが実装が追従していない）。
- Profile ごとに一意で不変の `username`（acct の名前部分）を持ち、Account 名とは分ける。
- 旧 Account 単位の連合データは引き継がず、同一 DB 上で新 Profile モデルへ切り替える（in-place reset）。

## 出典（ユーザー決定）

- [candidates.md D08](../../../shuttlepub/packets/candidates.md#d08) /
  [grill 記録](../../../shuttlepub/interviews/discord-feature-grill-2026-10-15.json)
  `d08-q13`（Profile 単位移行と実保存・フォロー解除を今回含める）、
  `d08-q14`（既存連合 identity は破棄可・本番利用者なし。Move・リダイレクト・互換維持なし）、
  `d08-q15`（Profile ごとに一意・不変の username。Account 名とは別。移管でも維持）。
- 既存決定: Emumet ADR 0002（アカウントアドレス）/ 0003（委任署名）/ 0007（組織 Account・Profile 移管）。
  既存要求: [ap-federation](../ap-federation/overview.md) / [block-mute](../block-mute/overview.md)。

## 確定方針

### in-place reset（P4 で本番適用）

- P4 で旧連合データ（旧連合鍵・関係・配送状態）を初期化し、同一 DB を Profile モデルへ切り替える。
- 旧新 actor の同時公開、dual-write、旧関係の変換・コピー、Move は行わない。機能フラグによる旧新切替も追加しない。
- P2 は新保存モデルと**隔離 DB 用**の移行 fixture まで。破壊的 migration の本番配置は P4。
- P4 は専用移行フレームワークを作らず、対象限定の versioned SQL・一回限りの鍵初期化・停止／再開手順に留める。
- **保持するもの**: AuthAccount、Account、Profile、組織 membership、イベント履歴、全体モデレーション等。
  `TRUNCATE ... CASCADE` による無差別削除は禁止。
- 新運用開始後の旧モデルへの逆変換は保証しない。
- P1〜P3 の新 Profile actor・関係処理は**本番 root router へ未 mount**（直接組み立てたテスト router で検証）。
  P4 まで本番 router と配送 worker 起動処理へ接続しない。稼働する actor・保存モデルは常に一種類。

### username の移行契約

| 段階 | 作成 API | 既存 Profile |
|---|---|---|
| E8 | `POST /api/v1/accounts` の `profile_username`、Profile 作成の `username` は optional。指定時は形式検証し、保存未実装なら**作成副作用前に**明示的な未実装エラー。黙って無視しない | 読取値は未設定を表現可能 |
| P1〜P3 | optional を維持。指定値を保存。省略した旧クライアントも動作 | 所有者が未設定値を一度だけ設定できる |
| FN | 新 UI は作成時に必ず送信。未設定 Profile の一回限り設定にも対応 | 「変更不可」を確認して設定 |
| P4 以後 | 必須化。省略は validation error。OpenAPI も required へ変更 | 未設定が残っていれば切替拒否 |

- **FN の merge と P1 との実接続確認を P4 の前提にする。**
- 形式: `^[a-z0-9][a-z0-9._-]{0,63}$`（ASCII 小文字、1〜64 文字）。暗黙の trim・小文字化はしない。
- 初期予約語: `admin`, `administrator`, `root`, `system`, `support`, `security`, `moderator`, `api`, `ap`,
  `auth`, `oauth`, `oauth2`, `login`, `logout`, `register`, `settings`, `well-known`。
- 一意性は DB でも保証。削除済み username は再利用しない。Account 名から自動導出しない。
- username 更新 API を通常の編集機能として設けない（一回限り設定のみ）。
- この文字種は P4 の Mastodon / Iceshrimp E2E でも検証する。

### 認証・責務

- D08 の新規 Follow 受理・送信拒否は Emumet。
- 返信・引用・リポスト・いいね／絵文字の新規受理・送信拒否は **ShuttlePub 本体**の後続責務（今回は S8 で契約化のみ）。
  Emumet inbox に投稿内容の最終認可を重複実装しない。
- 外部 ID は nanoid。

## Execution units

[packets.md](packets.md) を参照。契約・検証境界は [acceptance.md](acceptance.md)。

## Related

- [personal-domain-controls](../personal-domain-controls/overview.md)（DC）
- [ap-federation](../ap-federation/overview.md) / [block-mute](../block-mute/overview.md) /
  [org-accounts](../org-accounts/overview.md)（Profile 移管）
- frontends 側の参照: [ratcap settings-hub](../../../ratcap/features/settings-hub/overview.md)
  （過去 packet は書き換えない）
