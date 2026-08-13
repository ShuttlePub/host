# ShuttlePub intent-system 集約セットアップガイド

> 目的: サービスごとに分散している intent-system セットアップを、作成済みの集約 host リポジトリ 1 つに統合する。
> 対象読者: オペレーター(人間)と、作業を実行する AI エージェントの design スレッド。
> 原則: **手でファイルや label をいじらず、各ステップで `intent-cli` のガイダンスに従う**。このガイドは道筋の管理に使い、判断に迷ったら design スレッドで `intent-cli` に聞く。

## 進捗ステータス(2026-08-13 時点)

| domain | 状態 |
|---|---|
| `emumet` | ✅ 完了(Phase 1–5 実施済み。集約 host で実運用中) |
| `ratcap` | ✅ 完了(同上) |
| `shuttlepub` | ⏳ 未実施。追加時に Phase 1–3 をこの domain に対して実行する |
| `stellar` / `satellite` | 🚫 当面対象外。追加したくなった時点で同じ手順で domain を1つ追加する |

host の初期化(Phase 1-1 / 1-2)は完了済みのため、残作業は「新規 domain ごとの登録(Phase 1-3 以降)」のみ。Phase 0 / Phase 4 は追加対象 domain に旧セットアップがある場合だけ実施する。

---

## 0. ゴール状態と前提変数

### ゴール状態

```
ShuttlePub/<host-repo>          ← 集約 host リポジトリ(トポロジーA)
  .intent-cli/                  ← queue-state 等(host 単位・単一)
  intents/
    shuttlepub/                 ← domain(対象: ShuttlePub/ShuttlePub)追加予定
    emumet/                     ← domain(対象: ShuttlePub/Emumet)✅ 登録済み
    ratcap/                     ← domain(対象: ShuttlePub/RatCap)✅ 登録済み
    # stellar / satellite       ← 当面対象外(必要になった時点で同手順で追加)
  AGENTS.md
```

- domain は横並び。上位/下位のネスト概念は存在しない
- 将来のストレージサービスや stellar / satellite を追加する場合は、作成・追加時に同じ手順(Phase 1-3 以降)で domain を1つ追加するだけ
- http-msgsign / ap-sandbox / document 等の付随リポジトリは、intent 駆動で回したくなった時点で同様に domain 追加すればよい。今回は対象外でよい

### 前提変数(作業前に埋める)

| 変数 | 値 | 例 |
|---|---|---|
| `HOST` | 作成済み host リポジトリ | `ShuttlePub/<host-repo>` |
| `HOST_ROOT` | host リポジトリのローカル checkout パス | `~/work/<host-repo>` |
| 対象 domain | 登録済み: `emumet` `ratcap` / 追加予定: `shuttlepub` / 当面対象外: `stellar` `satellite` | 対象 repo は `ShuttlePub/<Capitalized名>` |

---

## Phase 0: 現状の棚卸し

集約先に持っていくもの・持っていかないものを確定する。

### 0-1. 既存セットアップの所在を特定する

試験導入済みの各リポジトリ(少なくとも Emumet / RatCap。ShuttlePub 本体等も)について、intent メタデータがどこにあるか特定する:

```bash
# 実装リポジトリ内に直接置いていないか(本来は無いはず)
gh repo view ShuttlePub/Emumet --json defaultBranchRef
git clone --depth 1 https://github.com/ShuttlePub/Emumet /tmp/check-emumet && ls /tmp/check-emumet

# メタデータ用ブランチ(main-metadata 等)がないか
git ls-remote --heads https://github.com/ShuttlePub/Emumet | grep -i metadata

# サービス個別の host リポジトリが org にないか
gh repo list ShuttlePub --limit 100
```

確認するもの:
- `intents/<domain>/` ディレクトリの場所(メタデータブランチ or 個別 host リポ)
- `.intent-cli/` ディレクトリの場所

### 0-2. 飛行中の作業を記録する

旧セットアップから publish 済みの issue / PR があれば記録する:

```bash
gh issue list -R ShuttlePub/Emumet --label intent-target --state open
gh issue list -R ShuttlePub/RatCap --label intent-target --state open
gh pr list -R ShuttlePub/Emumet --state open
gh pr list -R ShuttlePub/RatCap --state open
```

**方針(推奨):** 飛行中の issue/PR は旧セットアップ側で完了(closeout/merge)させてから切り替える。途中の queue 状態を新 host に引っ越す公式手段はなく、`.intent-cli/queue-state.json` の手動マージは docs が明示的に禁止している。完了させられないものは「旧 host では中断し、新 host 側で packet から切り直す」判断をオペレーターが下す。

### 0-3. 旧ループの停止

旧セットアップで実装/レビューのタイマーループや orchestrator、supervision スケジューラ(launchd / systemd / Task Scheduler 登録)が動いている場合はすべて停止・登録解除する。supervision artifact は install 時に表示された unregistration コマンドで解除する。

> 同一 domain/repo に対してドライバー(orchestrator-message / timer-loop)は常にちょうど1つ。新旧の重複稼働は GitHub 状態を奪い合うので厳禁。

---

## Phase 1: 集約 host の初期化と domain 登録

### 1-1. host リポジトリだけを checkout する

```bash
git clone https://github.com/<HOST> "$HOST_ROOT" && cd "$HOST_ROOT"
```

実装リポジトリはこの checkout に混ぜない(公式の別ホスト×既存パターンの作法)。

### 1-2. design スレッドを起ち上げ、最初のプロンプトを貼る

host の checkout を cwd とする AI エージェント(Claude / Codex / Copilot 等)の会話に、次を貼る(同居マシン想定の `herdr-only` 版):

> 既存の対象実装リポジトリ群 ShuttlePub/ShuttlePub, ShuttlePub/Emumet, ShuttlePub/RatCap に intent-cli を追加します。空の分離した intent 用ホストリポジトリだけを開いています。まずインストール済みのガイドで intent-cli を理解し、ホストを初期化して同居する単一マシンのチーム用に `herdr-only` を記録してください。

(対象リポジトリ群はその時点の追加予定に合わせて書き換える。分散チーム / 既存 agmsg 投資がある場合は末尾を「`agmsg` を記録してください」に変える)

エージェントは `guide onboarding` → `intent init` dry-run → `--write` 適用 → `session-layer set` まで進める。

### 1-3. domain ごとに初期化する

各 domain について design スレッドのエージェントが実行する(直接実行も可):

```bash
D=<domain>            # 追加対象(例: shuttlepub)
R=ShuttlePub/<repo>   # 対応する実装リポジトリ

intent-cli intent init      --domain "$D" --target-repo "$R" --write
intent-cli intent init-tree --domain "$D" --target-repo "$R" --write
intent-cli intent host-check --domain "$D" --format json   # "ok" を期待
```

- `partially-initialized` が返ったら表示されたガイダンス(または `intent-cli automation summary`)に従う
- 全 domain で `ok` になったら commit & push
- 初回 `intent init --write` は `.gitattributes`(JSONL union merge)と `.gitignore`(supervision telemetry 除外)の推奨行も追記する。既存 host への再実行時は guidance 表示のみで、ファイルは手で直さず `intent-cli` の指示に従う

### 1-4. 動作確認

```bash
intent-cli intent next-slice --domain "$D" --dry-run --format json
```

新規 domain では `design-needed` ガイダンスが返るのが正常。`missing-domain-bindings` のハードブロックが出る場合は 1-3 の抜け漏れ。

---

## Phase 2: 既存 intent tree の引っ越し

Phase 0 で特定した旧所在地から、**`intents/<domain>/` ディレクトリだけ**を集約 host にコピーする。

```bash
# 例: 旧メタデータブランチから持ってくる場合
git -C /tmp/old-emumet fetch origin main-metadata
cp -r /tmp/old-emumet/intents/emumet "$HOST_ROOT/intents/emumet"
```

ルール:

- **コピーするもの:** `intents/<domain>/` 配下すべて(intent tree = 知識の蓄積)
- **コピーしないもの:** `.intent-cli/`(queue-state.json, runs.jsonl 等)。host 状態は新 host で `intent-cli` が再構築する。旧 queue-state の持ち込み・マージは禁止
- `intents/<domain>/manifest.yaml` の `target_repo:` が新しい対象と一致しているか確認。変更不要なはずだが、**マニフェストを書き換える場合は事前にオペレーターへ変更内容を提示する**(tree-v1 の公式ルール)
- 旧セットアップがフラットファイル形式でも、そのまま持っていってよい(tree-v1 への移行は強制ではない)
- **tree 引っ越しと同じウェイクで GitHub issue を publish しない**(公式ルール)
- コピー後に commit & push

---

## Phase 3: 新 host での状態再構築

domain ごとに design スレッドで確認する:

```bash
intent-cli intent status
intent-cli intent next-slice --domain "$D" --dry-run --format json
intent-cli next --domain "$D" --target-repo ShuttlePub/<repo> --format markdown
```

- packet backlog を再構成する必要があれば `intent-cli stack --domain "$D" --target-repo <repo>` のガイダンスに従う(デフォルトで最初の1件だけ issue publish)
- Phase 0-2 で記録した飛行中 issue/PR との整合は `intent-cli automation doctor --format json` で診断し、表示される復旧コマンド(`automation reconcile` / `automation publish-recovery` 等)に従う。**label を `gh` で手動付与して状態を誤魔化さない**

---

## Phase 4: 旧セットアップの退役

新 host で `host-check` が全 domain `ok` かつ intent tree の引っ越しを目視確認してから実施する。

- [ ] 旧メタデータブランチ(main-metadata 等)の削除、または旧個別 host リポジトリのアーカイブ
- [ ] 旧ローカル checkout の削除(誤って旧 host から automation を回さないため)
- [ ] 旧 supervision / タイマーループの登録解除を再確認(Phase 0-3)
- [ ] 実装リポジトリに `.intent-cli/` が残っていれば除去(実装 repo は host メタデータを持たないのが正しい姿)

---

## Phase 5: オーケストレーションの起動

集約 host で4スレッドモデル(design / orchestrator / implementation / review)を起動する。

### 方針選択(domain/repo ごとにちょうど1つ)

| 方針 | 向いている場面 |
|---|---|
| multi-domain orchestrator 1本 | Emumet↔RatCap、Stellar↔Satellite、本体↔Emumet など依存を跨いだ計画を任せたい。委譲ごとに domain / execution_unit / target_repo / impl_cwd / review_cwd / base_branch_policy / destination_thread の明示ルーティングが必須 |
| domain ごとの single-domain orchestrator | 各サービスを独立に回したい。他 domain の queue 項目はスコープ外(触るとエスカレーション) |
| timer-loop モード | orchestrator スレッドを持たないシンプル運用。orchestrator-message モードとの混在は禁止 |

起動は design スレッドから:

> herdr-only で起動して。

または `intent-cli guide orchestrator-thread --domain <d> --target-repo <owner/repo> --mode multi-domain --format markdown` で生成される現在版のガイダンス・プロンプトに従う(docs のプロンプトを手で写さず、必ずインストール済み CLI から生成する)。

運用ルール抜粋:
- ワークスペースは team ごとに1つ、pane はロールごとに1つ、cwd はロール専用フォルダー(1フォルダー1チーム。共有すると agent identity が衝突する)
- implementation ロールは対象実装 repo の checkout から、orchestrator / review ロールは host の checkout から動かす
- 子実装エージェントは GitHub-contract-only: `intents/**` や `.intent-cli/` を読み書きさせない
- このマシンで他プロジェクトも動かす場合は cross-project isolation(kill 前に pid ごとの cwd 確認等)に従う

---

## 安全境界チェックリスト(作業中ずっと有効)

- [ ] `.intent-cli/queue-state.json` や JSONL を手編集していない(遷移は `intent-cli automation` / `intent-cli worker` 経由)
- [ ] ワークフロー label(`intent-target` / `intent-pr-*`)を手動や `gh` で付けていない
- [ ] 同一 domain/repo で orchestrator-message と timer-loop を同時稼働させていない
- [ ] intent tree 引っ越しと同じウェイクで issue を publish していない
- [ ] マニフェスト変更前にオペレーターへ提示した

---

## 参考(upstream 公式ドキュメント)

- [プロジェクト開始 / トポロジー選択](https://github.com/J-Tech-Japan/intent-system/blob/main/docs/ja/02-project-start.md)
- [別ホスト × 既存プロジェクト](https://github.com/J-Tech-Japan/intent-system/blob/main/docs/ja/02c-separate-host-existing.md)
- [Intent ナレッジツリーレイアウト (tree-v1)](https://github.com/J-Tech-Japan/intent-system/blob/main/docs/ja/03a-intent-tree-layout.md)
- [agent メッセージオーケストレーション(single/multi-domain)](https://github.com/J-Tech-Japan/intent-system/blob/main/docs/ja/12-agent-message-orchestration.md)
- [コマンドリファレンス](https://github.com/J-Tech-Japan/intent-system/blob/main/docs/ja/08-command-reference.md)
