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
