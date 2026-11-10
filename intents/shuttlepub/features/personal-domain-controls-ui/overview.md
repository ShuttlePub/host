---
facets: [vocabulary, invariant]
---

# personal-domain-controls-ui — overview

D08 のうち、ShuttlePub (`shuttlepub-web`) における個人単位のドメインミュート・ブロック設定 UI を扱う。実装 unit は F8。
Emumet 側の Profile/domain policy・Follow 制御は [personal-domain-controls](../../../emumet/features/personal-domain-controls/overview.md) を参照する。

## UI モック合意

[grill 記録](../../interviews/discord-feature-grill-2026-10-15.json) `d08-q16-ui-mock-v5-agreement` で、D08 UI モック v5
（desktop `artifact-59e9d815eac401547547f279342aff72`、mobile `artifact-d17402088130c2c0fba3acca09a389ff`、
仕様版 `artifact-678299c89cedc83dcb7288b3d9e7cd4d`）に合意済み。
画面構成・文言・挙動の実装基準は [ui-spec.md](ui-spec.md) の 26 項目とし、HTML モックは [mocks/](mocks/) に保存する。

この UI 合意は D08 全体の実装完了を意味しない。F8 の依存と到達範囲は [D08 candidate](../../packets/candidates.md#d08) を参照。

## Related

- Emumet 側: [personal-domain-controls](../../../emumet/features/personal-domain-controls/overview.md)
- [SNS で実現したい体験](../../product/social-experience.md#i08)
