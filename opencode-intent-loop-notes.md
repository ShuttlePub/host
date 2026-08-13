# intent-cli × OpenCode ループ統合ノート

> 目的: OpenCode (oh-my-openagent) 環境で intent-cli の実装ループを回すための実運用知見を記録する。
> 由来: 2026-08-12 unfollow-api (#20 → PR #21)、2026-08-13 block-mute-federation
> (#22 → PR #23)、2026-08-13 architecture-foundation (#24 → PR #25)、
> 2026-08-13 account-aggregate-repository (#26 → PR #27) の実測。
> 原則は変わらず `intent-cli` がワークフロー権威。ここには OpenCode 側の配線知見だけを置き、
> ワークフロー手順そのものはコピーしない。

---

## 現在のデフォルト構成 (2026-08-13 確定)

**実装委譲は `task()` ベース。team-mode / herdr は使わない。**

- 実装: `task(category="deep" 等, run_in_background=true)` で実装ワーカーを起動し、
  harness ネイティブの完了通知 (system-reminder) を wake 源とする
- 大きいスライス (rename sweep 級、ワーカーの 400 tool-call 予算を超える見込み) は
  packet 起こし時点で (a) マイルストーン分割 publish、(b) lead セッション ULW 直接実装
  (lead からは task() fan-out が使える)、のどちらかに振り分ける (§5 実測)
- 上限死後の復帰: **同一セッション継続 (task_id 再開) は使わない** (肥大コンテキストで
  空転する実績あり)。新セッションに lead 実測の state (git log/status の具体値) を
  渡すか、残作業が小さければ lead が直接仕上げる
- レビュー: lead の契約照合 + `code-reviewer` (網羅品質) + `oracle` (設計意図) の層構成。
  **code-reviewer はルーティング不具合で background stall するため、現在は
  `category="deep"` の read-only レビューで代替する** (§5 PR #27 実測)
- team-mode: 調整コストと member 再委譲不可の検証により廃止 (§3)
- herdr: 子セッション busy を観測できないため wake 源には使わない (§6)

### agent 名の正確な対応 (勘違い防止)

| 役割 | 呼び出し | 実体 |
|---|---|---|
| lead (このセッション) | — | Sisyphus (オーケストレーション lead。task() / team_* が使える) |
| 実装ワーカー | `task(category="deep"` / `"quick"` / ...`)` | **Sisyphus-Junior** (category 毎に最適化モデル。再委譲不可・400 tool-call 上限) |
| コードベース探索 | `task(subagent_type="explore")` | explore agent |
| 外部調査 (docs/OSS/web) | `task(subagent_type="librarian")` | librarian agent |
| 網羅的品質レビュー | `task(subagent_type="code-reviewer")` | code-reviewer (read-only 運用) |
| 設計/アーキテクチャ審査 | `task(subagent_type="oracle")` | oracle (read-only・高コスト) |
| 実装前の計画 | `task(subagent_type="plan")` | plan agent |
| 計画の事前分析 / 批評 | `task(subagent_type="metis"` / `"momus")` | Metis / Momus (計画ゲート) |

注意:

- **`sisyphus` という subagent_type は `task()` には存在しない**。`task(category=...)`
  で spawn されるのは常に Sisyphus-Junior。team_create の eligible 例に sisyphus が
  残っているが team-mode は使わない (§3)
- category 一覧: `deep` / `quick` / `ultrabrain` / `visual-engineering` / `writing` /
  `artistry` / `unspecified-low` / `unspecified-high`
- `review-gate:*` 系 plugin agent は要件/設計ゲート用で、PR レビュー用途ではない
- ワーカー (Sisyphus-Junior / team member) からの再委譲 (task() ネスト) は不可
  (subagent には task() の budget が公開されない)

---

## 0. 確定した「型」 (2026-08-13、3スライス実測で固定)

スライスのライフサイクルは以下のターン構造で回す:

**wake 時ルーチン (セッション冒頭)**: `intent-cli automation stalled-work --domain emumet
--repo ShuttlePub/Emumet` を実行し claimed-silent / writeback 滞留を検知する
(§6 interim プロトコル層3。2026-08-13 の wake から実施)。

1. `next` — 証拠確認(queue / backlog / PR / doctor)のうえで 1 プロセスを推薦
2. `grill` / clarification — ブロッカーがあれば先に解消
3. `stack` — packet draft。**この時点で packet.yaml から scaffold 由来のルートレベル
   コメントを除去する** (§2 参照)。github-body.md の H1 が issue タイトルになる
4. publish — queue-seed → publish-flow → automation issue-publish
5. claim — worker claim で intent-issue-in-progress
6. **実装前計画レビュー (本ノートで新設)**: claim 後・実装着手前に packet ↔ 実コードを
   再照合し、矛盾・追加の意思決定事項・実装分解を確定する。publish 前ではなくここに置く
   (draft 時点の記憶ではなく最新コードで照合できる)。今回 3 件の微差をこのターンで検出
7. 実装 — **開始時に lead はユーザーへ ultrawork-mode の有効化を促す**
   (ユーザーがメッセージで "ulw" / "ultrawork" と指定するだけでよい。agent は
   self-activate できないため、この促しを型の一手順として省略しない)。
   委譲形は冒頭のデフォルト構成を参照。worker prompt には作業場所・バイナリパス・
   gitmoji・スコープ境界・マイルストーン報告・検証ループ最小化を明記。
   上限死後の復帰ルールも冒頭のデフォルト構成通り
8. 2層レビュー — lead が契約照合 (`intent-cli guide review` チェックリスト) とラベル遷移、
   独立 `code-reviewer` agent が品質・セキュリティ・保守性 + 外部 API 互換性を審査。
   アーキテクチャ/設計意図が絡む変更 (port 導入・migration 設計等) ではさらに
   `oracle` を高リガー層として起動する (§5 architecture-foundation 実測)。
   **レビュー指摘は writeback/closeout 前に全件 disposition 表 (fixed / recorded /
   declined + 理由) を作る** (指摘の記録漏れ防止)。過去コミットのテスト検証は
   **fresh DB** で行う (dev DB は HEAD の migration 適用済みで汚染され、旧コミットの
   テストが偽の失敗を起こす)
9. closeout — merge → `closeout pr` → 知識書き戻し (declared なら同 wake で実施・記録)。
   **コミット分離が受入条件のスライスは squash ではなく merge commit で履歴を保存する**
   (ADR 0006 §10 型の rename 分離など。Emumet の既定は squash だが意図的に変える)
10. ノート更新 — 実測の差分を本ノートへ

---

## 1. 環境制約と対処 (このマシン固有)

| 制約 | 対処 |
|---|---|
| ~~`~/Documents` が ro bind mount~~ → 2026-08-13 に operator が sandbox 設定を変更し、Emumet 本体が writable に | **本物のチェックアウトで直接作業する** (worktree 不要)。以降のスライスもこの前提。sandbox 仕様は「cwd + ホームルート + /tmp が writable」で、`/var/tmp` は sandbox 内に存在しない。ホーム (`~`) はホスト側 `/var/tmp/opencodebox-*` の bind mount (ext4) で、永続性はセッション構成次第 |
| gh の git protocol が ssh + nix 環境の ssh_config 破損で git over ssh 不可、`~/.config/gh` も ro | clone は https、認証は repo-local credential helper: `git config credential.helper '!f() { echo username=x-access-token; echo password=$(gh auth token); }; f'` |
| 子リポジトリの `.envrc` の `use dotenv` がこの環境の direnv stdlibに無い | 非致命だが .env が載らない。恒久対応は `.envrc` を `dotenv` 表記に直す PR |
| Emumet flake pin の intent-cli が 0.5.0 で stale (worker 系コマンド不足) | host 側 flake の 0.18.1 nix store バイナリを子でも直接使う。恒久対応は Emumet flake.lock の intent-system-flake 更新 PR (別スライス候補) |
| **rootless docker の inotify quota 枯渇でローカル E2E 不可** (2026-08-13 実測。keto が fsnotify ENOSPC で起動不能) | ローカルで `e2e/run-ap-e2e.sh` を**実行しない**。E2E は CI をエビデンスにする (PR body に明記)。なお同スクリプトの cleanup (`compose down -v`) は稼働中の dev postgres container + volume を消す — 実行自体を避けること |

## 2. intent-cli 側の適合メモ

- `intent-cli guide oneshot --kind child-implement-or-update --repo ShuttlePub/...` は
  upstream (J-Tech-Japan) 専用で ShuttlePub リポジトリを受け付けない。
  → ループ本体は `intent-cli guide start` の汎用テンプレート + `worker next-action --github-only`
  で代替できる。実害はなかったが、ShuttlePub 対応を upstream に要望する価値はある。
- `worker next-action` / `claim` / `result-summary` / `complete` / `automation pr-transition`
  は全て ShuttlePub/Emumet で問題なく動作した (0.18.1)。
  `result-summary` の `--kind` は loop kind (`issue-to-pr`)、`--outcome` は enum
  (完了時は `pr-created`) で自由文は取らない。`complete` は issue に対して
  `--outcome pr-created --pr <n> --write` でラベル遷移 (add intent-pr-created /
  remove intent-issue-in-progress) まで行う
- publish 系は queue-seed ゲート (G363) がある: `issue publish-flow --write` 前に
  `automation queue-seed-from-packet` が必要。エラーメッセージが次のコマンドを教えてくれるので従う。
- packet.yaml の title は github-body.md の H1 が最終ソース (`title_source: github-body-h1`)。
  H1 が無いと `fallback-untitled` 警告になる。また packet.yaml は `execution_unit` トップレベル
  キーと `implementation_issue` セクションが別途必須 (scaffold 出力だけでは不足するので注意)。
- **packet.yaml のルートレベルコメントは projection パーサが不正フィールドとして弾く**
  (2026-08-13 実測: `issue draft` が "invalid root field" で失敗)。`packet draft` の scaffold が
  挿入する G461/G645 の説明コメントは、publish 前に除去すること。公開済み packet
  (unfollow-api) はコメント無し。**media-upload の packet.yaml には残っているので、
  その publish 時に同じ対応が必要**
- CI の giraffate/clippy-action が reviewdog install で `socket hang up` する infra flake あり
  (2026-08-13)。`gh run rerun <id> --failed` で回復する。差分に無関係な crate の fail は
  まず infra を疑う

## 3. team-mode 検証の結論 (2026-08-13 に廃止)

team-mode (使い捨て team: lead + implementation member) は2スライスで検証のうえ廃止。
運用詳細 (member wake/idle 管理、shutdown 握手等) は現行構成と無関係なため残さない。
引き継ぐ知見のみ:

- **member からの再委譲 (task() ネスト) は不可**: member セッションには task() が
  公開されず (budget ゼロ)、explore/librarian 系のみ。ネストオーケストレーション
  構想は現構成では成立しない
- **廃止理由**: 調整コスト (member wake/idle 管理、stale メッセージの順不同注入、
  契約の全文メッセージ化、shutdown 握手の停滞 → force delete) が見合わない
- worker prompt の定型 (子 clone を cwd、GitHub-contract-only、worker 経由のラベル
  遷移、バイナリ絶対パス、gitmoji、スコープ境界、マイルストーン毎の中間報告、
  検証ループ最小化) は team-mode 時代に確立。task() 委譲でも同じ定型が有効
- team-mode 時代の実績: block-mute-federation (9ファイル +838行、E2E 含む) は
  上記 prompt 規約で上限死せず完走

## 4. レビューループの実測

- 初回レビューで packet 契約との差分 (ローカル相手 unfollow 未対応) を1件検出し、
  PR コメント + `pr-transition request-update` で差し戻し → member が修正して
  `rereview-ready` → 再レビューで `approved` まで一連のラベル遷移が成立した。
  **2026-08-13 の block-mute-federation でも同じ往復が成立** (2 データ点目。
  E2E テスト欠陥 → request-update → テストのみ修正 → approved)。
- **ローカルで動かせなかった mock E2E は CI のハーネスで実行・通過した**。
  ローカル E2E 不可は PR 本文に明記すればブロッカーではなく、CI を証跡にできる。
- レビュー観点は `intent-cli guide review --pr <n> --domain emumet` のチェックリスト
  出力がそのまま使えた。テスト green は必要条件で、packet 照合が承認根拠。
- **E2E アサーションの観測可能性は独立したレビュー観点にする** (2026-08-13 の教訓):
  GET /blocks のような「source=自分」の一覧 API では remote→local の状態遷移を
  観測できず、テストが「見えないもの」を assert して CI で落ちた。静的レビュー
  (lead + code-reviewer) は両方とも通したが CI が捕捉した。inbound 連合の E2E は
  DB レベルの assert helper を使う。
- CI が落ちたら先に「どの観測が失敗したか」を特定してから request-update を書く。
  実装バグとテストの検証方法バグで修正スコープがまったく変わる。

## 5. 委譲構成の検証履歴と実測

確定事項:

- **実装は直接実装する単一ワーカーに委譲** (再委譲不可のため。§3)。
  `deep` 丸投げの反省 (400 tool-call 上限死) には、worker prompt への
  「マイルストーンごとに中間報告」「検証ループ最小化」の明記で対抗する。
  それより大きいスライスは packet を分割して publish する (設計側の責務)
- **lead = design/host 役** (ホストリポジトリ cwd のセッション)。review も lead が兼任し、
  品質レビューは独立 `code-reviewer` agent を read-only で別起動する 2層構成 (§0-8)。
  実装者と別セッションなので独立性も保てる
- **外部 API 互換性の観点をレビューに追加**: REST エンドポイント追加系では Mastodon API
  等の de-facto 標準との競合を、ActivityPub 連合系では Block/Undo の shape が
  主流実装 (Akkoma/GoToSocial/Iceshrimp) と整合するかを審査させる。
  (Mastodon は Block を連合しないため、Mastodon inbox への Block は黙棄される想定。
  実 Mastodon での確認は別スライスの余地あり)
- 検討履歴 (圧縮): 「lead セッション ULW 直接実装」の実験構想は
  moderation-role-assignment 用に立てられたが、ADR 0006 割り込みで
  architecture-foundation が先になり task() 委譲で実施。結果を受けて冒頭の
  デフォルト構成に確定した。ULW 直接実装は大きいスライス向けの選択肢として残る

### account-aggregate-repository (#26 → PR #27) の実測 (2026-08-13)

**user 定義 agent の background stall と lead 直接実装への移行**:

- deep ワーカーは起動 ~6分で M1 (rename commit) + claim まで正常に到達したが、
  operator 判断で「オーケストレーション可能な agent」への載せ替えを試行
- **`subagent_type="general"` と `code-reviewer` は background task で起動直後から
  無応答 stall する** (general は 6 分無出力・プロセス無し、code-reviewer は 48 分
  無出力)。原因は **agent ルーティング設定ミスによるレートリミット** (operator 特定)。
  category 経由 (Sisyphus-Junior) と oracle は正常動作する
- **解決: lead セッション ULW 直接実装 (選択肢 b) の初の本格運用**。M2-M5 を lead が
  直接実装して完走 (~2時間、Oracle 設計相談 → 実装 → 2層レビュー → merge)。
  Stage 2 規模 (port 定義 + driver 実装 + 同値テスト4本、+543行) は lead 直接で
  十分に回る。設計判断 (save signature) は実装前に Oracle 相談で確定させる流れが
  有効だった
- **品質レビュー層の代替**: code-reviewer 不在時は `category="deep"` に read-only
  レビュー prompt を渡すと 5 分で完走し、実質的な指摘 (MUST-FIX 1 / SHOULD-FIX 2)
  を返した。2層レビュー構成は「品質 = deep (Junior)、設計意図 = oracle」で代替可能
- **CI Format check がコミット粒度の fmt 欠落を捕捉**: rename commit が fmt 未通過で
  後続の fmt コミットに rename 行の再整形が混入し、Oracle レビューで Decision 10
  違反 (MUST-FIX) になった。対応は履歴組み直し (fmt を rename commit に折り込み、
  最終 tree が検証済み tree と同一であることを `git diff --quiet` で証明して
  force-with-lease)。**教訓: 各コミット作成時に `cargo fmt --check` を回す**
- 環境: cargo 系コマンドは `nix develop --command` 経由が必須 (pkg-config/openssl が
  bare shell に無い)。DB テストは `.env` の DATABASE_URL を明示渡し

### architecture-foundation (#24 → PR #25) の実測 (2026-08-13)

task() ベース委譲 (category=deep、Sisyphus-Junior) の初実施で以下を観測:

- **大規模 rename (144箇所/47ファイル) を含むスライスは Junior 単独の 400 tool-call
  予算を超えうる**。1回目は 18m で5コミット (rename→characterization→no-op除去→
  TxManager→seq列) 完了も finalize (検証/PR作成) 前に上限死。2回目は同一セッション
  継続 (task_id 再開) を試みたが、肥大コンテキストで空転し新規コミットゼロで再度上限死。
  **同一セッション継続は上限死後の復帰手段として機能しない**
- 残作業 (テスト切り出し・検証・PR作成・記録) は小さかったため lead が直接仕上げて完走
- **小スコープ委譲は健全に機能**: SHOULD-FIX 修正 (1ファイル) を category=quick に
  委譲したところ 46秒・予算内で完走。委譲粒度が予算内に収まることが成功条件
- 結論の更新: スライスの想定 tool-call 量が Junior 予算を超える場合は、
  (a) packet をマイルストーン単位で分割して publish する (設計側の責務、従来通り)、
  (b) lead セッション ULW 直接実装 (task() fan-out が使える) に載せる、のいずれかを
  packet 起こし時点で判断する。rename 全置換のような機械的大規模変更は (a) の
  分割基準として「rename sweep は独立スライス化」を検討する
- レビュー層の確定: 網羅的品質 = `code-reviewer`、アーキテクチャ/設計意図の審査 =
  `oracle` (ULW Reviewer Gate の高リガー層)。今回 oracle が ADR 決定4 への疑義
  (BIGSERIAL tailing の commit 順序逆転) を検出し、operator 判断で Stage 3 設計入力
  として ADR に記録する流れが機能した

## 6. herdr 観測の検証と interim observability (2026-08-13)

### 背景

- emumet の session-layer は `herdr-only` と記録済み (2026-08-11 に agmsg から遷移、
  `.intent-cli/session-layer-mode.json`)。ただしこのマシンに herdr は未インストールで、
  現行 transport は omo ネイティブ (task()) のまま運用してきた
- intent-system 側の認識: session layer は transport の選択であってモデル (4スレッドと
  権威境界) の変更ではない。herdr 導入は operator が裏で準備中

### 検証結果 (librarian によるソースレベル調査)

- herdr は opencode kind の状態を画面認識ではなく **plugin hook 権威**
  (`full_lifecycle_hook_authority` に `("herdr:opencode", "opencode")`) で取得する。
  ただしその opencode plugin は **子セッションの busy を親 pane に投影しない**
  (herdr 側テストでも確認)
- omo の `task(run_in_background=true)` は senpi 経由の `client.session.create()` で
  **parentID 付きの実 opencode サーバーセッション**を作る。lead セッションは自分の
  ターン終了時に子の稼働を待たず独立に idle 化する
- opencode サーバーは `/session/status` と `/session/children` を公開しており、
  API 的には子孫セッションの集約は可能。herdr がそれをやっていないだけ
- upstream の既知 issue: **herdr #1362** (親 OpenCode pane が子セッション作業中も
  idle のまま — 本件そのもの)、#2548 (childSessions false positive)、
  #2241 (Claude Code pane が run_in_background 実行中に idle を報告)
- omo PR #6613 (herdr multiplexer backend) は team-mode の **pane 可視化のみ**で
  orchestration 観測ではない。2026-08-13 時点で OPEN、状態検出の設計議論なし

### 結論

**現状の herdr は omo background 実行中と真の完了を区別できない。**
したがって実装委譲は task() ベース (harness ネイティブの完了通知) をデフォルトとし、
herdr 観測は (a) upstream #1362 系の解消、(b) opencode の measured launch recipe
(G647) 策定、が揃ってから再評価する。herdr 導入自体は pane 可視化・オペレーター
俯瞰の価値で進めてよいが、orchestration の wake 源には当面使わない。

### interim observability プロトコル

orchestrator-thread ガイドの3層 wake を本構成に写像:

1. **報告層**: `worker result-summary` + `worker complete` を実装セッションの必須
   最終手順とする (§0 の型に既存。transport 非依存の canonical 面)
2. **プロセス観測 wake**: 欠落。operator が wake 源 (実装セッションの終了を見て
   lead に伝える)。lead は canonical state (GitHub PR / ラベル / queue-state) で検証
3. **網**: `intent-cli automation stalled-work --domain emumet --repo ShuttlePub/Emumet`
   を lead の wake 時ルーチンに組み込む (claimed-silent 検知)

成功判定は composite gate (PR 実在・CI green・worker complete 記録・diff 精査) で、
これは §0-8/9 の従来運用と同じ。

### design ∥ implementation の並列化

- 意図の取りまとめと実装は構造的に並列可能。queue preload は正式サポート
  (dry-run で packet を `queued` に積み、issue リンクは後の wake で付ける)
- 直列化しているのは実装 WIP のみ: `wip_cap_guidance` は "Default child WIP cap is
  one in-flight branch per loop"。実装中に design 側で次 packet を draft して
  preload しておく運用が正規の並列形
- ADR 0006 スタックの依存: Stage 2/5/6 は Stage 1 完了で並列解禁、3 は 2 待ち、
  4 は 2+3 待ち。media-upload はスタックと完全独立

## 7. 次回以降の改善アクション

- [ ] code-reviewer / general の agent ルーティング設定の修正 (operator 側。
      レートリミットで background stall。修正までは品質レビュー = category=deep 代替)
- [ ] 大規模 rename sweep を含むスライスの分割基準 (rename を独立スライス/独立タスクに
      切る等) を packet 起こしのガイド/prompt 定型に反映するか検討 (§5 実測由来)
- [ ] Emumet flake.lock の intent-system-flake 更新 PR (stale 0.5.0 解消) — 別スライス候補
- [ ] Emumet `.envrc` の `use dotenv` → `dotenv` 修正 PR — 同上
- [ ] upstream に ShuttlePub リポジトリの `guide oneshot` 対応を要望するか検討
- [ ] herdr upstream 追跡: #1362 (子セッション busy の親 pane 非投影) / #2548 の解消
      状況。解消されても opencode measured launch recipe (G647) 策定までは wake 源にしない (§6)
- [x] ~~lead の wake 時ルーチンに `automation stalled-work` を組み込む~~ →
      2026-08-13 の wake から実施 (§0 冒頭に定型化)。初回実施で unfollow-api の
      knowledge-writeback-pending (declared: intent_tree) を検知
- [x] ~~media-upload publish 前に packet.yaml のルートレベルコメントを除去する~~ →
      2026-08-13 対応済み (architecture-foundation 分も同時に除去、af200b8)。
      あわせて両 packet の github-body.md に H1 タイトルを付与 (§2 の title 規約)
- [x] ~~moderation-role-assignment で lead セッション ULW 直接実装を試す~~ →
      2026-08-13 更新: 次スライスは architecture-foundation、構成は task() ベース
      委譲に変更 (§5 更新・§6 参照)
- [x] ~~子ループの起動手順の定型化~~ → §0 の「型」として確定 (2026-08-13)
- [x] ~~backlog 複数件運用時の WIP cap~~ → 現状は先頭 1 件運用で問題なし。複数並走が
      必要になった時点で再検討
- [x] ~~block-mute-federation でネストオーケストレーション検証~~ → 検証完了。
      team member からの task() 再委譲は不可 (§3)。単一ワーカー直接実装に確定
