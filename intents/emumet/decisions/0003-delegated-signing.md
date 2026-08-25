# 0003: ShuttlePub 発の投稿は Emumet が代理署名する(配送・コンテンツは ShuttlePub)

- Status: Accepted (2026-07-22 interview で確認)
- Amended 2026-08-24 (1回目): 配送責務を ShuttlePub へ修正
- Amended 2026-08-24 (2回目): 薄型境界へ再構成。「署名時の投稿記録と Emumet による
  outbox 提供」(1回目 amend で追加)を**撤回**し、コンテンツ保持・配布も ShuttlePub
  に委譲する delegated serving モデルに変更
- Deciders: operator

## Context

ActivityPub のサーバー間配送には HTTP Signature が必要で、署名鍵は AP actor
(= Profile、ADR 0002 amended)に紐づく。投稿データは ShuttlePub 本体が持つが、
秘密鍵は Emumet が管理する。

operator のプロダクト vision(2026-08-24 確認): Emumet は Google Workspace のような
サービス横断アカウント基盤であり、ActivityPub の責務は最大限 ShuttlePub に寄せる。
署名だけが Emumet 側に残る折衷点。

外部制約として、Mastodon / Misskey 現行 main のソース調査(2026-08-24)で以下を確認済み:

- 配信元ホスト/IP と署名者ドメインの照合は存在しない(未登録リレーからの配送も受理)
- Note object の `id` ホストは actor ホストと一致必須(Misskey は activity `id` ホストと
  `attributedTo` 完全一致も要求)。チェックはホストのみでパスは見ない
- object の再取得は request URL == final URL == document `id` の同一ホストを要求
  (Misskey strict)。**302 リダイレクトによる委譲は不可**
- 署名は配送試行・ターゲットごとの動的生成が必須(Misskey は Date ±300秒で拒否、
  署名 `host` は受信側ドメイン)
- Misskey の inbox ペイロード上限は 64KiB

## Decision (現行)

### 鍵と署名

- 署名用秘密鍵は Emumet が Profile ごとに生成・暗号化保管する
  (実装済み: `driver/src/crypto/rsa.rs`)
- ShuttlePub 発の投稿は Emumet が代理で署名する。署名済みリクエストの
  **配送(ファンアウト・送信・再送・配送状態管理)は ShuttlePub がハンドリングする**
- 署名 API は「任意バイト列への署名」ではなく、**狭い形に限定する**:
  - 入力: profile 指定 + 配送先 URL + 送信する正確な body バイト列
  - Emumet が `Date` / `Digest` / `Host` / `keyId` / 署名対象ヘッダリストを生成し、
    署名済みヘッダを返す。呼び出し側に署名文字列の構築を許さない
  - **配送試行ごと・ターゲットごとに呼ぶ**(事前署名の使い回しは不可)
  - wire contract: ShuttlePub は返却された body/ヘッダを byte-exact で送信する。
    外向きペイロードは 64KiB 上限(Misskey 互換 + DoS 防止)
- 認可は **Profile スコープの link capability**(shuttlepub-link 参照):
  - リンク時に `sign:post` 等の scope を付与。unlink で即時失効
  - request-time の構造検証は最小限: capability 有効性 / POST・HTTPS・canonical URL /
    body は JSON Activity で `actor` が対象 Profile に一致 / Create・Update では
    `attributedTo` 一致・ID が当該 link の namespace 内 / MVP で許可する Activity type
    のみ受理
  - 事前登録・digest 照合・履歴管理・内容の意味検証は行わない
    (=「capability を持つ ShuttlePub はその Profile として投稿できる」という
    信頼委譲を明示的に受け入れる。operator 判断 2026-08-24)
- 鍵運用モデル: 起動時に KEK/マスターシークレットで unlock し、復号鍵はプロセス内の
  bounded キャッシュ(TTL・上限付き)に保持。署名要求ごとの KDF 復号は
  fan-out × retry で CPU 枯渇するため採用しない

### ID とコンテンツ配布

- Activity / Note の `id` は Emumet ドメイン上の **リンクごとの名前空間**:
  `https://emumet.example/objects/<link-id>/<local-id>`
  - `link-id` は Emumet 発行の opaque ID。再利用禁止・発行時に Profile に固定
  - `local-id` は ShuttlePub が採番(衝突は名前空間分離で構造的に防止)
  - `local-id` は URL-safe な opaque segment に制限(path traversal / normalization 差異対策)
- **投稿コンテンツは Emumet に保存しない**(1回目 amend の「署名時記録」を撤回)。
  object / outbox の GET は Emumet ドメインの URL から発行元 ShuttlePub へ
  **透過リバースプロキシ**で配布する(302 は Misskey strict fetch で不可のため)
  - プロキシは document `id` と要求 URL の完全一致、および `attributedTo` の
    正当性を確認する。upstream のリダイレクトは拒否
  - ShuttlePub 障害時は 502 を返す(operator 判断 2026-08-24。キャッシュは将来拡張)
  - outbox の配布方式(プロキシ vs actor ドキュメントへの ShuttlePub URL 直接記載)は、
    コレクション URL のホスト制約の検証結果で確定する(2026-08-24 検証中。
    確定まではプロキシ方式を前提とする)
- **deletion marker のみ Emumet に保持する**(operator 判断 2026-08-24):
  署名した Delete について `object_id / profile_id / link_id / deleted_at` を記録し、
  削除済み object の URL には upstream より優先して Tombstone または 410 を返す
  (旧 ShuttlePub による削除済み投稿の復活防止)

## Consequences

- 秘密鍵が ShuttlePub 本体側に出ない
- マスターキーパスワード(KEK)による鍵暗号化が運用要件になる(実装済み)。
  加えて unlock 状態管理・キャッシュ運用・HA での unlock 手段が運用契約に必要
- 配送のリトライ・配送状態の記録は ShuttlePub 側の設計事項
- Emumet 側の外向き投稿受け口 API は不要(署名 API のみで足りる)
- **Emumet 障害は全 ShuttlePub の配送を同時停止させる**(署名が配送の前提のため)。
  ShuttlePub は未署名の配送ジョブを durable queue に保持し、指数 backoff で再試行する。
  署名をキャッシュして持ち越すことは時刻・ターゲット束縛のため不可
- 旧 ShuttlePub の停止・消滅により旧投稿は dereference 不可になる
  (ADR 0002 の保証外として受容。export による移行は将来機能)
- dereference の可用性は常に「Emumet AND 発行元 ShuttlePub」に依存する
- equivocation(同一 ID に別内容)は委譲先 ShuttlePub を信頼するモデルの前提として受容

## Links

- [features/post-relay](../features/post-relay/overview.md)
- [features/shuttlepub-link](../features/shuttlepub-link/overview.md)
- [0002](0002-account-address-on-emumet-domain.md)
