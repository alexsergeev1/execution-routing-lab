import { market, execute, benchmark, LOT } from './model.mjs';
import { mount, number, money } from './ui.mjs';

mount({
  slug:'execution-routing', market, simulate:execute, benchmark,
  strategies:[['adaptive','Adaptive router'],['twap','TWAP'],['vwap','VWAP']],
  highIsGood:false, measure:value=>number(value,2)+' bp', x:{name:'Trading interval',start:1},
  axes:{routing:'Shares filled',inventory:'Shares remaining',market:'Mid move (bp)'},
  config:form=>({regime:form.get('regime'),seed:Number(form.get('seed')),
    order:Number(form.get('shares'))/LOT,risk:Number(form.get('risk'))}),
  metrics:(selected,all)=>[
    ['Implementation shortfall',number(selected.bps,2)+' bp'],
    ['Cost vs arrival',money(selected.dollars)],
    ['Savings vs TWAP',number(all.twap.bps-selected.bps,2)+' bp'],
  ],
  series:(selected,view)=>{
    const rows=selected.records;
    if(view==='inventory') return [{name:'Remaining shares',values:rows.map(row=>row.remaining*LOT)}];
    if(view==='market') return [{name:'Mid vs arrival',values:rows.map(row=>row.mid)}];
    return [{name:'Venue A',values:rows.map(row=>row.a*LOT)},{name:'Venue B',values:rows.map(row=>row.b*LOT)}];
  },
  headings:['Interval','Mid bp','A fill / limit','B fill / limit','Sweep','Remaining','Cost bp × lots'],
  table:selected=>selected.records.map(row=>[row.slot+1,number(row.mid,2),
    row.a*LOT+' / '+row.capacityA*LOT,row.b*LOT+' / '+row.capacityB*LOT,
    row.sweep*LOT,row.remaining*LOT,number(row.cost,2)]),
});
