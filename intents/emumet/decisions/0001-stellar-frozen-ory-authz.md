# 0001: Stellar 凍結と Ory への認証認可委譲

- Status: Accepted (2026-07-22 interview で確認)
- Deciders: operator

## Context

Stellar は認可サーバーになる予定だったサービスだが、構築が凍結された。
認証・認可基盤が別途必要だった。

## Decision

- 認証は Ory Kratos、OAuth2/OIDC 認可は Ory Hydra に委譲する
- Stellar の残責務のうち「利用する ShuttlePub サービスの保存」は Emumet が引き継ぐ
  (features/shuttlepub-link として再定義)
- Emumet は Hydra の Login/Consent Provider として振る舞う

## Consequences

- Keycloak から Ory への移行が完了し、JWT `sub`(Kratos identity UUID)が
  AuthAccount.client_id に対応する
- StellarAccount イベント定義(docs)は ShuttlePub 連携設定として再解釈される

## Amended 2026-11-18: Stellar を薄い認証サービスとして切り出す方向

shuttlepub domain の decisions/2026-11-18-p1-first-and-stellar-carve-out.md
(D36・D37・D38) による追記。

- 現行の Ory 構成 (Kratos / Hydra、Emumet が Login / Consent Provider) は、ShuttlePub との
  連携 (外部から届いた Activity を受信し、Profile のアタッチ先の ShuttlePub へ転送して
  保存する、ロードマップの P1) が通るまでそのまま使う。
- その後、Stellar を「凍結」から改め、Ory の上に載る薄い認証サービスとして切り出す。
  初期スコープの候補はログイン・同意のコールバックとクライアント登録 (DCR) の受付で、
  機能の追加は最小限にする。認可サーバーを自前で作る旧構想に戻すものではない。
- 今の実装では、ログイン・同意とクライアント登録 (DCR) の境界を分け、あとで Stellar へ
  移せるようにしておく。
- 未決: 切り出すタイミング (外部公開後に変えにくい契約と移行コストを見て決める)、
  Stellar を Emumet ごとに置くか共有するか、ログイン主体と Account の対応、
  client_id と ShuttlePub の origin の対応表 (shuttlepub D32) の担当、
  OpenID Federation の trust anchor。

## Links

- [shuttlepub decisions 2026-11-18 (D36-D41)](../../shuttlepub/decisions/2026-11-18-p1-first-and-stellar-carve-out.md)
- [features/shuttlepub-link](../features/shuttlepub-link/overview.md)
- [interview 2026-07-22](../interview/2026-07-22-initial-shaping.md)
