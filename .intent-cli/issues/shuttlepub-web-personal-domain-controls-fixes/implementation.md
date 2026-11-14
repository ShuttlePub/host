# shuttlepub-web-personal-domain-controls-fixes Implementation Packet

## Goal

shuttlepub-web の D08 (個人単位のドメインミュート・ブロック) の画面を手直しする。ミュート・ブロック一覧 (アカウントタブ) の各行を icon／name／acct で表示し (d08-q18/q20、d09-q06)、第三者の引用による非表示を cause=quote の文言と引用元ドメインで示す (d08-q19、ui-spec 3-4)。

## Why

ユーザー決定済みの作業順 (準備・D09・D08・D04) の D08 unit。契約 (Emumet #105/#106、ShuttlePub #25) と pin 更新 (frontends #48) は完了しており、画面の差分だけが残っている。

## Scope

- 一覧行の icon／name／acct (target_actor 由来、代替順、remote は常に代替アイコン、状態文なし、解除は常に可能、policy ID 解除)
- 引用による非表示 (cause=quote/direct の文言、引用元ドメイン、reveal)
- ui-spec 1-6/3-4 と mocks との差分の反映、README の旧前提の更新
- テスト・visual 登録・E2E

## Out of scope

- 画像プロキシの新設、検索画面 (D04)、ShuttlePub の実投稿制御、Emumet/ShuttlePub 側の契約変更

## Verification

purs-tidy、openapi:verify、codegen:check、spago build/test、bun test、tsc、ui-catalog の test/visual、E2E (mock・cookie-isolation)、`git diff --check`。

## Knowledge Maintenance (G461, optional)

- Intent placement: personal-domain-controls-ui の既存仕様に追従 (新規ノード不要)。
- ADR candidate: none.
- Diagram candidate: none.
- Docs update: candidates.md に到達範囲・local icon の判断・D04 への申し送り。
- Closeout learning: 一覧行の表示規則、引用による非表示の画面の扱い、local icon の判断、D04 への申し送り。write_back_required: true.
- Guide reachability (G645): `guide workflow task implementation-loop` / implementation → ShuttlePub/shuttlepub-frontends (apps/shuttlepub-web)。
