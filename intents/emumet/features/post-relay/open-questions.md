# post-relay — open questions

> See [../../clarifications/open.md](../../clarifications/open.md) for domain-level open questions.

## Open questions blocking this feature

- **ShuttlePub への転送プロトコル**: HTTP webhook / キュー(rikka-mq/Redis) / gRPC 等。
  ShuttlePub 本体側の受け口設計と合わせて決定が必要
- ShuttlePub から内部署名 API を呼ぶ際の認証方式(サービス間認証)
- 転送に失敗した場合の再送・保管方針

## Resolved

- ~~外向き配送で既存の内部署名 API(`POST /internal/v1/accounts/{id}/sign`)を
  そのまま使うのか、Emumet 主導の配送に置き換えるのか~~
  → **確定 (2026-08-24)**: 署名 API をそのまま使い、配送は ShuttlePub がハンドリングする。
  Emumet 主導の配送には置き換えない(ADR 0003 amended 参照)
