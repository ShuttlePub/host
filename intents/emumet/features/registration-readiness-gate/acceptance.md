# registration-readiness-gate — acceptance criteria

> See [overview.md](overview.md) for goals and [packets.md](packets.md) for the unit split / dependency graph.
> 各項目は unit の範囲だけを対象とする。D15 全体の受け入れは E15d + E15w + F15 が揃うまで保留。

## 全体（D15 統合受け入れ。未達）

- [ ] 実 Kratos 経路（browser / API の直接 registration、作成済み flow、設定変更後、UI を経由しない入口）で D15 の全状態が守られる (E15d)
- [ ] 外部 Webhook が管理画面を開いていなくても障害・復旧・防御低下を届ける (E15w)
- [ ] 管理画面で状態・開閉・再開・override・通知一覧/既読が操作でき、override 中の警告が画面遷移で消えない (F15)
- [ ] ログイン済み利用者の `POST /api/v1/accounts` と login がゲートの影響を受けない (E15d)

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

## F15 — registration-gate-admin-ui（shuttlepub-frontends#31。BFF/API 接続は先行可、画面はモック合意待ち）

- **部分進捗（2026-11-10）**: PR #33（head `3e07fec5d96c1e8c715f7bb6b0195bdcbcf60be2`、Refs #31）の BFF/API・生成型・fixture 部分を squash merge 済み（`7516562db15952144dd406070ffe3d3f95de02c3`）。独立 Reviewer approve（run `run-01m71j8qsyj87h460v46bhqyqn`、must 0）、CI 全 pass。画面実装はモック合意待ちで未着手。issue #31 は OPEN、F15 は未完了（queue 状態は変更しない）。
- [ ] 【画面実装ゲート】モックへのユーザー合意が host intent に記録されるまで画面実装 PR を出さない。BFF・API 接続・生成型・全状態 fixture は先行可（画面とは別 PR）
- [ ] 【先行可】BFF（状態・開閉・再開・override・通知一覧/未読/既読・Webhook 状態/テスト/再試行）が GraphQL・REST 変換・stateful mock・生成型に揃う。非管理者・未認証は fail closed。secret は応答に含まれない
- [ ] 【先行可】全状態 fixture（Accept 防御低下あり/なし・TemporaryReject・Stopped・AdminClosed・override On・409 競合・一時障害・通知・Webhook 各状態）が API 契約に照合される
- [ ] 管理者のみ操作可。revision 競合・一時障害・手動再開必要・閉鎖を混同しない
- [ ] 【モック合意後】override 警告が管理画面内の全ページに常時表示され、画面遷移・再読込・SSR/hydration で消えず、一般画面には出ない
- [ ] 【モック合意後】管理操作（override は警告 ack 必須）・通知一覧/未読/既読・Webhook 状態/テスト/再試行、SSR/hydration、visual（全状態）
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
