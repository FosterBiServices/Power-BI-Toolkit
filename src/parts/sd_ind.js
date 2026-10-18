/* ---------- Sample Data Maker: the industry data sets ----------
   Each industry is a model: tables (one DAX function each), relationships and starter measures.
   Sizes are the numbers the user can change; every table function also takes the seed. */
const SD_IND = (() => {
  const { P, C, R, lit, add, sub, mul, div, lt, le, gt, ge, eq, and, or, cat, int, round, min, max, pow, mod, sin, pi, iff, isblank, coalesce, date, year, month, quarter, weekday, eom, pad, fmtDate, at, pick, wpick, blank, nameIndex, firstOf, lastOf, company, days, PKG } = SD;
  const k = C('_k');
  const S = P('start_date'), E = P('end_date');
  const dateIn = (key, s, skew) => add(S, int(mul(skew === 1 ? R(key, s) : pow(R(key, s), skew), days())));
  const person = ix => cat(firstOf(ix), ' ', lastOf(ix));
  const REGIONS = ['North', 'South', 'East', 'West', 'Central'];
  const seedP = ['seed', 'INT64'];
  const n = name => [name, 'INT64'];
  const dts = [['start_date', 'DATETIME'], ['end_date', 'DATETIME']];
  const col = (nm, t, d, x) => Object.assign({ n: nm, t, d }, x || {});
  const key = (nm, d) => col(nm, 'int', d, { f: '0' });

  /* the date table, shared by every industry: whole years from the first to the last date */
  const dateTable = () => ({
    name: 'Date', fn: PKG + '.Dates', isDate: true, params: dts.slice(),
    desc: 'One row per day, in whole years from the start date to the end date. Marked as the date table.',
    stages: [{ calendar: [date(year(S), 1, 1), date(year(E), 12, 31)] }, { cols: [
      ['Year', year(C('Date'))], ['Quarter', cat('Q', quarter(C('Date')))], ['Month Number', month(C('Date'))], ['Month', fmtDate(C('Date'), 'mmm')],
      ['Month Year', fmtDate(C('Date'), 'mmm yyyy')], ['Month Year Sort', add(mul(year(C('Date')), 100), month(C('Date')))], ['Weekday', fmtDate(C('Date'), 'ddd')], ['Weekday Number', weekday(C('Date'))]] }],
    meta: [col('Date', 'date', 'The day.', { key: true }), col('Year', 'int', 'Calendar year.', { f: '0' }), col('Quarter', 'text', 'Calendar quarter, Q1 to Q4.'),
      col('Month Number', 'int', 'Month of the year, 1 to 12.', { f: '0', h: true }), col('Month', 'text', 'Short month name.', { s: 'Month Number' }),
      col('Month Year', 'text', 'Month and year, such as Jan 2025.', { s: 'Month Year Sort' }), col('Month Year Sort', 'int', 'Sorts Month Year in date order.', { f: '0', h: true }),
      col('Weekday', 'text', 'Short day name.', { s: 'Weekday Number' }), col('Weekday Number', 'int', 'Day of the week, Monday = 1.', { f: '0', h: true })]
  });
  const DATE_ARGS = { start_date: 'Start date', end_date: 'End date' };

  /* ---------- Retail sales ---------- */
  const NOUNS = ['Headphones', 'Speaker', 'Charger', 'Keyboard', 'Lamp', 'Blanket', 'Mug', 'Pillow', 'Tent', 'Backpack', 'Water Bottle', 'Camp Chair', 'Jacket', 'Sneakers', 'Cap', 'Hoodie'];
  const ADJ = ['Classic', 'Pro', 'Lite', 'Max', 'Eco', 'Urban', 'Smart', 'Travel', 'Deluxe', 'Mini', 'Ultra', 'Basic'];
  const CATS = ['Electronics', 'Home', 'Outdoor', 'Apparel'];
  const nounIx = pk => mod(add(sub(pk, 1), P('seed')), 16);
  const listPrice = pk => round(mul(at([120, 45, 80, 60], int(div(nounIx(pk), 4))), add(0.6, mul(R(pk, 12), 1.4))), 2);
  const unitCost = pk => round(mul(listPrice(pk), add(0.45, mul(R(pk, 13), 0.25))), 2);
  const retail = () => ({
    tables: [
      { name: 'Customers', fn: PKG + '.Retail.Customers', params: [n('num_customers'), ['start_date', 'DATETIME'], seedP], desc: 'Customers: shoppers and business accounts, with segment, city and region.',
        stages: [{ series: P('num_customers') }, { cols: [['CustomerKey', k], ['_ni', nameIndex(k)], ['_c', int(mul(R(k, 3), 25))],
          ['Segment', wpick([['Consumer', 6], ['Small Business', 2.5], ['Corporate', 1.5]], R(k, 1))],
          ['Customer', iff(eq(C('Segment'), 'Consumer'), person(C('_ni')), company(k, 10))],
          ['City', at(SD.LISTS.City, C('_c'))], ['Region', at(REGIONS, mod(C('_c'), 5))], ['Join Date', sub(S, int(mul(R(k, 4), 1095)))]] }],
        meta: [key('CustomerKey', 'Key that links to Sales.'), col('Customer', 'text', 'Customer name: a person for consumers, a company otherwise.'), col('Segment', 'text', 'Consumer, Small Business or Corporate.'),
          col('City', 'text', 'Home city.'), col('Region', 'text', 'Sales region of the city.'), col('Join Date', 'date', 'When the customer first signed up.')] },
      { name: 'Products', fn: PKG + '.Retail.Products', params: [n('num_products'), seedP], desc: 'Products with category, list price and unit cost.',
        stages: [{ series: P('num_products') }, { cols: [['ProductKey', k], ['_n', nounIx(k)], ['_a', mod(add(int(div(sub(k, 1), 16)), P('seed')), 12)],
          ['Product', cat(at(ADJ, C('_a')), ' ', at(NOUNS, C('_n')))], ['Category', at(CATS, int(div(C('_n'), 4)))], ['List Price', listPrice(k)], ['Unit Cost', unitCost(k)]] }],
        meta: [key('ProductKey', 'Key that links to Sales.'), col('Product', 'text', 'Product name.'), col('Category', 'text', 'Electronics, Home, Outdoor or Apparel.'),
          col('List Price', 'dec', 'Price before discount.', { f: '#,0.00' }), col('Unit Cost', 'dec', 'What one unit costs.', { f: '#,0.00' })] },
      { name: 'Stores', fn: PKG + '.Retail.Stores', params: [n('num_stores'), seedP], desc: 'Stores with city, region and type.',
        stages: [{ series: P('num_stores') }, { cols: [['StoreKey', k], ['_c', int(mul(R(k, 1), 25))], ['City', at(SD.LISTS.City, C('_c'))],
          ['Store', cat('Store ', pad(k, '00'), ' ', C('City'))], ['Region', at(REGIONS, mod(C('_c'), 5))],
          ['Store Type', wpick([['Mall', 3.5], ['High street', 3.5], ['Outlet', 2], ['Online', 1]], R(k, 2))]] }],
        meta: [key('StoreKey', 'Key that links to Sales.'), col('Store', 'text', 'Store name.'), col('City', 'text', 'City the store is in.'), col('Region', 'text', 'Sales region.'), col('Store Type', 'text', 'Mall, High street, Outlet or Online.')] },
      { name: 'Sales', fn: PKG + '.Retail.Sales', params: [n('num_orders'), ...dts, n('num_customers'), n('num_products'), n('num_stores'), seedP], desc: 'Sales order lines: one row per product on an order, with quantity, price, discount, sales and cost.',
        stages: [{ series: P('num_orders') }, { cols: [['Order Number', add(100000, k)], ['Order Date', dateIn(k, 1, 0.9)], ['CustomerKey', add(int(mul(pow(R(k, 2), 1.6), P('num_customers'))), 1)],
          ['StoreKey', add(int(mul(R(k, 3), P('num_stores'))), 1)], ['_lines', add(int(mul(R(k, 4), 4)), 1)], ['Ship Date', add(C('Order Date'), add(1, int(mul(R(k, 5), 6))))]] },
          { expand: C('_lines'), as: 'Line Number' },
          { cols: [['_lk', add(mul(k, 10), C('Line Number'))], ['ProductKey', add(int(mul(pow(R(C('_lk'), 6), 1.3), P('num_products'))), 1)],
            ['Quantity', add(int(mul(pow(R(C('_lk'), 7), 2), 6)), 1)], ['Unit Price', listPrice(C('ProductKey'))],
            ['Discount', div(wpick([[0, 70], [5, 15], [10, 10], [20, 5]], R(C('_lk'), 8)), 100)],
            ['Sales Amount', round(mul(mul(C('Quantity'), C('Unit Price')), sub(1, C('Discount'))), 2)], ['Cost Amount', round(mul(C('Quantity'), unitCost(C('ProductKey'))), 2)]] }],
        meta: [col('Order Number', 'int', 'Order the line belongs to.', { f: '0' }), col('Line Number', 'int', 'Line on the order, from 1.', { f: '0' }), col('Order Date', 'date', 'When the order was placed. Links to Date.'),
          col('Ship Date', 'date', 'When the order shipped.'), key('CustomerKey', 'Links to Customers.'), key('ProductKey', 'Links to Products.'), key('StoreKey', 'Links to Stores.'),
          col('Quantity', 'int', 'Units on the line.', { f: '0', sum: true }), col('Unit Price', 'dec', 'List price of one unit.', { f: '#,0.00' }), col('Discount', 'dec', 'Discount given, as a share of the price.', { f: '0%' }),
          col('Sales Amount', 'dec', 'Quantity times price, less the discount.', { f: '#,0.00', sum: true }), col('Cost Amount', 'dec', 'Quantity times unit cost.', { f: '#,0.00', sum: true })] },
      dateTable()],
    rels: [['Sales', 'CustomerKey', 'Customers', 'CustomerKey'], ['Sales', 'ProductKey', 'Products', 'ProductKey'], ['Sales', 'StoreKey', 'Stores', 'StoreKey'], ['Sales', 'Order Date', 'Date', 'Date']],
    measures: { Sales: [
      { n: 'Total Sales', x: 'SUM( Sales[Sales Amount] )', f: '#,0', d: 'Sales after discount.' },
      { n: 'Total Cost', x: 'SUM( Sales[Cost Amount] )', f: '#,0', d: 'Cost of the units sold.' },
      { n: 'Gross Margin', x: '[Total Sales] - [Total Cost]', f: '#,0', d: 'Sales less cost.' },
      { n: 'Gross Margin %', x: 'DIVIDE( [Gross Margin], [Total Sales] )', f: '0.0%', d: 'Gross margin as a share of sales.' },
      { n: 'Order Count', x: 'DISTINCTCOUNT( Sales[Order Number] )', f: '#,0', d: 'Number of orders.' },
      { n: 'Average Order Value', x: 'DIVIDE( [Total Sales], [Order Count] )', f: '#,0.00', d: 'Sales per order.' },
      { n: 'Units Sold', x: 'SUM( Sales[Quantity] )', f: '#,0', d: 'Units sold.' },
      { n: 'Active Customers', x: 'DISTINCTCOUNT( Sales[CustomerKey] )', f: '#,0', d: 'Customers who bought something.' }] },
    sizes: [['num_orders', 'Orders', 4000, 100000], ['num_customers', 'Customers', 500, 3600], ['num_products', 'Products', 60, 192], ['num_stores', 'Stores', 12, 99]]
  });

  /* ---------- HR ---------- */
  const DEPTS = ['Sales', 'Marketing', 'Customer Support', 'Operations', 'Engineering', 'IT', 'Finance', 'Human Resources'];
  const ROLES = ['Sales Representative', 'Marketing Specialist', 'Support Agent', 'Operations Analyst', 'Engineer', 'IT Specialist', 'Accountant', 'HR Partner'];
  const BASE = [52000, 56000, 42000, 48000, 78000, 64000, 60000, 55000];
  const LEVELS = ['Associate', 'Senior', 'Lead', 'Manager', 'Director'];
  const hireOf = ek => sub(E, int(mul(pow(R(ek, 40), 0.9), add(days(), 2920))));
  const SOURCES = [['Careers site', 35], ['Job board', 30], ['Referral', 15], ['Agency', 10], ['Social media', 10]];
  const STAGES = ['Applied', 'Screened', 'Interviewed', 'Offered', 'Hired'];
  const ROUNDS = ['First interview', 'Second interview', 'Panel', 'Final interview'];
  const DEPT_W = [[1, 20], [2, 8], [3, 18], [4, 20], [5, 16], [6, 6], [7, 6], [8, 6]];
  const jobTitle = (lv, dk) => iff(ge(lv, 4), cat(at(LEVELS, sub(lv, 1)), ', ', at(DEPTS, sub(dk, 1))), iff(eq(lv, 1), at(ROLES, sub(dk, 1)), cat(at(LEVELS, sub(lv, 1)), ' ', at(ROLES, sub(dk, 1)))));
  /* a job opening, worked out from its key (k), so Applications and Interviews can rebuild it */
  const reqCols = () => [['_rd', wpick(DEPT_W, R(k, 21))], ['_rl', wpick([[1, 40], [2, 30], [3, 15], [4, 10], [5, 5]], R(k, 22))],
    ['_open', add(S, int(mul(R(k, 23), days())))],
    ['_d', add(30, int(mul(mul(pow(R(k, 24), 1.5), 80), at([1, 1.1, 1.25, 1.5, 1.8], sub(C('_rl'), 1)))))],
    ['_can', lt(R(k, 25), 0.08)], ['_len', iff(C('_can'), int(mul(C('_d'), 0.6)), C('_d'))],
    ['_status', iff(le(add(C('_open'), C('_len')), E), iff(C('_can'), 'Cancelled', 'Filled'), 'Open')],
    ['_close', iff(eq(C('_status'), 'Open'), blank(), add(C('_open'), C('_len')))],
    ['_n', add(8, int(mul(R(k, 26), 30)))], ['_h', add(1, int(mul(R(k, 27), C('_n'))))]];
  /* an applicant to that opening (after expanding _n as Applicant Number) */
  const ak = C('_ak');
  const appCols = () => [['_ak', add(mul(k, 100), C('Applicant Number'))],
    ['_hired', and(eq(C('_status'), 'Filled'), eq(C('Applicant Number'), C('_h')))], ['_end', coalesce(C('_close'), E)],
    ['Applied Date', add(C('_open'), int(mul(mul(R(ak, 2), sub(C('_end'), C('_open'))), iff(C('_hired'), 0.3, 0.9))))],
    ['Stage Number', iff(C('_hired'), 5, iff(lt(R(ak, 3), 0.5), 1, iff(lt(R(ak, 3), 0.78), 2, iff(lt(R(ak, 3), 0.99), 3, 4))))],
    ['_iv', iff(lt(C('Stage Number'), 3), 0, iff(eq(C('Stage Number'), 3), add(1, int(mul(R(ak, 4), 2))), add(3, int(mul(R(ak, 4), 2)))))],
    ['Offer Made', ge(C('Stage Number'), 4)],
    ['Offer Date', iff(lt(C('Stage Number'), 4), blank(), iff(C('_hired'), sub(C('_close'), 2), min(add(C('Applied Date'), add(10, mul(7, C('_iv')))), C('_end'))))]];
  const termOf = (ek, hire) => iff(and(lt(R(ek, 41), 0.35), gt(int(sub(E, hire)), 60)), add(add(hire, 30), int(mul(R(ek, 42), sub(int(sub(E, hire)), 30)))), blank());
  const hr = () => ({
    tables: [
      { name: 'Departments', fn: PKG + '.HR.Departments', params: [], desc: 'Departments and the division each belongs to.',
        stages: [{ data: { cols: [['DepartmentKey', 'int'], ['Department', 'text'], ['Division', 'text']], rows: DEPTS.map((d, i) => [i + 1, d, ['Commercial', 'Commercial', 'Operations', 'Operations', 'Technology', 'Technology', 'Corporate', 'Corporate'][i]]) } }],
        meta: [key('DepartmentKey', 'Key that links to Employees.'), col('Department', 'text', 'Department name.'), col('Division', 'text', 'Commercial, Operations, Technology or Corporate.')] },
      { name: 'Employees', fn: PKG + '.HR.Employees', params: [n('num_employees'), ...dts, seedP], desc: 'Everyone employed since well before the start date: department, job, pay, hire and termination dates, and why they left.',
        stages: [{ series: P('num_employees') }, { cols: [['EmployeeKey', k], ['Employee Number', cat('E', pad(add(10000, k), '00000'))], ['_ni', nameIndex(k)],
          ['Employee', person(C('_ni'))], ['Gender', iff(lt(int(div(C('_ni'), 60)), 30), 'Female', 'Male')],
          ['DepartmentKey', wpick([[1, 20], [2, 8], [3, 18], [4, 20], [5, 16], [6, 6], [7, 6], [8, 6]], R(k, 1))],
          ['_lv', wpick([[1, 45], [2, 25], [3, 15], [4, 10], [5, 5]], R(k, 2))], ['Job Level', at(LEVELS, sub(C('_lv'), 1))],
          ['Job Title', iff(ge(C('_lv'), 4), cat(C('Job Level'), ', ', at(DEPTS, sub(C('DepartmentKey'), 1))), iff(eq(C('_lv'), 1), at(ROLES, sub(C('DepartmentKey'), 1)), cat(C('Job Level'), ' ', at(ROLES, sub(C('DepartmentKey'), 1)))))],
          ['Employment Type', wpick([['Full-time', 82], ['Part-time', 12], ['Contractor', 6]], R(k, 3))],
          ['Location', wpick([['Head Office', 45], ['Riverton', 20], ['Lakewood', 15], ['Remote', 20]], R(k, 4))],
          ['Birth Date', add(date(sub(year(E), add(22, int(mul(pow(R(k, 5), 1.3), 40)))), 1, 1), int(mul(R(k, 6), 365)))],
          ['Hire Date', hireOf(k)], ['Termination Date', termOf(k, C('Hire Date'))],
          ['Termination Reason', iff(isblank(C('Termination Date')), blank(), wpick([['Resigned', 55], ['Better offer', 15], ['Dismissed', 12], ['Redundancy', 10], ['Retired', 8]], R(k, 43)))],
          ['Termination Type', iff(isblank(C('Termination Date')), blank(), iff(or(eq(C('Termination Reason'), 'Dismissed'), eq(C('Termination Reason'), 'Redundancy')), 'Involuntary', 'Voluntary'))],
          ['Status', iff(isblank(C('Termination Date')), 'Active', 'Left')], ['Hire Source', wpick(SOURCES, R(k, 9))],
          ['Annual Salary', round(mul(mul(at(BASE, sub(C('DepartmentKey'), 1)), at([1, 1.25, 1.5, 1.9, 2.6], sub(C('_lv'), 1))), add(0.85, mul(R(k, 7), 0.3))), -2)],
          ['Performance Rating', wpick([[1, 5], [2, 15], [3, 50], [4, 22], [5, 8]], R(k, 8))]] }],
        meta: [key('EmployeeKey', 'Key that links to Absences.'), col('Employee Number', 'text', 'Employee ID.'), col('Employee', 'text', 'Full name.'), col('Gender', 'text', 'Female or Male.'),
          key('DepartmentKey', 'Links to Departments.'), col('Job Level', 'text', 'Associate, Senior, Lead, Manager or Director.'), col('Job Title', 'text', 'Job title.'),
          col('Employment Type', 'text', 'Full-time, Part-time or Contractor.'), col('Location', 'text', 'Where the employee works.'), col('Birth Date', 'date', 'Date of birth.'),
          col('Hire Date', 'date', 'First day of work. Links to Date (inactive; Hires uses it).'), col('Termination Date', 'date', 'Last day of work. Blank while employed. Links to Date (inactive; Terminations uses it).'),
          col('Termination Reason', 'text', 'Why the employee left.'), col('Termination Type', 'text', 'Voluntary or Involuntary (dismissed or made redundant). Blank while employed.'),
          col('Status', 'text', 'Active, or Left by the end date.'), col('Hire Source', 'text', 'Where the employee was found: careers site, job board, referral, agency or social media.'),
          col('Annual Salary', 'dec', 'Yearly pay.', { f: '#,0' }), col('Performance Rating', 'int', 'Latest rating, 1 (low) to 5 (high).', { f: '0' })] },
      { name: 'Absences', fn: PKG + '.HR.Absences', params: [n('num_absences'), ...dts, n('num_employees'), seedP], desc: 'Absences: one row per absence, while the employee worked here, with type and days.',
        stages: [{ series: P('num_absences') }, { cols: [['Absence ID', k], ['EmployeeKey', add(int(mul(R(k, 1), P('num_employees'))), 1)], ['_hire', hireOf(C('EmployeeKey'))],
          ['_from', max(C('_hire'), S)], ['_to', min(coalesce(termOf(C('EmployeeKey'), C('_hire')), E), E)]] },
          { filter: gt(C('_to'), C('_from')) },
          { cols: [['Start Date', add(C('_from'), int(mul(R(k, 2), sub(C('_to'), C('_from')))))],
            ['Absence Type', wpick([['Vacation', 45], ['Sick', 35], ['Personal', 10], ['Training', 7], ['Parental', 3]], R(k, 3))],
            ['Days', iff(eq(C('Absence Type'), 'Parental'), add(20, int(mul(R(k, 4), 60))), wpick([[1, 50], [2, 20], [3, 12], [5, 10], [10, 5], [15, 3]], R(k, 5)))]] }],
        meta: [col('Absence ID', 'int', 'Absence number.', { f: '0' }), key('EmployeeKey', 'Links to Employees.'), col('Start Date', 'date', 'First day of the absence. Links to Date.'),
          col('Absence Type', 'text', 'Vacation, Sick, Personal, Training or Parental.'), col('Days', 'int', 'Working days absent.', { f: '0', sum: true })] },
      { name: 'Requisitions', fn: PKG + '.HR.Requisitions', params: [n('num_requisitions'), ...dts, seedP], desc: 'Job openings: department, job, recruiter, when each opened and closed, and how long it took to fill.',
        stages: [{ series: P('num_requisitions') }, { cols: reqCols() }, { cols: [['RequisitionKey', k], ['Requisition ID', cat('REQ-', pad(add(1000, k), '0000'))],
          ['DepartmentKey', C('_rd')], ['Job Level', at(LEVELS, sub(C('_rl'), 1))], ['Job Title', jobTitle(C('_rl'), C('_rd'))],
          ['Recruiter', person(nameIndex(add(3500, mod(k, 6))))], ['Opened Date', C('_open')], ['Status', C('_status')], ['Closed Date', C('_close')],
          ['Days to Fill', iff(eq(C('_status'), 'Filled'), C('_d'), blank())]] }],
        meta: [key('RequisitionKey', 'Key that links to Applications.'), col('Requisition ID', 'text', 'Job opening number.'), key('DepartmentKey', 'Links to Departments.'),
          col('Job Level', 'text', 'Associate, Senior, Lead, Manager or Director.'), col('Job Title', 'text', 'Job being hired for.'), col('Recruiter', 'text', 'Recruiter who owns the opening.'),
          col('Opened Date', 'date', 'When the opening was approved. Requisitions Opened uses it.'), col('Status', 'text', 'Filled, Cancelled, or Open at the end date.'),
          col('Closed Date', 'date', 'When it was filled or cancelled. Blank while open. Requisitions Filled uses it.'),
          col('Days to Fill', 'int', 'Days from opening to the accepted offer. Blank unless filled.', { f: '0' })] },
      { name: 'Applications', fn: PKG + '.HR.Applications', params: [n('num_requisitions'), ...dts, seedP], desc: 'Applicants: one row per person who applied to an opening, how far they got and how it ended. Filled openings have exactly one hire.',
        stages: [{ series: P('num_requisitions') }, { cols: reqCols() }, { expand: C('_n'), as: 'Applicant Number' }, { cols: appCols() },
          { cols: [['ApplicationKey', ak], ['RequisitionKey', k], ['Candidate', person(nameIndex(ak))], ['Source', wpick(SOURCES, R(ak, 1))],
            ['Stage Reached', at(STAGES, sub(C('Stage Number'), 1))],
            ['Outcome', iff(C('_hired'), 'Hired', iff(and(eq(C('_status'), 'Open'), lt(R(ak, 5), 0.6)), 'In progress', iff(eq(C('Stage Number'), 4), 'Declined offer', iff(lt(R(ak, 6), 0.15), 'Withdrew', 'Rejected'))))]] }],
        meta: [key('ApplicationKey', 'Key that links to Interviews.'), key('RequisitionKey', 'Links to Requisitions.'), col('Candidate', 'text', 'Applicant name.'),
          col('Source', 'text', 'Careers site, Job board, Referral, Agency or Social media.'), col('Applied Date', 'date', 'When they applied. Links to Date.'),
          col('Stage Reached', 'text', 'Furthest step: Applied, Screened, Interviewed, Offered or Hired.', { s: 'Stage Number' }), col('Stage Number', 'int', 'Sorts Stage Reached, 1 to 5.', { f: '0', h: true }),
          col('Outcome', 'text', 'Hired, Declined offer, Rejected, Withdrew, or In progress at the end date.'),
          col('Offer Made', 'bool', 'TRUE when an offer was made.'), col('Offer Date', 'date', 'When the offer was made. Blank without one. Offers uses it.')] },
      { name: 'Interviews', fn: PKG + '.HR.Interviews', params: [n('num_requisitions'), ...dts, n('num_employees'), seedP], desc: 'Interviews: one row per interview round an applicant had, with the interviewer, rating and recommendation.',
        stages: [{ series: P('num_requisitions') }, { cols: reqCols() }, { expand: C('_n'), as: 'Applicant Number' }, { cols: appCols() },
          { expand: C('_iv'), as: 'Round Number' },
          { cols: [['_ik', add(mul(ak, 10), C('Round Number'))],
            ['Interview Date', iff(isblank(C('Offer Date')), add(C('Applied Date'), add(mul(7, C('Round Number')), int(mul(R(C('_ik'), 1), 4)))),
              add(C('Applied Date'), int(div(mul(sub(C('Offer Date'), C('Applied Date')), C('Round Number')), add(C('_iv'), 1)))))]] },
          { filter: le(C('Interview Date'), C('_end')) },
          { cols: [['InterviewKey', C('_ik')], ['ApplicationKey', ak], ['Round', at(ROUNDS, sub(C('Round Number'), 1))],
            ['Interviewer', person(nameIndex(add(int(mul(R(C('_ik'), 2), P('num_employees'))), 1)))],
            ['Rating', iff(C('Offer Made'), wpick([[3, 20], [4, 50], [5, 30]], R(C('_ik'), 3)), wpick([[1, 15], [2, 30], [3, 35], [4, 20]], R(C('_ik'), 3)))],
            ['Recommendation', iff(ge(C('Rating'), 4), 'Hire', iff(eq(C('Rating'), 3), 'Maybe', 'No hire'))]] }],
        meta: [key('InterviewKey', 'Interview number.'), key('ApplicationKey', 'Links to Applications.'), col('Round', 'text', 'First interview, Second interview, Panel or Final interview.', { s: 'Round Number' }),
          col('Round Number', 'int', 'Sorts Round, 1 to 4.', { f: '0', h: true }), col('Interview Date', 'date', 'When the interview took place. Interview Count uses it.'),
          col('Interviewer', 'text', 'Employee who ran the interview.'), col('Rating', 'int', 'Interviewer score, 1 (low) to 5 (high).', { f: '0' }), col('Recommendation', 'text', 'Hire, Maybe or No hire.')] },
      dateTable()],
    rels: [['Employees', 'DepartmentKey', 'Departments', 'DepartmentKey'], ['Absences', 'EmployeeKey', 'Employees', 'EmployeeKey'], ['Absences', 'Start Date', 'Date', 'Date'],
      ['Requisitions', 'DepartmentKey', 'Departments', 'DepartmentKey'], ['Applications', 'RequisitionKey', 'Requisitions', 'RequisitionKey'],
      ['Interviews', 'ApplicationKey', 'Applications', 'ApplicationKey'], ['Applications', 'Applied Date', 'Date', 'Date'],
      ['Employees', 'Hire Date', 'Date', 'Date', false], ['Employees', 'Termination Date', 'Date', 'Date', false]],
    measures: { Employees: [
      { n: 'Headcount', x: 'VAR _Day = MAX( \'Date\'[Date] )\nRETURN\n    CALCULATE(\n        COUNTROWS( Employees ),\n        Employees[Hire Date] <= _Day,\n        ISBLANK( Employees[Termination Date] ) || Employees[Termination Date] > _Day,\n        REMOVEFILTERS( \'Date\' )\n    )', f: '#,0', d: 'Employees on the payroll on the last day of the period.' },
      { n: 'Hires', x: 'CALCULATE( COUNTROWS( Employees ), USERELATIONSHIP( Employees[Hire Date], \'Date\'[Date] ) )', f: '#,0', d: 'Employees who started in the period.' },
      { n: 'Terminations', x: 'CALCULATE( COUNTROWS( Employees ), USERELATIONSHIP( Employees[Termination Date], \'Date\'[Date] ) )', f: '#,0', d: 'Employees whose last day was in the period.' },
      { n: 'Voluntary Terminations', x: 'CALCULATE( [Terminations], Employees[Termination Type] = "Voluntary" )', f: '#,0', d: 'Employees who chose to leave (resigned, better offer, retired).' },
      { n: 'Involuntary Terminations', x: 'CALCULATE( [Terminations], Employees[Termination Type] = "Involuntary" )', f: '#,0', d: 'Employees who were dismissed or made redundant.' },
      { n: 'Net Headcount Change', x: '[Hires] - [Terminations]', f: '#,0', d: 'Hires less terminations in the period.' },
      { n: 'Turnover %', x: 'DIVIDE( [Terminations], [Headcount] )', f: '0.0%', d: 'Terminations as a share of headcount at the end of the period.' },
      { n: 'Voluntary Turnover %', x: 'DIVIDE( [Voluntary Terminations], [Headcount] )', f: '0.0%', d: 'Voluntary terminations as a share of headcount at the end of the period.' },
      { n: 'Average Salary', x: 'VAR _Day = MAX( \'Date\'[Date] )\nRETURN\n    CALCULATE(\n        AVERAGE( Employees[Annual Salary] ),\n        Employees[Hire Date] <= _Day,\n        ISBLANK( Employees[Termination Date] ) || Employees[Termination Date] > _Day,\n        REMOVEFILTERS( \'Date\' )\n    )', f: '#,0', d: 'Average yearly pay of the employees in Headcount.' },
      { n: 'Average Tenure (Years)', x: 'VAR _Day = MAX( \'Date\'[Date] )\nRETURN\n    CALCULATE(\n        AVERAGEX( Employees, ( _Day - Employees[Hire Date] ) / 365.25 ),\n        Employees[Hire Date] <= _Day,\n        ISBLANK( Employees[Termination Date] ) || Employees[Termination Date] > _Day,\n        REMOVEFILTERS( \'Date\' )\n    )', f: '0.0', d: 'Average years since hire of the employees in Headcount.' }],
      Absences: [
      { n: 'Absence Days', x: 'SUM( Absences[Days] )', f: '#,0', d: 'Working days absent, by the day each absence started.' }],
      Requisitions: [
      { n: 'Requisitions Opened', x: 'CALCULATE( COUNTROWS( Requisitions ), TREATAS( VALUES( \'Date\'[Date] ), Requisitions[Opened Date] ) )', f: '#,0', d: 'Job openings approved in the period.' },
      { n: 'Requisitions Filled', x: 'CALCULATE( COUNTROWS( Requisitions ), Requisitions[Status] = "Filled", TREATAS( VALUES( \'Date\'[Date] ), Requisitions[Closed Date] ) )', f: '#,0', d: 'Job openings filled in the period.' },
      { n: 'Open Requisitions', x: 'VAR _Day = MAX( \'Date\'[Date] )\nRETURN\n    CALCULATE(\n        COUNTROWS( Requisitions ),\n        Requisitions[Opened Date] <= _Day,\n        ISBLANK( Requisitions[Closed Date] ) || Requisitions[Closed Date] > _Day\n    )', f: '#,0', d: 'Job openings still open on the last day of the period.' },
      { n: 'Average Days to Fill', x: 'CALCULATE( AVERAGE( Requisitions[Days to Fill] ), TREATAS( VALUES( \'Date\'[Date] ), Requisitions[Closed Date] ) )', f: '0', d: 'Days from opening to accepted offer, for openings filled in the period.' }],
      Applications: [
      { n: 'Application Count', x: 'COUNTROWS( Applications )', f: '#,0', d: 'Applications received in the period.' },
      { n: 'Offers', x: 'CALCULATE( COUNTROWS( Applications ), Applications[Offer Made] = TRUE(), TREATAS( VALUES( \'Date\'[Date] ), Applications[Offer Date] ), REMOVEFILTERS( \'Date\' ) )', f: '#,0', d: 'Offers made in the period.' },
      { n: 'Offers Accepted', x: 'CALCULATE( [Offers], Applications[Outcome] = "Hired" )', f: '#,0', d: 'Offers made in the period that were accepted.' },
      { n: 'Offer Acceptance %', x: 'DIVIDE( [Offers Accepted], [Offers] )', f: '0.0%', d: 'Accepted offers as a share of offers made.' },
      { n: 'Application to Hire %', x: 'DIVIDE( CALCULATE( COUNTROWS( Applications ), Applications[Outcome] = "Hired" ), [Application Count] )', f: '0.0%', d: 'Applications received in the period that ended in a hire.' }],
      Interviews: [
      { n: 'Interview Count', x: 'CALCULATE( COUNTROWS( Interviews ), TREATAS( VALUES( \'Date\'[Date] ), Interviews[Interview Date] ), REMOVEFILTERS( \'Date\' ) )', f: '#,0', d: 'Interviews held in the period.' },
      { n: 'Interviews per Hire', x: 'DIVIDE( [Interview Count], [Offers Accepted] )', f: '0.0', d: 'Interviews held for each accepted offer.' },
      { n: 'Average Interview Rating', x: 'CALCULATE( AVERAGE( Interviews[Rating] ), TREATAS( VALUES( \'Date\'[Date] ), Interviews[Interview Date] ), REMOVEFILTERS( \'Date\' ) )', f: '0.00', d: 'Average interviewer score, 1 to 5, for interviews held in the period.' }] },
    sizes: [['num_employees', 'Employees', 600, 3600], ['num_absences', 'Absences', 3000, 100000], ['num_requisitions', 'Job openings', 150, 3000]]
  });

  /* ---------- Finance ---------- */
  const ACCTS = [['Product revenue', 'Revenue', 1, 420000], ['Service revenue', 'Revenue', 1, 160000], ['Materials', 'Cost of sales', -1, 150000], ['Direct labor', 'Cost of sales', -1, 90000],
    ['Freight', 'Cost of sales', -1, 25000], ['Salaries', 'Operating expense', -1, 120000], ['Benefits', 'Operating expense', -1, 30000], ['Rent', 'Operating expense', -1, 22000],
    ['Marketing', 'Operating expense', -1, 28000], ['Travel', 'Operating expense', -1, 9000], ['Software', 'Operating expense', -1, 12000], ['Utilities', 'Operating expense', -1, 6000],
    ['Professional fees', 'Operating expense', -1, 8000], ['Depreciation', 'Operating expense', -1, 10000], ['Interest', 'Other', -1, 4000], ['Income tax', 'Other', -1, 35000]];
  const CCS = [['Head Office', 'Corporate', 0.10], ['North Region', 'Sales', 0.16], ['South Region', 'Sales', 0.14], ['East Region', 'Sales', 0.15], ['West Region', 'Sales', 0.13], ['Manufacturing', 'Operations', 0.14], ['Distribution', 'Operations', 0.10], ['Research', 'Technology', 0.08]];
  const glMonths = add(add(mul(sub(year(E), year(S)), 12), 12), -1);
  const termDays = ck => wpick([[30, 60], [45, 25], [60, 15]], R(ck, 30));
  const finance = () => ({
    tables: [
      { name: 'Accounts', fn: PKG + '.Finance.Accounts', params: [], desc: 'Profit and loss accounts, with type, sign and sort order.',
        stages: [{ data: { cols: [['AccountKey', 'int'], ['Account', 'text'], ['Account Type', 'text'], ['Sign', 'int'], ['Sort Order', 'int']], rows: ACCTS.map((a, i) => [i + 1, a[0], a[1], a[2], (i + 1) * 10]) } }],
        meta: [key('AccountKey', 'Key that links to General Ledger.'), col('Account', 'text', 'Account name.', { s: 'Sort Order' }), col('Account Type', 'text', 'Revenue, Cost of sales, Operating expense or Other.'),
          col('Sign', 'int', '1 for revenue, -1 for costs. Signed Amount uses it.', { f: '0' }), col('Sort Order', 'int', 'Profit and loss order.', { f: '0', h: true })] },
      { name: 'Cost Centers', fn: PKG + '.Finance.CostCenters', params: [], desc: 'Cost centers and the division each belongs to.',
        stages: [{ data: { cols: [['CostCenterKey', 'int'], ['Cost Center', 'text'], ['Division', 'text']], rows: CCS.map((c, i) => [i + 1, c[0], c[1]]) } }],
        meta: [key('CostCenterKey', 'Key that links to General Ledger.'), col('Cost Center', 'text', 'Cost center name.'), col('Division', 'text', 'Corporate, Sales, Operations or Technology.')] },
      { name: 'General Ledger', fn: PKG + '.Finance.GeneralLedger', params: [...dts, seedP], desc: 'Monthly amounts by account and cost center, for Actual (start to end date) and Budget (every month of those years).',
        stages: [{ grid: [{ as: '_m', n: glMonths, from: 0 }, { as: 'AccountKey', n: ACCTS.length }, { as: 'CostCenterKey', n: CCS.length }, { as: '_s', n: 2 }] },
          { cols: [['Date', eom(date(year(S), 1, 1), C('_m'))], ['Scenario', iff(eq(C('_s'), 1), 'Actual', 'Budget')], ['_key', add(mul(add(mul(add(mul(C('_m'), 16), C('AccountKey')), 8), C('CostCenterKey')), 2), C('_s'))]] },
          { filter: or(eq(C('Scenario'), 'Budget'), and(ge(C('Date'), eom(S, 0)), le(C('Date'), eom(E, 0)))) },
          { cols: [['_base', mul(mul(at(ACCTS.map(a => a[3]), sub(C('AccountKey'), 1)), at(CCS.map(c => c[2]), sub(C('CostCenterKey'), 1))), add(1, div(mul(0.06, C('_m')), 12)))],
            ['_season', iff(or(eq(C('AccountKey'), 8), eq(C('AccountKey'), 14)), 1, add(1, mul(0.12, sin(div(mul(mul(2, pi()), sub(month(C('Date')), 3)), 12)))))],
            ['Amount', round(mul(mul(C('_base'), C('_season')), iff(eq(C('Scenario'), 'Budget'), add(1.01, mul(R(C('_key'), 1), 0.04)), add(0.88, mul(R(C('_key'), 2), 0.24)))), 0)],
            ['Signed Amount', mul(C('Amount'), at(ACCTS.map(a => a[2]), sub(C('AccountKey'), 1)))]] }],
        meta: [col('Date', 'date', 'Month end. Links to Date.'), key('AccountKey', 'Links to Accounts.'), key('CostCenterKey', 'Links to Cost Centers.'), col('Scenario', 'text', 'Actual or Budget.'),
          col('Amount', 'dec', 'Amount for the month, always positive.', { f: '#,0', sum: true }), col('Signed Amount', 'dec', 'Amount with costs negative, so a sum gives profit.', { f: '#,0', sum: true })] },
      { name: 'Customers', fn: PKG + '.Finance.Customers', params: [n('num_customers'), seedP], desc: 'Business customers with region and payment terms.',
        stages: [{ series: P('num_customers') }, { cols: [['CustomerKey', k], ['Customer', company(k, 10)], ['Region', pick(REGIONS, R(k, 1))], ['Payment Terms Days', termDays(k)], ['Payment Terms', cat('Net ', C('Payment Terms Days'))]] }],
        meta: [key('CustomerKey', 'Key that links to Invoices.'), col('Customer', 'text', 'Company name.'), col('Region', 'text', 'Sales region.'), col('Payment Terms', 'text', 'Net 30, Net 45 or Net 60.', { s: 'Payment Terms Days' }),
          col('Payment Terms Days', 'int', 'Days the customer has to pay.', { f: '0', h: true })] },
      { name: 'Invoices', fn: PKG + '.Finance.Invoices', params: [n('num_invoices'), ...dts, n('num_customers'), seedP], desc: 'Customer invoices with due date, paid date and status at the end date.',
        stages: [{ series: P('num_invoices') }, { cols: [['Invoice Number', cat('INV-', pad(k, '000000'))], ['CustomerKey', add(int(mul(pow(R(k, 1), 1.5), P('num_customers'))), 1)],
          ['Invoice Date', dateIn(k, 2, 0.85)], ['Amount', round(add(500, mul(pow(R(k, 3), 3), 25000)), 2)], ['Due Date', add(C('Invoice Date'), termDays(C('CustomerKey')))],
          ['_paid', iff(lt(R(k, 4), 0.02), blank(), add(C('Due Date'), add(wpick([[-10, 20], [0, 40], [10, 20], [30, 12], [60, 8]], R(k, 5)), int(mul(R(k, 6), 10)))))],
          ['Paid Date', iff(gt(C('_paid'), E), blank(), C('_paid'))],
          ['Status', iff(isblank(C('Paid Date')), iff(lt(C('Due Date'), E), 'Overdue', 'Open'), 'Paid')],
          ['Days to Pay', iff(isblank(C('Paid Date')), blank(), int(sub(C('Paid Date'), C('Invoice Date'))))]] }],
        meta: [col('Invoice Number', 'text', 'Invoice ID.'), key('CustomerKey', 'Links to Customers.'), col('Invoice Date', 'date', 'When the invoice was sent. Links to Date.'), col('Due Date', 'date', 'When payment is due.'),
          col('Paid Date', 'date', 'When it was paid. Blank if not paid by the end date.'), col('Amount', 'dec', 'Invoice amount.', { f: '#,0.00', sum: true }),
          col('Status', 'text', 'Paid, Open (not yet due) or Overdue, at the end date.'), col('Days to Pay', 'int', 'Days from invoice to payment.', { f: '0' })] },
      dateTable()],
    rels: [['General Ledger', 'AccountKey', 'Accounts', 'AccountKey'], ['General Ledger', 'CostCenterKey', 'Cost Centers', 'CostCenterKey'], ['General Ledger', 'Date', 'Date', 'Date'],
      ['Invoices', 'CustomerKey', 'Customers', 'CustomerKey'], ['Invoices', 'Invoice Date', 'Date', 'Date']],
    measures: {
      'General Ledger': [
        { n: 'Actual', x: 'CALCULATE( SUM( \'General Ledger\'[Signed Amount] ), \'General Ledger\'[Scenario] = "Actual" )', f: '#,0', d: 'Actual amount, with costs negative. With no account filter, this is net income.' },
        { n: 'Budget', x: 'CALCULATE( SUM( \'General Ledger\'[Signed Amount] ), \'General Ledger\'[Scenario] = "Budget" )', f: '#,0', d: 'Budget amount, with costs negative.' },
        { n: 'Variance', x: '[Actual] - [Budget]', f: '#,0', d: 'Actual less budget. Positive is better than budget.' },
        { n: 'Variance %', x: 'DIVIDE( [Variance], ABS( [Budget] ) )', f: '0.0%', d: 'Variance as a share of budget.' },
        { n: 'Revenue', x: 'CALCULATE( [Actual], Accounts[Account Type] = "Revenue" )', f: '#,0', d: 'Actual revenue.' },
        { n: 'Gross Profit', x: 'CALCULATE( [Actual], Accounts[Account Type] IN { "Revenue", "Cost of sales" } )', f: '#,0', d: 'Revenue less cost of sales.' },
        { n: 'Gross Margin %', x: 'DIVIDE( [Gross Profit], [Revenue] )', f: '0.0%', d: 'Gross profit as a share of revenue.' },
        { n: 'Operating Expenses', x: '-CALCULATE( [Actual], Accounts[Account Type] = "Operating expense" )', f: '#,0', d: 'Actual operating expenses, as a positive number.' },
        { n: 'Net Income', x: 'CALCULATE( [Actual], REMOVEFILTERS( Accounts ) )', f: '#,0', d: 'Revenue less every cost.' }],
      Invoices: [
        { n: 'Invoiced', x: 'SUM( Invoices[Amount] )', f: '#,0', d: 'Amount invoiced in the period.' },
        { n: 'Open Receivables', x: 'VAR _Day = MAX( \'Date\'[Date] )\nRETURN\n    CALCULATE(\n        SUM( Invoices[Amount] ),\n        Invoices[Invoice Date] <= _Day,\n        ISBLANK( Invoices[Paid Date] ) || Invoices[Paid Date] > _Day,\n        REMOVEFILTERS( \'Date\' )\n    )', f: '#,0', d: 'Invoiced and not yet paid on the last day of the period.' },
        { n: 'Average Days to Pay', x: 'AVERAGE( Invoices[Days to Pay] )', f: '0.0', d: 'Average days from invoice to payment, for paid invoices.' },
        { n: 'Paid On Time %', x: 'DIVIDE( CALCULATE( COUNTROWS( Invoices ), Invoices[Paid Date] <= Invoices[Due Date], NOT ISBLANK( Invoices[Paid Date] ) ), CALCULATE( COUNTROWS( Invoices ), NOT ISBLANK( Invoices[Paid Date] ) ) )', f: '0.0%', d: 'Paid invoices paid by their due date.' }] },
    sizes: [['num_invoices', 'Invoices', 3000, 100000], ['num_customers', 'Customers', 150, 3600]]
  });

  /* ---------- Healthcare ---------- */
  const SPECS = ['Cardiology', 'Orthopedics', 'Pediatrics', 'Internal Medicine', 'Oncology', 'Neurology', 'Emergency Medicine', 'General Surgery'];
  const specOf = pk => at(SPECS, mod(sub(pk, 1), 8));
  const health = () => ({
    tables: [
      { name: 'Patients', fn: PKG + '.Health.Patients', params: [n('num_patients'), ['end_date', 'DATETIME'], seedP], desc: 'Patients with age band, gender, insurance and city.',
        stages: [{ series: P('num_patients') }, { cols: [['PatientKey', k], ['MRN', cat('MRN', pad(add(100000, k), '000000'))], ['_ni', nameIndex(k)], ['Patient', person(C('_ni'))],
          ['Gender', iff(lt(int(div(C('_ni'), 60)), 30), 'Female', 'Male')], ['_age', int(mul(pow(R(k, 1), 0.9), 92))],
          ['Birth Date', add(date(sub(year(E), C('_age')), 1, 1), int(mul(R(k, 2), 365)))],
          ['Age Band', iff(lt(C('_age'), 18), '0-17', iff(lt(C('_age'), 35), '18-34', iff(lt(C('_age'), 50), '35-49', iff(lt(C('_age'), 65), '50-64', '65+'))))],
          ['Insurance', wpick([['Commercial', 45], ['Medicare', 25], ['Medicaid', 18], ['Self-pay', 7], ['Other', 5]], R(k, 3))], ['City', pick('City', R(k, 4))]] }],
        meta: [key('PatientKey', 'Key that links to Encounters.'), col('MRN', 'text', 'Medical record number.'), col('Patient', 'text', 'Full name.'), col('Gender', 'text', 'Female or Male.'),
          col('Birth Date', 'date', 'Date of birth.'), col('Age Band', 'text', 'Age at the end date: 0-17, 18-34, 35-49, 50-64 or 65+.'), col('Insurance', 'text', 'Who pays: Commercial, Medicare, Medicaid, Self-pay or Other.'), col('City', 'text', 'Home city.')] },
      { name: 'Providers', fn: PKG + '.Health.Providers', params: [n('num_providers'), seedP], desc: 'Doctors and their specialty.',
        stages: [{ series: P('num_providers') }, { cols: [['ProviderKey', k], ['_ni', nameIndex(add(k, 1800))], ['Provider', cat('Dr. ', person(C('_ni')))], ['Specialty', specOf(k)]] }],
        meta: [key('ProviderKey', 'Key that links to Encounters.'), col('Provider', 'text', 'Doctor’s name.'), col('Specialty', 'text', 'Medical specialty.')] },
      { name: 'Encounters', fn: PKG + '.Health.Encounters', params: [n('num_encounters'), ...dts, n('num_patients'), n('num_providers'), seedP], desc: 'Visits and hospital stays: type, length of stay, readmission, wait time, charges, payments and satisfaction.',
        stages: [{ series: P('num_encounters') }, { cols: [['Encounter ID', cat('ENC', pad(k, '0000000'))], ['PatientKey', add(int(mul(pow(R(k, 1), 1.2), P('num_patients'))), 1)],
          ['ProviderKey', add(int(mul(R(k, 2), P('num_providers'))), 1)], ['Admit Date', dateIn(k, 3, 0.9)],
          ['Encounter Type', iff(eq(specOf(C('ProviderKey')), 'Emergency Medicine'), 'Emergency', wpick([['Outpatient', 72], ['Inpatient', 28]], R(k, 4)))],
          ['Length of Stay', iff(eq(C('Encounter Type'), 'Inpatient'), add(1, int(mul(pow(R(k, 5), 2), 12))), 0)],
          ['Discharge Date', add(C('Admit Date'), C('Length of Stay'))],
          ['Readmitted Within 30 Days', and(eq(C('Encounter Type'), 'Inpatient'), lt(R(k, 6), 0.14))],
          ['Wait Minutes', iff(eq(C('Encounter Type'), 'Emergency'), add(10, int(mul(pow(R(k, 7), 1.5), 240))), add(5, int(mul(R(k, 7), 40))))],
          ['Charges', round(iff(eq(C('Encounter Type'), 'Inpatient'), add(4000, mul(mul(C('Length of Stay'), 2500), add(0.7, mul(R(k, 8), 0.6)))), iff(eq(C('Encounter Type'), 'Emergency'), add(900, mul(R(k, 8), 3000)), add(150, mul(R(k, 8), 600)))), 2)],
          ['Payments', round(mul(C('Charges'), add(0.45, mul(R(k, 9), 0.4))), 2)],
          ['Satisfaction Score', wpick([[1, 4], [2, 8], [3, 18], [4, 40], [5, 30]], R(k, 10))]] }],
        meta: [col('Encounter ID', 'text', 'Encounter number.'), key('PatientKey', 'Links to Patients.'), key('ProviderKey', 'Links to Providers.'), col('Admit Date', 'date', 'When the visit or stay began. Links to Date.'),
          col('Discharge Date', 'date', 'When the patient went home.'), col('Encounter Type', 'text', 'Outpatient, Inpatient or Emergency.'), col('Length of Stay', 'int', 'Nights in hospital (0 for visits).', { f: '0' }),
          col('Readmitted Within 30 Days', 'bool', 'TRUE when an inpatient came back within 30 days.'), col('Wait Minutes', 'int', 'Minutes from arrival to being seen.', { f: '0' }),
          col('Charges', 'dec', 'Amount billed.', { f: '#,0.00', sum: true }), col('Payments', 'dec', 'Amount collected.', { f: '#,0.00', sum: true }), col('Satisfaction Score', 'int', 'Patient survey score, 1 to 5.', { f: '0' })] },
      dateTable()],
    rels: [['Encounters', 'PatientKey', 'Patients', 'PatientKey'], ['Encounters', 'ProviderKey', 'Providers', 'ProviderKey'], ['Encounters', 'Admit Date', 'Date', 'Date']],
    measures: { Encounters: [
      { n: 'Encounter Count', x: 'COUNTROWS( Encounters )', f: '#,0', d: 'Visits and stays.' },
      { n: 'Patients Seen', x: 'DISTINCTCOUNT( Encounters[PatientKey] )', f: '#,0', d: 'Different patients with an encounter.' },
      { n: 'Average Length of Stay', x: 'CALCULATE( AVERAGE( Encounters[Length of Stay] ), Encounters[Encounter Type] = "Inpatient" )', f: '0.0', d: 'Average nights per inpatient stay.' },
      { n: 'Readmission Rate %', x: 'DIVIDE( CALCULATE( COUNTROWS( Encounters ), Encounters[Readmitted Within 30 Days] = TRUE() ), CALCULATE( COUNTROWS( Encounters ), Encounters[Encounter Type] = "Inpatient" ) )', f: '0.0%', d: 'Inpatient stays followed by a readmission within 30 days.' },
      { n: 'Average ED Wait (Minutes)', x: 'CALCULATE( AVERAGE( Encounters[Wait Minutes] ), Encounters[Encounter Type] = "Emergency" )', f: '0', d: 'Average emergency department wait.' },
      { n: 'Average Satisfaction', x: 'AVERAGE( Encounters[Satisfaction Score] )', f: '0.00', d: 'Average survey score, 1 to 5.' },
      { n: 'Total Charges', x: 'SUM( Encounters[Charges] )', f: '#,0', d: 'Amount billed.' },
      { n: 'Collection Rate %', x: 'DIVIDE( SUM( Encounters[Payments] ), [Total Charges] )', f: '0.0%', d: 'Payments as a share of charges.' }] },
    sizes: [['num_encounters', 'Encounters', 8000, 100000], ['num_patients', 'Patients', 2000, 3600], ['num_providers', 'Providers', 40, 1800]]
  });

  /* ---------- Manufacturing ---------- */
  const LINES = ['Valves', 'Pumps', 'Brackets', 'Fittings', 'Housings'];
  const cycleOf = pk => add(20, int(mul(R(pk, 3), 100)));
  const manufacturing = () => ({
    tables: [
      { name: 'Products', fn: PKG + '.Manufacturing.Products', params: [n('num_products'), seedP], desc: 'Parts made in the plants, with product line, cycle time and standard cost.',
        stages: [{ series: P('num_products') }, { cols: [['ProductKey', k], ['_l', mod(sub(k, 1), 5)], ['Product Line', at(LINES, C('_l'))],
          ['Product', cat(at(['VLV', 'PMP', 'BRK', 'FIT', 'HSG'], C('_l')), '-', pad(add(100, mul(k, 7)), '000'))], ['Ideal Cycle Seconds', cycleOf(k)], ['Standard Cost', round(add(2, mul(R(k, 4), 60)), 2)]] }],
        meta: [key('ProductKey', 'Key that links to Production.'), col('Product', 'text', 'Part number.'), col('Product Line', 'text', 'Valves, Pumps, Brackets, Fittings or Housings.'),
          col('Ideal Cycle Seconds', 'int', 'Fastest time to make one unit.', { f: '0' }), col('Standard Cost', 'dec', 'Planned cost of one unit.', { f: '#,0.00' })] },
      { name: 'Machines', fn: PKG + '.Manufacturing.Machines', params: [n('num_machines'), seedP], desc: 'Machines with line, plant and type.',
        stages: [{ series: P('num_machines') }, { cols: [['MachineKey', k], ['Machine', cat('M-', pad(k, '00'))], ['Line', cat('Line ', add(mod(sub(k, 1), 4), 1))],
          ['Plant', at(['Plant A', 'Plant B'], mod(int(div(sub(k, 1), 4)), 2))], ['Machine Type', pick(['CNC mill', 'Lathe', 'Press', 'Injection molder', 'Assembly cell'], R(k, 1))]] }],
        meta: [key('MachineKey', 'Key that links to Production.'), col('Machine', 'text', 'Machine ID.'), col('Line', 'text', 'Production line.'), col('Plant', 'text', 'Plant A or Plant B.'), col('Machine Type', 'text', 'Kind of machine.')] },
      { name: 'Production', fn: PKG + '.Manufacturing.Production', params: [...dts, n('num_machines'), n('num_products'), seedP], desc: 'One row per machine per shift worked: planned and run minutes, downtime and its reason, units made and scrapped.',
        stages: [{ grid: [{ as: 'Date', days: [S, E] }, { as: 'MachineKey', n: P('num_machines') }, { as: '_sh', n: 3 }] },
          { cols: [['Shift', at(['Day', 'Evening', 'Night'], sub(C('_sh'), 1))], ['_key', add(mul(add(mul(int(sub(C('Date'), S)), P('num_machines')), C('MachineKey')), 3), C('_sh'))]] },
          { filter: or(le(weekday(C('Date')), 5), and(eq(C('_sh'), 1), lt(R(C('_key'), 1), 0.3))) },
          { cols: [['ProductKey', add(int(mul(R(C('_key'), 2), P('num_products'))), 1)], ['Planned Minutes', 480],
            ['Downtime Minutes', int(mul(pow(R(C('_key'), 3), 3), 180))],
            ['Downtime Reason', iff(eq(C('Downtime Minutes'), 0), blank(), wpick([['Changeover', 30], ['Breakdown', 22], ['Material shortage', 18], ['Planned maintenance', 18], ['Quality check', 12]], R(C('_key'), 4)))],
            ['Run Minutes', sub(C('Planned Minutes'), C('Downtime Minutes'))],
            ['Units Produced', int(mul(div(mul(C('Run Minutes'), 60), cycleOf(C('ProductKey'))), mul(add(0.75, mul(R(C('_key'), 5), 0.2)), add(0.9, mul(R(C('MachineKey'), 6), 0.1)))))],
            ['Units Scrapped', int(mul(mul(C('Units Produced'), pow(R(C('_key'), 7), 2)), 0.08))]] }],
        meta: [col('Date', 'date', 'Production day. Links to Date.'), key('MachineKey', 'Links to Machines.'), col('Shift', 'text', 'Day, Evening or Night.'), key('ProductKey', 'Links to Products.'),
          col('Planned Minutes', 'int', 'Minutes the shift was scheduled to run.', { f: '0', sum: true }), col('Run Minutes', 'int', 'Minutes it ran.', { f: '0', sum: true }),
          col('Downtime Minutes', 'int', 'Minutes stopped.', { f: '0', sum: true }), col('Downtime Reason', 'text', 'Why it stopped. Blank with no downtime.'),
          col('Units Produced', 'int', 'Units made, good and scrapped.', { f: '#,0', sum: true }), col('Units Scrapped', 'int', 'Units thrown away.', { f: '#,0', sum: true })] },
      dateTable()],
    rels: [['Production', 'MachineKey', 'Machines', 'MachineKey'], ['Production', 'ProductKey', 'Products', 'ProductKey'], ['Production', 'Date', 'Date', 'Date']],
    measures: { Production: [
      { n: 'Units', x: 'SUM( Production[Units Produced] )', f: '#,0', d: 'Units made.' },
      { n: 'Good Units', x: '[Units] - SUM( Production[Units Scrapped] )', f: '#,0', d: 'Units made less scrap.' },
      { n: 'Scrap Rate %', x: 'DIVIDE( SUM( Production[Units Scrapped] ), [Units] )', f: '0.0%', d: 'Scrapped units as a share of units made.' },
      { n: 'Downtime Hours', x: 'SUM( Production[Downtime Minutes] ) / 60', f: '#,0.0', d: 'Hours stopped.' },
      { n: 'Availability %', x: 'DIVIDE( SUM( Production[Run Minutes] ), SUM( Production[Planned Minutes] ) )', f: '0.0%', d: 'Run time as a share of planned time.' },
      { n: 'Performance %', x: 'DIVIDE( SUMX( Production, Production[Units Produced] * RELATED( Products[Ideal Cycle Seconds] ) ) / 60, SUM( Production[Run Minutes] ) )', f: '0.0%', d: 'Ideal time for the units made as a share of run time.' },
      { n: 'Quality %', x: 'DIVIDE( [Good Units], [Units] )', f: '0.0%', d: 'Good units as a share of units made.' },
      { n: 'OEE %', x: '[Availability %] * [Performance %] * [Quality %]', f: '0.0%', d: 'Overall equipment effectiveness: availability times performance times quality.' }] },
    sizes: [['num_machines', 'Machines', 12, 99], ['num_products', 'Products', 25, 999]]
  });

  /* ---------- Customer service ---------- */
  const TEAMS = ['Billing', 'Technical', 'Accounts', 'General'];
  const service = () => ({
    tables: [
      { name: 'Customers', fn: PKG + '.Service.Customers', params: [n('num_customers'), seedP], desc: 'Customer accounts with segment, plan and region.',
        stages: [{ series: P('num_customers') }, { cols: [['CustomerKey', k], ['Customer', company(k, 10)], ['Segment', wpick([['Enterprise', 15], ['Mid-market', 35], ['Small business', 50]], R(k, 1))],
          ['Plan', wpick([['Basic', 45], ['Standard', 35], ['Premium', 20]], R(k, 2))], ['Region', pick(REGIONS, R(k, 3))]] }],
        meta: [key('CustomerKey', 'Key that links to Tickets.'), col('Customer', 'text', 'Company name.'), col('Segment', 'text', 'Enterprise, Mid-market or Small business.'), col('Plan', 'text', 'Basic, Standard or Premium.'), col('Region', 'text', 'Sales region.')] },
      { name: 'Agents', fn: PKG + '.Service.Agents', params: [n('num_agents'), ['end_date', 'DATETIME'], seedP], desc: 'Support agents with team, location and hire date.',
        stages: [{ series: P('num_agents') }, { cols: [['AgentKey', k], ['_ni', nameIndex(add(k, 900))], ['Agent', person(C('_ni'))], ['Team', at(TEAMS, mod(sub(k, 1), 4))],
          ['Location', wpick([['Office', 60], ['Remote', 40]], R(k, 1))], ['Hire Date', sub(E, int(mul(R(k, 2), 2500)))]] }],
        meta: [key('AgentKey', 'Key that links to Tickets.'), col('Agent', 'text', 'Full name.'), col('Team', 'text', 'Billing, Technical, Accounts or General.'), col('Location', 'text', 'Office or Remote.'), col('Hire Date', 'date', 'First day as an agent.')] },
      { name: 'Tickets', fn: PKG + '.Service.Tickets', params: [n('num_tickets'), ...dts, n('num_customers'), n('num_agents'), seedP], desc: 'Support tickets: channel, category, priority, response and resolution times, SLA, satisfaction and status at the end date.',
        stages: [{ series: P('num_tickets') }, { cols: [['Ticket ID', cat('TCK-', pad(k, '000000'))], ['CustomerKey', add(int(mul(pow(R(k, 1), 1.4), P('num_customers'))), 1)],
          ['AgentKey', add(int(mul(R(k, 2), P('num_agents'))), 1)], ['Created Date', dateIn(k, 3, 0.85)],
          ['_ch', wpick([[1, 35], [2, 30], [3, 25], [4, 10]], R(k, 4))], ['Channel', at(['Email', 'Phone', 'Chat', 'Web form'], sub(C('_ch'), 1))],
          ['Category', wpick([['Technical issue', 30], ['Billing', 22], ['How-to', 20], ['Account', 18], ['Feature request', 10]], R(k, 5))],
          ['_p', wpick([[1, 30], [2, 45], [3, 20], [4, 5]], R(k, 6))], ['Priority', at(['Low', 'Medium', 'High', 'Urgent'], sub(C('_p'), 1))],
          ['First Response Minutes', add(1, int(mul(at([120, 2, 3, 240], sub(C('_ch'), 1)), add(0.3, mul(pow(R(k, 7), 2), 3)))))],
          ['_hours', round(mul(add(2, mul(pow(R(k, 8), 2), 96)), at([1.5, 1, 0.6, 0.3], sub(C('_p'), 1))), 1)],
          ['_target', at([96, 48, 24, 4], sub(C('_p'), 1))],
          ['_done', le(add(C('Created Date'), int(div(C('_hours'), 24))), E)],
          ['Status', iff(C('_done'), 'Closed', iff(lt(R(k, 9), 0.5), 'Open', 'Pending'))],
          ['Resolved Date', iff(C('_done'), add(C('Created Date'), int(div(C('_hours'), 24))), blank())],
          ['Resolution Hours', iff(C('_done'), C('_hours'), blank())],
          ['SLA Met', and(C('_done'), le(C('_hours'), C('_target')))],
          ['CSAT', iff(and(C('_done'), lt(R(k, 10), 0.4)), iff(le(C('_hours'), C('_target')), wpick([[3, 15], [4, 40], [5, 45]], R(k, 11)), wpick([[1, 20], [2, 30], [3, 30], [4, 20]], R(k, 11))), blank())],
          ['Reopened', and(C('_done'), lt(R(k, 12), 0.07))]] }],
        meta: [col('Ticket ID', 'text', 'Ticket number.'), key('CustomerKey', 'Links to Customers.'), key('AgentKey', 'Links to Agents.'), col('Created Date', 'date', 'When the ticket came in. Links to Date.'),
          col('Channel', 'text', 'Email, Phone, Chat or Web form.'), col('Category', 'text', 'What the ticket is about.'), col('Priority', 'text', 'Low, Medium, High or Urgent.'),
          col('First Response Minutes', 'int', 'Minutes to the first reply.', { f: '0' }), col('Status', 'text', 'Closed, Open or Pending, at the end date.'),
          col('Resolved Date', 'date', 'When it was closed. Blank while open.'), col('Resolution Hours', 'dec', 'Hours from created to closed.', { f: '0.0' }),
          col('SLA Met', 'bool', 'TRUE when closed within the target for its priority (Urgent 4, High 24, Medium 48, Low 96 hours). FALSE while still open.'),
          col('CSAT', 'int', 'Customer survey score, 1 to 5, when the customer answered.', { f: '0' }), col('Reopened', 'bool', 'TRUE when the customer reopened it.')] },
      dateTable()],
    rels: [['Tickets', 'CustomerKey', 'Customers', 'CustomerKey'], ['Tickets', 'AgentKey', 'Agents', 'AgentKey'], ['Tickets', 'Created Date', 'Date', 'Date']],
    measures: { Tickets: [
      { n: 'Tickets Created', x: 'COUNTROWS( Tickets )', f: '#,0', d: 'Tickets that came in.' },
      { n: 'Tickets Closed', x: 'CALCULATE( COUNTROWS( Tickets ), Tickets[Status] = "Closed" )', f: '#,0', d: 'Tickets created in the period that are closed.' },
      { n: 'Backlog', x: 'CALCULATE( COUNTROWS( Tickets ), Tickets[Status] <> "Closed" )', f: '#,0', d: 'Tickets still open or pending at the end date.' },
      { n: 'Average First Response (Minutes)', x: 'AVERAGE( Tickets[First Response Minutes] )', f: '#,0', d: 'Average minutes to the first reply.' },
      { n: 'Average Resolution (Hours)', x: 'AVERAGE( Tickets[Resolution Hours] )', f: '#,0.0', d: 'Average hours to close.' },
      { n: 'SLA Met %', x: 'DIVIDE( CALCULATE( COUNTROWS( Tickets ), Tickets[SLA Met] = TRUE() ), [Tickets Closed] )', f: '0.0%', d: 'Closed tickets closed within target.' },
      { n: 'Average CSAT', x: 'AVERAGE( Tickets[CSAT] )', f: '0.00', d: 'Average survey score, 1 to 5.' },
      { n: 'Reopen Rate %', x: 'DIVIDE( CALCULATE( COUNTROWS( Tickets ), Tickets[Reopened] = TRUE() ), [Tickets Closed] )', f: '0.0%', d: 'Closed tickets the customer reopened.' }] },
    sizes: [['num_tickets', 'Tickets', 10000, 100000], ['num_customers', 'Customers', 800, 3600], ['num_agents', 'Agents', 30, 900]]
  });

  const LIST = [
    { id: 'retail', name: 'Retail sales', blurb: 'Orders, customers, products and stores.', kpis: 'Sales, gross margin, orders, average order value, units, active customers.', make: retail },
    { id: 'hr', name: 'HR', blurb: 'Employees, absences, job openings, applicants and interviews.', kpis: 'Headcount, hires, terminations, turnover, salary, tenure, absence days, open requisitions, days to fill, applications, interviews, offer acceptance.', make: hr },
    { id: 'finance', name: 'Finance', blurb: 'General ledger actuals and budget, customers and invoices.', kpis: 'Actual, budget, variance, revenue, gross margin, net income, receivables, days to pay.', make: finance },
    { id: 'health', name: 'Healthcare', blurb: 'Patients, providers and encounters.', kpis: 'Encounters, length of stay, readmission rate, ED wait, satisfaction, collection rate.', make: health },
    { id: 'mfg', name: 'Manufacturing', blurb: 'Production by machine and shift, products and machines.', kpis: 'Units, scrap rate, downtime, availability, performance, quality, OEE.', make: manufacturing },
    { id: 'service', name: 'Customer service', blurb: 'Tickets, agents and customers.', kpis: 'Tickets, backlog, first response, resolution time, SLA met, CSAT, reopen rate.', make: service }
  ];
  return { LIST, get: id => LIST.find(x => x.id === id) || LIST[0], DATE_ARGS };
})();
