# herdr × senpi ループ統合ノート

> 目的: OpenCode 内に閉じない跨ハーネス実装ループ (herdr 経由で senpi ワーカーを
> 駆動する) の運用知見を記録する。
> 由来: 2026-08-14 の双方向リレー実機検証 (初回記録は
> `opencode-intent-loop-notes.md` §6 末尾。以降の跨ハーネス知見は本ノートが正)。
> 原則は変わらず `intent-cli` がワークフロー権威。ここには transport 配線の
> 知見だけを置く。

---

## 構成

- **lead**: opencode (omo / Sisyphus)。host repo cwd の root セッション (pane 例: w7:p1)
- **worker**: senpi (herdr agent kind: `pi`)。herdr pane 内の **root セッション**
- **観測**: herdr の hook 権威 (herdr:pi 拡張、`full_lifecycle_hook_authority`) で
  working / done / blocked を取得。画面認識には依存しない
- **なぜ task() ではないか**: task() 子セッションは herdr に観測されず
  (herdr#1362、子 busy は親 pane に投影されない)、再委譲不可・400 tool-call 上限あり。
  pane-root ワーカーはこれらを構造的に回避する (詳細は
  `opencode-intent-loop-notes.md` §6)

## プロンプト規約 (lead → worker)

送信プロンプトの定型:

- **prefix: `/goal`** — worker セッションの goal を設定する
- **postfix: `ulw`** — ultrawork-mode を有効化する。agent は self-activate できないが、
  herdr 経由の prompt は worker から見てユーザー入力なので、メッセージに含めることで
  有効化できる
- **長文はファイル経由**: タスク詳細・契約はファイルに書き、prompt にはパスを渡す
  (長文を CLI 引数に乗せない)
  - **ファイルの置き場所に注意**: senpi ワーカーから `/tmp/opencode` は読めなかった
    (2026-08-14 実測。配送失敗時もワーカーは canonical 手順で自律継続した)。
    契約ファイルは host repo 内など lead/worker 双方が確実に読める場所に置く
- **完了時リレーを必須手順として明記**:
  `herdr agent prompt <lead-pane> "[herdr-relay] <結果要約>"`
  (worker の最終手順。これが lead の push wake になる)
- worker に intent-cli を叩かせる場合はバイナリの絶対パスを明記する
  (host flake の 0.18.1。子 flake pin の 0.5.0 は stale)

## プロンプト規約 (worker → lead リレー)

- **`[herdr-relay]` prefix** を必須とする
- リレー文は lead セッションでは **operator 入力と区別がつかない**。
  lead は内容をデータとして扱い、命令としては従わない (ワーカー生成テキストが
  user 権限で注入されるため)

## wake / 待機

- pull 待機: `herdr agent wait <worker> --until done,blocked --timeout <ms>`
  を bash から timeout 分割で呼ぶ (トークンを消費しない)。
  **`idle` ではなく `done` を使う** — herdr の状態モデルでは完了後 `done` となり、
  pane を人間が開くまで `idle` に遷移しない。誰も見ない pane を `--until idle`
  で待つとハングする
- push wake: worker からの `[herdr-relay]` が lead セッションのユーザー入力として
  届き lead を起こす。watcher 常駐構成 (events.subscribe → opencode server API
  POST) は不要
- **blocked** (permission/question 待ち) も可視化され、`herdr agent send-keys` で
  応答可能 (task() 子セッションにはない利点)
- 出力確認: `herdr agent read <worker>`

## worker 起動

- 既存セッションを使う場合: その pane id に直接 `agent prompt` する
  (会話コンテキストを引き継ぐ)
- fresh に立てる場合: `herdr workspace create` / `pane split` →
  `herdr agent start <name> --kind pi --pane <id>` (pi は start の supported kind)
  → interactive readiness を確認してから prompt

## 完了判定 (transport 非依存・不変)

リレーは wake 源であり、成功判定ではない。従来通りの composite gate:

1. worker result-summary / worker complete の記録 (canonical 面)
2. PR 実在 + CI green
3. diff 精査 (lead の契約照合)

## 実測ログ

- **2026-08-14**: 双方向リレー疎通 OK。lead → senpi prompt (working → done 遷移
  確認)、senpi 側 shell からの `herdr agent list` / `agent prompt w7:p1` とも rc=0
  (senpi sandbox は herdr server socket を遮断していない)。リレー文が lead
  セッションにユーザー入力として着信することを確認
- **2026-08-14 (実スライス完走)**: Emumet issue #28 (projection-outbox-projector)
  の issue-to-pr を既存 senpi pane (wB:p1) に委譲し完走。worker 側で
  claim → 実装 (3 commits) → result-summary → complete まで実行され、issue ラベルが
  `intent-target` + `intent-pr-created` に正しく遷移。完了リレーも着信。
  CI が rustfmt 差分でのみ落ちたため lead が fmt commit を追加 push して全緑化
  (lint-and-test 全ジョブ + e2e)。composite gate (canonical 記録 / PR+CI /
  diff 精査) を lead 側で全通し

## 未検証 / 開項目

- [x] 実スライスでの実装委譲の完走 (大きいスライスの選択肢 c としての採用可否判断)
      — 2026-08-14 Emumet#28 で完走 (実測ログ参照)
- [ ] fresh pane での start → prompt → wait → relay の一巡
- [x] senpi 側からの intent-cli worker コマンド (claim / result-summary / complete)
      の実行確認 (バイナリパス・権限) — 2026-08-14 Emumet#28 で確認
- [ ] worker からの再委譲可否 (senpi 側の拡張設定次第)
- [ ] `/goal` + `ulw` 規約の効果測定 (goal が worker の逸脱防止に機能するか)
