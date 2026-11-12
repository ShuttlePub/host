# registration-readiness-gate — acceptance criteria

> See [overview.md](overview.md) for goals and [packets.md](packets.md) for the unit split / dependency graph.
> 各項目は unit の範囲だけを対象とする。D15 全体の受け入れは E15d + E15w + F15 が揃うまで保留。

## 全体（D15 統合受け入れ。2026-11-12 完了）

- [x] 実 Kratos 経路（browser / API の直接 registration、作成済み flow、設定変更後、UI を経由しない入口）で D15 の全状態が守られる (E15d)
- [x] 外部 Webhook が管理画面を開いていなくても障害・復旧・防御低下を届ける (E15w)
- [x] 管理画面で状態・開閉・再開・override・通知一覧/既読が操作でき、override 中の警告が画面遷移で消えない (F15)
- [x] ログイン済み利用者の `POST /api/v1/accounts` と login がゲートの影響を受けない (E15d)

### D15 統合 closeout（2026-11-12）

- F15 最終 PR shuttlepub-frontends #43（Closes #31、head `287ce17b329f34b5191f8ab8d9fd937e1fa59ca1`）は squash merge 済み（`1227ca8abc4fb80a78fb88e9fa1b888be0db7c7c`）。#31 は CLOSED。前段 #33 (`7516562db15952144dd406070ffe3d3f95de02c3`)・#39 (`3c7c7e2b9984db1762b2092ae18f4959751569ed`) も squash merge 済み。独立 Reviewer approve（run `run-01m76dttgrd68w833r0n102zte`、must 0）、CI 2 checks pass。
- D15 全 unit 完了: E15a #67 (`0ac9e9c087f61447c9a2c5e4a4cbf04a1075f2ca`)、E15w #69 (`ae9bdddef26c21b2d70e08a5a8f74ac5e6153d05`)、E15b #79 (`16b9e4301edde8bd4de222ab4d691dc7c32798b8`)、E15c #85 (`d3e157c8e5b1b39c49e1ace6431a6825bb71f0e7`)、E15d #88 (`ef063d67bc28b2a93fb6c09babc73d90216fa176`)・#92 (`95e3f77c7517d3337380df95f74a90eabe6b4ee0`)、bootstrap 修正 #99 (`11414a68ec1bb6872d8af6c09f7e1a312c19922e`)、E15x #100 (`7843ccb0de3a792741c608d54beabf81b8bd9b45`)、F15 #33/#39/#43（上記）。
- 残余リスク: hook 除去時に Emumet 単独では物理的に登録を遮断できない、LB sampling は有限、SMTP の時間差、評価から persist まで非原子的、遅延 persist の再観測は 10 秒有界、Webhook URL は平文保存、鍵ローテーションは範囲外、tracing 非漏洩テストは未実装。
- 未決: (?) ヘルプページの置き場所。

## E15a — registration-gate-control-plane（control plane のみ）

- [ ] メール認証 OR BOT 対策の組合せ（メールのみ／BOT のみ／両方／どちらもなし）で最低条件の判定が成立する
- [ ] 両方用意して片方だけ障害なら、動作中の対策のみを必須として受付を継続し、防御低下を通知イベント化する
- [ ] 両方が一時障害なら一時拒否になり、復旧で手動再開なしに自動再開し、障害と復旧を通知イベント化する
- [ ] 設定喪失（両対策の設定上の無効化）で停止ラッチが成立し、復旧だけでは再開せず、管理者の手動再開のみで解除される。再開時に最低条件未達なら拒否される。手動閉鎖を自動解除しない
- [ ] override は警告確認が必須で、明示解除まで有効で、通常の自動停止・障害時拒否判定を行わず、常時表示できる状態として取得できる。override の状態表が成立する
- [ ] 状態遷移と通知イベントを同一 transaction で保存する。probe の反復で通知が増殖しない
- [ ] 通知の既読状態は管理者間で共有されない
- [ ] revision による競合検出、監査記録、管理者認可が成立する
- [ ] 実 Kratos 遮断・実 provider 検証は含まない（登録ゲートが本番登録を実際に守るのは E15d 以降）
- 検証: 純粋状態機械テスト、`DATABASE_URL` を設定した実 DB テスト（skip のみの成功は不可）、管理者認可、同時更新の競合、通知一覧・既読 API、OpenAPI 再生成

## E15b — registration-kratos-guard-contract（実証と所在決定）

- [ ] Kratos v1.3.1 で browser / API の直接 registration、閉鎖前に作成済みの flow、hook の timeout / 不達、override 相当の実験結果が記録される
- [ ] 拒否時に identity が作成されない証拠（管理 API / DB 観測）がある
- [ ] login と認証済み Account 追加（`POST /api/v1/accounts`）に影響しないことが示される
- [ ] メール所有確認・BOT token 検証・ゲート判定を Kratos ネイティブ／Emumet webhook のどこで担うかが決まり、ADR（`intents/emumet/decisions/registration-protection-placement.md`）に記録される
- [ ] 実効設定の観測方法、設定喪失の検出方法、検証 API 応答の意味、provider と失敗分類、UI を迂回した直接 API 経路の対策が文書化される
- [ ] health 応答や設定ファイルの存在を ready の証拠にしない
- [ ] 隔離 compose・Kratos 実バイナリ・DB/管理 API 観測と、再現 fixture を成果物として残す
- [ ] 本番 Kratos 設定への hook 接続は行わない（E15d 所有）
- draft ゲート: 所在・provider・観測契約を親が確認するまで E15c/E15d を draft しない。成立しない条件が見つかった場合は影響と代案を親へ戻す

### E15b closeout（2026-11-10、unit 範囲のみ）

- Emumet PR #79 は squash merge 済み（`16b9e4301edde8bd4de222ab4d691dc7c32798b8`）、Emumet#64 は close 済み。
- 独立 Reviewer approve（run `run-01m7244qfjdrzbkbcjdhfdqszh`、must 0）、Rust run `42774934783` と e2e run `42774933166` の CI 全12 checks pass。
- [registration-protection-placement.md](../../decisions/registration-protection-placement.md) の決定 A（`question-88b36432ff84f589f1388699c8f40fa3`）に基づく。Kratos v1.3.1 実バイナリの pre-persist 拒否時に identity が作成されないことを実証した。
- E15b の範囲のみ完了。E15c/E15d、F15 の画面実装と D15 全体の統合受け入れは未完了。

### E15c 技術判断・closeout（2026-11-10、unit 範囲のみ）

- 鮮度規定は古い成功を ready の根拠に使わないための規定。既知の失敗は鮮度切れだけでは解除・軽減せず、同じ範囲で失敗段階を覆い、失敗観測時刻より後の成功証拠か generation 変更まで保持する（[ADR「回復の範囲と単調性の原則」](../../decisions/registration-protection-placement.md)、親判断 `question-dae3e9a0d121a99ab797db5bb4c0a922`）。
- SMTP の証拠は検証段階（connect < start_tls < auth < mail_from < rcpt < data）と SMTP 対話時刻で評価する。応答 code の確認だけでは障害を解除しない。probe は MAIL FROM までの成功で接続範囲の障害のみ解除でき、RCPT/DATA の配送範囲の障害は canary の新規送信成功でのみ解除する。
- 非列挙の受け入れ範囲は公開 status/body と readiness 経由まで。SMTP 往復時間の差は残余リスクとして残る（親判断 `question-e5dc7328dab8c93081bf5affe9052d15`）。
- E15d への引き継ぎ: canary 配送再検証の周期実行（自動再開の前提）、business 成功期限切れ時の新 roundtrip（初回 bootstrap の管理者 roundtrip 要求は 2026-11-12 に廃止。下記「Bootstrap revision」）、成功対話開始時刻の下限化、Turnstile `observed_at` の統一、proxy 配下の利用者別送信元制限、時間差抑制、フロントは credentials 付きで Kratos CSRF cookie を届ける必要がある。
- Emumet PR #85 は squash merge 済み（`d3e157c8e5b1b39c49e1ace6431a6825bb71f0e7`）、Emumet#80 は close 済み。独立 Reviewer approve（run `run-01m72ahfsrhdcaknymyeq23c41`、head `f4ba87e` 時点で must 0。head `665c7404b936bfee7ff7732ba3b6806bcf4b4265` は任意指摘 (3) RSET best-effort 化のみ）、CI 全 pass。実 DB `check-driver` は 311 passed / 1 ignored（live Turnstile）。
- E15c の範囲のみ完了。E15d、F15 の画面実装と D15 全体の統合受け入れは未完了。

## E15w — registration-admin-notification-webhook（Emumet#68。外部 Webhook 配送のみ）

- [ ] E15a の永続通知イベント（全種別。override 開始・解除を含む）が、サーバー設定の単一 endpoint へ配送される。event ID は再試行・再起動・再送でも同一。未設定なら配送せず「未設定」が観測でき、ゲート動作に影響しない
- [ ] at-least-once・受信側 event ID 重複排除・順序非保証が受信側向け文書に明記される
- [ ] HMAC-SHA256 署名（timestamp + 本文）。secret はサーバー設定のみで DB・API 応答・ログ・エラー・payload に出ない。署名のテストベクタと検証手順の文書がある
- [ ] SSRF 対策: HTTPS のみ、リダイレクト禁止、接続時の宛先検査と接続固定、全アドレス検査、timeout・本文サイズ上限。SSRF fixture で拒否され恒久失敗として記録される。test 用の例外は本番設定から有効化できない
- [ ] payload・ログに secret・登録者メール等を含めない（allowlist シリアライザ、宛先は host のみ表示）
- [ ] 再試行（408/429/5xx/timeout/接続失敗。Retry-After 尊重）と恒久エラー（その他 4xx・3xx・SSRF 拒否・設定不備）の分類、上限超過/恒久エラーで failed、管理者の再試行まで再送されない
- [ ] 配送記録の永続化、再起動後の回収、二重 worker でも同一 event を同時に二重送信しない（lease）
- [ ] 管理者 API（状態・テスト送信・再試行）。テスト送信はゲート状態・通知一覧・未読件数に影響しない。非管理者は 401/403。secret は応答に出ない
- [ ] Webhook 不達・failed・設定不備・worker 停止でゲート状態は変わらず、配送失敗が新しい Webhook 配送対象の通知イベントを生まない（無限再帰しない）
- 検証: 純粋ロジック（署名・分類・バックオフ・allowlist）、SSRF fixture、`DATABASE_URL` 実 DB + fake receiver（再起動・二重 worker・429/5xx/timeout・恒久エラー・管理者再試行。skip のみの成功は不可）、管理者認可、OpenAPI 再生成。E15a merge 後に rebase し共有ファイルは一件ずつ統合

### E15w の技術判断・closeout（2026-11-10、unit 範囲のみ）

- 最大期間（24h）は再試行（retrying）にのみ適用し、一度も試行していない pending の初回送信は期間超過後も行う。at-least-once と再起動後回収を優先する判断（親判断 `question-94564a5a413cf52b45d9d7bddb7003ca`）。テスト `a_never_attempted_delivery_is_still_sent_after_a_long_outage` で固定。
- Emumet PR #69 は squash merge 済み（`ae9bdddef26c21b2d70e08a5a8f74ac5e6153d05`）、Emumet#68 は close 済み。
- 独立 Reviewer approve（run `run-01m71kqtt6n5htgs0g8zsyqdfz`、must 0）、CI run `42745129343` 全 pass。`check-driver` は実 DB テストを実行し、0 ignored（前 run で確認済み）。
- E15w の範囲のみ完了。E15b/E15c/E15d と F15 の画面実装は未完了であり、D15 全体の受け入れは未達のままとする。

## F15 — registration-gate-admin-ui（shuttlepub-frontends#31。画面を含め完了）

- **部分進捗（2026-11-10）**: PR #33（head `3e07fec5d96c1e8c715f7bb6b0195bdcbcf60be2`、Refs #31）の BFF/API・生成型・fixture 部分を squash merge 済み（`7516562db15952144dd406070ffe3d3f95de02c3`）。独立 Reviewer approve（run `run-01m71j8qsyj87h460v46bhqyqn`、must 0）、CI 全 pass。画面実装はモック合意待ちで未着手。issue #31 は OPEN、F15 は未完了（queue 状態は変更しない）。
- [x] 【画面実装ゲート】モックへのユーザー合意が host intent に記録されるまで画面実装 PR を出さない。BFF・API 接続・生成型・全状態 fixture は先行可（画面とは別 PR）
- [x] 【先行可】BFF（状態・開閉・再開・override・通知一覧/未読/既読・Webhook 状態/テスト/再試行）が GraphQL・REST 変換・stateful mock・生成型に揃う。非管理者・未認証は fail closed。secret は応答に含まれない
- [x] 【先行可】全状態 fixture（Accept 防御低下あり/なし・TemporaryReject・Stopped・AdminClosed・override On・409 競合・一時障害・通知・Webhook 各状態）が API 契約に照合される
- [x] 管理者のみ操作可。revision 競合・一時障害・手動再開必要・閉鎖を混同しない
- [x] 【モック合意後】override 警告が管理画面内の全ページに常時表示され、画面遷移・再読込・SSR/hydration で消えず、一般画面には出ない
- [x] 【モック合意後】管理操作（override は警告 ack 必須）・通知一覧/未読/既読・Webhook 状態/テスト/再試行、SSR/hydration、visual（全状態）
- 統合: `bff/schema.graphql`・生成型は FN と直列、共通基盤は F0 所有、生成物の手編集禁止。実ゲートとの組合せは D15 統合受け入れ

## override の細部（技術設計詳細。overview.md 参照。E15a/E15w/F15 に反映）

- [ ] override 中も準備済み（effective）の保護は登録時に課される。override は準備未完了・障害でも開放するだけ（E15a）
- [ ] 解除で通常判定に戻る（解除時点の観測で再評価。管理者状態は閉鎖にしない）（E15a）
- [ ] override の開始・解除が通知一覧と Webhook の両方に含まれる（E15a 生成・E15w 配送・F15 表示）
- [ ] 警告バナーは管理画面内の全ページに常時表示し一般画面には出さない（F15。文言・見た目はモック合意待ち）

## E15c / E15d（後続。packet 化時に確定）

- E15c: 空設定・無効資格情報・timeout・429/5xx 等を区別し、古い成功結果を無期限に使わない。片方故障時は健全な対策のみ必須にできる
- E15d: D15 全状態を実 registration で確認。設定喪失は手動再開、障害復旧は自動再開、override は明示解除まで有効。login・追加 Account の回帰

## Writeback 記録

- queue 登録・publish・完了のリンクは [packets.md](packets.md) と candidates.md D15 節へ unit 範囲だけ追記する。

### E15a closeout（2026-11-10、unit 範囲のみ）

- Emumet PR #67 は squash merge 済み（`0ac9e9c087f61447c9a2c5e4a4cbf04a1075f2ca`）、Emumet#65 は close 済み。独立 Reviewer approve（run `run-01m71eeqq2r2c2qhkj6b0yb6zx`、must 0）、CI 全緑。
- 実 DB テスト証跡: Rust run `42731914696` の `check-driver` は 171 passed / 0 ignored。
- E15a は管理 control plane のみで、実登録を保護しない。E15d の実 enforcement、E15w、F15 が未完了のため、D15 全体の受け入れは未達のまま。

## E15d refinement: 周期検証 API 応答による readiness 維持・復旧（2026-11-10）

出典: 親判断 question-273f21f1ce70800ab974ed89f9c8f6bd。d15-q05 の準備済み基準は、設定の存在ではなく検証 API の実応答である。受信ボックスでの roundtrip を継続的に要求する決定ではない。したがって、固定された承認済み canary 宛先への SMTP DATA 受理は、同一 generation の readiness の business TTL 更新と配送段階の障害解除に利用してよい。Turnstile も、公式 Siteverify の解釈可能な業務応答を維持・復旧の証拠とする。単なる TCP 接続・health・設定ファイル存在とは区別する。

E15d の技術選択は、各 generation の初回 bootstrap（メールは管理者 canary code 確認、BOT は有効 token の検証成功。**2026-11-12 に入力なしの管理者［再検証］へ改訂、下記「Bootstrap revision」**）を保持し、以後は周期的な SMTP DATA 受理／Siteverify probe の業務応答で business TTL を更新する。過去の成功が TTL 超過していても同一 generation なら維持・復旧できる。generation 変更後に旧成功を持ち越さず、未 bootstrap の設定を周期 probe だけで operational にしない。MAIL FROM までの接続 probe はメール business TTL を更新しない。公開の任意宛先送信・不正 token は readiness の維持証拠にしない。

段階×時刻の証拠モデルは維持する。成功の evidence_at は、成功した対話の開始時刻を保守的な下限とする（対話中に観測された新しい障害を、遅れて完了した古い対話が解除しない）。障害の時刻は実際の失敗観測時刻。code 確認それ自体は新しい SMTP 障害を解除しない。設定喪失 latch は provider が復旧しても解除されず、手動再開が必要である。

これは E15d の設計精緻化であり、準備 PR や E15c 単体をもって実 Kratos enforcement／D15 全体の受け入れを完了とはしない。

## E15d refinement: enforcement 基盤の喪失は override と独立した停止（2026-11-10）

出典: 親判断 question-3eac94babf10decd062298d0f74a5c2a。hook の削除・未照合 replica・attestation の期限切れ等、登録判定そのものを迂回し得る構成喪失は、provider の準備未完了・一時障害とは別の設定喪失として扱う。enforcement が未確認の間、またはその停止 latch が残る間は、override より先に Stopped とする。provider 成功や通常の観測更新がこの状態を正常化してはならない。

既存の provider 起因の状態表は変更しない。override_info は基盤停止で暗黙に解除せず、明示解除まで保持する。API は override 有効と enforcement 停止を同時に表現できなければならず、F15 は override バナーだけをもって受付中と表示しない。

照合状態の復旧を通知しても停止 latch は自動解除しない。再開は、最新の enforcement 照合が有効な状態で管理者が明示的に行う。最低保護条件を満たす場合は通常の手動再開、保護の無い状態で継続中の override により再開する場合は警告確認を再度要求する。override の開始者・開始時刻はこの再開で書き換えない。基盤喪失と照合復旧の両イベントを通知一覧・E15w Webhook の配送対象とする。

これは実装に必要な状態契約の精緻化であり、実 Kratos・全到達経路の照合と fail-closed 試験が完了するまで D15/E15d を完了扱いしない。

### E15d part 2 の受け入れ境界（2026-11-11）

- 本番 password pre-persist hook、認証、追加method無効固定、negative canary の nonce+flow+receipt と admin非作成照合を対象とする。positive は実 Kratos CI が担う。
- enforcement 喪失は override より先に停止し、override_info は保持する。復旧通知後も手動再開が必要で、保護なしの継続override再開では警告再確認を要求する。provider成功ではenforcement停止を解除しない。
- CI は実 Kratos + Emumet 本番ルーター + PostgreSQL で D15 q01〜q11 を検証する。q04 は招待機能の新設を要求せず、公開 registration に自称招待/override の迂回を認めない。SMTP/Turnstileのみ模擬し、DB/identity実作成と通知/Webhookを確認する。skipだけの成功は不可。
- 保証の限界: hook自体が外れたKratosに対してEmumetの停止は物理遮断にならない。次の周期検査で検査の当たった経路を検出し即時通知するが、有限回のLB URL canaryで非選択/未応答replicaや未広告methodを完全に網羅しない。不明replica排除・経路切離し・物理停止は運用者の配備層責務（[ADR](../../decisions/registration-protection-placement.md)）。独自ingressやDocker inspectorが実装されたとする受け入れは行わない。
- F15の画面表示・操作・常時警告は引き続き別unit。E15d part2 のPR/CI/レビュー証跡は完了報告時に追記する。

### E15d part 2 closeout（2026-11-10、unit 範囲のみ）

- Emumet PR #88（part 1、`ef063d67bc28b2a93fb6c09babc73d90216fa176`）と PR #92（part 2、`95e3f77c7517d3337380df95f74a90eabe6b4ee0`）は squash merge 済み。#92 head は `1d896bfef2d741552fdc003f393545d5e826a765`。独立 Reviewer approve（run `run-01m73ajh2zjhz9p4ysdrk0h760`、must 0）、CI 全14 checks success。
- 実 Kratos D15 q01〜q11（`real_kratos_d15_q01_through_q11`、E2E run `42878493680`）は 1 pass / 0 ignored。Rust run `42878495066` は実 DB 37 passed / 0 ignored、driver 323 passed / 1 ignored（live Cloudflare のみ）。
- E15d unit の範囲は完了。Emumet#81 は part 1 の PR #88 merge 時にすでに CLOSED であり、reopen せずそのまま CLOSED。D15 全体は F15 の画面実装（ユーザーのモック合意待ち）が残るため未完了。
- 残余リスク:
  - hook を除去した Kratos 自体への物理遮断は Emumet 単独では保証できず、配備層での経路切離し・不明 replica 排除・停止は運用者の責務。
  - 有限回の LB URL sampling では、未選択／未応答の未知 replica や未広告 method を網羅できない。
  - SMTP の対話・観測時刻の差による時間差は残る。
  - gate 評価から identity persist までを単一原子操作にできない。
  - 遅延 persist の再観測は 10 秒の有界検証であり、無期限の再観測ではない。

## Bootstrap revision: 入力なしの管理者［再検証］（2026-11-12）

出典: d15-q05、リード承認 question-f24eeb05650d956c943da656275847ac。詳細は [ADR「Bootstrap revision」](../../decisions/registration-protection-placement.md)。

- 受け入れ: 保護が準備済み（operational）になるのは、**入力なしの管理者 verify** が実際の検証 API 応答（メール: 固定 canary 宛の SMTP DATA 受理、Turnstile: ダミー token への `invalid-input-response` = secret 有効）を得たときだけ。管理者の code 入力・widget token・受信確認は要求しない。設定が有効なだけ・周期 probe だけ・health・HTTP 200 だけでは準備済みにならない（実 Kratos E2E q05 で確認）。
- Turnstile: `invalid-input-secret` / `missing-input-secret` は設定不正、`bad-request` だけ・未知の code・429/5xx は準備済みにならない。公式テストキーで実 Siteverify を検証（`live_turnstile_official_test_keys`、ignored）。
- 証拠モデル（段階×時刻、DATA 受理）、登録者 code 確認が障害を解除しない原則、generation 束縛は維持。
- 実装状況: Bootstrap 修正 PR ShuttlePub/Emumet#99 merged (squash 11414a68ec1bb6872d8af6c09f7e1a312c19922e)。Turnstile は既知 code に未知の code が混在する拒否応答も一時障害（secret の error が混在する場合は設定不正を優先）。ダミー token での secret 検証順序（無効 secret → `invalid-input-secret`）は公式保証ではなく E15b の実応答と公式テストキーでの実測上の前提（live テストで継続確認）。

## E15x closeout: registration-webhook-endpoint-management（2026-11-11、unit 範囲のみ）

- Emumet PR #100（Closes #97、head `b9fa4a38bd56d4ae28c564110a7bbeb993493766`）は squash merge 済み（`7843ccb0de3a792741c608d54beabf81b8bd9b45`）、#97 は CLOSED。
- 独立 Reviewer approve（run `run-01m76181y2h6fb484y0zw5bbzm`、must 0）、CI 全 pass。実 DB テストは driver 67 / application 20 / server 10 passed、すべて 0 ignored。実 Kratos E2E も pass。CI の `Check openapi.json is up-to-date` も pass。
- 設計判断・境界:
  - 送信先 secret は AES-256-GCM で暗号化し、送信先 ID を AAD として束縛する。鍵は `REGISTRATION_WEBHOOK_ENCRYPTION_KEY` から取得する。鍵ローテーション機構は本 unit の範囲外。
  - URL は平文保存する。URL の path/query に token が含まれる場合、その情報は DB 上で保護されない。
  - 既存環境変数 endpoint 1 件の冪等取り込みで、既存配送データを破壊せず移行する。
  - E15w の旧集約 API を削除し、retry request body の契約を変更した。配送は送信先ごとに並行処理する。
- 残余・範囲外:
  - tracing に secret が漏れないことのテストと worker spawn 停止のテストは未実装。
  - 既存 `GET /ap/accounts/{account_id}` の OpenAPI path parameter 名の不整合は既存不具合であり、本 unit の範囲外。
  - ローカル `cargo test -p server write_openapi_spec_to_file -- --ignored` は未実行。PR merge ref の CI `Check openapi.json is up-to-date` は pass。
- E15x の範囲のみ完了。F15 の Webhook タブが後続であり、D15 全体は未完了のままとする。
