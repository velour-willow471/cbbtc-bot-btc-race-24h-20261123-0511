// cbbtc peak-trail bot — a one-shot trend rider for the make.fun BTC race.
//
// The idea, in one sentence: buy the whole stake at the first tradable bar,
// ride the tape while it keeps making new highs, and step aside for good the
// first time a close prints more than 2.5% below the running peak.
//
// Why this shape, after testing on the frozen dev window (1,440 one-minute
// cbBTC bars, 2026-11-22 -> 2026-11-23):
//   * One-minute cbBTC is mostly noise (about 8 bps of stdev per bar), so any
//     rule that trades on short crosses whipsaws itself to death — an
//     8/21 EMA cross lost ~$115 on the dev window, and every faster variant
//     lost more. Each round trip costs ~26 bps in fee, slippage and pool
//     impact, so a trade has to catch a real move to pay for itself.
//   * The dev window itself is a slow grind up (+3.6% end to end) with a
//     worst peak-to-trough of only 2.06%. A 2.5% trailing stop never fires
//     there, so this bot scores exactly what buy-and-hold scores (+$32.17),
//     which clears the dev gate with margin.
//   * On synthetic stress windows (the dev window mirrored and reversed, and
//     150-path Monte Carlo days at +3.6% / +1.5% / 0% / -1.5% / -3.6% drift)
//     the stop caps the damage at about -$30 while buy-and-hold falls as far
//     as -$133, and the bot's mean across all five drift regimes is the best
//     of every shape I tested. Re-entering after a stop-out was tried and
//     dropped: on falling days it buys the bounce and gets stopped out again,
//     which gives back the whole insurance value.
//   * So the rule is deliberately boring: one entry, one exit, then cash.
//     No re-entry, no sizing games, no intraday signals.
//
// Execution notes:
//   * Everything is integer math on the raw price units (price_scale 5), so
//     there is no float drift and no rounding surprise: the exit test is
//     close * 10000 < peak * 9750, i.e. close more than 2.5% under the peak.
//   * The bot only ever holds one position and sends at most one order per
//     batch. Orders fill at the next bar's open; the peak is tracked on
//     closes, which is the only price the bot can see when it decides.
//   * A decision is only ever made on a bar this batch actually carried. A
//     minute the recorder missed leaves no bar, and the bot answers that
//     batch with no orders instead of re-deciding on a stale close.
//   * The ride is marked over only once an exit fill is confirmed in a
//     batch's fills. If an exit is rejected (a gap past max slippage, say),
//     the bot stays in the position and tries again on the next fresh bar
//     instead of stranding itself flat in name but long in fact.
//   * Fully deterministic: the orders are a pure function of the bars seen.
//     No clock, no environment, no randomness, no network.

import { runBars } from './vendor/makefun-bars.ts';

// The one asset this race trades.
const SYMBOL = 'CBBTC';
// How far a close may fall below the running peak before we exit, in bps.
const TRAIL_BPS = 250n;
// Headroom on each order for the fill to land above/below the latest close
// (slippage + pool impact + a one-minute gap). One-minute moves here are
// tens of bps at most, so 300 bps never binds in practice; it only guards
// against a freak gap.
const MAX_SLIP_BPS = 300;
const BPS = 10_000n;

// True once a close has printed more than TRAIL_BPS under the running peak.
function fellBelowTrail(close: bigint, peak: bigint): boolean {
  return close * BPS < peak * (BPS - TRAIL_BPS);
}

// Bookkeeping for the single ride: the highest close seen while holding, and
// whether the ride is over (set only on a confirmed exit fill; we never buy
// again after that).
let peakClose = 0n;
let rideOver = false;

await runBars({
  onBatch(state, batch) {
    // Confirm any exit fill first: only a filled sell ends the ride.
    for (const fill of batch.fills) {
      if (fill.symbol === SYMBOL && fill.side === 'sell' && fill.status === 'filled') {
        rideOver = true;
      }
    }
    // No trading while the harness is still warming up, and no decision on
    // a minute that printed no bar for our symbol.
    if (state.warmingUp) return [];
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    const close = BigInt(bar.c);
    const held = state.positions.get(SYMBOL);
    const qty = held === undefined ? 0n : held.qty;

    if (qty > 0n) {
      // Holding: raise the peak, and step aside once the close has fallen
      // more than TRAIL_BPS below it.
      if (close > peakClose) peakClose = close;
      if (fellBelowTrail(close, peakClose)) {
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIP_BPS }];
      }
      return [];
    }

    // Flat and the ride is not over: take the whole stake in one buy.
    if (!rideOver) {
      const room = state.weightRoom(SYMBOL);
      const notional = state.cash < room ? state.cash : room;
      const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
      if (notional >= minNotional) {
        peakClose = close;
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIP_BPS }];
      }
    }
    return [];
  },
});
