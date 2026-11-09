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

## E15c / E15d / E15w / F15（後続。packet 化時に確定）

- E15c: 空設定・無効資格情報・timeout・429/5xx 等を区別し、古い成功結果を無期限に使わない。片方故障時は健全な対策のみ必須にできる
- E15d: D15 全状態を実 registration で確認。設定喪失は手動再開、障害復旧は自動再開、override は明示解除まで有効。login・追加 Account の回帰
- E15w: 単一 endpoint、HTTPS・リダイレクト禁止・宛先検査（SSRF 対策）、secret/登録者メールの非漏洩、at-least-once と event ID 重複排除、Webhook 不達でゲート状態を変えない
- F15: 管理者のみ操作可、revision 競合・一時障害・手動再開必要を混同しない、override 警告を画面遷移で消さない

## Writeback 記録

- queue 登録・publish・完了のリンクは [packets.md](packets.md) と candidates.md D15 節へ unit 範囲だけ追記する。
