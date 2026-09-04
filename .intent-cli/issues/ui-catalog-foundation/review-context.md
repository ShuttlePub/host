# ui-catalog-foundation Review Context

Review that this slice moves operation toward the documented intent without widening scope.

Flag findings if the implementation:

- widens scope beyond the issue contract;
- launches AI providers from `intent-cli`;
- mutates GitHub or parent state when the issue is read-only;
- skips required contract sections.

## Slice-specific review focus

- スコープ逸脱: Storybook / Chromatic の導入、BFF・バックエンド接続、アプリ固有 View (Login/Accounts/Drive 等) の fixture 化が混入していないか。これらはインタビューで明示的にスコープ外と確定している。
- アーキテクチャ踏襲: apps/emumet-web / apps/booskiff-web と同一の PureScript + Flame SSR + hydration + Bun サーバー構成になっているか。静的 SSR のみ・クライアントのみへの簡略化はインタビュー確定事項 (catalog-app-architecture) への違反。
- spago 配線: workspace がアプリ側 spago.yaml に集約され、packages/ui が extraPackages の `path:` 参照で接続されているか (D6)。ルートへの spago workspace 配置は D6 の再検討条件に触れるため、実施した場合は closeout learning での言及が必須。
- Tailwind @source: `apps/ui-catalog` の style.css の `@source` が packages 配下まで明示拡張されているか (content detection hazard。未拡張だと packages 由来のクラスが CSS に出ない)。
- テーマ切替: packages/design-tokens/theme.js と同じ data-color / data-shape 属性方式か。独自のテーマ機構の新設は重複。
- JSON manifest: コンポーネント名・ストーリー/状態・直接 URL が列挙でき、ブラウザなし (curl 等) で取得可能か。manifest が人間向け HTML の副産物でなく機械可読であること。

## Facet context

<!-- BEGIN GENERATED FACET CONTEXT (G530) -->
No facet-annotated nodes found for this domain — facets (G529) are optional and this is the norm before a tree adopts them.
<!-- END GENERATED FACET CONTEXT (G530) -->

## Knowledge Writeback Expectation (G461)

If the packet's `closeout_learning.write_back_required` is `true`, confirm the
expected intent-tree / ADR / diagram / docs writeback landed in this PR or was
captured as a follow-up packet. If the packet declined all knowledge maintenance,
that is acceptable — note it rather than blocking.