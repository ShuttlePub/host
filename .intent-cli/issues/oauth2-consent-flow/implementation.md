# oauth2-consent-flow Implementation Packet

## Goal

Ratcap BFF (`index.ts`) に `GET/POST /oauth2/consent` を素の HTML standalone ページとして
追加し、Hydra 手動同意フローを完結させる。スコープ表示は日本語プライマリの i18n
ラベルマップ (Accept-Language 判定・英語対応・未知スコープは生名フォールバック)。
セッション cookie は要求しない。変更は BFF 層に閉じ、PureScript 側には触れない。

## Why

外部 ShuttlePub ホストをサードパーティ OAuth2 クライアントとして受け入れるには
明示同意画面が必須 (D7)。Emumet 側の consent API は実装済みで、足りないのは
Ratcap の同意 UI のみ。2026-08-24 grill で D8/D9/D10 を確定し packet 化。

## Scope

- `index.ts`: `GET /oauth2/consent` (Emumet 呼出 → HTML 描画 / 302 伝搬) と
  `POST /oauth2/consent` (許可/拒否の中継 → 302) のハンドラ追加。`/auth/*` と同じ層。
- i18n ラベルマップ (言語コード → スコープ → ラベル)。ja プライマリ + en。
- challenge 不正時のエラーページ。
- BFF 単体テスト (Emumet 呼出 mock)。
- Hydra consent URL の Ratcap 向けデプロイ設定変更 (D6)。

## Out of scope

- PureScript / Flame SSR 側の一切の変更。
- `ratcap_session` 連携・ログイン誘導・mock モード対応 (D5/D10)。
- Emumet 側変更・既存 `/auth/*` 変更。

## Verification

- `bun test` 全件成功 (新規 consent ケース + 既存リグレッション)。
- real モード手動 E2E (Hydra consent skip 無効化で同意フロー完結)。
- `git diff --check`。

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/ratcap/features/oauth2-consent/` 既存ノード (新規不要)。
- ADR candidate: なし (feature decisions.md D8-D10 に記録済み)。
- Diagram candidate: なし。
- Docs update: なし。
- Closeout learning: 完了時に `packets/backlog.md` 完了セクション移動 +
  `features/oauth2-consent/packets.md` へ issue リンク追記 (host-only)。
  `write_back_required: true` (backlog/packets.md のみ、intent tree 変更不要)。

- Guide reachability (G645): `guide workflow task implementation-loop` / role:
  implementation / target surface: Ratcap BFF `GET/POST /oauth2/consent`。

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
