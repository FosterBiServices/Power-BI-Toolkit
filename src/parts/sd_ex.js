/* ---------- Sample Data Maker: the example files (made-up customers, orders and products) ---------- */
function sdExample(){
  const first = ['Jordan', 'Avery', 'Riley', 'Morgan', 'Casey', 'Taylor', 'Quinn', 'Rowan', 'Skyler', 'Parker', 'Reese', 'Emerson'];
  const last = ['Blake', 'Carter', 'Dalton', 'Ellison', 'Fletcher', 'Hale', 'Irwin', 'Keller', 'Lowell', 'Merritt'];
  const cities = ['Northbridge', 'Eastfield', 'Westbrook', 'Southport', 'Midvale'];
  const segs = ['Consumer', 'Consumer', 'Small Business', 'Corporate'];
  const products = [['P-201', 'Desk Lamp', 'Home', 39.5], ['P-202', 'Travel Mug', 'Home', 14.25], ['P-203', 'Trail Backpack', 'Outdoor', 89], ['P-204', 'Rain Jacket', 'Apparel', 120], ['P-205', 'Wireless Mouse', 'Electronics', 24.99], ['P-206', 'Camp Stove', 'Outdoor', 64.5], ['P-207', 'Wool Socks', 'Apparel', 12], ['P-208', 'Phone Charger', 'Electronics', 19.99]];
  const t = v => ({ k: 'text', v }), n = (v, z) => ({ k: 'num', v, z }), d = (y, m, dd) => ({ k: 'date', v: SD.serial(y, m, dd), z: 'yyyy-mm-dd' });
  const r = SDM.rng('example');
  const customers = [];
  for (let i = 0; i < 24; i++) {
    const f = first[i % first.length], l = last[(i * 7) % last.length];
    customers.push([t('C-' + (1001 + i)), t(f + ' ' + l), t(f.toLowerCase() + '.' + l.toLowerCase() + '@mail.test'), t(cities[i % 5]), t(segs[i % 4]), d(2022, 1 + (i % 12), 1 + ((i * 5) % 27))]);
  }
  const orders = [];
  for (let i = 0; i < 60; i++) {
    const c = customers[Math.floor(r() * customers.length)], p = products[Math.floor(r() * products.length)], q = 1 + Math.floor(r() * 4);
    orders.push([n(50001 + i, '0'), t(c[0].v), t(p[0]), d(2024, 1 + Math.floor(i / 5), 1 + Math.floor(r() * 27)), n(q, '0'), n(Math.round(q * p[3] * 100) / 100, '#,##0.00')]);
  }
  return [
    { id: 'ex1', file: 'Sales example.xlsx', sheet: 'Customers', csv: false, headers: ['Customer ID', 'Customer Name', 'Email', 'City', 'Segment', 'Signup Date'], rows: customers },
    { id: 'ex2', file: 'Sales example.xlsx', sheet: 'Orders', csv: false, headers: ['Order ID', 'Customer ID', 'Product Code', 'Order Date', 'Quantity', 'Sales Amount'], rows: orders },
    { id: 'ex3', file: 'Products example.csv', sheet: 'Products example', csv: true, headers: ['Product Code', 'Product', 'Category', 'Unit Price'], rows: products.map(p => [t(p[0]), t(p[1]), t(p[2]), n(p[3])]) }
  ];
}
