# media-upload — open questions

> See [../../clarifications/open.md](../../clarifications/open.md) for domain-level open questions.

## Open questions blocking this feature

なし (2026-08-12 grill で全て解消。Q/A と選定経緯は
[../../interview/2026-08-12-c1-c3-grill.md](../../interview/2026-08-12-c1-c3-grill.md)、
決定は [decisions.md](decisions.md) を参照)

## 解消済み (2026-08-12)

- ~~ストレージバックエンド選定~~ → S3 互換 (開発環境は RustFS)
- ~~画像の配信ドメイン~~ → 別ドメイン直接配信 (本番 R2 + カスタムドメイン)
- ~~アイコン/バナー変更時の Update 配送~~ → 配送する
