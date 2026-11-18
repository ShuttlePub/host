# 2026-11-18 P1 の連携を先に通し、その後 Stellar を切り出す (D36-D41)

2026-11-18 に operator と行った会議 (Excalidraw の Stellar パネル) で確定した決定。
[2026-11-18-service-concept-and-cross-service-p0.md](2026-11-18-service-concept-and-cross-service-p0.md)
の続きで、番号を引き継ぐ。

きっかけは operator の提起「Ory (認証・認可) を将来は Stellar に持たせ、Emumet は
それを利用する形にしたい」。Stellar の役割と、それを今のロードマップのどこで行うかを
話し合い、先に Emumet と ShuttlePub の連携を通すことにした。

## 決定

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D36 | 進める順序 | ShuttlePub を優先する。現行の Ory 構成 (Kratos / Hydra) のまま、外部の ActivityPub サーバーから届いた Activity を Emumet が受信し、Profile のアタッチ先の ShuttlePub へ転送し、ShuttlePub が重複を除いて保存するところまで (ロードマップの P1) を先に通す。Stellar の切り出しは、この連携が通った後に行う | 確定 |
| D37 | Stellar の位置付け | Stellar を、Ory の上に載る薄い認証サービスとして切り出す。初期スコープの候補はログイン・同意のコールバックとクライアント登録 (DCR) の受付で、機能の追加は最小限にする。emumet ADR 0001 の「Stellar は凍結」をこの方向に改める | 確定 |
| D38 | 切り出しに備えた今の実装 | 今の実装では、ログイン・同意 (現在は Emumet が Hydra の Login / Consent Provider を兼ねている) と、クライアント登録 (DCR) の境界を分け、あとで Stellar へ移せるようにしておく | 確定 |
| D39 | ShuttlePub の 2 つの受け口 | ShuttlePub は、連合先に公開するリレー用の inbox と、Emumet からの転送を受ける専用 API の両方を持つ。D30 の転送の受け口は後者 | 確定 |
| D40 | ShuttlePub のドメインと link の説明 | ShuttlePub のドメインが変わる場合は、新しいサーバーとして扱う。link の説明は当面「Profile のアタッチ先」(Profile がどの ShuttlePub サーバーにアタッチしているか) で揃える。別のサーバーを閲覧しても link は変わらない | 確定 |
| D41 | リリース前の QA | リリースの前に QA の工程を設け、適用対象の FEP との整合と、ほかの ActivityPub 実装との相互運用を確かめる | 確定 |

## 今回の決定に含めないもの (未決)

- **転送時の認証方式** (Emumet → ShuttlePub の転送リクエストをどう認証するか)。
  候補として「Emumet の鍵で転送リクエストに署名し、ShuttlePub が検証する」案が
  挙がっている。
- **Ory の停止中に保証する範囲**。受信・保存・キューでの再送・ShuttlePub への保存の
  どこまでを Ory の停止中も通すか、JWT / JWKS の扱いと耐える時間の具体策。
- **D32 の対応表の担当**。client_id と ShuttlePub の origin の対応を Emumet と
  Stellar のどちらが持つか。D32 の「Emumet が持つ」はこの決定で未決に戻す。
- Stellar を Emumet ごとに置くか共有するか、Stellar のログイン主体と Emumet の
  Account の対応、OpenID Federation の trust anchor。
- 外部公開・本番デプロイに対して Stellar を切り出すタイミング。外部公開後に変えにくい
  契約 (URL・issuer・subject・link の識別子など) と移行コストを確かめてから決める。

## 過去の決定との関係

- **D30** (内向き転送は専用 API): 維持。D39 で、その専用 API はリレー用 inbox とは
  別の受け口であることを明記した。転送時の認証方式は未決 (上記)。
- **D31** (ホーム / 参加の link と信頼モード): 維持。link の説明の言葉だけを D40 で
  「Profile のアタッチ先」に揃える。
- **D32** (サービス間認証は Hydra の間 DCR): DCR を使う方針は維持。対応表の担当は
  未決に戻した。将来 OpenID Federation に移る話は D37 の Stellar の範囲に含まれる。
- **D35** (連合 E2E とイメージ公開): 維持。D41 の QA は、連合 E2E とは別にリリース前の
  工程として置く。
- **emumet ADR 0001** (Stellar 凍結と Ory への委譲): 現行の Ory 構成は P1 の間そのまま
  使う。Stellar を「構築しない」から「薄い認証サービスとして切り出す」へ改め、
  ADR 0001 に追記した。
- **ロードマップ** ([../packets/roadmap-2026-11-18.md](../packets/roadmap-2026-11-18.md)):
  P1 の完了の目安と認証の項目を改め、P1 の後に Stellar の切り出し、本番デプロイの前に
  QA を加えた。
