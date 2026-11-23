# cbbtc-bot-btc-race-24h-20261123-0511

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/velour-willow471/cbbtc-bot-btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/velour-willow471/cbbtc-bot-btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

Build a bot that trades Coinbase Wrapped BTC (cbBTC) on 1-minute on-chain prices with $1,000 of paper money, so nothing is traded for real, for the highest net PnL on the 24 hours that start 15 minutes after the deadline: entries close 6 hours after the opening, the bots that made money on the dev window race live over those 24 hours, and $50 goes to the 10 highest net PnLs, 1st place to the highest, $12 for 1st; the house bots race but never take a place.

## The bot

`main.ts` is a one-shot peak-trail rider: it buys the whole $1,000 stake at the first tradable bar, rides while closes keep making new highs, and steps aside for good the first time a close prints more than 2.5% below the running peak — then stays in cash. No re-entry, no intraday signals.

Why: one-minute cbBTC is mostly noise (~8 bps per bar), so short-cross rules whipsaw themselves to death on the dev window (an 8/21 EMA cross lost ~$115), while the dev window itself is a slow grind up (+3.6%) with a worst drawdown of only 2.06% — a 2.5% trailing stop never fires there, so this bot scores exactly what buy-and-hold scores (+$32.17, 1 trade, 1.98% max drawdown), comfortably clearing the dev gate. On synthetic stress windows (dev mirrored/reversed, plus Monte Carlo days at +3.6% / +1.5% / 0% / -1.5% / -3.6% drift) the stop caps losses at about -$30 where buy-and-hold falls to -$133, and re-entering after a stop-out was tested and dropped — on falling days it buys the bounce and gets stopped out again.

All decisions are integer math on raw price units, and the bot is fully deterministic: same bars in, same orders out.

## Run it

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1` on stdin/stdout (newline-delimited JSON): it reads the harness's `hello` and one `batch` per minute and answers each batch with exactly one `reply` echoing its `seq`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=caarkdy3&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
