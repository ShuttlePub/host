## Goal

ShuttlePub の /api/v1 に、他サーバーのカスタム絵文字で付いた既存リアクションへの便乗(D09)の API 契約を追加する。マージ済みの S3(クイックリアクション、`server/src/api_v1/quick_reaction.rs`)と S8(個人 domain 制御の投稿表示、`server/src/api_v1/personal_domain.rs`)を拡張し、外部絵文字の出自・画像状態・利用範囲、チップ単位の外部判別、新エラー、reaction PUT の判定順を、型・生成 OpenAPI schema・fixture・明示的な 501 route として確定させる。外部絵文字の取得・保存・連合は実装しない。

## Why This Slice Exists Now

frontends は UI を先行し、ShuttlePub backend 実装を待たず契約に準拠する mock で進めている。D09 の決定(d09-q01 既存チップからの便乗のみ、d09-q02 画像が無ければ `:name:` 表示で送信は許可、d09-q03 削除後は保存分も期限後に削除し `:name:` 表示)と、今回のユーザー UI 決定(同名で別サーバーの絵文字の見分けは地球マーク=外部印をチップに出す、U5=c)に対し、S3/S8 の契約には外部絵文字の出自・利用範囲・画像状態が無いため、UI が準拠できる producer 契約を先に固定する。

## Current Observed State

- S3(PR #17)・S8(PR #19)は ShuttlePub main にマージ済み。`EmojiRef`(`unicode` / `custom`)は identity のみ、`EmojiView` は availability・shortcode・image_url を持つが出自・画像状態(availability と独立)・利用範囲は無い
- S8 の `EmojiReactionCount` は `emoji`(`EmojiRef`)と `count` のみで、チップから外部か否かを判別できない
- reaction PUT は「利用可否 → 同一選択 no-op → 選択(別絵文字は置換)」で、外部絵文字を「既存チップ経由のみ」にする判定は無い
- エラーコードに利用範囲違反を表す値が無い

## Accepted Baseline You May Assume

- ShuttlePub の WebAPI 定義は server 層(Axum + utoipa)で、生成 schema `openapi/shuttlepub.json` が契約の正本(S0 ADR)。ハンドラーは明示的な 501(`todo!`/`unimplemented!` は使わない)。S0 の再生成差分 CI がある
- `EmojiRef` は変更しない。既存 S0/S3/S8 の fixture・schema の既存形は後方互換のまま通る
- d09-q01: 外部カスタム絵文字は投稿に付いた既存リアクションのチップを押したときだけ利用可能。最近使った絵文字・ピッカー検索・常用絵文字には載せない。操作は D03 C3 と同じく、他人のチップを押して同じ絵文字で反応し、未反応時のみ適用
- d09-q02: 画像を表示できないときは `:name:` を表示し、送信は許可する。d09-q03: 元サーバーで削除されたものは保存分も一定期間後に削除し以後 `:name:`(期間は未決で本契約に含めない)
- D03 q09(解除 API 遅延)・q10(通知抑制)は応答に現れないので追加フィールド不要
- API パス・フィールド名の最終形は実装時に S0/S3 の命名規約へ合わせてよい。確定後の生成 schema が正本

## Target Repo / Path / Part

Repository: `ShuttlePub/ShuttlePub`

- Target paths: `server/`, `openapi/shuttlepub.json`

Target part: "S3 quick-reaction と S8 personal-domain の契約を拡張する外部(他サーバー)カスタム絵文字の出自・画像状態・利用範囲の表現と、既存リアクション便乗の PUT 判定順(型・schema・fixture・501 route)"

## In Scope

- `EmojiView` に optional で `origin`(出自ドメイン。Unicode・自サーバーのカスタム絵文字では無し)、`image_state`(画像の有無。`availability` とは独立)、`usage`(`existing_reaction_only` | `anywhere`)を追加。他サーバーの絵文字は `origin` あり・`usage = existing_reaction_only`
- S8 `EmojiReactionCount` に optional の `view`(`EmojiView`)を追加。カスタム絵文字のチップは `view` を持ち(`view.emoji` はチップの `emoji` と一致)、`view.origin` の有無で UI が外部印(地球マーク)を出せることを契約で保証する。同名・別ドメインの絵文字は identity が異なる別チップ
- 新エラー `emoji_usage_not_allowed`(422)
- 常用絵文字設定 PUT: 外部絵文字を加えると 422 `emoji_usage_not_allowed`(details は `/favorites/{index}`)。設定応答にも外部絵文字を出さない
- reaction PUT の判定順: 1 利用可否(`emoji_unavailable` 422)→ 2 現在の選択と同じなら 200 no-op → 3 外部絵文字でその投稿に同じ絵文字のチップが無ければ 422 `emoji_usage_not_allowed` → 4 外部絵文字で自分が別の絵文字で反応済みなら 409(直接置換しない・現在の反応は維持)→ 5 選択 200。3・4 は `usage = existing_reaction_only` の絵文字のみで、Unicode・自サーバー絵文字は S3 の挙動(置換可)のまま
- 画像欠落(`image_state`)でも `availability` が available なら選択可能であること、表示用 shortcode が保たれることの契約化
- 型・serialization・schema・fixture と全 route 501 のテスト、`openapi/shuttlepub.json` の再生成

## Out Of Scope

- 外部絵文字の取得・画像キャッシュ・元サーバー削除の検出と保存期限、連合 EmojiReact の送受信、実保存・投稿処理
- `EmojiRef` の変更。ピッカー/最近使った絵文字/常用への外部絵文字の掲載
- D03 q09・q10 向けの追加フィールド、既存 dev API `POST /api/notes/{id}/reactions` の変更・schema 掲載
- frontends の UI・mock 実装(後続)

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: ShuttlePub/ShuttlePub の既存 S3・S8 契約を拡張し、`EmojiView` の optional な `origin`/`image_state`/`usage`、S8 `EmojiReactionCount` の optional な `view`、新エラー `emoji_usage_not_allowed`(422)、設定 PUT の外部絵文字 422、reaction PUT の判定順(利用可否→no-op→チップ有無→別反応 409→選択)を、型・生成 OpenAPI schema・fixture・明示的な 501 route として追加し、生成 schema を更新すること。取得・保存・連合は実装せず、既存 S0/S3/S8 のテストと再生成差分 CI を含む既存 CI がグリーンであること。

## Acceptance Criteria

- `EmojiView` に optional の `origin`・`image_state`・`usage` が追加され `EmojiRef` は変更されない。Unicode・自サーバー絵文字は `origin` 無し、他サーバー絵文字は `origin` あり・`usage = existing_reaction_only`
- S8 `EmojiReactionCount` の optional `view` により、チップ単位で外部か否か(`view.origin`)が分かる。カスタム絵文字のチップは `view` を持ち `view.emoji` は同チップの `emoji` と一致。同名・別ドメインのチップが `origin` で区別できる
- 新エラー `emoji_usage_not_allowed`(422)が共通エラー形式に追加される
- 設定 PUT で外部絵文字を加えると 422 `emoji_usage_not_allowed`(`/favorites/{index}`)、設定応答に外部絵文字は現れない
- reaction PUT の判定順 1〜5 が契約と fixture で固定される(外部絵文字のみ 3・4 が適用、現在の反応は 422/409 でも維持)
- 画像欠落の外部絵文字でも `availability = available` なら PUT が成立し、`:name:` 表示に使う shortcode が応答に含まれる。`image_state` と `availability` は独立
- D03 q09・q10 は応答に現れないため追加フィールドを設けないことが記載され、DELETE の冪等・利用可否非依存は不変
- 全 route が明示的な 501(共通エラー形式)のまま。既存 S0/S3/S8 のテスト・fixture が回帰せず、生成 schema(`openapi/shuttlepub.json`)が更新され S0 の再生成差分 CI がグリーン

## Verification

- 型・serialization テスト(`origin`/`image_state`/`usage` の省略・往復、`EmojiReactionCount.view`、`emoji_usage_not_allowed`)
- schema テスト(生成 schema が契約と一致、`EmojiRef` 不変、dev API を含まない)と再生成差分なし
- fixture を schema と参照モデルに照合(判定順、設定 422、画像欠落、同名別ドメイン、チップの外部印保証)
- 全契約 route が明示的な 501 を返す route テスト、既存 S0/S3/S8 テストの回帰なし
- 既存 Rust CI(fmt / clippy -D warnings / test / build / git diff --check)がグリーン

## Related Links

- 依存ユニット: shuttlepub-openapi-foundation(ShuttlePub/ShuttlePub#14)、quick-reaction-api-contract(ShuttlePub/ShuttlePub#15、PR #17)、personal-domain-content-api-contract(ShuttlePub/ShuttlePub#18、PR #19)
- 意図: intents/shuttlepub/product/social-experience.md (I09, I03)、intents/shuttlepub/packets/candidates.md (D09, D03)
- 決定記録: intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json (d09-q01〜q03、d03-q09/q10)。UI 決定(地球マーク U5=c)は thread-xxs52dcx でのユーザー指示

## Knowledge Maintenance

- Intent placement: social-experience.md I09 節と candidates.md D09 節に本 unit の依存・到達範囲・UI 決定を追記(新規 intent ノード不要)
- ADR candidate: none(S0 の生成 schema 正本 ADR に従う)
- Diagram candidate: none
- Docs update: D09 に「API 契約のみ」と判定順・外部印の保証を記録
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が ShuttlePub/ShuttlePub (`server/`, `openapi/shuttlepub.json`) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
