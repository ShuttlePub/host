# registration-readiness-gate — packets

> See [../../packets/](../../packets/) for domain-level packet list.
> 計画の正本: 2026-11 D15 登録ゲート計画（thread-xxs52dcx 最終計画 3.C / 4 / 5）。
> ユーザー決定の正本: [candidates.md D15](../../../shuttlepub/packets/candidates.md#d15)、
> [grill 記録](../../../shuttlepub/interviews/discord-feature-grill-2026-10-15.json) `d15-q01`〜`d15-q11`。

## Execution units

domain `emumet`。E15a〜E15w の target は `ShuttlePub/Emumet`、F15 のみ `ShuttlePub/shuttlepub-frontends`。

| unit | slug | 範囲 | 依存 | 状態 |
|---|---|---|---|---|
| E15a | `registration-gate-control-plane` | 管理者の開閉・手動再開・override・revision・監査・状態遷移・通知イベント・管理者別既読。実 Kratos 遮断・実 provider 検証は含まない | なし | queue 登録・issue 公開済み（[Emumet#65](https://github.com/ShuttlePub/Emumet/issues/65)） |
| E15b | `registration-kratos-guard-contract` | Kratos v1.3.1 の pre-persist guard 実証と保護の実装所在の決定（ADR）。本番 Kratos 設定への hook 接続は含まない | なし | queue 登録・issue 公開済み（[Emumet#64](https://github.com/ShuttlePub/Emumet/issues/64)） |
| E15c | `registration-protection-readiness` | E15b で決めた保護 adapter・実検証 API・設定世代・readiness 鮮度期限・設定喪失と一時障害の分類 | E15a, E15b | 後続（予定）。**E15b の所在・provider・観測契約を親が確認するまで draft しない** |
| E15d | `registration-gate-enforcement` | 実 Kratos hook 配線・保護実行・継続 probe・ゲートと通知イベントの統合。本番 Kratos 設定変更は E15d が所有 | E15a, E15b, E15c | 後続（予定）。E15c と同じ draft ゲート |
| E15w | `registration-admin-notification-webhook` | 永続イベントの外部 Webhook 配送（stable event ID・署名・timeout/再試行・失敗状態・管理者テスト/再試行） | E15a | queue 登録・issue 公開済み（[Emumet#68](https://github.com/ShuttlePub/Emumet/issues/68)） |
| F15 | `registration-gate-admin-ui` | emumet-web 管理画面（状態・理由・開閉・再開・override・常時警告・通知一覧/既読・Webhook 状態）。target `ShuttlePub/shuttlepub-frontends` | E15a の契約（モック UI は E15c/E15d/E15w と並行可） | queue 登録・issue 公開済み（[shuttlepub-frontends#31](https://github.com/ShuttlePub/shuttlepub-frontends/issues/31)）。**画面実装 PR はモック合意が host intent に記録されるまで出さない**（BFF・API 接続・生成型・fixture は先行可） |

queue 登録済みの unit（登録成功後に追記する）:

- E15a `registration-gate-control-plane` — [Emumet#65](https://github.com/ShuttlePub/Emumet/issues/65)（packet: `.intent-cli/issues/registration-gate-control-plane/`、2026-11-10 queue 登録・issue 公開）
- E15b `registration-kratos-guard-contract` — [Emumet#64](https://github.com/ShuttlePub/Emumet/issues/64)（packet: `.intent-cli/issues/registration-kratos-guard-contract/`、2026-11-10 queue 登録・issue 公開）
- E15w `registration-admin-notification-webhook` — [Emumet#68](https://github.com/ShuttlePub/Emumet/issues/68)（packet: `.intent-cli/issues/registration-admin-notification-webhook/`、2026-11-10 queue 登録・issue 公開。依存 E15a）
- F15 `registration-gate-admin-ui` — [shuttlepub-frontends#31](https://github.com/ShuttlePub/shuttlepub-frontends/issues/31)（packet: `.intent-cli/issues/registration-gate-admin-ui/`、2026-11-10 queue 登録・issue 公開。依存 E15a の契約・E15w の API。画面実装はモック合意待ち — 下記「F15 の画面実装ゲート」）

## 依存図

```text
E15a ─┬→ E15w ───────────────┐
      ├→ F15 ────────────────┤
      └→ E15c ─→ E15d ──────┴→ D15 統合受け入れ
E15b ───→ E15c
```

- D15 の全体受け入れは E15d + E15w + F15 が揃って初めて成立する。個別 unit の完了で D15 を完了としない。
- E15c/E15d は E15b の成果物（保護の所在・provider・観測契約）を親が確認するまで draft しない（draft ゲート）。
- F15 のモック実装開始と、実接続を含む最終受け入れ（D15 統合受け入れ）は区別する。

## 便の順序

- 第1便: E15b、E15a（E8 `profile-domain-policy-api-contract` 等の他機能 unit と並行して packet 化）
- 第2便: E15w、F15
- 第3便: E15b の成果物確認後に限り E15c、E15d を draft

## F15 の画面実装ゲート

画面構成・文言・見た目はリード側モックをユーザーがレビュー中で未決（ユーザー方針: 「説明が多すぎる、Misskey/X を見て引き算」）。
**モックへのユーザー合意がこの feature 配下（`intents/emumet/features/registration-readiness-gate/`）の host intent に記録されるまで、
F15 の画面実装 PR（PureScript の View/画面・ルート・CSS・visual baseline）を出さない。** 合意の記録後に host から child（shuttlepub-frontends#31）へ伝達する。
BFF・API 接続・生成型・全状態 fixture など画面構成に依存しない部分は先行可（画面実装とは別 PR）。
`bff/schema.graphql`・生成型は別レーン FN（`profile-identity-web-adaptation`）と直列統合、workspace・CI・visual 共通基盤は別レーン F0 の所有、生成物の手編集は禁止。

## 編集競合と merge 順

Emumet の共有ファイル（`server/src/openapi.rs`、`server/src/route.rs`、本番 router を組み立てる `server/src/main.rs`、
DI wiring、`migrations/`、`openapi.json`）は Emumet 統合担当が一人で最終更新する。
初動の merge 順は **E15a → E8**。E8 は E15a 取り込み後に OpenAPI を再生成する。
E15b は隔離 fixture・compose override・試験成果物を中心とし、本番 Kratos 設定変更は E15d が所有する。
E15w（Emumet#68）は E15a（Emumet#65）の merge 後に rebase し、共有ファイルは一件ずつ統合してその時点の main から `openapi.json` を再生成する。

## 親状態の所在

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に
child へ親状態を作成しない。
