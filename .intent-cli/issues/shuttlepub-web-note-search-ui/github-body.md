## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。frontends 側に親状態を作成しない。

## Goal

shuttlepub-web に D04 投稿検索を実装する。BFF (ShuttlePub #23 の検索と #27 の作者 resolve/suggestions を mock・real で同じ型とエラー体系にそろえ、GraphQL に載せる) と、既存の `/search` placeholder を置き換える画面 (検索欄内の作者チップ、`from:@acct` 変換、候補、無限スクロール、ハイライト、時間切れの続き読み、URL 保持、プロフィール「…」からの入口)。

## Why This Slice Exists Now

ユーザーが決めた作業順 (準備・D09・D08・D04) の最後の unit。契約 (ShuttlePub #23・#27、pin bd997e6) と UI 仕様 (note-search-ui ui-spec 合意 v2、grill d04-q08〜q18、d09-q06) は確定済みで、BFF と画面だけが残っている。

## Current Observed State

- `/search` はナビゲーション先だけの placeholder
- 固定 OpenAPI には `searchPersonalNotes`・`resolveNoteSearchAuthor`・`suggestNoteSearchAuthors` があるが BFF/GraphQL には無い。content.ts の `searchFor` (S8 の表示抑制) は U0 で #23 に追従済み
- producer の fixture `note_search_author/{projection,schema_cases}.json` は未 vendor
- ShuttlePub の検索・作者 API は契約のみで real は常に 501

## Accepted Baseline You May Assume

- 仕様の正本: host main の `intents/shuttlepub/features/note-search-ui/ui-spec.md` と `mocks/index.html` (合意 v2)、candidates.md の D04・D09 (d09-q06)
- 検索結果の項目は note_id・author (actor URL)・body・created_at だけ。表示名・アイコン・件数・リアクションは契約に無い。不足は不足として表示し、mock の仮表示と区別する
- 外部 icon・絵文字はブラウザで読まない (d09-q06)。名前は D08 の規則 (display_name → preferred_username → @acct → actor URL)、URL から推測しない
- 作者 API の 409 はリアクションの conflict と別物。real の 501・不正な 200・通信失敗を mock の成功にフォールバックしない
- マージは独立レビュー後にリードが指示する

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `apps/shuttlepub-web, apps/ui-catalog/visual`

Target part: `D04 投稿検索の BFF (検索・作者 resolve/suggestions) と /search 画面`

## In Scope

- BFF: GraphQL Query と型、mock・real adapter (同じ型・エラー体系)、Profile スコープと本人所有確認、fixture の vendor と contract test
- 画面: 検索欄内の作者チップ、`from:@acct` 変換 (Enter/スペース/候補/IME)、候補 combobox、結果の無限スクロール・ハイライト・CW 畳み、時間切れの続き読み、追加ページ失敗の再試行、URL 保持、プロフィール「…」の入口
- 遅延応答の破棄、mute/block 非漏洩、外部リクエスト 0
- テスト、visual 登録、E2E

## Out Of Scope

- 画像プロキシ (別 unit)、詳細検索メニュー、ShuttlePub・Emumet 側の契約変更、共用 postMenu の全投稿メニューへの入口追加

## Standalone Child Issue Contract

shuttlepub-web の `/search` を、ui-spec v2 に従う投稿検索にする。BFF は #23・#27 の契約を mock と real で同じ型・エラー体系で包み (real の 501・不正 200・通信失敗は成功に見せない)、画面は `from:@acct` を作者チップに変換し (Enter は変換後に検索、スペースは変換のみ、候補は actor_url で確定、手入力のみ resolve)、無限スクロール・一致のハイライト・CW 畳み・時間切れの続き読み・URL 保持・プロフィールからの入口を備える。契約に無い項目は不足として扱う。

## Acceptance Criteria

1. BFF: 選択 Profile にスコープし本人所有・選択一致を確認する。mock と real は同じ型・エラー体系で、real の 501・不正 200・通信失敗は成功にならない。作者 API の 409 はリアクションの conflict と混ざらない。契約に無い項目は不足として扱い、mock の仮表示と区別する。
2. 検索欄: `from:@user@host` を作者チップに変換 (Enter は変換後に検索、スペースは変換のみ、2 つ目の from は置換、解決失敗は元テキストを残して検索しない、host 省略は自サーバー)。作者は最大 1、キーワードのみも可、常設の「+投稿者」なし。候補は最大 5 で combobox のキーボード操作、候補選択は actor_url で確定し resolve しない。IME 確定の Enter/スペースで誤動作しない。
3. 結果: 無限スクロール、本文・CW の一致を安全なテキスト要素でハイライト、CW は畳む。条件変更で cursor と世代をリセットし、多重ロード・重複追加なし。時間切れは途中結果を残して自動読み込み停止、「途中から続きを読む」で再開。追加ページ失敗は再試行。通信エラー・501 は途中結果に偽装せず、501 は短い未実装表示。
4. URL に確定した条件だけを保持し、戻る・共有・再読込で再現する (SSR→hydration を含む)。プロフィール「…」の入口は作者チップ付きで即検索する。
5. 遅延応答が新しい入力・Profile を上書きしない。Profile 切替でリセットする。mute/block 対象が件数・空き行・ハイライトに漏れない。外部リクエスト 0。
6. テスト (Enter/スペース/IME、from 置換、解決失敗、host 省略、候補選択で resolve 未実行、古い応答破棄、cursor 終了・重複・時間切れ・続き・追加ページ失敗、ハイライト、URL 往復、プロフィール入口、0 件、429/503/501、desktop/mobile、SSR→hydration、Profile 切替、外部リクエスト 0)、producer fixture の contract test。
7. purs-tidy・openapi:verify・codegen:check・spago build/test・bun test・tsc・visual・E2E が通り、既存 CI がグリーン。real E2E は EMUMET_READ_TOKEN 未設定で skip される既知事情を PR 本文に明記する。

## Verification

purs-tidy、openapi:verify、codegen:check、spago build/test、bun test、tsc --noEmit、ui-catalog の test/visual (shuttlepub-verify desktop/mobile・capture)、E2E (mock・cookie-isolation)、`git diff --check`。

## Related Links

- 依存: ShuttlePub/ShuttlePub#23 (note search)・#27 (author lookup)、ShuttlePub/shuttlepub-frontends#47 / #48 (schema pin)、#50 (D09)、#52 (D08)

## Knowledge Maintenance

- Intent placement: note-search-ui の既存仕様の実装 (新規ノード不要)
- ADR candidate: none
- Diagram candidate: none
- Docs update: candidates.md に到達範囲・契約に無いカード項目の扱い・real が 501 の事情
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` / implementation → ShuttlePub/shuttlepub-frontends (apps/shuttlepub-web)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
