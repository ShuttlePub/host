## Goal

ShuttlePub の /api/v1 契約(#21 `remote-emoji-reuse-api-contract` で追加した他サーバー=外部カスタム絵文字の契約)を修正する。元サーバーで削除された、またはこちらの画像キャッシュが期限切れになった外部絵文字でも、その投稿に同じ絵文字の既存リアクションのチップが残っている限り、`:name:` 表示のまま同じ反応を付けられる(reaction PUT が 200)ようにする。そのために、画像の有無・削除(`image_state`)と送信可否(`availability` と利用範囲の規則)を分けて整理し、reaction PUT の判定順の説明・fixture・参照モデル・生成 OpenAPI schema を更新する。契約のみで、ハンドラーは明示的な 501 のまま。

## Why This Slice Exists Now

UI 正本(外部絵文字は既存チップへの便乗のみ。画像を表示できない場合は `:name:` で押せる。元サーバーで削除済み・キャッシュ画像期限切れも同じ見た目で押せて便乗できる)と、現 producer 契約(削除・保存期限後の外部絵文字を `unavailable` + `image_state=missing` とし、PUT は可用性検査が先で 422 `emoji_unavailable`)が食い違う。frontends の独立レビューで判明した。ユーザーが「画面の仕様に合わせて API の定義を直す」案を選択した(grill 記録 `d09-q07-deleted-remote-emoji-reuse`)。frontends は契約に準拠する mock で UI を先行しているため、producer 契約を先に直す必要がある。

## Current Observed State

ShuttlePub main(a00d234)で:

- `docs/foundation.md` の「External custom emoji」節と `server/src/api_v1/quick_reaction.rs` の module docs は、元サーバーで削除されキャッシュ期限切れの外部絵文字を `unavailable`(`unavailable_reason=deleted`)+ `image_state=missing` とする
- reaction PUT の判定順は 1 利用可否(`emoji_unavailable` 422)→ 2 現在の選択と同じなら 200 no-op → 3 外部絵文字でその投稿に同じ絵文字のチップが無ければ 422 `emoji_usage_not_allowed` → 4 外部絵文字で別の反応中なら 409 `conflict` → 5 選択 200。このため削除済み外部絵文字は既存チップが残っていても 1 で 422 になり、現在選択中の再送も 422
- fixture `server/tests/fixtures/quick_reaction/scenarios/remote_reaction_checks_availability_first.json`、他の `remote_*.json` の setup(`goneblob@remote.example`)、`schema_cases.json` の「deleted external emoji is unavailable and its image missing」、`server/tests/fixtures/personal_domain/remote_emoji_chips.json` の `external_deleted_at_origin` が同じ表現
- 外部絵文字の `unavailable` 理由に制限が無く、`EmojiView::check_consistency` は外部絵文字の `deleted` を許す

## Accepted Baseline You May Assume

- 生成 schema `openapi/shuttlepub.json` が契約の正本(S0)。ハンドラーは明示的な 501(`todo!`/`unimplemented!` は使わない)。再生成差分 CI がある。UI 先行方針により実ハンドラーは実装しない
- `EmojiRef` は変更しない。`ErrorCode` は増やさない(`emoji_usage_not_allowed` 422・`emoji_unavailable` 422・`conflict` 409 を既存のまま使う)。`image_state` と `usage` の enum 値は変えない
- ローカル(自サーバー)カスタム絵文字の `unavailable`(`deleted`/`disabled`)の扱いは変えない(選択は 422 `emoji_unavailable`、DELETE は利用可否に依存しない)
- #21 の他の規則は維持する: 外部絵文字は常用に入れられない、外部絵文字は `usage=existing_reaction_only`(既存チップ経由のみ)、Unicode・ローカル絵文字は別絵文字への置換可、外部絵文字は別の反応中なら直接置換せず 409、`origin` は外部のみ・チップ単位の外部印(S8 `EmojiReactionCount.view.origin`)
- 外部絵文字の取得・画像キャッシュ・元サーバー削除の検出と保存期間(`d09-q03`、具体的な期間は未決)・連合は本 slice に含めない

## Target Repo / Path / Part

Repository: `ShuttlePub/ShuttlePub`

- Target paths: `docs/foundation.md`, `server/`, `openapi/shuttlepub.json`

Target part: S3 quick-reaction / S8 personal-domain の外部カスタム絵文字契約のうち、元サーバー削除・画像キャッシュ期限切れの扱い(画像の有無と送信可否の分離)と reaction PUT の判定順の修正(型・docs・schema・fixture・参照モデル・501 route)

## In Scope

- 元サーバー削除・キャッシュ期限切れの外部絵文字を `availability=available`・`image_state=missing`(`image_url` 無し、`shortcode` あり、`usage=existing_reaction_only`、`unavailable_reason` 無し)で表す契約。外部絵文字(`origin` あり)に `unavailable_reason=deleted` を付けた view を `check_consistency` が拒否する。外部絵文字が `unavailable` になるのは自サーバーが無効化した `disabled` のみ
- reaction PUT: 既存チップが残る削除済み外部絵文字は 200 で選択でき、現在の選択と同じなら 200 no-op。チップが無い削除済み外部絵文字は 422 `emoji_usage_not_allowed`(どのコードかを契約・fixture で固定)
- 判定順の更新と明確化: 1 利用可否(`emoji_unavailable` 422。ローカル絵文字の unavailable と外部 `disabled`。元サーバー削除・キャッシュ期限切れは含まない)→ 2 現在の選択と同じなら 200 no-op → 3 外部絵文字でチップ無しなら 422 `emoji_usage_not_allowed` → 4 外部絵文字で別の反応中なら 409 → 5 選択 200
- 設定 PUT は削除済み外部絵文字も 422 `emoji_usage_not_allowed`(`/favorites/{index}`)
- `docs/foundation.md`、module docs、utoipa の doc コメント・description、`openapi/shuttlepub.json` の再生成
- fixture・参照モデル・テストの更新: `remote_*` scenario の削除済み外部絵文字を available + missing に、`remote_reaction_checks_availability_first.json` は `disabled` の外部絵文字で availability 先頭を示す形に、削除済み外部絵文字の便乗成功・チップ無し拒否・選択中に削除された場合の新 scenario、`schema_cases.json`、`personal_domain/remote_emoji_chips.json`

## Out Of Scope

- 外部絵文字の取得・画像キャッシュ・元サーバー削除の検出と保存期間、連合 EmojiReact の送受信、実保存・投稿処理(実ハンドラーは 501 のまま)
- `EmojiRef`・`ErrorCode` の変更、ローカル絵文字の unavailable の扱いの変更、ピッカー/最近使った絵文字/常用への外部絵文字の掲載
- D03 q09・q10 向けの追加フィールド、既存 dev API `POST /api/notes/{id}/reactions` の変更・schema 掲載
- frontends の mock・UI 実装(pin 更新後の追従は frontends 側の別 unit)

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: ShuttlePub/ShuttlePub の既存の外部カスタム絵文字契約(S3 `quick_reaction.rs`・S8 `personal_domain.rs`・`docs/foundation.md`)を修正し、元サーバー削除・画像キャッシュ期限切れの外部絵文字を `available` + `image_state=missing` で表して、その投稿に既存チップが残っていれば reaction PUT で 200 になる(`:name:` 表示、現在の選択と同じ再送は 200 no-op、チップが無ければ 422 `emoji_usage_not_allowed`)ようにすること。画像の有無・削除(`image_state`)と送信可否(`availability`・利用範囲の規則)を分けて契約と判定順の説明を更新し、fixture・参照モデル・テスト・生成 OpenAPI schema を同期する。ローカル絵文字の unavailable の扱いと #21 の他の規則(外部は常用不可、409 など)は変えず、ハンドラーは明示的な 501 のまま、再生成差分 CI を含む既存 CI がグリーンであること。

## Acceptance Criteria

- 元サーバーで削除された、またはキャッシュが期限切れの外部絵文字は、`EmojiView` で `availability=available`・`image_state=missing`・`image_url` 無し・`shortcode` あり・`usage=existing_reaction_only`・`unavailable_reason` 無しと表される。外部絵文字(`origin` あり)に `unavailable_reason=deleted` を付けた view は `check_consistency` が拒否する。外部絵文字の `unavailable` は `disabled` のみ
- reaction PUT: その投稿に同じ絵文字の既存チップが残る削除済み外部絵文字は 200 で選択できる(応答の `view` は `image_state=missing`、`:name:` 表示用 `shortcode` を含む)。現在の選択と同じ削除済み外部絵文字の再送は 200 no-op。既存チップが無い削除済み外部絵文字は 422 `emoji_usage_not_allowed`(`emoji_unavailable` ではない)で、現在の反応は維持される
- 判定順 1 利用可否(`emoji_unavailable` 422。ローカル絵文字の unavailable と外部 `disabled`)→ 2 同一再送 200 no-op → 3 外部でチップ無し 422 `emoji_usage_not_allowed` → 4 外部で別の反応中 409 `conflict` → 5 選択 200 が、`docs/foundation.md`・module docs・OpenAPI 説明・fixture・参照モデルで一致する。元サーバー削除・キャッシュ期限切れが 1 の対象外であることが明記される
- 設定 PUT は削除済み外部絵文字を常用に加えると 422 `emoji_usage_not_allowed`(`/favorites/{index}`)。S8 のチップ `view` も削除済み外部絵文字を `available` + `missing` で表し、チップ単位の外部印(`view.origin`)の保証は変わらない
- ローカル絵文字の unavailable の扱い、#21 の他の規則(外部は常用不可・`existing_reaction_only`・Unicode/ローカルは置換可・別反応中は 409・DELETE の冪等と利用可否非依存)が回帰しない。全 route は明示的な 501 のまま、生成 schema(`openapi/shuttlepub.json`)が更新され再生成差分 CI を含む既存 CI がグリーン

## Verification

- 型・consistency テスト(外部の `unavailable_reason=deleted` 拒否、available + missing の往復、ローカル絵文字は従来どおり)
- scenario を schema と参照モデルで照合(削除済み+チップ有り 200、チップ無し 422 `emoji_usage_not_allowed`、選択中に削除されても再送 no-op、`disabled` 外部絵文字の 422 `emoji_unavailable`、ローカル不変、既存 scenario の回帰なし)
- 生成 schema のテストと再生成差分なし、全 route 501 の route テスト、既存 S0/S3/S8 テストの回帰なし
- 既存 Rust CI(fmt / clippy -D warnings / test / build / `git diff --check`)

## Related Links

- 修正対象の契約: ShuttlePub/ShuttlePub#20(issue)/ PR #21(`remote-emoji-reuse-api-contract`、squash `cc04c03`)。依存 unit: quick-reaction-api-contract(#15、PR #17)、personal-domain-content-api-contract(#18、PR #19)
- UI 正本: host `intents/shuttlepub/features/note-search-ui/ui-spec.md` §5(D09 差分 UI)、決定記録 grill `d09-q01`〜`q05`・`d09-q07-deleted-remote-emoji-reuse`
- 食い違いを指摘した frontends レビュー: ShuttlePub/shuttlepub-frontends PR #50(issue #49)
- ユーザー決定: 削除済み外部絵文字は案 a「画面の仕様に合わせて API の定義を直す」(thread-xxs52dcx、原文「a」)

## Knowledge Maintenance

- Intent placement: candidates.md D09 節(決定は d09-q07 に記録済み。完了後に契約の最終形を追記)
- ADR candidate: none(S0 の生成 schema 正本 ADR に従う)
- Diagram candidate: none
- Docs update: D09 に issue/PR と契約の最終形(ShuttlePub 側 `docs/foundation.md` は PR で更新)
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール)が ShuttlePub/ShuttlePub (`docs/foundation.md`, `server/`, `openapi/shuttlepub.json`) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
