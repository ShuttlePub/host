## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。frontends 側に親状態を作成しない。

## Goal

shuttlepub-web で、他サーバーのカスタム絵文字 (EmojiView.origin あり、usage=existing_reaction_only) を、投稿に付いている既存リアクションチップへの便乗だけで使えるようにする (D09 の画面差分)。

## Why This Slice Exists Now

ユーザーが決めた作業順 (準備・D09・D08・D04) の D09 unit。契約 (ShuttlePub #21) と producer pin の更新 (frontends #48) は完了済み。

## Current Observed State

- pin は ShuttlePub `a00d234aedecb0223ba20dc8d7e9334cf9d39e83`・Emumet `c4d6ea3a4f06e924e73ffa058e5ec6e2409f1e3d`。EmojiView の `origin`/`image_state`/`usage` と集計チップの `view` は REST → GraphQL → PureScript で保持済みだが、画面には出していない (見た目は従来のまま)
- ピッカーの custom カテゴリは自サーバー絵文字のみ。外部チップからの反応操作・地球マーク・`:name:` 代替表示は未実装
- bff/schema.graphql の `Emoji.imageUrl`/`RelationActor.iconUrl` のコメントは「ブラウザが直接読む」前提のまま

## Accepted Baseline You May Assume

- 仕様の正本: host main の `intents/shuttlepub/features/note-search-ui/ui-spec.md` §5、`quick-reaction-ui/ui-spec.md`、`candidates.md` の D09 (d09-q01〜q06)
- 外部絵文字は既存チップへの便乗のみ。ピッカー・お気に入り (常用)・最近使った (現状なし、新設しない) には出さない。直接 mutation されても mock が拒否する
- 外部絵文字チップに地球マーク (絵文字の直後・件数の前、11px、muted 色、U5=c)。`image_state=missing`・削除済み・画像ロード失敗は `:name:` 表示で押せる。local の利用不可表示は変えない
- d09-q06 (ユーザー決定): 他サーバーの画像はブラウザから外部サーバーへ直接読み込まない。自サーバー経由の安全な配信経路が既存契約にあれば使い、無ければ外部絵文字は常に `:name:` + 地球マークの代替表示。プロキシ新設は別 unit
- 反応規則: 422 `emoji_unavailable` → 同一絵文字の再送 200 no-op → 422 `emoji_usage_not_allowed` → 409 `conflict`。422/501 で成功トースト・保存済み状態にしない
- マージは独立レビュー後にリードが指示する

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `apps/shuttlepub-web, apps/ui-catalog/visual`

Target part: `外部絵文字チップへの便乗 UI と mock・BFF・エラー経路の追従`

## In Scope

- 外部絵文字チップの外観 (地球マーク、`:name:` 代替、画像ロード失敗時の代替) と押下による便乗
- ピッカー・常用絵文字・最近使ったに出さない。mock が不正 mutation を拒否する
- 反応規則の優先順と、EMOJI_USAGE_NOT_ALLOWED の区別、422/501 で成功扱いしない
- 他サーバー画像の経路の判断 (PR 本文に根拠付きで記載) と bff/schema.graphql コメントの修正
- テスト (通常/画像なし/削除済みチップ、picker/favorites 非表示、不正 mutation、422/501、便乗→解除→Undo、Profile 往復、遅延応答)、visual 登録、README
- 必要なら `quick_reaction/schema_cases.json` の vendor 追加

## Out Of Scope

- 画像プロキシの新設 (別 unit)、RelationActor の表示変更 (D08 unit)、検索画面 (D04 unit)
- 外部絵文字の取得・キャッシュ・連合 (producer 側)

## Standalone Child Issue Contract

shuttlepub-web で外部絵文字チップへの便乗 UI を実装する。外部絵文字は既存チップへの便乗だけで使え、ピッカー・常用・最近使ったには出さず、直接 mutation は mock が拒否する。外部チップには地球マークを付け、画像なし・削除済み・ロード失敗は `:name:` で押せる。他サーバー画像をブラウザから外部へ直接読み込まない (画像経路の判断を PR 本文に根拠付きで書く)。

## Acceptance Criteria

1. 外部絵文字チップに地球マークが出て、同名の自サーバー絵文字チップと区別できる (読み上げは「:name:（host） でリアクション（件数）」)。
2. `image_state=missing`・削除済み・画像ロード失敗は同じ `:name:` 代替表示で押せる。local の利用不可表示は変えない。
3. 他サーバーの絵文字画像をブラウザから外部サーバーへ直接読み込まず、画像経路の判断を PR 本文に記載し、schema.graphql のコメントを方針に合わせる。
4. 外部絵文字はピッカー・常用・最近使ったに出ず、直接 mutation は mock が拒否する。
5. 反応規則の優先順を守り、EMOJI_USAGE_NOT_ALLOWED を区別し、422/501 で成功扱いしない。
6. 一人一投稿一反応・解除→選び直し・Undo・FIFO・Profile 分離を維持し、便乗→解除→Undo・Profile 往復・遅延応答でも壊れない。
7. テストを追加し、purs-tidy・openapi:verify・codegen:check・spago build/test・bun test・tsc・visual・E2E が通り、既存 CI がグリーン。real E2E は EMUMET_READ_TOKEN 未設定で skip される既知事情を PR 本文に明記する。


## Verification

purs-tidy、openapi:verify、codegen:check、spago build/test、bun test、tsc --noEmit、ui-catalog の test/visual (shuttlepub-verify desktop/mobile・capture)、E2E (mock・cookie-isolation)、`git diff --check`。

## Related Links

- 依存: ShuttlePub/shuttlepub-frontends#47 / #48 (schema pin)、ShuttlePub/ShuttlePub#20 / #21 (外部絵文字 API 契約)

## Knowledge Maintenance

- Intent placement: quick-reaction-ui/overview.md の拡張 (新規ノード不要)
- ADR candidate: none
- Diagram candidate: none
- Docs update: candidates.md に到達範囲・画像経路の判断・後続への申し送り
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` / implementation → ShuttlePub/shuttlepub-frontends (apps/shuttlepub-web)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
