function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export const LOT = 100;
export const SLOTS = 12;
const profile = slot => 1 + 1.2 * ((slot - 5.5) / 5.5) ** 2;

function forecast(slot, regime) {
  const scale = regime === 'thin' ? 0.65 : 1;
  const rate = regime === 'thin' ? 1.8 : 1;
  return {
    slot, mid: 0,
    a: Math.round(18 * scale * profile(slot)),
    b: Math.round(12 * scale * profile(slot)),
    spreadA: 0.7 * rate, spreadB: 1.6 * rate,
  };
}

export function market(seed, regime) {
  const random = rng(seed);
  let mid = 0;
  return Array.from({ length: SLOTS }, (_, slot) => {
    const expected = forecast(slot, regime);
    mid += (random() - 0.48) * (regime === 'volatile' ? 15 : 6);
    return { ...expected, mid,
      a: Math.max(1, Math.round(expected.a * (0.60 + random() * 0.85))),
      b: Math.max(1, Math.round(expected.b * (0.55 + random() * 0.90))),
      spreadA: expected.spreadA * (0.8 + random() * 0.55),
      spreadB: expected.spreadB * (0.8 + random() * 0.75) };
  });
}

export function routes(row) {
  const available = row.a + row.b;
  return Array.from({ length: available + 1 }, (_, lots) => {
    let best = { a: 0, b: 0, friction: Infinity };
    for (let a = Math.max(0, lots - row.b); a <= Math.min(lots, row.a); a++) {
      const b = lots - a;
      const friction = a * (row.spreadA + 5.5 * a / row.a) + b * (row.spreadB + 2.4 * b / row.b);
      if (friction < best.friction) best = { a, b, friction };
    }
    return best;
  });
}

export function optimize(rows, order, risk) {
  let future = new Float64Array(order + 1);
  future.fill(Infinity, 1);
  const policy = [];
  for (let t = rows.length - 1; t >= 0; t--) {
    const options = routes(rows[t]);
    const value = new Float64Array(order + 1).fill(Infinity);
    const choices = new Int16Array(order + 1);
    for (let remaining = 0; remaining <= order; remaining++) {
      for (let lots = 0; lots <= Math.min(remaining, options.length - 1); lots++) {
        const left = remaining - lots;
        const cost = options[lots].friction + risk * left * left / Math.max(1, order) + future[left];
        if (cost < value[remaining]) {
          value[remaining] = cost;
          choices[remaining] = lots;
        }
      }
    }
    policy[t] = choices;
    future = value;
  }
  return { policy, value: future };
}

export function execute(rows, config, strategy) {
  let remaining = config.order;
  const totalVolume = rows.reduce((sum, _, t) => {
    const expected = forecast(t, config.regime);
    return sum + expected.a + expected.b;
  }, 0);
  let cumulativeVolume = 0;
  const records = rows.map((row, t) => {
    const expected = forecast(t, config.regime);
    cumulativeVolume += expected.a + expected.b;
    const options = routes(row);
    const future = Array.from({ length: rows.length - t - 1 }, (_, j) => forecast(t + j + 1, config.regime));
    let target;
    if (strategy === 'adaptive') {
      const plan = optimize([row, ...future], remaining, config.risk);
      target = Number.isFinite(plan.value[remaining]) ? plan.policy[0][remaining] : options.length - 1;
    } else {
      const fraction = strategy === 'vwap' ? cumulativeVolume / totalVolume : (t + 1) / rows.length;
      target = Math.round(config.order * fraction) - (config.order - remaining);
    }
    const lots = Math.min(remaining, options.length - 1, Math.max(0, target));
    const route = options[lots];
    remaining -= lots;
    const sweep = t === rows.length - 1 ? remaining : 0;
    const cost = route.friction + row.mid * (lots + sweep) + sweep * (18 + 0.35 * sweep);
    remaining -= sweep;
    return { ...row, capacityA: row.a, capacityB: row.b, ...route, lots, sweep, remaining, cost };
  });
  const bps = records.reduce((sum, row) => sum + row.cost, 0) / config.order;
  return { records, bps, dollars: bps * config.order * LOT * 100 / 10000 };
}

export function benchmark(seed, config, count = 64) {
  return Array.from({ length: count }, (_, index) => {
    const rows = market(seed + index * 7919, config.regime);
    return Object.fromEntries(['adaptive', 'twap', 'vwap']
      .map(strategy => [strategy, execute(rows, config, strategy).bps]));
  });
}
