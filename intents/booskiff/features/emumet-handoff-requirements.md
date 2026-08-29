# emumet からの受け渡し要件 (booskiff 側)

emumet ドメインの org-accounts grill (2026-08-29、
`intents/emumet/interview/2026-08-29-org-accounts-grill.md` Q8/Q9) から
booskiff ドメインに委譲された要件。clarifications/open.md の C1 も参照。

## 要件 1: 組織 Account を Drive の所有者として許可する

- **初動での扱い (D1/D14)**: 所有者モデルへの配慮は初動で実施
  (Account 所有者の一般化として組織 Account を拒まない設計にする)。
  「個人 Account / 組織 Account の区別」を booskiff のドメインに持ち込むかは
  この時点では決めない (Emumet 側の Account 表現に従う)
- **後続 slice での詳細設計**:
  - 組織専用 Drive (課金・容量は組織単位) の扱い
  - 組織メンバーのロール (オーナー/管理者/メンバー) に応じた Drive 操作権限
  - 課金プランの組織単位適用 (Q7/Q8 の課金モデルとの統合)

## 要件 2: copy 系 API (Profile 移管時のファイルコピー)

- Profile 移管時に Emumet が「個人 Drive の参照ファイルを組織 Drive へコピー +
  参照付け替え」を行うため、同一 Booskiff 内の Drive 間コピー API が必要
- **扱い**: 初動スコープ外。組織 Drive 詳細の slice と同じタイミングで設計
- 設計論点メモ: コピー=メタデータ複製+新オブジェクト (物理コピー) か、
  参照共有か。課金計量への影響 (受信バイトではなく内部コピーなので計上しない
  方向が自然だが、容量は重複分を食う)

## 連携時の API 契約論点 (将来の詰め所)

- 公開参照の付け替え・解除タイミング (参照中の Profile がある状態での
  非公開化は Emumet 側の整合責任。D12/Q12)
- Emumet 側が booskiff の課金状態を参照する経路 (容量表示等。D7)
