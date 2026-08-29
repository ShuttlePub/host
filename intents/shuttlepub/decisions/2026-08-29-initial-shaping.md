# 決定一覧: 2026-08-29 初動 shaping grill (D1-D11)

grill Q1-Q11 の結論。決定の経緯・検討肢・理由の完全版は
`../interviews/shuttlepub.json` (セッション: shuttlepub)。

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D1 (Q1) | コードベース | 2023 年スケルトンは全面刷新。nitinol ベースで一から再構成し、stargate (edition 2024) の構成を参考基盤とする | 確定 |
| D2 (Q2) | リレー位置づけ | 本体に内蔵。stargate は PoC として位置づけ、その実装知見 (Follow 受理→Accept 配送、HTTPSig 署名・検証、リモート Actor 解決) を本体へ移管。署名主体・actor 帰属の分界は Emumet と別途詰める | 確定 |
| D3 (Q3) | 初動の Emumet 依存 | C3: Emumet 側先行。capability (shuttlepub-link / post-relay) 実装の要求駆動に回し、Emumet 完成後に本体の接続着手。現行 Account 単位署名 API での先行は後で作り替えが確定するため不採用 | 確定 |
| D4 (Q4) | 待機期間の先行範囲 | 非依存部分の実装まで: Emumet への契約定義 + nitinol 土台 + Note ドメイン + stargate からの連合面移植 (署名はモック or 自前鍵) | 確定 |
| D5 (Q5) | Note ドメインスコープ | Misskey 的標準セット: 投稿・reply・renote 相当・quote 相当・reaction (mention/hashtag を含む)。nitinol の examples / コード内 docs が充実しており初動で現実的と判断 | 確定 |
| D6 (Q6) | 永続化バックエンド | postgres アダプタ (実装中) 完了まで in-memory (nitinol-persistence 組込)。なお sqlite アダプタは未実装 | 確定 |
| D7 (Q7/Q8) | ドメイン語彙 | turbo / turbo_quote を新設計でも維持 (ブースト / 引用の独自語。AP に公式語がないための当時の決定を引き継ぐ)。イベント family 名の語彙規約として初動で固定 | 確定 |
| D8 (Q9) | イベント基盤の関係 | 本体 (nitinol) と Emumet (独自 ES) のイベントストアは完全分離。連携は HTTP API (署名 API、post-relay 受け口) のみ。将来のイベント連携は nitinol の Projector/CheckpointStore で後付け | 確定 |
| D9 (Q10) | クライアント層 | 初動は API のみ。フロントエンドは別リポジトリとして後で作る | 確定 |
| D10 (Q11) | 受け入れ基準 | 6 項目 (下記) | 確定 |
| D11 | 実行単位 | 初回実行単位を `note-foundation` とする | 確定 |

## 初回実行単位 `note-foundation` の受け入れ基準 (D10)

1. nitinol ベース workspace で ProcessSystem / EventSourceSystem が起動する
2. Note aggregate (投稿・reply・turbo・turbo_quote・reaction) のイベント
   decide/apply が実装され、in-memory EventStore で永続化・replay が検証される
3. Projector によるタイムライン read model が構築でき、取得 REST API が応答する
4. 連合面: inbox で Follow を受理しモック署名で Accept を返送、リモート Actor
   解決と HTTPSig 検証が動作する (stargate 移植)
5. Emumet への契約書 (capability 署名 API + post-relay 受け口の要求定義) が
   ドキュメントとして記録されている
6. 各 aggregate の単体テスト + replay 検証テストが CI で回る

## 意図的に後続 slice に送った論点

- リレーの Emumet 署名への切り替え (capability 完成後の接続 slice)
- post-relay 受け口の実接続 (Emumet 側の転送機構完成後)
- フロントエンド (別リポジトリ)
- nitinol postgres アダプタ本体 (別リポジトリ、実装進行中)
- ユーザー向け UI 語彙と内部語の使い分け (今回は turbo 語を全面採用で統一)
