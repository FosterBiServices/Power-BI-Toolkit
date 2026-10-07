/* ---------- KPI Visualizer: example KPIs (generic sales data) ---------- */
const KV_EX_KPIS = [
  { label: 'Sales', measure: 'Total Sales', format: '\\$#,0', better: 'higher', target: 'Sales Target', compare: 'Sales LY', compareLabel: 'last year',
    pv: { value: '1,240,000', target: '1,200,000', compare: '1,150,000', trend: '940000 980000 1010000 1050000 1030000 1090000 1120000 1100000 1160000 1190000 1210000 1240000' } },
  { label: 'Gross Margin %', measure: 'Gross Margin %', format: '0.0%', better: 'higher', target: '38%', compare: 'Gross Margin % LY', compareLabel: 'last year',
    pv: { value: '36.1%', target: '', compare: '35.2%', trend: '34.8% 35.1% 35.6% 35.0% 35.4% 35.9% 36.3% 35.8% 36.0% 36.4% 36.2% 36.1%' } },
  { label: 'Return Rate', measure: 'Return Rate', format: '0.0%', better: 'lower', target: '4%', compare: '', compareLabel: 'last year',
    pv: { value: '4.6%', target: '', compare: '', trend: '3.8% 3.9% 4.1% 3.7% 4.0% 4.2% 4.3% 4.1% 4.4% 4.5% 4.4% 4.6%' } },
  { label: 'Orders', measure: 'Order Count', format: '#,0', better: 'higher', intent: 'context', target: '', compare: 'Orders LY', compareLabel: 'same month last year',
    ctx: [{ kind: 'per', ref: "'Customer'[Customer Key]", fmt: '#,0.0', before: '', after: ' orders per customer', pv: '' }, { kind: 'asof', ref: "'Date'[Date]", fmt: '', before: 'As of ', after: '', pv: '' }],
    pv: { value: '1,610', target: '', compare: '1,540', trend: '1420 1390 1510 1480 1550 1530 1600 1580 1490 1620 1640 1610' } }
];
const KV_EX_CFG = { table: '_Measures', trendCol: "'Date'[Month Start]" };
