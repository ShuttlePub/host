## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。frontends 側に親状態を作成しない。

## Goal

shuttlepub-web の D08 (個人単位のドメインミュート・ブロック) の画面を手直しする。ミュート・ブロック一覧 (アカウントタブ) の各行を icon／name／acct で表示し、第三者の引用による非表示を「引用しています／引用元: <domain>」で示す。

## Why This Slice Exists Now

ユーザーが決めた作業順 (準備・D09・D08・D04) の D08 unit。契約 (Emumet c4d6ea3 (#106)、ShuttlePub #25) と producer pin の更新 (frontends #48)、他サーバー画像の経路の判断 (frontends #50) は完了済みで、画面の差分だけが残っている。

## Current Observed State

- アカウントタブの行は actor URL (scheme なし) の表示で、BFF が保持している `ActorPolicy.targetActor` (kind/status/display_name/icon_url/acct/preferred_username/profile_id) を画面が使っていない
- 引用による非表示 (`HiddenContent.cause=quote`) は BFF/GraphQL まで届いているが、画面の文言は cause 別になっておらず引用元ドメインも出していない。README は旧前提「引用を reveal しても引用元は hidden のまま」のまま

## Accepted Baseline You May Assume

- 仕様の正本: host main の `intents/shuttlepub/features/personal-domain-controls-ui/ui-spec.md` (1-6 一覧、3-4 引用)・`mocks/d08-v5.html`、candidates.md の D08 (d08-q18/q19/q20) と D09 (d09-q06)
- データ経路は既存 BFF のまま。ブラウザから Emumet を直接呼ばない。actor URL から名前・acct を推測しない
- d08-q20: pending/unavailable も含め、名前は display_name → preferred_username → acct → actor URL の順、状態文なし、解除は常に可能
- d09-q06: 他サーバーの icon_url をブラウザで直接読まない。安全な自サーバー経由の配信経路は契約に無い (D09 で確認済み) ので remote は常に代替アイコン。プロキシ新設は別 unit
- 解除の識別子は policy ID。cause=quote のとき reveal で引用先も表示 (ShuttlePub #25)
- マージは独立レビュー後にリードが指示する

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `apps/shuttlepub-web, apps/ui-catalog/visual`

Target part: `ミュート・ブロック一覧の icon／name／acct 表示と、引用による非表示の文言・引用元ドメイン表示`

## In Scope

- 一覧行の icon／name／acct (target_actor 由来、代替順、remote は常に代替アイコン、解除は policy ID)
- 一覧取得 501 を空一覧にしない、解除失敗を成功扱いしない、トースト・ダイアログの呼び方の統一
- 引用による非表示 (cause=quote/direct)、引用元ドメイン、reveal・隠す・Profile 切替・古い応答破棄
- ui-spec 1-6/3-4 と mocks の差分反映、README の旧前提更新
- テスト、visual 登録、E2E

## Out Of Scope

- 画像プロキシの新設 (別 unit)、検索画面 (D04 unit)、ShuttlePub の実投稿制御、Emumet・ShuttlePub 側の契約変更

## Standalone Child Issue Contract

shuttlepub-web のミュート・ブロック一覧の行を icon／name／acct (target_actor 由来、名前は display_name → preferred_username → acct → actor URL の順、remote は常に代替アイコン、状態文なし、解除は常に可能で policy ID による) で表示し、引用による非表示を cause=quote のとき「ミュート中／ブロック中のドメインの投稿を引用しています」＋「引用元: <domain>」＋［この投稿だけ表示］で示す (cause=direct は従来文言)。仕様の正本と差があれば反映し、対応表を PR 本文に書く。

## Acceptance Criteria

1. 一覧の行が icon／name／acct で表示され、種別バッジ・状態文なし、解除は「ミュート解除」(青)・「ブロック解除」(赤)。
2. local/remote × resolved/pending/unavailable × 表示項目欠落で名前の代替順・acct 表示が仕様どおりで、解除が常に可能。
3. 他サーバーの icon_url を外部へ読み込まない。local icon の扱いを根拠付きで PR 本文に記載する。
4. 解除は policy ID で行い (同名・同 acct でも選んだ行だけ)、トースト・ダイアログの呼び方が揃う。501 を空一覧にせず、解除失敗を成功扱いしない。
5. cause=quote/direct の文言を区別し (両方該当時は producer の優先順位)、reveal・隠す・Profile 切替・古い応答破棄が正しく、hidden 応答に本文等が漏れない。独立制限 (CW・センシティブ・削除・閲覧権) は維持。
6. ui-spec 1-6/3-4 と mocks の差分を反映し対応表を PR 本文に書く。README の旧前提を更新する。
7. テスト追加、purs-tidy・openapi:verify・codegen:check・spago build/test・bun test・tsc・visual・E2E が通り、既存 CI がグリーン。real E2E は EMUMET_READ_TOKEN 未設定で skip される既知事情を PR 本文に明記する。

## Verification

purs-tidy、openapi:verify、codegen:check、spago build/test、bun test、tsc --noEmit、ui-catalog の test/visual (shuttlepub-verify desktop/mobile・capture)、E2E (mock・cookie-isolation)、`git diff --check`。

## Related Links

- 依存: ShuttlePub/shuttlepub-frontends#47 / #48 (schema pin)、#49 / #50 (D09)、ShuttlePub/ShuttlePub#24 / #25 (引用の隠し契約)、ShuttlePub/Emumet#106 (c4d6ea3、target_actor)

## Knowledge Maintenance

- Intent placement: personal-domain-controls-ui の既存仕様に追従 (新規ノード不要)
- ADR candidate: none
- Diagram candidate: none
- Docs update: candidates.md に到達範囲・local icon の判断・D04 への申し送り
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` / implementation → ShuttlePub/shuttlepub-frontends (apps/shuttlepub-web)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
