/* ---------- Chart Patterns: example numbers for the previews (generic sales data) ---------- */
const CP_EX_CATS = [['Bikes', 4210000], ['Helmets', 2870000], ['Gloves', 1940000], ['Jerseys', 1420000], ['Bottles', 860000], ['Locks', 510000]];
const CP_EX_ITEMS = [['Contoso Retail', 912000], ['Fabrikam Stores', 845000], ['Northwind Shop', 790000], ['Adventure Sports', 702000], ['Litware Outdoor', 655000], ['Proseware Cycles', 590000],
  ['Tailspin Bikes', 541000], ['Wingtip Goods', 498000], ['Alpine Ski House', 433000], ['Coho Sports', 380000], ['Fourth Coffee Co', 322000], ['Lucerne Trading', 260000]];
const CP_EX_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  .map((m, i) => [m, Math.round(310000 + i * 9000 + Math.sin(i / 1.7) * 42000 + (i >= 9 && i <= 13 ? 60000 : 0))]);
