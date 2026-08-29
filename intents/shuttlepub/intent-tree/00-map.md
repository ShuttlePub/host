# Intent Map

- Domain: `shuttlepub`
- Target repo: `ShuttlePub/ShuttlePub`
- Initial map: **初動整理 2026-08-29** (コード観察ベース、grill 未実施)

## ドメイン形状 (初動整理)

ShuttlePub は「ShuttlePub サービス群の SNS 本体 (タイムライン構築・投稿
永続化)」を目指すドメイン。ただし現状コード (最終コミット 2023-04-30) は
独自アカウント管理を前提とした CRUD スケルトンのみで、サービス群の現行
intent (emumet / booskiff) が前提とする連携構成 (Emumet / Ory / Booskiff)
とは乖離している。乖離は観察として記録し、ここでは評価しない。

```
identity/mission.md          使命 (サービス群記録より) + 現状コードとの対応 (観察)
product/overview.md          現状実装インベントリ (評価なし)
technology/overview.md       現状スタック、未使用依存、設計方向 (nitinol / stargate)
links/external.md            関連リポジトリ (nitinol, stargate, サービス群)
features/                    (未整理)
decisions/                   (未整理)
clarifications/open.md       (未整理)
```

## 設計方向 (オーナー共有 2026-08-29、grill 前の前提)

- 本体は **Actor Model + Event Sourcing** で構築する方向。基盤ライブラリ
  **nitinol** (Rust 製 ES toolkit、actor runtime 搭載) を開発中。
- **リレー機能の PoC** は **stargate** (AP デバッグツール兼) で進行中。
  署名・検証・リモート Actor 照会・Accept 配送まで実装確認済み。
- 上記は 2023 年スケルトンとは別系統の新規実装方向。既存コード資産との
  関係は未決定。

## 未整理の論点 (grill 候補、優先順ではない)

- 2023 年スケルトンと新規実装方向 (nitinol ベース) の関係:
  全面刷新か、部分的再利用 (層構成・postgres 基盤など) か
- リレー (stargate PoC) の位置づけ: 本体の機能として内蔵するか、
  別サービスとして切り出すか (Emumet の連合中継との責務分界も絡む)
- Emumet / Ory / Booskiff との連携設計 (現行コードには存在しない)。
  nitinol ベースにすると Emumet (独自 ES 実装) とのイベント整合性
  設計も論点
- migration 内の notes / turbo quote 系スキーマの扱い (Rust 実装なし、
  SQL 自体の適用可否も未検証)。turbo quote の設計意図は未確認
- 未使用依存 (redis / meilisearch / lettre / image) の去就
- ユーザー層・機能境界の固有記録 (現行は emumet 記録の参照のみ)

## ホストデータ

- キュー・packet: `.intent-cli/issues/` (共用ルート。
  現行 bindings の execution_unit_regex は `.*` のため他 domain unit も
  参照範囲。絞り込みは未実施)
- 自動化 bindings: `automation/bindings.md` (child_repo: ShuttlePub/ShuttlePub)
