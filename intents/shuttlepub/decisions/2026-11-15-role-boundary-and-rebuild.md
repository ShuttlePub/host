# 決定一覧: 2026-11-15 役割境界の訂正と内部実装の置き換え (D12-D19)

`ShuttlePub/ShuttlePub` の主担当 (operator、team `shuttlepub-core`) による決定。
2026-08-29 の決定一覧 (D1-D11) に続く番号を振る。
ruling の記録は `intent-cli ruling show role-boundary-and-rebuild-2026-11-15
--domain shuttlepub --team shuttlepub-core` で参照できる。

## 役割の定義

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D12 | Emumet の役割 | Emumet は ActivityPub と ShuttlePub サービス群における **Identity Plane** を担う。その中で inbox / outbox といった ActivityPub の技術は現れるが、それはリレー機能ではない | 確定 |
| D13 | ShuttlePub の役割 | ShuttlePub は (a) リレーサーバーとして振る舞う部分、(b) タイムラインの構築、(c) SNS として成り立たせる部分を担う。大まかな指標として、水平スケーリングの効果量が大きいものを ShuttlePub に置く | 確定 |
| D14 | 既存記述の訂正 | `shuttlepub` ドメインの記録にあった「連合中継は Emumet」という記述 (emumet intent からの転記) は誤りとして D12・D13 で改める。D2 (リレーは本体に内蔵) は有効で、D12・D13 と一致する | 確定 |

## 内部実装の置き換え

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D15 | 既存実装の扱い | 既存の内部実装は破棄して置き換える。コードは引き継がず、引き継ぐのはやり方のみとする。CQRS+ES へ乗り換える以上、ほとんどの項目が変わるため | 確定 |
| D16 | 基本アーキテクチャ | `HalsekiRaika/architectured` の `main` ブランチに倣う。レイヤードアーキテクチャ (`server` → {`application`, `driver`} → `kernel`) と、cake-pattern による DI (`DependOn*` trait + blanket impl) を使う | 確定 |
| D17 | CQRS+ES | D16 の上に nitinol 0.7 による CQRS+ES を適用する。書き込み側は集約によるイベントソーシング、読み取り側はプロジェクションによる読み取りモデルとする | 確定 |
| D18 | リレー部分の参照 | リレー部分は `HalsekiRaika/stargate` を PoC として参照する。stargate は ActivityPub のペイロードを見るデバッガーとして作られ中断しているが、architectured に近い構成を持ち、Follow→Accept を備える。参照するのは構成と手順で、コードは移さない | 確定 |

## REST API 契約

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D19 | `/api/v1` 契約の扱い | 置き換えでは `openapi/shuttlepub.json` に差分を出さないことを目指す。そのため D15 の例外として、契約の定義 (`server/src/api_v1*`、`server/src/openapi.rs`、`server/src/bin/openapi.rs`) と契約テスト・fixture は残す。置き換えは `dev` ブランチで行うので、コストが見合わない場合は一致しなくてもよい。その場合は、置き換え後に契約を後付けの基準として合わせる手段を取る | 確定 |

## 過去の決定との関係

- **D1** (全面刷新、stargate の構成を参考基盤): 全面刷新は維持。基本構成の
  参照元は D16 で architectured とし、stargate はリレー部分の参照 (D18) とする。
- **D2** (リレーは本体に内蔵): 維持。「実装知見を本体へ移管」は D15・D18 の
  「やり方のみを引き継ぐ」と同じ意味で読む。
- **D3・D4** (Emumet 側先行、待機期間の先行範囲): 変更なし。リレー部分の
  署名は当面、自前の鍵で行う。
- **D6** (postgres アダプタ完成まで in-memory): 前提が変わった。nitinol 0.7 は
  PostgreSQL のプロバイダ (`postgres` feature) を同梱している。永続化先は
  置き換えの設計で決める (本決定一覧では未決)。
- **generated-openapi-contract**: 変更なし。`main` の
  `openapi/shuttlepub.json` が契約の正本であることは変わらない。

## 影響範囲 (他ドメインの担当者向け)

D12-D14 により書き換えた `shuttlepub` ドメインの記述:

- `identity/mission.md`: Mission statement、Vision の2項目め、
  Values の「責務の分離」
- `product/overview.md`: Non-goals の「アカウント・署名鍵・連合中継 → Emumet」

`shuttlepub` ドメイン外で、同じ趣旨の記述を持つ可能性がある箇所
(本決定では変更していない):

- `emumet` ドメインの intent 記録のうち、「連合中継」「連合プロトコル面の
  複雑さを Emumet に閉じ込める」に当たる Mission / Vision / Values の記述。
  `shuttlepub` 側の旧記述はここからの転記だった。
- D2 が「別途詰める」とした、署名主体・actor 帰属の Emumet との分界。
  D12・D13 は役割の大枠を定めたもので、この分界の詳細は未決のまま。

## 未決

- 永続化先 (D6 の扱い)。
- `dev` で契約に差分が出た場合の、`main` への merge 時の扱い。
- 実装済みの操作について、契約の文面にある「stub: always answers 501」
  などの記述をどうするか (文面を直すと `openapi/shuttlepub.json` に差分が出る)。
