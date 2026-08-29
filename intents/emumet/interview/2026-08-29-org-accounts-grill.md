# Interview: org-accounts grill (2026-08-29)

chat-first grill セッションで記録。CLI セッション記録:
`intents/emumet/interviews/org-accounts.json` (Q1-Q11)。

契機: Booskiff (ドライブストレージ) の設計議論で「複数の Account が 1 Profile を
共同運用する」ケースが Emumet 現行設計で未想定であることが判明 (booskiff C1)。
operator 判断で「すぐやりたい要件」として emumet C5 を起票し、grill を実施。

## Q1: 「すぐやりたい」共同運用の形は?

**Answer**: A. 組織としての公式アカウント運用。個人 Profile の共同運用 (B) は
不要。組織 Account が Profile を所有し、個人 Account は組織のメンバーとして
間接的に操作するモデルで確定。

## Q2: メンバーシップの主体は?

**Answer**: A. 初期はローカル Account のみをメンバーにする。リモート Emumet
アカウントのメンバー加入は将来フェーズとして設計する (Emumet 鯖間連携
feature として独立)。「Emumet 複数鯖の世界観」の確定は別途論点として残す。

## Q3: メンバーの役割は何段階にする?

**Answer**: B. 3段階ロール: オーナー (組織の所有・解散・オーナー移譲) /
管理者 (メンバー管理・Profile 操作) / メンバー (Profile 操作のみ)。
GitHub 的な責任者と運用者の分離、オーナー移譲経路を最初から持つ。

## Q4: 組織 Account のログイン・認証モデルは?

**Answer**: A. スイッチ式を採用。組織 Account は Kratos identity を持たず、
個人が identity でログイン後に UI/API で操作コンテキストを個人/所属組織に
切り替える。組織としての操作は「その組織のメンバーであること」の claim で
認可する。課金主体 (組織) と操作者 (個人メンバー) の分離と一致。

## Q5: 組織 Account の作成資格は?

**Answer**: A. 認証済み個人 Account なら誰でも作成可能。作成者が最初の
オーナー。1人の個人が複数の組織 Account を作成・所有してもよい
(GitHub Organization 的)。スパム組織対策は作成後のモデレーションで対処。
課金は作成ではなく容量・共有機能に対して課す。

## Q6: 個人 Account の組織化 (変換経路) は必要か?

**Answer**: C. Profile 移管のみを product スコープに含める (個人→組織への
移管)。Account 変換は持たない。コア実装は Profile の account_id 付け替え +
所有移転イベント。将来互換性: acct/Actor URI・署名鍵・フォロー関係は
Profile スコープ (ADR 0002) を維持し、Profile の account_id 付け替えを
恒久的に禁止する制約を導入しない。実装は org-accounts 基盤 packet と分離した
後続 packet で段階化可。
※ operator の再考により A (不要) から C へ確定。

## Q7: Profile 移管のフローは?

**Answer**: A. 2段階フロー: 移管元の個人オーナーが「組織 X へ移管」を申請し、
移管先組織のオーナー/管理者が承認して確定 (GitHub リポジトリ移管と同じ)。
移管リクエストは pending → accepted/rejected/cancelled の状態管理。
承認前なら移管元が取り消し可、承認後は不可 (移管先による戻しは将来検討)。

## Q8: 組織 Account の Drive (Booskiff) の所有モデルは?

**Answer**: A. 組織専用 Drive。組織 Account が所有する独立 Drive とし、
メンバーはロール (オーナー/管理者/メンバー) に応じて操作可能。
メンバーの個人 Drive とは完全分離。課金・容量は組織単位
(詳細設計は Booskiff ドメイン側 grill に委譲)。
Booskiff 側要件: Drive の所有者として組織 Account を許可する。

## Q9: Profile 移管時、参照ファイル (アイコン等) の扱いは?

**Answer**: B. 移管時に参照ファイルを組織 Drive へコピーし、Profile の参照を
付け替える。元ファイルは個人 Drive に残る。Booskiff 側要件: copy 系 API。
UI 要件: 移管フローでコピー対象ファイルと挙動を明示する。
Ratcap 側にも移管 UI・組織コンテキスト表示の波及があるため、
Ratcap 波及は別論点として整理する。

## Q10: 組織への通報・ban は現行 Account 単位モデルに乗せるか、段階的対処の手段は?

**Answer**: A-2. 組織 Account も現行 Account 単位モデレーションにそのまま乗せる
(通報・Suspend・Ban は AccountId 対象、多態化しない)。組織への ban は
全組織 Profile を停止、メンバー個人には影響しない。あわせて
AccountEvent::Warning (警告) を新設し、通報 resolve 時に「警告で解決」を
選択可能にする。警告履歴はイベントとして残し、繰り返し違反の判断材料とする。

## Q11: Ratcap への波及はどう扱う?

**Answer**: A. Emumet 側は API 契約のみ確定し、波及リストを Ratcap ドメインの
grill に引き継ぐ。波及: (1) 組織コンテキスト切替 UI (2) 移管フロー UI
(申請/承認/コピー対象の明示) (3) モデレーション UI (警告選択肢・
組織区別表示) (4) 組織 Drive UI。Ratcap の UI 設計は Ratcap ドメインの
grill で詰める。

## Rediscovery (終了時)

- 組織の解散時の Profile 扱い → 既存 Account 削除フローに準ずる (新規質問ではなく
  overview の Scope に明記)
- 不在オーナーの自動処理 → オーナー移譲で対処 (初期スコープ外、将来検討)
- meaningful な新規質問なし → intent-update-ready で終了
