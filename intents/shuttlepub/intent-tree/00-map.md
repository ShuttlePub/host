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
technology/overview.md       現状スタック、未使用依存、データモデル観察
features/                    (未整理)
decisions/                   (未整理)
clarifications/open.md       (未整理)
```

## 未整理の論点 (観察で出たもの、優先順ではない)

- 現行スケルトン (独自 Account/Profile/Follow、confidentials 認証) を
  資産として継続するか、サービス群構成に寄せるか
- migration 内の notes / turbo quote 系スキーマの扱い (Rust 実装なし、
  SQL 自体の適用可否も未検証)
- 未使用依存 (redis / meilisearch / lettre / image) の去就
- ユーザー層・機能境界の固有記録 (現行は emumet 記録の参照のみ)

## ホストデータ

- キュー・packet: `.intent-cli/issues/` (共用ルート。
  現行 bindings の execution_unit_regex は `.*` のため他 domain unit も
  参照範囲。絞り込みは未実施)
- 自動化 bindings: `automation/bindings.md` (child_repo: ShuttlePub/ShuttlePub)
