# shuttlepub-web-note-search-ui Implementation Packet

## Goal

shuttlepub-web の D04 投稿検索を実装する。BFF (ShuttlePub #23 の検索、#27 の作者 resolve/suggestions を mock・real で同じ型・エラー体系にし GraphQL に載せる) と、`/search` 画面 (作者チップ、`from:@acct` 変換、候補、無限スクロール、ハイライト、時間切れの続き読み、URL 保持、プロフィール入口)。

## Why

ユーザー決定済みの作業順 (準備・D09・D08・D04) の D04 unit。契約 (#23・#27、pin bd997e6) と UI 仕様 (ui-spec v2、d04-q08〜q18、d09-q06) は確定済みで、BFF と画面だけが残っている。

## Scope

- BFF の検索・作者 resolve/suggestions (mock/real 同一の型・エラー体系、real は 501・不正 200・通信失敗を成功にしない、Profile スコープ・本人所有確認、fixture vendor と contract test)
- `/search` 画面 (作者チップ・from 変換・候補・結果・無限スクロール・時間切れ続き読み・URL 保持・プロフィール入口)
- 遅延応答の破棄、mute/block 非漏洩、外部リクエスト 0
- テスト・visual 登録・E2E

## Out of scope

- 画像プロキシ、詳細検索メニュー、契約変更、共用 postMenu 全体への入口追加

## Verification

purs-tidy、openapi:verify、codegen:check、spago build/test、bun test、tsc、ui-catalog の test/visual、E2E (mock・cookie-isolation)、`git diff --check`。

## Knowledge Maintenance (G461, optional)

- Intent placement: note-search-ui の既存仕様の実装 (新規ノード不要)。
- ADR candidate: none.
- Diagram candidate: none.
- Docs update: candidates.md に到達範囲・契約に無いカード項目の扱い・real が 501 の事情。
- Closeout learning: 検索 BFF と画面の到達範囲、from 解決規則の実装判断、時間切れ続き読み、契約に無い検索カード項目の扱い。write_back_required: true.
- Guide reachability (G645): `guide workflow task implementation-loop` / implementation → ShuttlePub/shuttlepub-frontends (apps/shuttlepub-web)。
