# Open Clarifications

2026-07-22 stack 時点で packet 化を deferred した事項。`grill` / `clarification` で解消する。

## C1 (解消済み 2026-08-12): media-upload のストレージバックエンド

- 結論: S3 互換 (開発環境は RustFS)。配信は別ドメイン直接配信
  (本番 R2 + カスタムドメイン想定、公開ベース URL は設定差し替え式)。
  アイコン/バナー変更時は Update(Person) をフォロワーへ配送する
- 決定記録・Q/A: [../interview/2026-08-12-c1-c3-grill.md](../interview/2026-08-12-c1-c3-grill.md)
- feature 側決定: [../features/media-upload/decisions.md](../features/media-upload/decisions.md)

## C2 (方向確定 2026-11-18、詳細は実行単位の設計で): post-relay の ShuttlePub 転送プロトコル

- **結論 (2026-11-18)**: 再開条件 (ShuttlePub 本体の構想) を満たしたので方向を確定した。
  専用 API とし、中身は受信した AP の Activity をそのまま渡し、外側に宛先 Profile・
  署名検証の結果・受信時刻などを付ける。転送先はホーム (信頼モード③) と、信頼モード②
  以上の link。サービス間認証は Hydra の間 DCR。envelope の正確な形と、ダイレクトを
  どの link へ転送するかは post-relay / shuttlepub-link の実行単位の設計で決める
- 決定記録: shuttlepub domain の decisions/2026-11-18-service-concept-and-cross-service-p0.md
  (D30・D31・D32)
- **追記 (2026-11-18、D36-D41)**: 「サービス間認証は Hydra の間 DCR」は ShuttlePub → Emumet
  の向きの話。Emumet → ShuttlePub の転送リクエストの認証方式と、Ory の停止中に保証する
  範囲は未決 (候補: Emumet の鍵で署名し ShuttlePub が検証する)。転送の受け口は
  ShuttlePub のリレー用 inbox とは別の専用 API (D39)。P1 で現行の Ory 構成のまま通す (D36)
- 以下は 2026-08 時点の記録

- 背景: inbox で受けた投稿を連携先 ShuttlePub へ転送する方式が未決
- 論点: HTTP webhook / キュー(rikka-mq/Redis) / その他。ShuttlePub 本体側の受け口設計と
  セットで決める必要がある。サービス間認証方式も未決
- 2026-08-12 grill 調査で判明: ShuttlePub 本体 (ShuttlePub/ShuttlePub) は
  2023-04 停止・受け口非存在。本体不在のまま IF だけ確定すると手戻りリスクが高い
- **再開条件: ShuttlePub 本体実装の構想が立った時点で再 grill する**
- 参照: ../features/post-relay/open-questions.md

## C3 (方向確定 2026-11-18、詳細は実行単位の設計で): shuttlepub-link の連携先認証・ multiplicity

- **結論 (2026-11-18)**: link を「ホーム」と「参加」に分ける。参加の link は複数持てる。
  登録は本人が UI の認可確認画面で行う。link ごとに信頼モード (① 署名のみ /
  ② + 受信の転送 / ③ + Profile のコレクション配布) を選び、③ は同時に 1 つ = ホーム。
  認証は Hydra の間 DCR (client_id と origin の対応を Emumet が持つ)
- 決定記録: shuttlepub domain の decisions/2026-11-18-service-concept-and-cross-service-p0.md
  (D31・D32)、ADR 0002 / 0003 の 2026-11-18 追記
- **追記 (2026-11-18、D36-D41)**: client_id と origin の対応表の担当 (Emumet か Stellar か)
  は未決に戻した。link の説明は当面「Profile のアタッチ先」で揃え、ShuttlePub の
  ドメインが変わる場合は新しいサーバーとして扱う (D40)
- 以下は 2026-08 時点の記録

- 背景: docs の StellarAccount 定義(access_token/refresh_token)を踏襲するか未決。
  ShuttlePub 本体側の実装状況の確認が必要
- 論点: 認証方式、1アカウントの連携先は 1 つか複数か、登録主体は誰か
- 2026-08-12 grill 調査で判明: docs 定義は実装で踏襲されておらず、Emumet の
  auth_hosts/auth_accounts (access_token カラムなし) は Hydra 認証クライアント
  管理として稼働中。C2 と同じく本体設計前提のため deferred
- **再開条件: ShuttlePub 本体実装の構想が立った時点で再 grill する (C2 と同時)**
- 参照: ../features/shuttlepub-link/open-questions.md

## C4 (解消済み 2026-08-12): Emumet REST API (/api/v1) の Mastodon API 互換方針

- 結論: (a) で確定。`/api/v1` は Emumet 固有 API であり、Mastodon クライアント API
  互換は Non-goal。互換レイヤ分離(b)・現行ルート改修(c)は行わない。
  オペレーターの本来の関心は REST クライアント API ではなく ActivityPub 連合の
  相互運用性であり、そちらは実 Mastodon サーバーとの E2E(S7-S9)が CI で
  常時検証済みであることを実調査で確認した
- 決定記録: [../decisions/0005-rest-api-is-emumet-specific.md](../decisions/0005-rest-api-is-emumet-specific.md)
- 経緯・Q/A: [../interview/2026-08-12-c4-rest-api-mastodon-compat.md](../interview/2026-08-12-c4-rest-api-mastodon-compat.md)
- フォローアップ: Mastodon 実機 E2E の Undo(Follow) カバレッジ追加を
  packet backlog に登録(`mastodon-e2e-undo-coverage`) → **完了**
  (issue #46 / PR #47 マージ 2026-08-20。S10 双方向 Undo(Follow) を追加)

## C5 (解消済み 2026-08-29): 組織アカウント / Profile 共同管理の構想確定

- 結論: **組織 Account モデルで確定**。Profile : Account = N:1 を維持。
  メンバーロール3段階、スイッチ式認証、誰でも作成可 (複数可)、
  Profile 移管 (2段階フロー、移管時の参照ファイルコピー)、
  現行モデレーション + Warning イベント新設。
  Ratcap への波及は API 契約のみ確定し UI 設計は Ratcap grill に引き継ぎ
- 決定記録: [../features/org-accounts/overview.md](../features/org-accounts/overview.md)、
  [../interview/2026-08-29-org-accounts-grill.md](../interview/2026-08-29-org-accounts-grill.md)
  (Q1-Q11、CLI セッション記録: ../interviews/org-accounts.json)

## Recently Resolved

- 2026-08-25T14:11:06Z — unlink 後の旧 namespace (`/objects/<link-id>/...`) のプロキシ継続条件・遮断ルール
  - Decision: (operator 確定 2026-08-25) **A で確定**: ユーザー主体 unlink → read-only プロキシ無期限継続 (upstream 応答する限り。7日連続到達不能で 502 化 → 30日後に 404)。 運営切断(abuse/規約違反) → 即時遮断(全 object 404)。 削除済み object は unlink 理由に関わらず Tombstone/410 を upstream より優先 (現行 requirements 通り)。link 管理に unlink reason の記録を追加する。

- 2026-08-25T14:11:06Z — 署名 API の SLO(レイテンシ・エラー率)と backpressure 設計。Emumet 障害時の最大許容停止時間
  - Decision: (operator 確定 2026-08-25) **A で確定**: SLO p99 100ms・エラー率 0.1% 未満。 過負荷時は Emumet が 429 + Retry-After を返し、ShuttlePub は queue backoff で応じる (Emumet 内に要求キューを持たない)。レート制限は profile(link)単位 + 全体上限の2段。 Emumet 最大許容停止時間 72h(ShuttlePub 側 durable queue 保持 72h と整合)。

- 2026-08-25T14:10:57Z — 内向き転送(Emumet → ShuttlePub)が失敗した場合の再送間隔・保管期間の具体値
  - Decision: (operator 確定 2026-08-25) **A で確定**: 指数 backoff (初回30s、倍率2、上限1h、jitter 付き)。72h で再試行打ち切り、 dead-letter 相当の監査記録へ移行。監査記録は 30日保管。
