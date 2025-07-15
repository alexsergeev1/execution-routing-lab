import test from 'node:test';
import assert from 'node:assert/strict';
import { market, routes, optimize, execute, benchmark } from './model.mjs';

test('venue split minimizes convex friction over every feasible split', () => {
  const row = { a:4,b:3,spreadA:0.5,spreadB:1.5 };
  const options = routes(row);
  assert.equal(options.length, 8);
  for (let lots=0; lots<options.length; lots++) {
    const result = options[lots];
    assert.equal(result.a+result.b,lots);
    assert.ok(result.a<=row.a && result.b<=row.b);
    for (let a=Math.max(0,lots-row.b); a<=Math.min(lots,row.a); a++) {
      const b=lots-a;
      const friction=a*(row.spreadA+5.5*a/row.a)+b*(row.spreadB+2.4*b/row.b);
      assert.ok(result.friction<=friction+1e-9);
    }
  }
});

test('planning detects infeasible capacity and penalizes late inventory', () => {
  const slot={a:5,b:5,spreadA:1,spreadB:1};
  assert.equal(optimize([slot,slot],21,0).value[21],Infinity);
  assert.ok(optimize([slot,slot],10,4).policy[0][10] > optimize([slot,slot],10,0).policy[0][10]);
});

test('strategies fill all inventory and itemize closing sweeps on shared paths', () => {
  for (let seed=0;seed<20;seed++) {
    const config={order:480,risk:0.15,regime:'thin'};
    const rows=market(seed,config.regime);
    for (const strategy of ['adaptive','twap','vwap']) {
      const {records,bps,dollars}=execute(rows,config,strategy);
      assert.equal(records.at(-1).remaining,0);
      assert.equal(records.reduce((sum,row)=>sum+row.lots+row.sweep,0),config.order);
      assert.ok(records.at(-1).sweep>0);
      assert.ok(records.every(row=>row.a<=row.capacityA && row.b<=row.capacityB));
      assert.ok(Math.abs(dollars-bps*config.order)<1e-8);
    }
  }
});

test('adaptive routing only uses the current realized slot', () => {
  const config={order:180,risk:0.15,regime:'normal'};
  const rows=market(42,config.regime);
  const changed=rows.map((row,i)=>i<4 ? row : {...row,mid:100,a:1,b:1});
  assert.deepEqual(execute(rows,config,'adaptive').records.slice(0,4),
    execute(changed,config,'adaptive').records.slice(0,4));
  assert.deepEqual(benchmark(42,config,4),benchmark(42,config,4));
});
