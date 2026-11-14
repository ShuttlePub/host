---
facets: [vocabulary, invariant]
---

# note-search-ui — overview

D04 の投稿検索 UI と、D09（他サーバーのカスタム絵文字リアクション）の差分 UI を扱う。画面実装では [ui-spec.md](ui-spec.md) を基準とし、単体で開ける HTML モックを [mocks/](mocks/) に保持する。

## UI モック合意

ユーザー本人の回答「D04 v2はこれでOK」で、D04 モック v2（artifact `artifact-eee22518088f31f43b8acf2d05698b5e`）に合意済み。論点 U1〜U3 は推奨 (a)、モックの仮決め 2 点（変換だけでは検索せず Enter 変換時は検索まで進む／投稿者は 1 人で 2 つ目の `from:` は置換）も含む。v1（artifact `artifact-04dc53c500d61b7b554875b63c53eb95`）への回答 D04 U1〜U4・D09 U5 と合わせた決定と出典は [ui-spec.md §1](ui-spec.md#1-ユーザー決定と出典) に記録する。

モックは `mocks/index.html` の単一 HTML で、CSS と JavaScript を内包し、外部ファイルを参照しない。[D03 SNS 本体 UI v6](../quick-reaction-ui/ui-spec.md) を土台にした差分モックである。

## 境界

- UI モックの合意は D04・D09 の実装完了・実装readyを意味しない。検索契約・絵文字 identity 等の未決事項は [D04 candidate](../../packets/candidates.md#d04)・[D09 candidate](../../packets/candidates.md#d09) を参照。
- キーワードだけの全体検索（D04 U2=b）は d04-q05 の「標準構成では投稿者必須・全体検索は提供しない」部分を置き換える。DB 部分一致の件数・応答時間の上限値と負荷対策（pg_trgm 等）は技術設計で決める。
- 時間上限で中断したときに途中までの結果を返せるかはサーバー実装次第で、返せない場合の表示は ui-spec の U3 の注意に従う。
- 詳細検索メニュー（Advanced Search Menu）は未設計。導入までは検索画面に投稿者指定の常設 UI を置かない。

## Related

- [SNS で実現したい体験 I04](../../product/social-experience.md#i04)・[I09](../../product/social-experience.md#i09)
- [D04 candidate](../../packets/candidates.md#d04)・[D09 candidate](../../packets/candidates.md#d09)
- [D03 quick-reaction UI](../quick-reaction-ui/overview.md)
