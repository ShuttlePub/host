# remote-emoji-reuse-api-contract Implementation Packet

## Goal

ShuttlePub の /api/v1 に、他サーバーのカスタム絵文字で付いた既存リアクションへの便乗(D09)の API 契約を追加する。マージ済みの S3(`server/src/api_v1/quick_reaction.rs`)と S8(`server/src/api_v1/personal_domain.rs`)を拡張し、`EmojiView` の出自・画像状態・利用範囲、S8 `EmojiReactionCount` の `view`、新エラー `emoji_usage_not_allowed`、reaction PUT の判定順を型・生成 schema・fixture・501 route として確定させる。実取得・保存・連合は実装しない。

## Why

frontends の UI(既存チップから同じ外部絵文字で便乗する操作、同名別サーバー絵文字を見分ける地球マーク)が準拠する producer 契約を、backend 実装前に固定する必要がある。d09-q01〜q03 は決定済みだが、S3/S8 の契約には外部絵文字の出自・利用範囲・画像状態が無い。

## Scope

- `EmojiRef` は不変。`EmojiView` に optional で `origin`(出自ドメイン。Unicode・自サーバー絵文字では無し)、`image_state`(画像の有無。`availability` とは独立)、`usage`(`existing_reaction_only` | `anywhere`)
- S8 `EmojiReactionCount` に optional の `view`(`EmojiView`)。カスタム絵文字のチップは `view` を持ち、`view.origin` の有無で外部チップ(地球マーク)かが分かる
- 新エラー `emoji_usage_not_allowed`(422)
- 設定 PUT: 外部絵文字を常用に入れると 422(`/favorites/{index}`)。設定応答にも出さない
- reaction PUT 判定順: 1 利用可否(`emoji_unavailable` 422)→ 2 現在の選択と同じなら 200 no-op → 3 外部絵文字でその投稿に同じ絵文字のチップが無ければ 422 `emoji_usage_not_allowed` → 4 外部絵文字で自分が別の絵文字で反応済みなら 409(直接置換しない)→ 5 選択 200。手順 3・4 は `usage = existing_reaction_only` の絵文字のみ(Unicode・自サーバー絵文字は S3 のまま、別絵文字への置換も従来どおり可)
- fixture(外部絵文字の便乗成功・チップ無し 422・別反応済み 409・画像欠落でも送信可・設定 422・同名別ドメイン)、型・schema テスト、全 route 501 の回帰
- `openapi/shuttlepub.json` の再生成とコミット

## Out of scope

- 外部絵文字の取得・画像キャッシュ・元サーバー削除の検出と保存期限(d09-q03 の具体期間は未決)、連合 EmojiReact の送受信、実保存・投稿処理
- `EmojiRef` の変更、ピッカー/最近使った絵文字への外部絵文字の掲載(契約上も常用設定に入れない)
- D03 q09・q10(応答に現れないため追加フィールド無し)、既存 dev API の変更
- frontends の UI・mock 実装

## Verification

- 型・serialization テスト(`origin`/`image_state`/`usage` の省略・往復、`EmojiReactionCount.view`)
- 生成 schema テスト(新フィールド・新エラー、`EmojiRef` 不変、dev API を含まない)と再生成差分なし
- fixture を schema と参照モデルに照合(判定順 1〜5、設定 422、画像欠落、同名別ドメイン、チップの外部印保証)
- 全契約 route が 501 を返す route テスト、既存 S0/S3/S8 テストの回帰なし
- Rust CI(fmt / clippy -D warnings / test / build / git diff --check)と openapi 再生成差分 CI がグリーン

## Knowledge Maintenance (G461)

- Intent placement: social-experience.md I09 節と candidates.md D09 節に本 unit の依存・到達範囲・UI 決定(U5=c)を追記(新規 intent ノード不要)
- ADR candidate: none(S0 の生成 schema 正本 ADR に従う)
- Diagram candidate: none
- Docs update: D09 に「API 契約のみ」と判定順・外部印の保証を記録
- Closeout learning: 判定順・identity 不変・画像状態と利用可否の独立を記録(`write_back_required: true`)
- Guide reachability (G645): `guide workflow task implementation-loop` / implementation / ShuttlePub/ShuttlePub (`server/`, `openapi/shuttlepub.json`)
