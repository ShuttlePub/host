---
facets: [vocabulary, invariant]
---

# quick-reaction-ui — overview

D03 の SNS 本体 UI とクイックリアクション UI を扱う。画面実装では [ui-spec.md](ui-spec.md) を基準とし、単体で開ける HTML モックを [mocks/](mocks/) に保持する。

## UI モック合意

[grill 記録](../../interviews/discord-feature-grill-2026-10-15.json) の `d03-q11-sns-ui-mock-v6-agreement` で、SNS 本体 UI と D03 モック v6（artifact `artifact-6a27047992aabd6e2eea9d50d3cde20e`）に合意済み。v5 へのフィードバックを反映した v6 を最終版とし、画面構成・文言・挙動の実装基準は [ui-spec.md](ui-spec.md) とする。

モックは `mocks/index.html` の単一 HTML で、CSS と JavaScript を内包し、外部の `v*.mjs` / `v*.css` を参照しない。

## F3 実装

[PR #42](https://github.com/ShuttlePub/shuttlepub-frontends/pull/42) squash `67ebe19243646a8a78749ae5f8944fcd6f2e34f2` でUIをマージ済み。[ui-spec v6](ui-spec.md)準拠で、S3契約準拠のstateful mockによる受け入れを完了した。実保存backendは未実装で、realは`NOT_IMPLEMENTED`表示。実保存・端末間同期は後続で、D03全体は未完了。

## 境界

- 公開範囲の「公開・ホーム・フォロワー・ダイレクト」は Misskey に合わせた仮置きであり、ShuttlePub が扱う公開範囲としては未確定。選択肢の最終仕様を決めたものではない。
- UI モックの合意は D03 全体の実装完了・実装readyを意味しない。実装範囲と未決事項は [D03 candidate](../../packets/candidates.md#d03) を参照。

## Related

- [SNS で実現したい体験](../../product/social-experience.md#i03)
- [D03 candidate](../../packets/candidates.md#d03)
