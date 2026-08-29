# Intent Map

- Domain: `shuttlepub`
- Target repo: `ShuttlePub/ShuttlePub`
- Initial map: **初動確定 2026-08-29** (grill Q1-Q11、記録: `interviews/shuttlepub.json`)

## ドメイン形状 (初動確定)

ShuttlePub は「ShuttlePub サービス群の SNS 本体 (タイムライン構築・投稿
永続化)」を目指すドメイン。2023 年スケルトン (最終コミット 2023-04-30) は
初動 grill で**全面刷新**が決定 (D1)。現行実装は nitinol (Rust 製 ES
toolkit、actor runtime 搭載) ベースで再構成する。リレー機能は本体に内蔵
(D2、stargate の PoC 知見を移管)。サービス群の現行 intent (emumet /
booskiff) が前提とする連携構成 (Emumet / Ory / Booskiff) とは、初動は
Emumet 側先行 (D3) で、本体は非依存部分の実装から着手 (D4)。

```
identity/mission.md          使命 (サービス群記録より) + 現状コードとの対応 (観察)
product/overview.md          現状実装インベントリ (評価なし)
technology/overview.md       現状スタック、未使用依存、設計方向 (nitinol / stargate)
links/external.md            関連リポジトリ (nitinol, stargate, サービス群)
decisions/                   2026-08-29 grill の決定一覧 (D1-D11)
features/                    (未整理)
clarifications/open.md       (未整理)
interviews/shuttlepub.json   初動 shaping の決定記録 (Q1-Q11)
```

## 初動実行単位 (packet-ready)

**`note-foundation`**: nitinol 土台 + Note ドメイン (turbo/turbo_quote 語彙で
投稿・reply・ブースト・引用・reaction) + タイムライン投影 + stargate からの
連合面移植 (署名モック、in-memory 永続化) + Emumet 契約書。
受け入れ基準・検証方法は decisions D10、packet は `.intent-cli/issues/note-foundation/`。

## 将来 slice (依存順の目安)

1. **Emumet 接続**: capability 署名 (D3 の完成条件が揃い次第)。リレーの
   署名切替 + post-relay 受け口の実接続
2. **postgres 永続化**: nitinol postgres アダプタ (別リポジトリ、実装中)
   完成後の切换
3. **フロントエンド**: 別リポジトリとして構築 (D9)
4. turbo quote 以外の独自概念・UI 語彙の再検討 (必要時 grill)

## ホストデータ

- キュー・packet: `.intent-cli/issues/` (共用ルート。
  現行 bindings の execution_unit_regex は `.*` のため他 domain unit も
  参照範囲。絞り込みは未実施)
- 自動化 bindings: `automation/bindings.md` (child_repo: ShuttlePub/ShuttlePub)
