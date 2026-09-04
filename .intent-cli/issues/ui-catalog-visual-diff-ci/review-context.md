# ui-catalog-visual-diff-ci Review Context

Review that this slice moves operation toward the documented intent without widening scope.

Flag findings if the implementation:

- widens scope beyond the issue contract;
- launches AI providers from `intent-cli`;
- mutates GitHub or parent state when the issue is read-only;
- skips required contract sections.

## Slice-specific review focus

- PR コメントへの画像直接埋め込み: 差分画像が PR コメントに直接表示されるか。レポート zip の DL 確認方式への退行はインタビュー確定事項 (visual-diff-pr-integration) への違反。reg-notify-github-plugin で実現できず自前ステップで補完した場合、その判断と検証結果が記録されているか。
- R2 ライフサイクル: アップロードされた差分画像・レポートに期限付き自動削除 (ライフサイクルルール) が設定されているか。無期限蓄積は確定事項違反。
- スコープ逸脱: カタログアプリ本体の変更 (ui-catalog-foundation の責務) や、アプリ固有 View のスクリーンショット対象化が混入していないか。
- CI 統合: check.yml へのジョブ追加が D8 (bun test 追加) の先例に沿っているか。差分なし PR で緑 check になることを確認 (差分検出の失敗が常に赤になる実装は不可)。
- クレデンシャル: R2 のシークレットがリポジトリにハードコードされていないか (GitHub Secrets 経由であること)。
- 依存確認: ui-catalog-foundation が先行してマージされているか。manifest 列挙に依存する実装の場合、manifest の欠如で壊れないか。

## Facet context

<!-- BEGIN GENERATED FACET CONTEXT (G530) -->
No facet-annotated nodes found for this domain — facets (G529) are optional and this is the norm before a tree adopts them.
<!-- END GENERATED FACET CONTEXT (G530) -->

## Knowledge Writeback Expectation (G461)

If the packet's `closeout_learning.write_back_required` is `true`, confirm the
expected intent-tree / ADR / diagram / docs writeback landed in this PR or was
captured as a follow-up packet. If the packet declined all knowledge maintenance,
that is acceptable — note it rather than blocking.