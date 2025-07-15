# Execution Routing Lab

[Live demo](https://alexsergeev1.github.io/execution-routing-lab/)

Route a buy order under venue capacity, spreads, nonlinear market impact and inventory risk. Compare adaptive execution, TWAP and forecast-volume VWAP across 64 paired synthetic sessions.

Dynamic programming schedules order lots over time. A second discrete optimization splits each slice across two venues. Realized prices determine arrival-price shortfall and residual shares incur a closing sweep penalty. All strategies use the same within-slot router.

```sh
node --test
node serve.mjs
```

Open http://localhost:8080. Scenario and benchmark tables export to CSV. The simulator uses synthetic liquidity and prices.
