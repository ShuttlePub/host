---
facets: [invariant]
---

# account-management — overview

## Goals

ShuttlePub 全体で共有されるアカウントの正本を Event Sourcing + CQRS で管理する。
**基盤は実装済み**(2026-07 時点)。

## 実装済みスコープ

- Account CRUD + Deactivate(Event Sourced: Created/Updated/Deactivated/Suspended/Unsuspended/Banned)
- Profile(display_name, summary, icon, banner)・ Metadata(label, content) — Account 更新 API に統合
- AuthAccount / AuthHost による Ory(Kratos/Hydra)連携の認証解決
- 署名鍵管理(RSA 生成・暗号化保存・失効)と内部署名 API
- 楽観的排他(prev_version)・ Signal→Applier による ReadModel 投影

## 受領した追加意図 (2026-10-15、candidate)

スパムBOTの踏み台を防ぐため、防御設定が整うまで一般登録を開けないようにしたい。
2026-10-21の[grill記録](../../../shuttlepub/interviews/discord-feature-grill-2026-10-15.json)の
`d15-q01-either-email-or-bot-protection`で、メール認証またはCAPTCHA等のBOT対策の
どちらか一方を最低条件とするORを採用した。両方は必須にせず、対策なしの一般開放は認めない。
`d15-q02-auto-stop-on-loss-of-configured-protection`で、開放後の設定変更で両方が無効に
なった場合は新しい一般登録を自動停止する。一時的な外部障害や既存利用者の利用停止は含めない。
具体的な準備済み判定、Ory identity登録とEmumet Account作成の対象・迂回防止、
復旧後の再開方法・招待登録等の扱いは未決。ゲートの実装完了を意味しない。
[意図I15](../../../shuttlepub/product/social-experience.md#i15) /
[候補D15](../../../shuttlepub/packets/candidates.md#d15) を参照。
担当domainはemumet、target repoはEmumet。管理UIをfrontendsの後続候補に分ける。

## Related

- [packets.md](packets.md)
- コード: `kernel/src/entity/account.rs`, `application/src/service/account*`, `server/src/route/account/`
- モデレーション関連は [../moderation/overview.md](../moderation/overview.md)
