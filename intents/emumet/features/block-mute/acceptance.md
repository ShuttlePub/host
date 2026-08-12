# block-mute — acceptance criteria

> See [overview.md](overview.md) for goals.

## Criteria

- [x] ローカルアカウントをブロックでき、一覧・解除できる (block-mute-core, PR #17)
- [x] リモートアカウントをブロックでき、相手 inbox に Block アクティビティが配送される(E2E で検証) (block-mute-federation, PR #23)
- [x] ブロック時に双方向のフォロー関係が解除される (block-mute-core, PR #17)
- [x] inbox で受信した Block がフォロー関係の解除に反映される (block-mute-federation, PR #23)
- [x] ミュートはローカルのみで機能し、一覧・解除できる (block-mute-core, PR #17)
- [x] Mock peer / Iceshrimp E2E にブロックのシナリオが追加される (block-mute-federation, PR #23。mock peer 4 シナリオ + Iceshrimp S10)
