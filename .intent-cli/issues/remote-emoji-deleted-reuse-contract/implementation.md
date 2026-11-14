# remote-emoji-deleted-reuse-contract Implementation Packet

## Goal

#21(`remote-emoji-reuse-api-contract`)で確定した外部(他サーバー)カスタム絵文字の契約のうち、元サーバーで削除された・画像キャッシュが期限切れになった外部絵文字の扱いを UI 正本に合わせて直す。既存チップが残っていれば `:name:` 表示のまま同じ反応を付けられる(reaction PUT 200)ようにし、画像の有無・削除(`image_state`)と送信可否(`availability`)を分けて整理する。

## Why

#21 は削除・保存期限後の外部絵文字を `unavailable`(`deleted`)+ `image_state=missing` とし、reaction PUT は可用性検査が先で 422 `emoji_unavailable` だった。UI 正本(ui-spec §5、`d09-q02`/`q03`/`q05`)は「削除済みも取得失敗と同じ `:name:` の見た目で押せて、既存チップへ便乗できる」で、frontends PR #50 の独立レビューで食い違いと判定された。ユーザーが案 a(API を UI に合わせる)を選択(grill `d09-q07-deleted-remote-emoji-reuse`)。

## Scope

- 外部絵文字の元サーバー削除・キャッシュ期限切れは `image_state=missing`(+ `availability=available`、`unavailable_reason` 無し、`shortcode` あり)で表す。外部絵文字(`origin` あり)に `unavailable_reason=deleted` は付けない(`check_consistency` で拒否)。外部絵文字の `unavailable` は自サーバーが無効化した `disabled` のみ
- reaction PUT 判定順(順序は #21 と同じ): 1 利用可否(`emoji_unavailable` 422。ローカル絵文字の unavailable と外部 `disabled`)→ 2 同一再送 200 no-op → 3 外部でチップ無し 422 `emoji_usage_not_allowed`(削除済み外部絵文字のチップ無しもここ)→ 4 外部で別反応中 409 `conflict` → 5 選択 200
- 設定 PUT: 削除済み外部絵文字も 422 `emoji_usage_not_allowed`(`/favorites/{index}`)
- docs/foundation.md、module docs、utoipa の doc コメント・description、生成 `openapi/shuttlepub.json`
- fixture: `remote_*` scenario の削除済み外部絵文字 setup を available + missing に更新、`remote_reaction_checks_availability_first.json` は `disabled` の外部絵文字で availability 先頭を示す形に更新、削除済み+チップ有りの便乗成功・チップ無し拒否・選択中に削除された場合の新 scenario、`schema_cases.json`・`personal_domain/remote_emoji_chips.json` の削除済み外部絵文字ケース
- 参照モデル(`server/tests/quick_reaction.rs`)と型・consistency テスト

## Out of scope

- 外部絵文字の取得・画像キャッシュ・削除検出・保存期間、連合 EmojiReact、実保存。実ハンドラーは 501 のまま
- `EmojiRef`・`ErrorCode` の変更、ローカル絵文字の unavailable の扱いの変更
- frontends の mock・UI 実装(pin 更新後の追従は frontends 側 unit)

## Verification

- 型・consistency テスト(外部の `unavailable_reason=deleted` 拒否、available+missing の往復)
- scenario を schema と参照モデルで照合(削除済み+チップ有り 200、チップ無し 422 emoji_usage_not_allowed、再送 no-op、disabled 外部の 422 emoji_unavailable、ローカル不変)
- 再生成 schema の差分なし、全 route 501、既存 S0/S3/S8 テストの回帰なし
- Rust CI(fmt / clippy -D warnings / test / build / git diff --check)

## Knowledge Maintenance (G461)

- Intent placement: candidates.md D09 節(決定は d09-q07 に記録済み。完了後に最終形を追記)
- ADR candidate: none
- Diagram candidate: none
- Docs update: D09 に issue/PR と契約の最終形
- Closeout learning: UI 先行と producer 契約の食い違いの検出経緯、image_state と availability の分離(`write_back_required: true`)
- Guide reachability (G645): `guide workflow task implementation-loop` / implementation / ShuttlePub/ShuttlePub
