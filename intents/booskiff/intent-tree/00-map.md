# Intent Map

- Domain: `booskiff`
- Target repo: `ShuttlePub/Booskiff`
- Initial map: **確定 2026-08-29** (grill Q1-Q15、記録: `interviews/booskiff.json`)

## ドメイン形状 (初動確定)

Booskiff は「ShuttlePub サービス群のファイル保管サービス (Misskey Drive 的 UX)」。
所有者は Emumet Account、Profile (AP actor) は参照のみ (Booskiff に Profile 概念は持たない)。

```
identity/mission.md          使命・用語 (Account / Profile / Drive / 共有 / フォールバック S3)
product/overview.md          初動スコープ、機能境界、将来 slice の未決論点
technology/overview.md       stack、認証、転送、ストレージ、課金、配布の技術方針
decisions/                   2026-08-29 grill の決定一覧 (D1-D15)
features/                    emumet からの受け渡し要件・将来機能の未決メモ
clarifications/open.md       C1 (組織 Account 共有、emumet grill 経由で解消済み)
interviews/booskiff.json     初動 shaping の決定記録 (Q1-Q15)
```

## 初動実行単位 (packet-ready)

**`drive-foundation`**: core (Rust: 認証 + Drive CRUD + S3 基盤 + 課金ポリシー土台)
+ web (TanStack Start: ログイン + Drive 一覧/アップロード/削除)。
受け入れ基準・検証方法は decisions D14/D15、packet は `.intent-cli/issues/drive-foundation/`。

## 将来 slice (依存順の目安)

1. **共有 (輸送)**: リンク型 vs Account 指定型、外部公開の是非 (Q9 メモ)
2. **組織 Drive 詳細**: 組織 Account 所有の Drive・課金・容量の組織単位適用 (emumet C1 委譲)
3. **copy 系 API**: Profile 移管時のファイルコピー (emumet C1 委託)
4. **支払いプロバイダ具体実装**: Stripe 等 (抽象化+無効モードは初動済み)
5. **単体運用モードの認証**: Kratos 同居 or 簡易ローカル認証 (Q3 で後送り)

## ホストデータ

- キュー・packet: `.intent-cli/issues/`
- 自動化 bindings: `automation/bindings.md` (child_repo: ShuttlePub/Booskiff)