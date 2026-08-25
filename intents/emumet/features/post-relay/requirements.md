# post-relay — requirements

> See [overview.md](overview.md) for goals. 責務境界の根拠は ADR 0003 (2回目 amend, 2026-08-24)。

## Functional requirements

### 内向き(連合 → ShuttlePub)

- inbox で Create/Note を受け付け、HTTP Signature 検証後に連携先 ShuttlePub へ転送
- 転送先は shuttlepub-link で設定された Profile ごとの連携先サービス
- 未設定 Profile 宛ての挙動を定義(保留/破棄/エラー)
- **転送 envelope**(ShuttlePub 側の冪等処理を担保する):
  - canonical activity JSON(raw body)、remote activity ID と actor
  - Emumet が検証した signer keyId / actor
  - 対象 Profile、stable receipt ID、受信時刻、link generation
  - ShuttlePub は remote activity ID をキーに冪等処理する
- 転送は durable queue 経由とし、障害時も取りこぼさない(operator 判断 2026-08-24)。
  恒久失敗(バリデーション・未リンク・再試行枯渇)は dead-letter 相当の監査記録を残す

### 外向き(ShuttlePub → 連合)

- **署名 API**(ADR 0003 の狭い形):
  - 入力: profile 指定 + 配送先 URL + 送信する正確な body バイト列
  - Emumet が `Date` / `Digest` / `Host` / `keyId` / 署名対象ヘッダを生成して返す
  - 配送試行ごと・ターゲットごとに呼ぶ(再利用不可)
  - 認可は Profile スコープの link capability(`sign:post`)。構造検証のみ実施
    (capability 有効性 / POST・HTTPS / actor・attributedTo 一致 / ID namespace 内 /
    MVP 許可 type のみ)
  - wire contract: 返却された body/ヘッダを byte-exact で送信。外向き 64KiB 上限
- アクティビティの組み立て・ファンアウト先決定・リモート inbox への送信・
  リトライ・配送状態の記録は ShuttlePub が行う
- **ID 名前空間**: Activity/Note の `id` は
  `https://emumet.example/objects/<link-id>/<local-id>` 形式。
  `local-id` は ShuttlePub 採番、URL-safe opaque segment

### 配布(連合 → object/outbox GET)

- Emumet ドメインの object URL への GET は発行元 ShuttlePub へ透過リバースプロキシ
  - document `id` と要求 URL の完全一致、`attributedTo` の正当性を確認
  - upstream のリダイレクトは拒否。ShuttlePub 障害時は 502(operator 判断 2026-08-24)
- outbox の GET も同様にプロキシで確定(検証済み: Misskey が異ホストコレクション URL を
  アクター文書ごと拒否するため、actor ドキュメントへの ShuttlePub URL 直接記載は不可)
- deletion marker(署名した Delete の `object_id / profile_id / link_id / deleted_at`)
  を保持し、削除済み object URL は upstream より優先して Tombstone/410 を返す

### 追加アクティビティ

- Like / Announce / Delete / Update 等のハンドリング方針を packet 単位で段階的に
- 署名 API で許可する Activity type も MVP(Create)から段階的に拡張する
  (拡張時に scope と最小 shape 検証を追加)
