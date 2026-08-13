# intent-cli × OpenCode ループ統合ノート

> 目的: OpenCode (oh-my-openagent) 環境で intent-cli の実装ループを回すための実運用知見を記録する。
> 由来: 2026-08-12 の emumet `unfollow-api` 実験 (issue ShuttlePub/Emumet#20 → PR #21) と
> 2026-08-13 の emumet `block-mute-federation` (issue #22 → PR #23) で得た実測。
> 原則は変わらず `intent-cli` がワークフロー権威。ここには OpenCode 側の配線知見だけを置き、
> ワークフロー手順そのものはコピーしない。

---

## 0. 確定した「型」 (2026-08-13、2スライス実測で固定)

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
   使い捨て team (lead + implementation member) または ULW 直接実装 (§5 実験)。
   member/worker prompt には作業場所・バイナリパス・gitmoji・スコープ境界・
   マイルストーン報告・検証ループ最小化を明記
8. 2層レビュー — lead が契約照合 (`intent-cli guide review` チェックリスト) とラベル遷移、
   独立 `code-reviewer` agent が品質・セキュリティ・保守性 + 外部 API 互換性を審査
9. closeout — merge → `closeout pr` → 知識書き戻し (declared なら同 wake で実施・記録)
10. ノート更新 — 実測の差分を本ノートへ。team は `team_delete` で解体

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
4. **team member からの再委譲は不可** (2026-08-13 検証完了): member セッションには
   `task()` / delegate-task が公開されず (budget ゼロ)、`call_omo_agent` の
   explore/librarian 系のみ。§5 の「ネストオーケストレーション」構想は現構成では
   成立しないため、implementation member はスライスを直接実装する。
   block-mute-federation 級 (9ファイル +838行) はマイルストーン報告 + 検証最小化で
   上限死せず完走できた。それより大きいスライスは lead 側で分割 publish する。
5. **member の idle 表示と wake**: `team_status` の idle は未読状態の話で、セッションは
   生きていることがある。`task(task_id=...)` の nudge が "gate: active" で skip されたら
   稼働中なので二重起動しない。未読メッセージは順不同で注入されるため、
   タイムスタンプを見て古いバックログに反応しない。

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

## 5. チーム構成の結論 (2026-08-13 に検証完了)

実験後の助言を受けた改訂方針だった「ネストオーケストレーション」は、
**team member からの再委譲 (task()) が現構成では不可**と検証されたため撤回。
以下が確定構成:

- **implementation member は直接実装する単一ワーカー** (subagent_type `sisyphus`)。
  `deep` 丸投げの反省 (400 tool-call 上限死) には、member prompt への
  「マイルストーンごとに中間報告」「検証ループ最小化」の明記で対抗する。
  block-mute-federation (9ファイル +838行、E2E 含む) はこの構成で上限死せず完走。
  それより大きいスライスは packet を分割して publish する (設計側の責務)。
- **lead = design/host 役** (ホストリポジトリ cwd のセッション)。review も lead が兼任し、
  品質レビューは独立 `code-reviewer` agent を read-only で別起動する 2層構成 (§0-8)。
  実装者と別セッションなので独立性も保てる。`review-gate:*` 系 plugin agent は
  要件/設計ゲート用で PR レビュー用途ではない。
- **外部 API 互換性の観点をレビューに追加**: REST エンドポイント追加系では Mastodon API
  等の de-facto 標準との競合を、ActivityPub 連合系では Block/Undo の shape が
  主流実装 (Akkoma/GoToSocial/Iceshrimp) と整合するかを審査させる。
  (Mastodon は Block を連合しないため、Mastodon inbox への Block は黙棄される想定。
  実 Mastodon での確認は別スライスの余地あり)

### 次スライス (moderation-role-assignment) の実験: lead セッション ULW 直接実装 (2026-08-13 オペレーター承認)

team-mode の調整コスト (member wake/idle 管理、stale メッセージの順不同注入、
契約の全文メッセージ化、shutdown 握手の停滞 → force delete) を受け、次スライスは
**lead セッションで ultrawork-mode を有効化して直接実装**する構成を試す:

- 実装は task() による wave 分割 fan-out。lead からは task() が使えるため、
  team member の再委譲制約 (§3-4) は適用されない
- レビューは ULW Reviewer Gate 手順 (criterion-cited blockers + 差分再レビュー ≤2 回)。
  reviewer は ultrabrain 級、または同手順を prompt に与えた code-reviewer。
  レビュー独立性 (実装者と別セッション) は team-mode と同じく確保できる
- シナリオ契約 (観測可能なリアルサーフェスの事前名指し) により、今回 CI に漏れた
  「GET /blocks では remote→local 行を観測できない」型の欠陥を設計時に検出できるはず
- 比較軸: 調整コスト (上記 team 運用コスト vs task() セッション再開管理)、
  上限死リスク、レビュー品質。結果を本ノートに記録してデフォルトを決める
- **ultrawork-mode は agent が self-activate できない** (ユーザーの "ulw" / "ultrawork"
  指定でハーネスが注入)。指定がない場合は §0 の型に従い ULW 規律を self-impose する

**更新 (2026-08-13)**: ADR 0006 の8ユニットが backlog 先頭に挿入され、次スライスは
`architecture-foundation` (issue #24) になった。実験構成も §6 の検証結果を受けて
「lead セッション ULW 直接実装」から **task() ベースの sisyphus 委譲**に変更する。
harness ネイティブの完了通知 (system-reminder) が外部観測より信頼できるため。
比較軸とレビュー手順 (2層レビュー、シナリオ契約) は上記の通り維持する。

## 6. herdr 観測の検証と interim observability (2026-08-13)

### 背景

- emumet の session-layer は `herdr-only` と記録済み (2026-08-11 に agmsg から遷移、
  `.intent-cli/session-layer-mode.json`)。ただしこのマシンに herdr は未インストールで、
  現行 transport は omo ネイティブ (team-mode / task()) のまま運用してきた
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
      sisyphus 委譲に変更 (§5 更新・§6 参照)
- [x] ~~子ループの起動手順の定型化~~ → §0 の「型」として確定 (2026-08-13)
- [x] ~~backlog 複数件運用時の WIP cap~~ → 現状は先頭 1 件運用で問題なし。複数並走が
      必要になった時点で再検討
- [x] ~~block-mute-federation でネストオーケストレーション検証~~ → 検証完了。
      team member からの task() 再委譲は不可 (§3-4, §5)。単一ワーカー直接実装に確定
