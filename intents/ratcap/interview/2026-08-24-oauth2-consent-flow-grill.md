# Interview: oauth2-consent-flow grill (2026-08-24)

chat-first grill セッションで記録。CLI セッション記録:
`intents/ratcap/interviews/oauth2-consent-flow.json` (Q1-Q2)。

契機: `isbot-at-creation` の完了記録 (2026-08-24 grill) に続き、ratcap backlog の
新 Ready 先頭 `oauth2-consent-flow` を grill。

## 調査で解決済みと判明した問 (再質問せず)

- 旧 Q2 (challenge の到達経路): D2/D6 + Emumet 実装調査で解決。Emumet の
  `GET /oauth2/consent` は challenge ベース非認証 API として実装済みで、
  非 skip クライアントには `ShowConsent { consent_challenge, client_name,
  requested_scope }` を JSON 返却、skip 時は 302。Hydra → ブラウザ → Ratcap
  `/oauth2/consent` → Ratcap が Emumet を呼ぶ直列で成立。
- 旧 Q4 (拒否時遷移): D3 再確認。追加誘導なし。`accept: false` の 302
  (`error=access_denied` 付きクライアント redirect_uri) に従う。OAuth2 標準。
- 旧 Q5 (未ログイン時): D10 として確定。同意ページは `ratcap_session` を要求しない
  (challenge のみで動作・Hydra ログイン完了後にのみ到達)。challenge 不正時は
  エラーページ表示で終了、ログイン誘導なし。

## Q1: 同意ページの実装形式は?

**Answer**: A. BFF (`index.ts`) が素の HTML を返す standalone ページ。
`/auth/*` ハンドラと同じ層で完結させ、Flame SSR/hydration は通さない。
GET でフォーム描画・POST で Emumet `POST /oauth2/consent` へ中継して 302 を返す。
第三者クライアントのダンス中に開かれる一度きりのフォームなので SPA ライフサイクルは
不要。既存 CSS を読んで見た目は統一する。

→ D8 として decisions.md に記録。変更は `index.ts` (+ BFF テスト) に閉じる。

## Q2: 要求スコープの表示方法は?

**Answer**: 日本語プライマリのラベルマップとし、複数言語対応(i18n)を意識した構造にする。
英語でも出せるようにする。言語はブラウザの `Accept-Language` ヘッダからサーバーサイドで
判定する (BFF の素 HTML ページのため直接読める)。未知スコープは生名フォールバック。
既存 UI が英語なのは日本語化するまでもない名称ばかりだっただけで、日本語化の方針を
否定するものではない。

→ D9 として decisions.md に記録。

## 後処理 (intent-update + packet-ready)

- `features/oauth2-consent/decisions.md`: D8 (BFF 素 HTML ページ) / D9 (ja-primary i18n) /
  D10 (ratcap_session 不要求) を追加
- `features/oauth2-consent/open-questions.md`: Q2-Q6 全件クローズ
- `features/oauth2-consent/requirements.md`: FR2/FR7/FR8 更新、FR9 (BFF 素 HTML) /
  FR10 (i18n) 追加、NFR2 更新
- `features/oauth2-consent/acceptance.md`: AC1 チェック (D8 で解決)、AC3 更新 +
  AC3a (i18n) / AC3b (session 不要) 追加
- packet-ready 判定: スコープ・制約・受入条件・検証が揃ったため
  `intent-cli packet draft --execution-unit oauth2-consent-flow` を実施 (オペレーター承認済み)
