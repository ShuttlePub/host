# emumet-post-relay 契約 (v1, revision 3)

Emumet が Profile の inbox で受けた Activity を、ホーム link の ShuttlePub へ転送するときの契約。
**この directory が正本** (D61)。Emumet 側 (`ShuttlePub/Emumet` の `docs/contracts/post-relay-v1*`) は、
この directory の commit・版・checksum を記録した写しで、独立に編集しない。

| ファイル | 内容 |
|---|---|
| [v1.md](v1.md) | 契約の本文 (英語): 転送先、envelope、外側署名、再送で変わるもの・変わらないもの、受け手の検証 (P1 は link 台帳なし)、inbox の読み取りと振り分け、lifecycle、定数の表、写しの規則 |
| [v1.schema.json](v1.schema.json) | envelope の JSON Schema (2020-12) |
| [v1.constants.json](v1.constants.json) | 定数 (文書の表・schema・fixture と一致させる) |
| [fixtures/](fixtures/README.md) | P1 の fixture、P2 の fixture (事前状態を明記して分離)、再送、署名ベクトル、inbox 読み取り、公開鍵 |
| [tools/](tools/) | fixture の生成 script (`node` だけで動く)。再生成すると鍵と署名がすべて変わる |

## 置き場所の根拠

- 計画 (第 3 版) §10.1 の第一候補。代替 (`intents/emumet/features/post-relay/contract-v1.*`) は使わない。
- `intent-cli guide host-ownership`: design の役割は `intents/<domain>/**` に書ける。契約は ShuttlePub が受け手で、
  envelope の決定 (D54) も shuttlepub domain にあるため、shuttlepub domain に置く。
- `intent-cli intent lint-layout --domain shuttlepub` は、この directory の追加で新しい警告を出さない
  (既存の `MISSING-FEATURE-OVERVIEW` のみ)。
- emumet domain の `features/post-relay` からは参照 (links.md・decisions.md) だけにして、正本を 1 つに保つ。

## 検証

host には CI がない。契約の検証は Emumet の `server/tests/post_relay_contract.rs` (CI の `Check server` で実行) が行う:
写しの checksum、定数の一致、schema、P1 の fixture (link 台帳なしの参照受け手)、署名ベクトル、再送、
inbox の読み取り。契約を変えるときは、この directory を変えて commit し、写しを作り直す (v1.md §12)。

## 決定との対応

D61 (置き場所)・D62 (解除と送信開始)・D63 (除外条件)・D64 (30 日隔離)・D65 (移管・再有効化)・D66 (P1/P2)・D67 (revision 2 のレビュー反映)
— [../../decisions/2026-11-21-emumet-p1-open-items.md](../../decisions/2026-11-21-emumet-p1-open-items.md)。
