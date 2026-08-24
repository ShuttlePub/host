# post-relay — requirements

> See [overview.md](overview.md) for goals.

## Functional requirements

### 内向き(連合 → ShuttlePub)

- inbox で Create/Note を受け付け、HTTP Signature 検証後に連携先 ShuttlePub へ転送
- 転送先は shuttlepub-link で設定されたアカウントごとの連携先サービス
- 未設定アカウント宛ての挙動を定義(保留/破棄/エラー)

### 外向き(ShuttlePub → 連合)

- 内部署名 API(`POST /internal/v1/accounts/{id}/sign`)で配送リクエストへの代理署名を提供
- アクティビティの組み立て・ファンアウト先決定・リモート inbox への送信は ShuttlePub が行う
- 配送失敗時のリトライ・配送記録は ShuttlePub 側の責務(Emumet の delivery 機構は外向きには使わない)

### 追加アクティビティ

- Like / Announce / Delete / Update 等のハンドリング方針を packet 単位で段階的に
