---
facets: [vocabulary]
---

# shuttlepub-link — overview

## Goals

Profile ごとに「連携先 ShuttlePub サービス」を設定し、自分宛ての投稿の転送先を
決められるようにする。docs の StellarAccount イベント定義の後継にあたる
(2026-07-22 interview: 「メインサービスの保存」ではなく「アカウントごとの連携先
ShuttlePub サービスを設定してそこに自分宛ての投稿を流す」形)。

2026-08-24 の境界改訂(ADR 0002/0003 amended)により、リンクは単なる転送先設定ではなく、
**Profile への content provider 接続 + 署名 capability** として再定義された:

- リンクは **Profile 単位**(Account 単位ではない。ADR 0002 amended)
- リンク時に capability(`profile_id + link_id + scopes`)を発行する。
  最低 scope は `sign:post`(署名要求 = 投稿許可)。この capability が
  署名 API の認可根拠になる(operator 判断 2026-08-24)
- **1 Profile につき active な link は1つ**(operator 判断 2026-08-24)
- `link-id` は Emumet 発行の opaque ID。再利用禁止・発行時に Profile に固定。
  object ID 名前空間(`/objects/<link-id>/...`)の接頭辞でもある

## Background

Stellar システムは凍結され、認可まわりは Ory で代替された(decisions/0001)。
StellarAccount イベント定義(host, client_id, access_token, refresh_token)は
コンセプトとしては有効だが、対象は Stellar ではなく ShuttlePub 本体サービス群になる。

## Scope

- Profile ↔ 連携先 ShuttlePub サービスの紐付け(登録・更新・削除)
- capability の発行・失効(unlink 時は即時失効)
- relink(本体サービス切替)手順:
  1. 旧 capability を失効
  2. 旧 namespace を read-only 化(新規署名を拒否、既存 object のプロキシは継続)
  3. 新 link / 新 namespace / 新 capability を有効化
  4. inbox 転送先を新 link に切替
  5. Emumet 保持のフォロワーグラフを新 ShuttlePub へ API/export で提供
- post-relay の転送先解決・署名 API の認可に利用されること

## Related

- [requirements.md](requirements.md) / [open-questions.md](open-questions.md) / [packets.md](packets.md)
- [../post-relay/overview.md](../post-relay/overview.md) — 本設定の主たる利用者
- 決定記録: ../../decisions/0002-account-address-on-emumet-domain.md, 0003-delegated-signing.md
- docs: https://docs.shuttle.pub/docs/emumet/data-structure (StellarAccount イベント)
