# Review Context: di-cleanup-adapter-removal

## レビュー観点

- facade の遮断が本当にコンパイル時に効くか: facade 型が DependOn* を実装して
  いないこと、route ハンドラが facade 経由でのみ依存を取得していること
- processor 解体で調停ロジック (CommandEnvelope 構築 + 同期 read model 書込みの
  順序) が use case に正しく移管されているか (Stage 7 の教訓: 同期書込みを落とすと
  跨リクエストの read-after-write が projector に race する)
- マクロ拡張が既存の4使用箇所 (handler.rs, projection/tests.rs ×3,
  characterization_tests.rs) と整合するか
- rename commit が純粋 rename として分離されているか (挙動変更混入なし)
- HTTP/OpenAPI 表面が不変か (utoipa 定義、e2e green)

## 過去 stage のレビュー指摘パターン (再発防止)

- Stage 6: ドキュメント記述とコードの乖離、migration の NOT NULL 制約漏れ
- Stage 7: コマンドパス同期書込みの削除 (race)、projector の窓外 fold 欠落、
  削除済み集約の NotFound セマンティクス、cross-projector 相互作用
