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

## 5. 次回以降の改善アクション

- [ ] Emumet flake.lock の intent-system-flake 更新 PR (stale 0.5.0 解消) — 別スライス候補
- [ ] Emumet `.envrc` の `use dotenv` → `dotenv` 修正 PR — 同上
- [ ] upstream に ShuttlePub リポジトリの `guide oneshot` 対応を要望するか検討
- [ ] 子ループの起動手順 (clone 場所、credential helper、バイナリパス) を
      member prompt テンプレートとして定型化する
- [ ] backlog 複数件運用時の WIP cap と team 使い捨て/存続の方針を決める
