# External Links

## 関連リポジトリ (HalsekiRaika = オーナー個人アカウント)

- **nitinol** — https://github.com/HalsekiRaika/nitinol
  「An Event Sourcing toolkit for Rust」(v0.4.2、workspace 構成)。
  feature 構成: `runtime` (actor runtime: ProcessSystem / Process)、
  `contract` / `eventsource` (Aggregate / Projector)、`persistence`
  (EventStore)、`saga` (event-sourced process manager)。
  ShuttlePub 本体で採用したい Actor Model + ES の基盤ライブラリとして
  開発中 (オーナー共有 2026-08-29)。Emumet コードベースへの導入実績は
  未確認 (Emumet の Cargo.toml には依存なし)。
- **stargate** — https://github.com/HalsekiRaika/stargate
  「A debugging tool for ActivityPub Protocol」(edition 2024、
  app-cmd / driver / kernel / server 構成)。リレー機能の PoC 兼用。
  実装確認済み: リレー Actor への Follow → リモート Actor 照会 →
  Accept 配送の interactor (app-cmd/src/interactors/relay/)、
  HTTP Signature の署名・検証 (http-msgsign-draft ベース)、
  リモート Actor / Inbox 取得クライアント、AP エンティティ
  (Activity / Actor / Link 系)。
- **lutetium** — https://github.com/HalsekiRaika/lutetium
  「tokio based simplified actor library」 (CQRS+ES 向け)。
  nitinol runtime の前身候補と思われるが、現行基盤として位置づけられた
  のは nitinol (未確認の推測)。
- **diazene** — https://github.com/HalsekiRaika/diazene
  「Simple Actor for Rust (with Tokio)」。同上、actor library の
  試作段階のひとつと思われる (未確認の推測)。

## サービス群リポジトリ (ShuttlePub org)

- Target repo: https://github.com/ShuttlePub/ShuttlePub
- ShuttlePub/Emumet — アカウント・連合中継 (es-aggregates 実装済み)
- ShuttlePub/Booskiff — ファイル保管 (drive-foundation queued)
- ShuttlePub/document — ドキュメント (docs.shuttle.pub)
