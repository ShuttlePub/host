---
# Optional semantic facets (G529) — closed set, one line each:
#   vocabulary            — event/command vocabulary: what counts as a fact
#   invariant              — invariants and consistency boundaries
#   decider                — decider judgments: what a command decides
#   acceptance-property    — what must not break
# Uncomment and edit to annotate this node, e.g.:
# facets: [vocabulary]
---

# Draft intent — shuttlepub / session discord-feature-intake-2026-10-15

> Compiled from accepted interview answers. Operator must accept this draft before any source-of-truth mutation.

## Accepted baseline

### source-feature-ideas — Discord threadから共有されたプロジェクトの機能案と背景を、方式仮説・追記・参照URLを含めて記録する。今回は意図の整理とpacket候補化を依頼されており、実装仕様の確定やissue公開は含まない。

2026-10-15にユーザーがこのチャットへ貼ったDiscord thread由来テキスト。元スレッドURL・発言者・投稿日時は未提供。原文中の相対的な「最近」等は現在情報とみなさない。

## S01

引用リツイートに引用された側からはただのリツイートに見えるようにする機能 人が何かのリツイートに対して独り言をつぶやきたい時に、フォローしてる人が何のツイートに対してのものなのかを見やすくしたい 追記：misskeyみたく対象の投稿の時系列的前後の投稿を取得できるようにすれば解決するかも [https://misskey.io/notes/9gyulk4ywy](https://misskey.io/notes/9gyulk4ywy "https://misskey.io/notes/9gyulk4ywy") 他にもリンクを貼ったときに引用にしないという方法もあり&#x20;

## S02

添付画像に関して他者からの利用範囲を指定できる機能\
デフォルトはCC BY NDとかで

## S03

1アクションで、予め設定しておいた絵文字でのリアクションが出来るオプション/ボタン?\
Misskeyのような絵文字によるリアクションが実装されている場合において、わざわざ絵文字を選択する工程を挟みたくない場合がある(基本的には同じリアクションしかしない場合等、TwitterやMastodonのfavのように簡単に押したい人は居る)

## S04

検索時に特定ユーザーに絞れる機能(対象は1ユーザーだけでも無いより良い) Misskey、標準だと検索機能がかなり弱いイメージがあるので… DBの構造とかに依存してそうではありますが、対象は最悪1ユーザーだけでも良いので絞れると嬉しいなと  追記: 1ユーザーに絞る機能がMisskeyに付いた ローカル限定検索も追加された 何だったか忘れましたが何かの条件付き検索はDBの都合で厳しいとissueに書いてるのがありましたね&#x20;

## S05

閲覧履歴\
一度開いた投稿を後から見直せる。日付での絞り込みやキーワード、投稿者、メディアタイプなどで検索できるとなおよし

## S06

外部サーバーとの連携機能 自鯖から他鯖のユーザーを見た時、過去の投稿やフォロー/フォロワーの詳細が正しく表示されず、やむなくその鯖のページに行くことになるが、そこで見付けた人や投稿を、自分のアカウントからフォローしたりスター付けたりがめちゃくちゃやりにくい←Twitterから移行した初期はマジでげんなりした ので、ここをどうにか頑張りたい 手法(想定)&#x20;

- ShuttlePub以外の外部サーバー サーバーorクライアント側でなんとかして自鯖から離れることなく他サーバーの情報を正しく表示し、直接フォローできるようにする(実現可能かは不明。mastodon/misskeyなどそれぞれに対応したAPIを直接叩いたり、最悪スクレイピングなどで個別対応せざるを得ない気がする)
- ShuttlePub同士 サーバー側で相互に通信する

追記：Mastodonでは普通に`users/{userid}/following.json?page=INTEGER`で、misskeyでは`users/{misskey:id}/following?page=true&coursor={id}`で対象ユーザーのフォローしているユーザーを取得できる。この雰囲気では現行サービスの~~怠惰~~データ量とかの削減な感じがする&#x20;

## S07

投稿内容の編集機能 Mastodonなどでも存在している機能。Misskeyにも最近実装された(ものの、AP互換ではないみたい) AP互換性を持たせながら実装する場合、他インスタンスの編集履歴を持つべきかとか、そういう話はここの意見が参考になりそう [https://github.com/misskey-dev/misskey/issues/8364#issuecomment-1398634301](https://github.com/misskey-dev/misskey/issues/8364#issuecomment-1398634301 "https://github.com/misskey-dev/misskey/issues/8364#issuecomment-1398634301") でも編集後のノートの扱いに関しては色々と大変かも [https://github.com/misskey-dev/misskey/issues/8362#issuecomment-1745946421](https://github.com/misskey-dev/misskey/issues/8362#issuecomment-1745946421 "https://github.com/misskey-dev/misskey/issues/8362#issuecomment-1745946421")&#x20;

## S08

ユーザーのドメインブロック/ミュート機能 オーナーサイドのドメインブロックは本当に悪意のある鯖から自分の鯖を守るためだけに使い、思想の相異などで不快に感じる投稿が多いサーバーとかからの内容は各自勝手に自衛できるようにしたい ブロック情報の保持はEmumet側、投稿のフィルタリングはShuttlePub側になりそう&#x20;

## S09

他鯖のカスタム絵文字リアクションへの便乗\
akkoma系は可能らしい

## S10

NSFW系の話題を見掛けたので… Misskeyにはこの辺り( [https://github.com/niri-la/misskey.niri.la/issues/125](https://github.com/niri-la/misskey.niri.la/issues/125 "https://github.com/niri-la/misskey.niri.la/issues/125") )が該当するんですが、閲覧注意かそうでないかの2択しかないと渋いので、種類別でフィルタリングしたい感じになっています。 あと、ローカルでは後から変更出来るのに連合では反映されなかったりが渋すぎています: [https://misskey.niri.la/notes/9gyjhd6y6k](https://misskey.niri.la/notes/9gyjhd6y6k "https://misskey.niri.la/notes/9gyjhd6y6k")

## S11

画像のタグ付け 画像に任意のタグを複数個つけられるようにする。既存のタグから補完が効く仕組みがあるとよい タグにはノーマルタグとセンシティブタグが存在する。外部鯖にはノーマルタグは無視されるが、センシティブタグの場合はCWにタグ名が記載される&#x20;

## S12

投稿内容に合わせて、メッセージやリンクの表示および投稿自体のキャンセルを行わせる\
検索についても同様の措置が取れるようにする\
自殺関連の投稿に支援先を表示したり、パパ活などの違法な行為に関する投稿の検索を阻害する、震災時の情報のミスリードを防ぐなど様々な活用が可能なはず

## S13

投稿に関して反応可能Allowリストみたいなやつ 投稿内容に関係あるものしか反応できないようにするやつ&#x20;

Xが微妙に引用ポストでは反応できるみたいなやつがあるので全部フィルターできるのもあってもいいのかなと&#x20;

逆にAllowリストが効く範囲をかえれてもいい 例えば投稿に対して絵文字みたいなやつで反応できる機能だけ誰でもできるようにするとか むしろ、リポストといいねしかできないとか allowリストの数はある程度制限(3\~5ぐらい？) それ以上欲しい場合は月額課金or公式特別認定されたものだけみたいな(この機能は個人というより重要情報発信垢や企業公式垢向け機能がいいかなと)&#x20;

## S14

投稿データに投稿元のIPをハッシュ化したものを連合データに載せる。\
用途としては悪質なユーザーの情報を公開した際に、IPが本当にそのユーザーのものであるかを外部の人間が検証するために使うなどの、サーバーの垣根を超えたモデレーションを行うためのもの\
アルゴリズムはBLAKE3が良いかもしれない?

## S15

管理者向けに新規登録の一般開放に一定の条件を設ける\
スパムBOTなどの踏み台にされることを防ぐため、メール認証やcapchaなどの設定が完了していない限り新規登録を有効化できないようにする

## S16

タグの通報機能\
複数鯖による荒らしなどで使用されているタグを通報可能にし、自動or手動でトレンドから下げるようにできる

## S17

リノート時の元投稿のデータ検証 リノート時に対象のノートの署名情報を載せるなりして、リノートしたユーザーが見た投稿と、リノートされた今見えてる投稿が異なるものでないか検証する&#x20;

Context [https://fedibird.com/@noellabo/112635153227115367](https://fedibird.com/@noellabo/112635153227115367 "https://fedibird.com/@noellabo/112635153227115367")


## Open questions

- none

## Candidate execution units

- TODO — operator decides whether to promote this draft into a published child issue.
