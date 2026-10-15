# Discord機能案の受領・候補化の監査記録

## 対象と承認範囲

受領日2026-10-15。ユーザーから提供された17案を意図として整理し、対象repoを判断して
packet候補にする依頼に基づく。原文記録・要約・候補・関連domainの導線をhost mainへ保存。
方式の確定、実装、実行queueへの登録、issue公開、ラベル遷移は今回の範囲外。
hostのAGENTS.mdに従い、編集前に `git pull --ff-only` で最新化済み。

## 読み取りコマンド

手順はインストール済みCLIのhelpとguideを併用して確認した。

```text
intent-cli --help
intent-cli packet --help
intent-cli intent --help
intent-cli guide --help
intent-cli intent add-feature --help
intent-cli interview record-answer --help
intent-cli intent draft-from-interview --help
intent-cli intent lint-layout --help
intent-cli guide workflow task packet-draft --format json
intent-cli guide workflow task intent-interview --format json
intent-cli guide intent-work setup --kind intent-shape --domain shuttlepub --target-repo ShuttlePub/ShuttlePub --format json
intent-cli guide model --format json
intent-cli guide onboarding --format json
intent-cli guide commands list --format json
intent-cli automation summary --format json
intent-cli intent host-check
intent-cli intent status --domain shuttlepub --format json
intent-cli intent search --domain shuttlepub --query Note --format json
intent-cli intent search --domain emumet --query block --format json
intent-cli intent next-slice --dry-run --domain shuttlepub --target-repo ShuttlePub/ShuttlePub --format json
intent-cli guide intent-work audit --domain shuttlepub --target-repo ShuttlePub/ShuttlePub --format json
```

`intent search --domain shuttlepub --format json` はguideの例だけでは実行できず、
実装のusageに従って `--query Note` を補って再実行した。
`artifact-intake` はexternal issue/PR専用で、このテキスト受領には適用しなかった。
`intent status` はWIP/queuedなし、`next-slice --dry-run` は `design-needed`。
これらの結果を今回の候補のready判定には用いていない。

## 変更コマンドと生成物

原文の17ブロックに追跡ID S01–S17と受領情報を付け、以下で記録した。

```text
intent-cli interview record-answer --domain shuttlepub --session discord-feature-intake-2026-10-15 --question source-feature-ideas --prompt <受領目的と範囲> --from-file /tmp/shuttlepub-discord-source-2026-10-15.md --write --format json
intent-cli intent draft-from-interview --domain shuttlepub --session discord-feature-intake-2026-10-15 --write --format json
```

`--prompt` の実値は生成されたsession JSONの同名questionへ保存されている。
session pathがshuttlepub domain配下であることを確認した。

- [interview JSON](../interviews/discord-feature-intake-2026-10-15.json): 原文の正本。
- [CLI生成ドラフト](../drafts/discord-feature-intake-2026-10-15.md): 原文の閲覧用記録。

その他は文書として編集した。

- [social-experience](../product/social-experience.md): 17意図、方式案と確定設計の区別、調査根拠。
- [candidates](candidates.md): 17候補のrepo別分割・依存・受付条件・未決事項。
- [README](../README.md)、[map](../intent-tree/00-map.md)、[feature索引](../features/index.md): 発見用の導線。
- [Emumet block/mute](../../emumet/features/block-mute/overview.md)、
  [account-management](../../emumet/features/account-management/overview.md): 個人domain設定と登録防御の意図。
- [Emumet AP](../../emumet/features/ap-federation/packets.md)、
  [post-relay](../../emumet/features/post-relay/packets.md): 横断契約への候補リンク。
- [Booskiff metadata](../../booskiff/features/media-metadata.md)、
  [feature索引](../../booskiff/features/index.md)、[map](../../booskiff/intent-tree/00-map.md): file責務の仮配置。
- [frontend map](../../ratcap/intent-tree/00-map.md): target repoとdomainを分ける導線。
- 本監査文書。

## 調査とレビュー

plannerが既存意図・関連packetと分割案、explorerが子repoとShuttlePub GitHub mainを
読み取り調査した。workerが原文保全と候補文書を分担し、親が統合・検証する。
ShuttlePub観察commitは `7eea43d82d8945e05348794fa22c668fe90075d3`。
2026-08-29時点の観察を現在実装と混同せず、既存Note基盤を前提にした。
元テキストの外部URLについて、取得できなかった本文を推測で補完していない。

## 検証と残る質問

文書のためアプリのbuild/testは対象外。原文・意図・候補が17件ずつ対応し、
6参照URLと方式仮説が保持されていること、JSONのanswerと原文の完全一致を確認した。
変更16文書の相対リンク・anchor計93件、空白、`git diff --check` を検証済み。
独立レビューでも欠落・仮説の確定化・責務の衝突・完了packetの変更は見つからなかった。
`intent-cli intent lint-layout --domain <domain> --format json` を
shuttlepub/emumet/booskiff/ratcapに実行した。shuttlepubとbooskiffはclean。
全4domainでhas_errors=false。既存のEmumet org-accountsの相対リンク2件と、
ratcapの未作成category folder4件は今回の追加によるものではない。
既存問題を今回の候補の仕様へ混ぜない。

候補化を妨げる未回答はない。各候補の質問を実行packetへの昇格前に解く。
特にD01の作者側表示、D13のAllow対象、D14の証明対象、D15の登録権威は未決として残す。

## 実行を省いた操作と理由

- `packet draft` / claim取得: 実行単位を予約する段階ではなく、候補の方式・分割が未確定。
- `issue validate-body` / facet-check: 公開用4ファイルpacketを作成していないため対象なし。
  候補をissue-readyとは表現せず、facet dataや成功を捏造していない。
- `issue publish-flow` / `automation issue-publish`: 今回は候補の保存まで。公開issueなし。
- interview追加質問・clarification mutation: 候補作成に必須の質問はなく、未決は候補内に保持。
- child実装・ラベル変更・queue/runs編集・監視設定: 依頼範囲外。

この候補化作業では `intents/rules/**`、workflowを言い換えるlocal skill、
コピーされたworkflow promptを参照していない。`intent-cli run` / `dotnet run`、
CLIからのAI起動は行っていない。
