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
product/service-concept.md   サービス群全体のコンセプト (2026-11-18)
packets/roadmap-2026-11-18.md  サービス群の実装ロードマップ (P0-P4)
contracts/emumet-post-relay/ Emumet 内向き転送の契約 v1 (正本。D61)
decisions/                   決定一覧 (D1-D11: 2026-08-29 grill、D12-D19: 2026-11-15 役割境界と再構築、D20-D22: 2026-11-16 リレー優先・module の切り分け・永続化先、D23-D35: 2026-11-18 サービス群のコンセプトとサービス間の前提、D36-D41: 2026-11-18 P1 の連携を先に通し、その後 Stellar を切り出す、D42-D50: 2026-11-20 問題領域と 3 つの Producer・port 層、D51-D68: 2026-11-21 Emumet の P1 以降の未決事項と転送の契約、D69-D71: 2026-11-22 TL の流れ先・リレーを初期の範囲から外す・Shared Inbox と link の許可)
features/                    (未整理)
clarifications/open.md       (未整理)
interviews/shuttlepub.json   初動 shaping の決定記録 (Q1-Q11)
```

## 初動実行単位 (packet-ready)

**`note-foundation`**: nitinol 土台 + Note ドメイン (turbo/turbo_quote 語彙で
投稿・reply・ブースト・引用・reaction) + タイムライン投影 + stargate からの
連合面移植 (署名モック、in-memory 永続化) + Emumet 契約書。
受け入れ基準・検証方法は decisions D10、packet は `.intent-cli/issues/note-foundation/`。

## 再構築 (D12-D19、2026-11-15〜)

役割境界の訂正 (Emumet は Identity Plane、リレーサーバーとしての振る舞いは本体)
と、内部実装の置き換えを決定した
(`decisions/2026-11-15-role-boundary-and-rebuild.md`)。作業は `dev` で行い、
`/api/v1` の契約は維持する (D19)。

- **`shuttlepub-layered-foundation`** (完了 2026-11-16、ShuttlePub/ShuttlePub
  PR #31、`dev` = f12933b): 4 crate のレイヤード構成と cake-pattern DI の土台、
  新しい構成の上での Follow→Accept (`POST /inbox`・`GET /actor`)。旧 Note スライスと
  nitinol 0.4.2 への依存は削除。到達範囲と構成は
  [technology/overview.md](../technology/overview.md)。
- **未着手**: nitinol 0.7 による CQRS+ES と永続化 (D17)、フォロワーの保存、
  `/api/v1` のハンドラの実装。

## サービス群のコンセプトとロードマップ (D23-D35、2026-11-18)

「1 つのアカウントで、たくさんの小さなタイムラインを渡り歩ける Fediverse」を
サービス群のコンセプトとし、ShuttlePub を「コミュニティそのもの (1 サーバー =
1 コミュニティ)」と位置付けた。あわせて Emumet との前提 (内向き転送の専用 API、
ホーム / 参加の link と信頼モード、DCR、署名 API のバッチ化、契約の merge 方針、
連合 E2E) を決めた。

- 決定: [decisions/2026-11-18-service-concept-and-cross-service-p0.md](../decisions/2026-11-18-service-concept-and-cross-service-p0.md)
- コンセプト: [product/service-concept.md](../product/service-concept.md)
- ロードマップ: [packets/roadmap-2026-11-18.md](../packets/roadmap-2026-11-18.md)
  (P0 前提 → P1 連合の土台 → P2 投稿とコミュニティ TL → P3 フォロワーへ届ける・
  ホーム TL → P4 反応・制御・メディア・運用)

## P1 を先に通し、その後 Stellar を切り出す (D36-D41、2026-11-18)

現行の Ory 構成のまま、外部から届いた Activity を Emumet が受信して Profile の
アタッチ先の ShuttlePub へ転送し、重複を除いて保存するところまで (P1) を先に通す。
その後、Stellar を Ory の上に載る薄い認証サービスとして切り出す。ShuttlePub は
リレー用 inbox と転送用の専用 API の両方を持つ。リリース前に QA の工程を置く。
転送時の認証方式、Ory 停止中に保証する範囲、D32 の対応表の担当は未決。

- 決定: [decisions/2026-11-18-p1-first-and-stellar-carve-out.md](../decisions/2026-11-18-p1-first-and-stellar-carve-out.md)

## 問題領域と 3 つの Producer (D42-D50、2026-11-20)

ShuttlePub が扱う問題を「Producer から送られた Activity を元に、タイムラインが構築される
こと」と定めた。Producer は、① 利用者の投稿、② 連合を申し込んできた外のサービス
(リレー用 inbox)、③ Emumet からの転送の 3 つ。リレーは多数の投稿を受けるための仕組みで、
Follow は Producer ② が増える出来事として扱う。タイムラインは Local TL・Global TL・
ホーム TL と呼び、Projector で導く。KJ法のまとまりは D47 の表に置き換えた。
外部サービスが実体であるものの口を置く `port` 層を足す (D50)。
`shuttlepub-relay-follower` (#32) は retired にし、PR #33 は merge せずに閉じた (2026-11-20)。
供給元の受け入れと届いた投稿の受け入れを、新しい実行単位で作り直す。Global TL は後のフェーズ。

- 決定: [decisions/2026-11-20-problem-domain-and-producers.md](../decisions/2026-11-20-problem-domain-and-producers.md)
- **`shuttlepub-producer-intake`** (完了 2026-11-23、ShuttlePub/ShuttlePub PR #35、Issue #34、
  `dev` = efb5bfc): 5 crate (port 層を追加)、nitinol 0.8 と PostgreSQL の導入、供給元の受け入れ
  (Follow の記録)、Accept の配送 (出来事への反応)、届いた公開投稿の記録まで。到達範囲と
  分かったことは [technology/overview.md](../technology/overview.md)。
  タイムラインの Projector・Undo・転送の受け口は未着手。

## リレーを初期の範囲から外す (D69-D71、2026-11-22)

Local TL はこの ShuttlePub の投稿だけ、Global TL は受け取った公開投稿とした (D69)。リレー
(外部からの取り込みと再配信) を初期の範囲から外し、P1 の最初の単位を Emumet からの転送
(Producer ③) の受け口に改めた (D70)。Emumet は Shared Inbox を持ち、送り先の ShuttlePub ごとに
本体 1 件と宛先の Profile 一覧をまとめて送る。link の信頼モードは署名・受け取り・コレクションの
別々の許可にした (D71)。

- 決定: [D69](../decisions/2026-11-22-timeline-routing.md)、
  [D70](../decisions/2026-11-22-initial-scope-without-relay.md)、
  [D71](../decisions/2026-11-22-shared-inbox-and-link-permissions.md)
- **`shuttlepub-producer-intake` との関係**: D70 の記録の時点で、この単位は Issue #34 として発行済みで
  PR #35 がレビューを終えていた (D70 の「packet は queued (未公開) のまま」は queue-state の表示で、
  実際の状態とずれていた)。operator の判断 (2026-11-23) で、PR #35 を `dev` に merge してから直す。
  層・nitinol・PostgreSQL・まとまり「受け入れ」・投稿の集約は ③ の受け口で使う。Follow の受付・
  供給元の集約・Accept の配送・リレー用 inbox での Create の受け入れは、次の単位で外す。
- **次の単位**: Emumet からの転送の受け口 (`POST /internal/v1/emumet/activities`)。D71 で転送の契約を
  改める (v1 の revision か v2 か未決) ので、その形が決まってから packet にする。

下の「将来 slice」は 2026-08-29 時点の目安で、順序はロードマップが新しい。

## 将来 slice (依存順の目安)

1. **Emumet 接続**: capability 署名 (D3 の完成条件が揃い次第)。リレーの
   署名切替 + post-relay 受け口の実接続
2. **postgres 永続化**: nitinol postgres アダプタ (別リポジトリ、実装中)
   完成後の切换
3. **フロントエンド**: 別リポジトリとして構築 (D9)
4. turbo quote 以外の独自概念・UI 語彙の再検討 (必要時 grill)

## 受領した将来意図 (2026-10-15)

[social-experience](../product/social-experience.md) にDiscord由来の17意図を整理。
[packet候補](../packets/candidates.md) はrepo別の分割案・依存・未決事項を持つ。
[受領原文](../drafts/discord-feature-intake-2026-10-15.md)から追跡できる。
方式・優先順位は未確定、実行queueへの追加やissue公開は行っていない。

投稿・timelineは `ShuttlePub/ShuttlePub`、個人domain設定や登録防御は `ShuttlePub/Emumet`、
画像metadataは `ShuttlePub/Booskiff` を第一候補、UIは `ShuttlePub/shuttlepub-frontends` とする。
file／attachment境界とSNS UIの正式domainは未決。

上記の初動記述は当時の履歴。現在のNote基盤と連合の限定範囲は
[受領時の実装調査](../product/social-experience.md#責務と現状の根拠)を参照。

## ホストデータ

- キュー・packet: `.intent-cli/issues/` (共用ルート。
  現行 bindings の execution_unit_regex は `.*` のため他 domain unit も
  参照範囲。絞り込みは未実施)
- 自動化 bindings: `automation/bindings.md` (child_repo: ShuttlePub/ShuttlePub)
