# oauth2-consent — design decisions

> See [overview.md](overview.md) for goals and [../../decisions/](../../decisions/) for cross-domain ADRs.

## Decisions

- D1: 同意 UI は Ratcap 内に standalone ページとして実装する方向を基本とする。
  - 理由：Ratcap は既に BFF (`index.ts`) と SSR (`Server.purs`) を持ち、認証関連の UI（login 等）を提供している。Emumet テンプレートに UI を置くと、フロントのスタイリング・メンテナンスが分断される。
  - 影響：新しいルート（例：`/oauth2/consent`）を `index.ts` に追加し、SSR またはフォーム送信を処理する。Flame 通常 SPA ページではなく、サーバーサイド生成の HTML またはミニマルなフォームページを使う。
- D2: `consent_challenge` は URL クエリパラメータで受け取り、POST 時に hidden フィールドまたは同じクエリパラメータで引き継ぐ。
  - 理由：Hydra の consent フローは challenge を URL クエリでやり取りするのが標準。Ratcap 側で独自にセッションに保存する必要はない。
  - 影響：HTML フォームアクションは `?consent_challenge=...` を含むか、フォーム内に hidden input を含める。
- D3: `POST /oauth2/consent` のレスポンスは 302 リダイレクトであり、サーバー側またはフォーム送信側でその `Location` をそのまま返す。
  - 理由： consent フローは Hydra が最終的なリダイレクト先を決定する。Ratcap 側で任意のリダイレクト先を解釈しない。
  - 影響：AJAX ではなく通常フォーム POST / サーバーサイドリダイレクトを使う方が実装が単純。
- D4: 認証状態は既存の `ratcap_session` cookie または Hydra 側のログインセッションから解決する。新しい独自セッション機構は作成しない。
  - 理由： consent フローはユーザーが既に Kratos/Hydra ログインを済ませた後に呼ばれる。Ratcap 側のセッションはそのまま利用可能。
- D5: mock 認証モードでは本機能は無効またはスキップする。
  - 理由： consent フローは real モードの Hydra/Kratos 連携でしか発生しない。mock 時はテスト対象外とする。
- D6: Hydra の consent URL を Ratcap 側に向ける設定変更を行う (2026-07-28 決定)。
  - 理由： D1 で Ratcap ホストが確定したため、Hydra が現在向けている Emumet `/oauth2/consent` から Ratcap の consent ページへリダイレクト先を変更する必要がある。
  - 影響： Hydra / デプロイ設定の変更を packet の成果物に含める。
- D7: 優先度を引き上げる (2026-08-11 オペレーター決定)。
  - 理由： ShuttlePub が Emumet をリソースサーバーとして利用する際、公式以外の外部 ShuttlePub ホストもサードパーティ OAuth2 クライアントとして登録・利用する見込み。外部クライアントに対しては consent の auto-skip は不適切で、明示的な同意画面が必須となる。
  - 影響： slice 順序で本 feature を前方に配置（`intents/ratcap/packets/backlog.md` 参照）。
- D8: 同意ページは BFF (`index.ts`) が素の HTML を返す standalone ページとする (2026-08-24 grill Q1)。
  - 理由： `/auth/*` ハンドラと同じ層で完結し、Flame SSR/hydration を通さない。第三者クライアントのダンス中に開かれる一度きりのフォームなので SPA ライフサイクルは不要。GET でフォーム描画・POST で Emumet `POST /oauth2/consent` へ中継して 302 を返す。見た目の統一は既存 CSS を読むことで担保する。
  - 影響： 変更は `index.ts` (+ BFF テスト) に閉じ、`Route.purs` / `Server.purs` / 型生成には触れない。D1 の「ミニマルなフォームページ」方針を確定させた。
- D9: スコープ表示は日本語プライマリのラベルマップとし、i18n 構造で英語も出力可能にする (2026-08-24 grill Q2)。
  - 理由： 既存 UI が英語なのは日本語化するまでもない名称ばかりだっただけで、日本語化方針を否定するものではない (オペレーター表明)。同意画面は第三者クライアント向けの「信頼の界面」であり生スコープ名の列挙は避ける。
  - 影響： 言語はブラウザの `Accept-Language` ヘッダからサーバーサイド判定 (BFF 素 HTML ページのため直接読める)。未知スコープは生名フォールバック。ラベル定義は言語追加しやすい構造 (言語コード → スコープ → ラベル) にする。
- D10: 同意ページは `ratcap_session` を要求しない (2026-08-24 grill で確認)。
  - 理由： Emumet の `GET/POST /oauth2/consent` は consent_challenge ベースの非認証 API で、同意画面は Hydra ログイン完了後にのみ到達する。第三者クライアント経由のユーザーは Ratcap セッションを持たない可能性がある。
  - 影響： D4 の「Hydra 側のログインセッションから解決」を具体化。challenge 欠落・不正時は Hydra 照会の失敗としてエラーページを表示する (Ratcap ログインへの誘導はしない)。
