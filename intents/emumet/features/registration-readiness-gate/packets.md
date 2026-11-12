# registration-readiness-gate — packets

> See [../../packets/](../../packets/) for domain-level packet list.
> 計画の正本: 2026-11 D15 登録ゲート計画（thread-xxs52dcx 最終計画 3.C / 4 / 5）。
> ユーザー決定の正本: [candidates.md D15](../../../shuttlepub/packets/candidates.md#d15)、
> [grill 記録](../../../shuttlepub/interviews/discord-feature-grill-2026-10-15.json) `d15-q01`〜`d15-q11`。

## Execution units

domain `emumet`。E15a〜E15w の target は `ShuttlePub/Emumet`、F15 のみ `ShuttlePub/shuttlepub-frontends`。

| unit | slug | 範囲 | 依存 | 状態 |
|---|---|---|---|---|
| E15a | `registration-gate-control-plane` | 管理者の開閉・手動再開・override・revision・監査・状態遷移・通知イベント・管理者別既読。実 Kratos 遮断・実 provider 検証は含まない | なし | PR #67 squash merge 済み（[Emumet#65](https://github.com/ShuttlePub/Emumet/issues/65)） |
| E15b | `registration-kratos-guard-contract` | Kratos v1.3.1 の pre-persist guard 実証と保護の実装所在の決定（ADR）。本番 Kratos 設定への hook 接続は含まない | なし | PR #79 squash merge 済み（`16b9e4301edde8bd4de222ab4d691dc7c32798b8`）、[Emumet#64](https://github.com/ShuttlePub/Emumet/issues/64) close 済み |
| E15c | `registration-protection-readiness` | E15b で決めた保護 adapter・実検証 API・設定世代・readiness 鮮度期限・設定喪失と一時障害の分類 | E15a, E15b | PR #85 squash merge 済み（`d3e157c8e5b1b39c49e1ace6431a6825bb71f0e7`）、[Emumet#80](https://github.com/ShuttlePub/Emumet/issues/80) close 済み |
| E15d | `registration-gate-enforcement` | 実 Kratos hook 配線・保護実行・継続 probe・ゲートと通知イベントの統合。本番 Kratos 設定変更は E15d が所有 | E15a, E15b, E15c | PR #88 (part 1)・#92 (part 2) squash merge 済み。E15d unit 完了。D15 全体受け入れは F15 画面（モック合意待ち）が残るため保留 |
| E15w | `registration-admin-notification-webhook` | 永続イベントの外部 Webhook 配送（stable event ID・署名・timeout/再試行・失敗状態・管理者テスト/再試行） | E15a | PR #69 squash merge 済み（[Emumet#68](https://github.com/ShuttlePub/Emumet/issues/68) close 済み） |
| E15x | `registration-webhook-endpoint-management` | E15w の追加 unit。管理者専用の Webhook 送信先 CRUD API（複数送信先・revision・監査・URL 部分マスク・シークレット暗号化・通知 4 カテゴリ選択）と、送信先ごとの配送・状態・テスト送信・1 件ずつ再試行・cursor ページングの配送失敗一覧・登録時/接続時 SSRF・既存環境変数 1 件の非破壊移行。F15 の Webhook タブ画面は含まない | E15w（完了） | PR #100 squash merge 済み（`7843ccb0de3a792741c608d54beabf81b8bd9b45`）、[Emumet#97](https://github.com/ShuttlePub/Emumet/issues/97) close 済み。後続は F15 の Webhook タブ。経緯: ユーザー決定 `question-433de6d63c710adbcaa304b4ba7d1ba6`（B: 送信先の登録・編集・削除 API を Emumet に追加してから ui-spec どおり実装） |
| F15 | `registration-gate-admin-ui` | emumet-web 管理画面（状態・理由・開閉・再開・override・常時警告・通知一覧/既読・Webhook 状態）。target `ShuttlePub/shuttlepub-frontends` | E15a の契約（モック UI は E15c/E15d/E15w と並行可） | queue 登録・issue 公開済み（[shuttlepub-frontends#31](https://github.com/ShuttlePub/shuttlepub-frontends/issues/31)）。PR #33/#39/#43 squash merge 済み。F15 完了、#31 close 済み |

queue 登録済みの unit（登録成功後に追記する）:

- E15c `registration-protection-readiness` — [Emumet#80](https://github.com/ShuttlePub/Emumet/issues/80)（packet: `.intent-cli/issues/registration-protection-readiness/`、2026-11-10 第3便 queue 登録・issue 公開。依存 E15a・E15b。unit 範囲のみで D15 全体は ready/完了ではない）
- E15d `registration-gate-enforcement` — [Emumet#81](https://github.com/ShuttlePub/Emumet/issues/81)（packet: `.intent-cli/issues/registration-gate-enforcement/`、2026-11-10 第3便 queue 登録・issue 公開。依存 E15a・E15b・E15c。unit 範囲のみで D15 全体は ready/完了ではない）
- E15a `registration-gate-control-plane` — [Emumet#65](https://github.com/ShuttlePub/Emumet/issues/65)（packet: `.intent-cli/issues/registration-gate-control-plane/`、2026-11-10 queue 登録・issue 公開）
- E15b `registration-kratos-guard-contract` — [Emumet#64](https://github.com/ShuttlePub/Emumet/issues/64)（packet: `.intent-cli/issues/registration-kratos-guard-contract/`、2026-11-10 queue 登録・issue 公開）
- E15x `registration-webhook-endpoint-management` — [Emumet#97](https://github.com/ShuttlePub/Emumet/issues/97)（packet: `.intent-cli/issues/registration-webhook-endpoint-management/`、2026-11-11 queue 登録・issue 公開。依存 E15w（完了）、後続 F15 の Webhook タブ。unit 範囲のみで D15 全体は ready/完了ではない）
- E15w `registration-admin-notification-webhook` — [Emumet#68](https://github.com/ShuttlePub/Emumet/issues/68)（packet: `.intent-cli/issues/registration-admin-notification-webhook/`、2026-11-10 queue 登録・issue 公開。依存 E15a）
- F15 `registration-gate-admin-ui` — [shuttlepub-frontends#31](https://github.com/ShuttlePub/shuttlepub-frontends/issues/31)（packet: `.intent-cli/issues/registration-gate-admin-ui/`、2026-11-10 queue 登録・issue 公開。依存 E15a の契約・E15w の API。画面実装はモック合意待ち — 下記「F15 の画面実装ゲート」）

### E15a closeout（2026-11-10、unit 範囲のみ）

- Emumet PR #67 は squash merge 済み（`0ac9e9c087f61447c9a2c5e4a4cbf04a1075f2ca`）、Emumet#65 は close 済み。
- 独立 Reviewer approve（run `run-01m71eeqq2r2c2qhkj6b0yb6zx`、must 0）、CI 全緑。
- 実 DB テスト証跡: Rust run `42731914696` の `check-driver` は 171 passed / 0 ignored。
- E15a は管理 control plane のみ。E15a 単体では実登録を保護しない。E15d の実 enforcement、E15w、F15 は未完了で、D15 全体は完了扱いにしない。

### E15w closeout（2026-11-10、unit 範囲のみ）

- Emumet PR #69 は squash merge 済み（`ae9bdddef26c21b2d70e08a5a8f74ac5e6153d05`）、Emumet#68 は close 済み。
- 独立 Reviewer approve（run `run-01m71kqtt6n5htgs0g8zsyqdfz`、must 0）、CI run `42745129343` 全 pass。`check-driver` は実 DB テストを実行し、0 ignored（前 run で確認済み）。
- E15w の範囲のみ完了。E15b/E15c/E15d と F15 の画面実装は未完了で、D15 全体は未完了のままとする。

### E15b closeout（2026-11-10、unit 範囲のみ）

- Emumet PR #79 は squash merge 済み（`16b9e4301edde8bd4de222ab4d691dc7c32798b8`）、Emumet#64 は close 済み。
- 独立 Reviewer approve（run `run-01m7244qfjdrzbkbcjdhfdqszh`、must 0）、Rust run `42774934783` と e2e run `42774933166` の CI 全12 checks pass。
- ADR [registration-protection-placement.md](../../decisions/registration-protection-placement.md) の決定 A（`question-88b36432ff84f589f1388699c8f40fa3`）に基づく。Kratos v1.3.1 の実証で pre-persist 拒否時に identity が作成されないことを確認した。
- E15b の範囲のみ完了。E15c/E15d の実装と F15 の画面実装、D15 全体の統合受け入れは未完了のままとする。

### E15c closeout（2026-11-10、unit 範囲のみ）

- Emumet PR #85 は squash merge 済み（`d3e157c8e5b1b39c49e1ace6431a6825bb71f0e7`）、Emumet#80 は close 済み。
- 独立 Reviewer approve（run `run-01m72ahfsrhdcaknymyeq23c41`、head `f4ba87e` 時点で must 0）。head `665c7404b936bfee7ff7732ba3b6806bcf4b4265` の変更は Reviewer 任意指摘 (3) の RSET best-effort 化のみ。CI 全 pass、実 DB `check-driver` は 311 passed / 1 ignored（live Turnstile）。
- E15c の範囲のみ完了。E15d の本番 Kratos hook 配線・継続 probe、E15w と F15 の画面実装は未完了で、D15 全体は未完了。

### E15d part 1 closeout（2026-11-10、準備 PR のみ）

- Emumet PR #88（E15d part 1、Refs #81）は squash merge 済み（`ef063d67bc28b2a93fb6c09babc73d90216fa176`）。独立 Reviewer approve（run `run-01m730g3c48mb2252sn8qm0h5e`、must 0）、CI 全13 checks pass。
- これは準備 PR のみ。part 2 の本番 Kratos hook 配線・attestation・実 Kratos D15 全状態 CI は未完了。E15d / D15 全体を完了扱いにせず、claim も release しない。
- PR 本文の「CI / 続く slice」に、後続 part 2 で「そこで `Closes #81` とする」と明記されており、GitHub が PR #88 の merge 時に Emumet#81 を自動 close した（2026-11-10 15:46:34Z）。squash commit message に closing keyword はない。reopen と説明コメントの親許可は伝達されたが、GitHub 操作は権限不足として拒否され未実施。ユーザーに直接確認中で、#81 は CLOSED のまま。ラベル・queue の変更や closeout は実行していない。

### E15d part 2 closeout（2026-11-10、unit 範囲のみ）

- Emumet PR #92（E15d part 2、Closes #81、head `1d896bfef2d741552fdc003f393545d5e826a765`）は squash merge 済み（`95e3f77c7517d3337380df95f74a90eabe6b4ee0`）。part 1 の PR #88 は `ef063d67bc28b2a93fb6c09babc73d90216fa176` で squash merge 済み。
- 独立 Reviewer approve（run `run-01m73ajh2zjhz9p4ysdrk0h760`、must 0）、CI 全14 checks success。実 Kratos の D15 q01〜q11（`real_kratos_d15_q01_through_q11`、E2E run `42878493680`）は 1 pass / 0 ignored。Rust run `42878495066` の実 DB は 37 passed / 0 ignored、driver は 323 passed / 1 ignored（live Cloudflare のみ）。
- #81 は #88 merge 時にすでに CLOSED で、reopen せず CLOSED のまま。`automation pr-transition --transition approved --write` は CLOSED issue が理由で拒否されず適用済み。closeout で queue は completed、claim は release 済み。
- E15d の範囲のみ完了。F15 の画面実装はユーザーのモック合意待ちであり、D15 全体は未完了のままとする。残余リスクは [acceptance.md](acceptance.md) に記録する。

### E15x closeout（2026-11-11、unit 範囲のみ）

- Emumet PR #100（Closes #97、head `b9fa4a38bd56d4ae28c564110a7bbeb993493766`）は squash merge 済み（`7843ccb0de3a792741c608d54beabf81b8bd9b45`）、#97 は close 済み。
- 独立 Reviewer approve（run `run-01m76181y2h6fb484y0zw5bbzm`、must 0）、CI 全 pass。実 DB は driver 67 / application 20 / server 10 passed、0 ignored。実 Kratos E2E も pass。
- E15x の範囲のみ完了。F15 の Webhook タブ実装が後続であり、D15 全体は未完了のままとする。

### D15 / F15 最終 closeout（2026-11-12）

- F15 の最終 PR shuttlepub-frontends #43（Closes #31、head `287ce17b329f34b5191f8ab8d9fd937e1fa59ca1`）は squash merge 済み（`1227ca8abc4fb80a78fb88e9fa1b888be0db7c7c`）。前段 #33 は `7516562db15952144dd406070ffe3d3f95de02c3`、#39 は `3c7c7e2b9984db1762b2092ae18f4959751569ed` で squash merge 済み。独立 Reviewer approve（run `run-01m76dttgrd68w833r0n102zte`、must 0）、CI 2 checks pass（build、Components and application screens）。shuttlepub-frontends#31 は CLOSED。
- D15 は全 unit 完了: E15a #67 (`0ac9e9c087f61447c9a2c5e4a4cbf04a1075f2ca`)、E15w #69 (`ae9bdddef26c21b2d70e08a5a8f74ac5e6153d05`)、E15b #79 (`16b9e4301edde8bd4de222ab4d691dc7c32798b8`)、E15c #85 (`d3e157c8e5b1b39c49e1ace6431a6825bb71f0e7`)、E15d #88 (`ef063d67bc28b2a93fb6c09babc73d90216fa176`)・#92 (`95e3f77c7517d3337380df95f74a90eabe6b4ee0`)、E15d bootstrap 修正 #99 (`11414a68ec1bb6872d8af6c09f7e1a312c19922e`)、E15x #100 (`7843ccb0de3a792741c608d54beabf81b8bd9b45`)、F15 #33/#39/#43（上記）。
- 残余リスク: hook 除去時に Emumet 単独では物理的に登録を遮断できないこと、LB sampling が有限であること、SMTP の時間差、評価から persist までが非原子的であること、遅延 persist の再観測は 10 秒有界であること、Webhook URL が平文保存であること、鍵ローテーションは対象外、tracing 非漏洩テストは未実装。
- 未決: (?) ヘルプページの置き場所。

## 依存図

```text
E15a ─┬→ E15w ─→ E15x ───────┤   （E15x の API 公開後に F15 の Webhook タブが接続する）
      ├→ F15 ────────────────┤
      └→ E15c ─→ E15d ──────┴→ D15 統合受け入れ
E15b ───→ E15c
```

- D15 の全体受け入れは E15d + E15w + F15 が揃って初めて成立する。個別 unit の完了で D15 を完了としない。
- E15c/E15d は E15b の成果物（保護の所在・provider・観測契約）を親が確認するまで draft しない（draft ゲート。2026-11-10 に ADR で所在・provider・観測契約を確認済みとして E15c/E15d を draft・queue 登録・issue 公開した。E15b PR #79 は squash merge 済み）
- F15 のモック実装開始と、実接続を含む最終受け入れ（D15 統合受け入れ）は区別する。

## 便の順序

- 第1便: E15b、E15a（E8 `profile-domain-policy-api-contract` 等の他機能 unit と並行して packet 化）
- 第2便: E15w、F15
- 第3便: E15b の成果物確認後に限り E15c、E15d を draft（2026-11-10 完了: E15c=Emumet#80、E15d=Emumet#81）

## F15 の画面実装ゲート

画面構成・文言・見た目はリード側モックをユーザーがレビュー中で未決（ユーザー方針: 「説明が多すぎる、Misskey/X を見て引き算」）。
**モックへのユーザー合意がこの feature 配下（`intents/emumet/features/registration-readiness-gate/`）の host intent に記録されるまで、
F15 の画面実装 PR（PureScript の View/画面・ルート・CSS・visual baseline）を出さない。** 合意の記録後に host から child（shuttlepub-frontends#31）へ伝達する。
BFF・API 接続・生成型・全状態 fixture など画面構成に依存しない部分は先行可（画面実装とは別 PR）。
`bff/schema.graphql`・生成型は別レーン FN（`profile-identity-web-adaptation`）と直列統合、workspace・CI・visual 共通基盤は別レーン F0 の所有、生成物の手編集は禁止。

### F15 BFF/API 部分の進捗（2026-11-10）

- shuttlepub-frontends PR #33（head `3e07fec5d96c1e8c715f7bb6b0195bdcbcf60be2`）は squash merge 済み（`7516562db15952144dd406070ffe3d3f95de02c3`）。Refs #31。独立 Reviewer approve（run `run-01m71j8qsyj87h460v46bhqyqn`、must 0）、CI 全 pass。
- BFF/API・生成型・fixture の先行部分のみ。画面実装はモック合意待ちで未着手。issue #31 は OPEN のまま、F15 は未完了で queue 状態も変更しない。

### F15 画面部分の進捗（2026-11-11）

- F15 画面 PR shuttlepub-frontends #39（head `93f0b83eb8b6d7edbcc59bc8e239bf799f399fee`）は squash merge 済み（`3c7c7e2b9984db1762b2092ae18f4959751569ed`）。基準は [ui-spec.md](ui-spec.md)（モック A v5）。Refs #31（closing keyword なし）。独立 Reviewer approve（main #41 との衝突解消差分を含む）、CI 全 pass。
- Webhook 登録 UI（「＋」・登録/編集モーダル・URL 部分マスク・古い配送失敗の再試行）は E15x（[Emumet#97](https://github.com/ShuttlePub/Emumet/issues/97)）の merge 後に後続 PR で実装する（ユーザー決定 `question-433de6d63c710adbcaa304b4ba7d1ba6`）。ui-spec の (?) はヘルプの置き場所が決まるまで出さない。
- issue #31 は OPEN のまま。F15 は未完了で、closeout・pr-transition・queue 状態の変更はしない。claim `execution-unit:registration-gate-admin-ui`（actor `f15-worker`）は後続 PR のため保持。

## 編集競合と merge 順

Emumet の共有ファイル（`server/src/openapi.rs`、`server/src/route.rs`、本番 router を組み立てる `server/src/main.rs`、
DI wiring、`migrations/`、`openapi.json`）は Emumet 統合担当が一人で最終更新する。
初動の merge 順は **E15a → E8**。E8 は E15a 取り込み後に OpenAPI を再生成する。
E15b は隔離 fixture・compose override・試験成果物を中心とし、本番 Kratos 設定変更は E15d が所有する。
E15w（Emumet#68）は E15a（Emumet#65）の merge 後に rebase し、共有ファイルは一件ずつ統合してその時点の main から `openapi.json` を再生成する。

## 親状態の所在

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に
child へ親状態を作成しない。
