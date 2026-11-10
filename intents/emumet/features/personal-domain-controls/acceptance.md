# personal-domain-controls — acceptance

> 契約・検証境界。overview は [overview.md](overview.md)。個別 unit の受け入れ詳細は各 packet が正本。

## D08 全体の受け入れ（全 unit 完了時。現時点では未達）

- [ ] Profile P の mute で表示が抑制され既存関係は残る。block では表示抑制＋既存 Follow／Follower の両方向解除
- [ ] P の設定は同一 Account の別 Profile Q・他 Account の Profile に波及せず、全体 HostModeration も発生させない
- [ ] 設定は実保存され再取得後も適用される（D8P）
- [ ] block 対象 domain から P への新規 Follow、P から対象 domain への新規 Follow を拒否（D8G）。mute は拒否しない
- [ ] block で pending を含む両方向の関係が解除され、AP Block は送らず最小限の通知のみ。外部障害でもローカル適用は成功（D8R）
- [ ] 解除後も関係は復元されず、復元用一覧も保持されない。再フォローは利用者操作
- [ ] 完全一致のみ（`sub.example.com` に `example.com` の設定は適用されない）
- [ ] 返信・引用・リポスト・いいね／絵文字の新規受理・送信拒否、表示抑制（ShuttlePub 側・後続 unit）
- [ ] UI から実ログイン→実方針保存・取得→Follow 解除まで確認（F8）

## E8（契約）の受け入れ境界

- Profile identity・Follow・個別 block/mute・domain-controls の認可・revision・エラーが OpenAPI に定義される。
- 作成 API の username は P4 まで optional。指定時は形式検証し、保存未実装の間は作成副作用前に明示的な未実装エラー（黙って無視しない）。
- 将来用 Profile actor／関係 route は本番未 mount であることを schema 説明にも記載。
- 外部 ID は nanoid。username 更新 API を通常の編集機能として設けない。
- 検証: OpenAPI 再生成、旧作成 payload・新 payload・未実装エラーの contract test、既存 Rust CI。
- 非目標: 新関係処理・方針保存・username 保存の実装。

### E8 確定契約（Emumet PR #70、squash `0bfa437`、2026-11-10 マージ済み）

- 契約 route は本番 root router に未 mount（タグ `ProfilePolicy`）。ハンドラは明示的 501 で、架空の成功・`todo!` はない。OpenAPI の tag・各 operation・**component schema 16 型の説明**に「CONTRACT ONLY / NOT MOUNTED」を記載し、テストで固定。
  - Profile identity `GET /api/v1/profiles/{profile_nanoid}`、Profile actor `GET /ap/profiles/{profile_nanoid}`（**actor URL の最終形・WebFinger は P1 で確定**）
  - Follow: `POST|DELETE .../follows[/{follow_id}]`、`GET .../following`、`GET .../followers`
  - 個別 block/mute: `GET|POST .../blocks`・`DELETE .../blocks/{block_id}`、`GET|POST .../mutes`・`DELETE .../mutes/{mute_id}`
  - domain-controls: `GET .../domain-controls`、`GET|PUT|DELETE .../domain-controls/{domain}`
- **followers の応答型は following と分離**。`ProfileFollowerResponse.follower` は `ProfileActorRef`（`kind`: local|remote、`actor_url`: canonical actor URL で常に必須、`profile_id`: local のみ）。remote／local 双方の応答 fixture あり。following は `ProfileFollowResponse.target`（canonical actor URL）。
- **domain-controls の revision / 409**: revision は 1 始まりで変更ごとに単調増加。PUT は `expected_revision` 省略＝新規作成（既存なら 409）、指定＝現 revision 一致時のみ置換（不一致・同時削除済みは 409）。DELETE は `expected_revision` 必須（不一致 409）。認可は Profile の現在の所有者のみ（401/403/404）。domain は完全一致（正規化の詳細は D8P）。block 書込は D8R まで未 mount。
- **username 段階（E8）**: `POST /api/v1/accounts` の `profile_username`・`POST /api/v1/profiles` の `username` は optional（`null` は省略扱い）。形式・予約語違反は **400**、有効値は保存未実装のため **501**。いずれも `resolve_auth_account_id` を含む作成副作用の前に拒否し、指定値を黙って捨てない。省略した旧 payload は従来どおり 201。`ProfileResponse.username` は nullable（未設定）。username 更新 API は設けない（テストで固定）。
- 検証: OpenAPI 再生成、実 DB（PostgreSQL 16）で workspace テスト（旧 payload・新 payload・501/400・副作用なし）、CI 全 green。
- **後続への引き継ぎ**: 未 mount の不在テストは `main.rs` の文字列検査＋テスト router のみ。**本番と共有する router 構成関数による「対象 route 不在」検査を P1（実 root 構成の route 不在テスト）／P4（mount 時）で実装**。

## 検証境界

| unit | 検証 |
|---|---|
| E8 | 上記 |
| D8P | 実 DB、正規化表（IDNA 等）、認可、同時更新、Profile 分離・移管 |
| D8G | 受信・送信・配送・block 更新の競合、重複、遅延 Accept。unblock 後の古い activity 再送で関係が復活しない |
| D8R | 実 DB・署名付き mock peer・配送競合・wire-level activity 検査（自分の Follow は元 Follow を参照する Undo、相手の Follow は Reject 等。AP Block なし） |
| F8 | FA 経由の実 Emumet E2E、BFF 変換、UI・visual。投稿部分は mock／未接続と明示 |

## 責務の境界

- Emumet は新規 Follow のみ実適用する。投稿操作の受理・送信拒否は ShuttlePub の後続責務で、Emumet に重複実装しない。
- 完了報告で「D08 本番適用完了」と書いてはならない。到達範囲は [packets.md](packets.md) に記録する。

## UI 前提（ユーザー指示）

F8 の画面構成を決める実装はモック合意まで保留する。F8 の UI・visual の受け入れは画面構成のモック合意後に行う。
