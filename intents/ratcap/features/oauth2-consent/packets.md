# oauth2-consent — packets

> See [../../packets/](../../packets/) for domain-level packet list.

## Execution units

### Packet: `oauth2-consent-flow` — 明示同意画面 (BFF standalone HTML + i18n) — 完了

> **issue**: [ShuttlePub/RatCap#6](https://github.com/ShuttlePub/RatCap/issues/6)
> (2026-08-24 publish) / **PR**: [ShuttlePub/RatCap#7](https://github.com/ShuttlePub/RatCap/pull/7)
> (2026-08-24 merge、merge commit `1676769`)。旧 2 分割案 (Packet 1: 方針決定 + 表示 /
> Packet 2: POST + エラーハンドリング) は 2026-08-24 grill で D8-D10 が確定したため
> 1 packet に集約。

- 内容
  - `index.ts` に `GET /oauth2/consent` (Emumet 呼出 → 同意フォーム HTML 描画 /
    auto-skip 時 302 伝搬) と `POST /oauth2/consent` (許可/拒否の中継 → 302) を追加。
    `/auth/*` と同じ層の BFF 素 HTML standalone ページ (D8)。Flame SSR / PureScript 側は
    変更しない。
  - スコープ表示は日本語プライマリの i18n ラベルマップ (言語コード → スコープ →
    ラベル)。言語は `Accept-Language` からサーバーサイド判定、未知スコープは生名
    フォールバック (D9)。
  - `ratcap_session` を要求しない。challenge 欠落・不正時はエラーページ (D10)。
  - BFF 単体テスト (Emumet 呼出 mock) + real モード手動 E2E。
  - Hydra consent URL の Ratcap 向けデプロイ設定変更 (D6)。
- 完了条件
  - acceptance.md の AC2-AC11 が満たされる。
- 推定規模：中
- 依存：なし
