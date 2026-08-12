# intent-cli × OpenCode ループ統合ノート

> 目的: OpenCode (oh-my-openagent) 環境で intent-cli の実装ループを回すための実運用知見を記録する。
> 由来: 2026-08-12 の emumet `unfollow-api` 実験 (issue ShuttlePub/Emumet#20 → PR #21) で得た実測。
> 原則は変わらず `intent-cli` がワークフロー権威。ここには OpenCode 側の配線知見だけを置き、
> ワークフロー手順そのものはコピーしない。

---

## 1. 環境制約と対処 (このマシン固有)

| 制約 | 対処 |
|---|---|
| `~/Documents` が ro bind mount (rw は host repo のみ) | 子実装 worktree は `~/worktrees/<repo>` に clone する |
| gh の git protocol が ssh + nix 環境の ssh_config 破損で git over ssh 不可、`~/.config/gh` も ro | clone は https、認証は repo-local credential helper: `git config credential.helper '!f() { echo username=x-access-token; echo password=$(gh auth token); }; f'` |
| 子リポジトリの `.envrc` の `use dotenv` がこの環境の direnv stdlib に無い | 非致命だが .env が載らない。恒久対応は `.envrc` を `dotenv` 表記に直す PR |
| Emumet flake pin の intent-cli が 0.5.0 で stale (worker 系コマンド不足) | host 側 flake の 0.18.1 nix store バイナリを子でも直接使う。恒久対応は Emumet flake.lock の intent-system-flake 更新 PR (別スライス候補) |

## 2. intent-cli 側の適合メモ

- `intent-cli guide oneshot --kind child-implement-or-update --repo ShuttlePub/...` は
  upstream (J-Tech-Japan) 専用で ShuttlePub リポジトリを受け付けない。
  → ループ本体は `intent-cli guide start` の汎用テンプレート + `worker next-action --github-only`
  で代替できる。実害はなかったが、ShuttlePub 対応を upstream に要望する価値はある。
- `worker next-action` / `claim` / `result-summary` / `complete` / `automation pr-transition`
  は全て ShuttlePub/Emumet で問題なく動作した (0.18.1)。
- publish 系は queue-seed ゲート (G363) がある: `issue publish-flow --write` 前に
  `automation queue-seed-from-packet` が必要。エラーメッセージが次のコマンドを教えてくれるので従う。
- packet.yaml の title は github-body.md の H1 が最終ソース (`title_source: github-body-h1`)。
  H1 が無いと `fallback-untitled` 警告になる。また packet.yaml は `execution_unit` トップレベル
  キーと `implementation_issue` セクションが別途必須 (scaffold 出力だけでは不足するので注意)。

## 3. team-mode マッピング (実験構成)

- **lead = design/host 役** (ホストリポジトリ cwd のセッション)。review も lead が兼任した。
- **implementation member** (deep カテゴリ): 子 clone を cwd とし、prompt に
  GitHub-contract-only (host metadata 不触)・worker 経由のラベル遷移・使用バイナリの
  絶対パス・gitmoji 規約・スコープ境界を明記。
- **goal コマンド**でスレッドゴールを固定し、lead 側は todowrite で監督進捗を管理。
- 4スレッドモデル (design/orchestrator/implementation/review) のうち orchestrator は
  今回は lead が吸収。backlog が増えてきたら orchestrator member を分離する。

### team-mode 運用で観測した問題と対策

1. **400 tool-call 上限で member が自動キャンセルされた** (実装完了直後、push 前)。
   対策: 作業は session_id (`task(task_id=...)`) で再開できた。member prompt に
   「検証ループは最小化し、マイルストーンごとに中間報告する」を明記するとよい。
   大きなスライスは「実装」「検証+PR作成」の2タスクに分割するのも有効そう。
2. **task() 再開セッションでは team_* ツールが見えず**、member が自分の team task を
   completed に更新できなかった。lead も cross-owner 更新は不可。
   → チーム解体時に task が in_progress 残りになるのを許容するか、
   member への再開指示に「team task 更新が無理なら本文で報告」を含める。
3. **member が最後に errored 状態になった**。成果物 (PR) は確定済みだったので
   `team_delete(force=true)` で解体。チームはスライス単位で使い捨てる運用が無難。

## 4. レビューループの実測

- 初回レビューで packet 契約との差分 (ローカル相手 unfollow 未対応) を1件検出し、
  PR コメント + `pr-transition request-update` で差し戻し → member が修正して
  `rereview-ready` → 再レビューで `approved` まで一連のラベル遷移が成立した。
- **ローカルで動かせなかった mock E2E は CI のハーネスで実行・通過した**。
  ローカル E2E 不可は PR 本文に明記すればブロッカーではなく、CI を証跡にできる。
- レビュー観点は `intent-cli guide review --pr <n> --domain emumet` のチェックリスト
  出力がそのまま使えた。テスト green は必要条件で、packet 照合が承認根拠。

## 5. 次のスライスでのチーム構成 (2026-08-12 オペレーター助言を反映)

実験後の助言を受けた改訂方針。`deep` 1本への丸投げは安直だった — 400 tool-call キャンセルは
「調査→実装→環境迂回→検証→PR」を1コンテキストに抱えたことが直接原因。

- **実装はネストオーケストレーション**: implementation member は `deep` ではなく
  委譲可能なオーケストレータ (subagent_type `sisyphus` または `atlas`) とし、
  issue 契約を「アプリケーション層」「REST/OpenAPI 配線」「テスト/E2E」等に分解して
  ワーカーへ fan-out する。ワーカーはコンテキストが小さく保たれ上限死を回避できる。
  - 制約: intent-cli の workflow 面 (worker claim/complete、ラベル遷移) を触るのは
    オーケストレータのみ (G444「1 wake 1 ドライバー」)。ワーカーは GitHub-contract-only の
    コード作業に限定する。
  - 未検証: team member 内からの再委譲 (delegate-task は budget zero と明記されていた)。
    task() が使えるかは次スライスで検証する。Sisyphus-Junior は no delegation なので
    オーケストレータ役には使わない。
  - 使い分け: 小さいスライス (数ファイル) では調整コストが見合わないので単一 worker のまま。
    block-mute-federation 級 (30ファイル) からネストを適用する。
- **レビューは2層**: 契約適合レビュー (intent-cli guide review 照合 + ラベル遷移) は
  lead が担う (host metadata 権限が必要)。コード品質レビューは `code-reviewer` agent を
  read-only で独立起動し、issue 契約と OOS 境界を prompt に与えて品質・セキュリティ・
  保守性を審査させる。実装者と別セッションなので独立性も保てる。
  (`review-gate:*` 系 plugin agent は要件/設計ゲート用で PR レビュー用途ではない。)
- **外部 API 互換性の観点をレビューに追加**: REST エンドポイント追加系スライスでは、
  Mastodon API 等の de-facto 標準とのパス/セマンティクス競合をレビュー観点に含める
  (今回の PR #21 で指摘を受けた。詳細は intents/emumet/clarifications/open.md C4)。

## 6. 次回以降の改善アクション

- [ ] Emumet flake.lock の intent-system-flake 更新 PR (stale 0.5.0 解消) — 別スライス候補
- [ ] Emumet `.envrc` の `use dotenv` → `dotenv` 修正 PR — 同上
- [ ] upstream に ShuttlePub リポジトリの `guide oneshot` 対応を要望するか検討
- [ ] 子ループの起動手順 (clone 場所、credential helper、バイナリパス) を
      member prompt テンプレートとして定型化する
- [ ] backlog 複数件運用時の WIP cap と team 使い捨て/存続の方針を決める
- [ ] block-mute-federation でネストオーケストレーション構成を検証し、
      team member からの再委譲可否を確認して本ノートに結果を追記する
