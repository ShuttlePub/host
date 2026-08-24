# 0003: ShuttlePub 発の投稿は Emumet が代理署名する(配送は ShuttlePub)

- Status: Accepted (2026-07-22 interview で確認)、Amended 2026-08-24 (配送責務を ShuttlePub へ修正)
- Deciders: operator

## Context

ActivityPub のサーバー間配送には HTTP Signature が必要で、署名鍵はアカウントに紐づく。
投稿データは ShuttlePub 本体が持つが、秘密鍵は Emumet が管理する。

ShuttlePub はタイムライン等を持つ SNS サービスの中核であり、ActivityPub 的には
リレーサーバーのように振る舞う。したがって配送トポロジ(ファンアウト先の決定・
配送・再送)も ShuttlePub の責務とする(2026-08-24 operator 指示)。

## Decision

- 署名用秘密鍵は Emumet が生成・暗号化保管する(実装済み: `driver/src/crypto/rsa.rs`)
- ShuttlePub 発の投稿は Emumet が代理で署名する。ただし**署名済みリクエストの
  配送(ファンアウト・送信・再送)は ShuttlePub がハンドリングする**
  - Emumet は署名サービスとして振る舞い、内部署名 API
    (`POST /internal/v1/accounts/{id}/sign`)がその実装
  - ShuttlePub は配送リクエストごとに署名を取得し、リモート inbox への送信を自ら行う
- **署名時に、Emumet は「どの ShuttlePub 発のどの投稿アクティビティか」を記録する**
  (2026-08-24 operator 指示)。actor の住所が emumet ドメインにあるため、リモートが
  fetch する outbox(`GET /users/{id}/outbox`)は Emumet が提供する必要があり、
  この記録がそのデータソースになる
  - 記録するのはアクティビティ内容と発行元 ShuttlePub であり、配送状態
    (配達済み/失敗/リトライ)は含まない。配送状態は ShuttlePub 側の記録
- post-relay の open question だった「内部署名 API をそのまま使うか、Emumet 主導の
  配送に置き換えるか」は、**前者(署名 API 利用 + ShuttlePub 配送)で確定** (2026-08-24)

## Consequences

- 秘密鍵が ShuttlePub 本体側に出ない
- マスターキーパスワードによる鍵暗号化が運用要件になる(実装済み)
- 配送のリトライ・配送状態の記録は ShuttlePub 側の設計事項になる
- Emumet 側の外向き投稿受け口 API は不要(署名 API のみで足りる)
- Emumet は outbox 提供責務を持つ(署名と引き換えに投稿内容を把握できるため、
  プライバシー上の取り決めとしても明文化しておく)

## Links

- [features/post-relay](../features/post-relay/overview.md)
- [0002](0002-account-address-on-emumet-domain.md)
