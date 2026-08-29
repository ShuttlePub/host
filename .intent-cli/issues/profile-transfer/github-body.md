# profile-transfer: Profile 移管 (個人→組織) — 2段階フロー + 所有移転 + 参照ファイルコピー要求

## Goal

個人の Profile を組織へ移管する 2段階フロー (申請 → 承認) を実装する。
承認時に Profile の所有 (account_id) が組織に移転し、参照ファイル
(icon/banner) のコピー要求が発行される。あわせて profiles.account_id を
部分ユニーク化し、組織が複数 Profile を持てるようにする。

## Why This Slice Exists Now

org-accounts grill Q6 (2026-08-29) で「個人 Account の組織化は Profile 移管
のみ」と確定 (Account 変換は持たない)。acct/Actor URI・署名鍵・フォロー
関係は Profile スコープ (ADR 0002) を維持するため、移管は account_id の
付け替えで実現し、将来互換性が保てる。Booskiff 側の移管時コピー要件
(booskiff C1) に対応する port をここで定義する。

## Current Observed State

- ProfileEvent: Created / Updated (account_id を含まない)。所有権移転
  イベントなし (kernel/src/entity/profile.rs)
- profiles.account_id は UNIQUE (1 Account = 1 Profile)。read model の
  find_by_account_id は単一返し
- 移管に相当するコードは一切存在しない
- org-accounts-foundation で組織・メンバーシップ基盤が作成済み (前提)
- org-accounts-auth-context でコンテキスト解決が作成済み (前提ではない —
  承認は個人 identity + OrgRole 判定で可能)

## Accepted Baseline You May Assume

- 移管は個人→組織のみ (組織→個人の戻しは将来検討、grill Q6/Q7)
- フローは 2段階: 移管元が申請 → 移管先 org の Owner/Admin が承認。
  承認前は移管元が取消可。承認後の取消・却下は不可 (422)
- acct/Actor URI・nanoid・署名鍵・フォロー関係は変わらない
  (Profile スコープ維持、grill Q6)
- 参照ファイルは組織 Drive へコピー + 参照付け替え (grill Q9)。
  Booskiff 未実装のため、本 packet はコピー要求 port の定義 + stub 実装で
  完了とする。実連携は Booskiff 実装後の follow-up
- 部分ユニーク化: personal アカウントのみ 1:1 制約を維持。
  組織 (kind=organization) は複数 Profile を持てる

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `kernel/src/entity, kernel/src/repository, kernel/src/read_model, application/src/service, server/src/route, server/src/api, driver/src/database/postgres, migrations`

Target part: ProfileTransferRequest aggregate + 移管フロー use case + ProfileEvent::AccountTransferred + profiles.account_id 部分ユニーク化 migration + ファイルコピー要求 port

## In Scope

- ProfileTransferRequest (aggregate/テーブル/イベント) + 状態遷移
  (pending → accepted/rejected/cancelled)
- ProfileEvent::AccountTransferred + apply 更新
- 申請・承認・却下・取消の use case + REST API (仮パス)
- profiles.account_id 部分ユニーク化 migration
- 参照ファイルコピー要求 port (stub 実装)

## Out Of Scope

- 組織→個人の移管 (戻し)
- ファイルコピーの実連携 (Booskiff 実装後の follow-up)
- AP Announce (フォロワーへの移管通知)
- 課金の引き継ぎ

## Standalone Child Issue Contract

この PR は、Emumet に Profile の個人→組織移管を導入するものである:
Profile 所有者が組織を指定して移管を申請し、組織の Owner/Admin が承認
すると、Profile の所有が組織に移転する (acct/URI/鍵/フォロワーは不変)。
承認時に icon/banner のコピー要求が発行される (実連携は stub)。
profiles.account_id は personal のみ 1:1 制約を維持した部分ユニーク化される。

## Acceptance Criteria

- ProfileTransferRequest の aggregate/テーブル/イベントが実装される
- 申請 (所有者のみ) → 承認/却下 (移管先の Owner/Admin のみ) → 取消
  (移管元、承認前のみ) のフローが動作する
- 承認で Profile.account_id が org に付け替わり、AccountTransferred イベントが
  保存される。URI/鍵/フォロー関係は不変
- profiles.account_id が部分ユニーク化され、personal は 1:1 維持・
  organization は複数 Profile を持てる
- 承認でコピー port が呼ばれる (stub。シグネチャと呼び出しをテストで検証)
- pending 中の重複申請は 422。受理後の取消は 422
- ユースケース単体テストでフロー全体が検証され、既存テスト全緑

## Verification

- ユースケース単体テスト (申請→承認・却下・取消・重複・権限拒否)
- migration 適用・ロールバック (部分ユニークの有効性検証)
- 既存テスト全緑、`git diff --check`

## Related Links

- 設計: host リポ `intents/emumet/features/org-accounts/overview.md`、
  `intents/emumet/interview/2026-08-29-org-accounts-grill.md` (Q6/Q7/Q9)
- 前提: `.intent-cli/issues/org-accounts-foundation/`
- Booskiff 側要件: host リポ `intents/booskiff/clarifications/open.md` C1
  (copy API)

## Knowledge Maintenance

- Intent placement: overview.md (primary)、packets.md unit 3 へ完了リンク追記
- ADR candidate: 0007-organization-accounts.md へ移管設計を追記
- Diagram candidate: none
- Docs update: none
- Closeout writeback expected: yes

## Guide Reachability (G645)

role-facing surface: REST API (移管エンドポイント)。
guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
