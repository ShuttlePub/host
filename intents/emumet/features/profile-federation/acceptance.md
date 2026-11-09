# profile-federation — acceptance

> 契約・検証境界。個別 unit の受け入れ詳細は各 packet が正本。overview は [overview.md](overview.md)。

## 全体の完了条件（P4 完了時）

- [ ] Profile が actor・follow graph・個別 block/mute の主体になり、旧 Account 単位の連合経路が廃止されている
- [ ] 全 Profile に一意・不変の username があり、Account 名とは独立している。Profile 移管後も username・actor URI・鍵・関係が維持される
- [ ] 旧連合データのみ初期化され、AuthAccount・Account・Profile・組織 membership・イベント履歴・全体モデレーションは保持される
- [ ] 再実行しても再消去・鍵再生成が起きない
- [ ] Mastodon / Iceshrimp / mock peer E2E が新 Profile モデルで成功する

## unit ごとの検証境界

| unit | 検証 | 境界・非目標 |
|---|---|---|
| E8 | OpenAPI 再生成、旧作成 payload・新 payload・未実装エラーの contract test、既存 Rust CI | 契約のみ。新関係処理・方針保存・username 保存は実装しない |
| P1 | 実 DB、イベント再適用、移管、鍵署名、実 root 構成の route 不在テスト | 本番 `/ap/profiles/...` は未 mount。root で新配送 worker を起動しない |
| P2 | 独立 DB/schema での migration・repository・競合テスト | 本番 migration・dual-write・変換ツールなし。旧 schema のテストと同じ DB を同時変更しない |
| P3o | DB transaction、fake peer、timeout・再起動・二重 worker | 外部配送失敗でローカル unfollow を巻き戻さない。本番 route・worker は未接続 |
| P3i | 署名付き HTTP fixture、実 DB、重複・順序逆転・不正参照 | 投稿 Activity の認可・実受理は対象外。本番 route は未 mount |
| FN | BFF REST 変換、GraphQL 生成、SSR/hydration、visual、P1 との実接続 | username 変更は対象外。P4 に依存しない |
| P4 | 移行前 fixture→移行後 DB、再実行、署名、WebFinger、Follow・個別 block/mute、移管後 identity 維持、許可 username 文字種、E2E | 旧 identity 保存・互換 Follow API・Move・無停止移行・DB 全消去は対象外 |

## 共通の契約

- 認可は現在の所有者（Account／組織 membership）による。外部 ID は nanoid。
- username 更新 API を通常の編集機能として設けない。
- P1〜P3 の Profile actor・関係 route は本番未 mount であることを OpenAPI schema 説明にも記載する（E8）。
- ShuttlePub 側の投稿操作の受理・送信拒否は本 feature の対象外（[DC acceptance](../personal-domain-controls/acceptance.md) 参照）。

## UI 前提（ユーザー指示）

FN の画面構成を決める実装はモック合意まで保留する。画面構成に依存しない BFF・GraphQL・変換の検証は先行できるが、
FN の受け入れ（SSR/hydration・visual を含む画面検証）は画面構成のモック合意後に行う。
