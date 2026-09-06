# drive-foundation-followups Implementation Packet

## Goal

drive-foundation (PR #2) のレビューで検出された nit 級指摘 8 件を集約して是正する。機能阻害なしの指摘群だが、バリデーション追加・競合安全化・キャッシュ導入・仕様文書化を 1 実行単位でまとめて着地させる。

## Why

- PR #2 レビューで機能に阻害はないと判断され手動 issue (#3) に退避されていたが、packet 化されていないため automation の対象にならず滞留していた。intent-cli ワークフローに載せて回収する。
- 競合での 500 (upsert_rule / ensure_owned_folder) は利用が増えたとき最初に表面化する欠陥系で、初期利用者フェーズの前に潰しておきたい。
- 課金解決の per-request クエリと `/public/{key}` 無制限は将来の負荷面リスク。キャッシュと緩い制限で初動の形を固める。

## Scope

各項目は元 issue #3 の指摘に対応する。実施前に対象コードで現在の挙動を確認し、指摘が最新コードでも依然として成立することを確かめること (PR マージ後の変更で既に解消・変質している可能性がある)。

- **バリデーション**: アップロード時のファイル名 (UploadQuery.name) にフォルダ名と同等の長さ検証 (255 字上限・空拒否など) を追加。検証規約はフォルダ名の実装と共有/揃える
- **ボディサイズ制御の整理**: files.rs の `DefaultBodyLimit::max(...)` レイヤが Body 直接抽出ハンドラでは実質 no-op (実強制は CountingBody) という誤解を招く構造を整理する。no-op レイヤを撤去するか、CountingBody ベースに一本化するかを決めて反映。超過時の応答 (413 等) を結合テストで固定
- **課金解決キャッシュ**: 全認証リクエストで DB 2-3 クエリ (global rules + owner rules + plan) が走る現状に、in-memory TTL キャッシュ + 管理者書き込み時 (rule upsert / plan 変更) の即時無効化を導入。分散共有キャッシュ (Redis 等) は導入しない
- **RateLimiters の整理**: プロセス内メモリ (複数レプリカ非共有) である制約をドキュメントに明記。rpm 変更で limiter 再生成 → burst リセットの挙動を確認し、in-place 更新に改めるか、意図的制約として明記するかを決定して反映
- **upsert_rule の原子化**: 2 段 upsert を単一文 (INSERT ... ON CONFLICT 等) にし、同時 INSERT 競合で unique violation による 500 を返さない
- **ensure_owned_folder の原子化**: 事前チェック + INSERT を原子化 (ON CONFLICT DO NOTHING + 再 SELECT 等) し、同時フォルダ生成競合で FK 違反の 500 を返さず、既存フォルダ再利用または 404/409 で返す
- **/public/{key} の仕様整備**: 無認証・帯域計量が初動外であることをドキュメント化。DoS 緩和として per-IP の緩いレート制限 (規定値を本文書で明記。例 300 req/min) を付与
- **immutable キャッシュの仕様文書化**: unpublish/削除後もブラウザ/CDN キャッシュが残り得ること (外部キャッシュの即時失効は保証しない) を、レスポンスヘッダ方針と併せて文書化

## Out of scope

- 分散共有キャッシュ・レート制限 (Redis 等のインフラ追加)。複数レプリカ展開自体も範囲外
- 課金ポリシーの規定値変更・新しい計量軸 (帯域計量など) の実装
- 公開範囲の仕様変更 (2 値公開制御の見直し)、Misskey Drive API 互換
- 上記 8 件以外の新規リファクタ。是正対象外の箇所で気付いた問題は別 packet を切る
- Web UI (shuttlepub-frontends) 側の変更

## Verification

1. 既存テストが通ること (リグレッションなし)
2. 追加テスト:
   - ファイル名検証の同値テスト (255 字境界、空、超過)
   - 課金解決: キャッシュヒット時に rules/plan クエリが発行されないこと、管理者書き込み後に即時反映されること
   - upsert_rule 同時競合テスト (unique violation 500 を返さない)
   - ensure_owned_folder 同時生成テスト (FK 違反 500 を返さない)
   - `/public/{key}` の per-IP レート制限が規定値で効くこと
3. ボディサイズ超過時応答の結合テスト (整理後の経路で固定)
4. `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/booskiff/intent-tree/00-map.md` (既存枠組み内の品質是正、新規ノードなし)
- ADR candidate: なし (公開仕様の文書化は Booskiff リポジトリ内 docs に記録)
- Diagram candidate: なし
- Docs update: Booskiff リポジトリ内の運用/仕様ドキュメントに 3 点 (/public 無認証、immutable キャッシュ非失効、RateLimiters レプリカ非共有) を記録する
- Closeout learning: DefaultBodyLimit の実効性確認など、是正時に得た確認知見があれば `intents/booskiff/technology/overview.md` に追記検討 (必須ではない)

- Guide reachability (G645): implementation-loop ガイド → implementation ロール → ShuttlePub/Booskiff (core/)

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
