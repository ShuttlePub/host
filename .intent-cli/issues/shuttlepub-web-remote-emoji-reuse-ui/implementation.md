# shuttlepub-web-remote-emoji-reuse-ui Implementation Packet

## Goal

shuttlepub-web に、他サーバーのカスタム絵文字 (EmojiView.origin あり、usage=existing_reaction_only) を既存リアクションチップへの便乗だけで使える UI (地球マーク・`:name:` 代替表示・ピッカー/常用への非表示・不正 mutation の拒否) を実装する。

## Why

ユーザー決定済みの作業順 (準備・D09・D08・D04) の D09 unit。契約 (ShuttlePub #21) と pin 更新 (frontends #48) は完了しており、画面の差分だけが残っている。

## Scope

- 外部絵文字チップの外観 (地球マーク、`:name:` 代替表示、画像ロード失敗時の代替)、押下による便乗
- ピッカー・常用絵文字・最近使った (新設しない) に出さない、mock の不正 mutation 拒否
- 422 emoji_unavailable / 200 no-op / 422 emoji_usage_not_allowed / 409 conflict の優先順と、422/501 で成功扱いしない
- 他サーバー画像の経路の判断 (d09-q06) と bff/schema.graphql コメントの修正
- テスト・visual 登録・README

## Out of scope

- 画像プロキシの新設 (別 unit)、RelationActor の表示変更 (D08)、検索画面 (D04)、外部絵文字の取得・キャッシュ・連合 (producer 側)

## Verification

purs-tidy、openapi:verify、codegen:check、spago build/test、bun test、tsc、ui-catalog の test/visual、E2E (mock・cookie-isolation)、`git diff --check`。

## Knowledge Maintenance (G461, optional)

- Intent placement: quick-reaction-ui/overview.md の拡張 (新規ノード不要)。
- ADR candidate: none.
- Diagram candidate: none.
- Docs update: candidates.md に到達範囲・画像経路の判断・後続への申し送り。
- Closeout learning: 画像経路の判断、便乗・不正 mutation・422/501 の扱い、D08 への申し送り。write_back_required: true.
- Guide reachability (G645): `guide workflow task implementation-loop` / implementation → ShuttlePub/shuttlepub-frontends (apps/shuttlepub-web)。
