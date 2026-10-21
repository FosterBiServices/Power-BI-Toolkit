/* ---------- KPI Visualizer: reusable card functions (DAX user-defined functions) ---------- */
// One card design as a DAX function, so each KPI's card is a one-line measure. The user picks the card (a summary
// card, a tile or a small chart) and whether it's an SVG image or HTML for the HTML Content visual, and the script
// holds only the functions that card needs. Colors, the neutral band and number shortening are written into the
// functions from Step 4, so there are no color or format functions: change them in the tool and apply the script again.
const KVF_PKG = 'FosterBIServices.KPICards';
// fn: the function's name (Html added for the HTML version). suffix: the measure's name after the KPI's.
// need: what a KPI must have to get one. dates: uses the date column. cmp: takes "MoM", "YoY" or a target.
const KVF_STYLES = [
  { id: 'summary', name: 'Summary card', fn: 'SummaryCard', suffix: 'Card', w: 295, h: 170, dates: true, cmp: true, tips: true, tip: 'Value, a pill with the change (MoM, YoY or vs target), the two numbers the pill compares, and 12 monthly columns.' },
  { id: 'trend', name: 'Trend tile', fn: 'TrendTile', suffix: 'Card', w: 232, h: 130, dates: true, cmp: true, tips: true, tip: 'A compact tile: value, a pill with the change (MoM, YoY or vs target) and 12 monthly columns.' },
  { id: 'rolling', name: 'Rolling tile', fn: 'RollingTile', suffix: 'Card', w: 232, h: 130, dates: true, days: true, tips: true, tip: 'The measure over the last N days, the change from the N days before, and 12 back-to-back windows of N days.' },
  { id: 'snapshot', name: 'Snapshot tile', fn: 'SnapshotTile', suffix: 'Card', w: 232, h: 130, tip: 'A value that doesn’t move with the dates, with a share bar for percentages.' },
  { id: 'bullet', name: 'Bullet chart', fn: 'BulletChart', suffix: 'Bullet', w: 120, h: 24, need: 'target', tip: 'The bar is the value in its status color, the dark mark the target. For a card or a table column.' },
  { id: 'progress', name: 'Progress bar', fn: 'ProgressBar', suffix: 'Progress', w: 120, h: 24, need: 'target', tip: 'The value as a % of its target, in its status color.' },
  { id: 'spark', name: 'Sparkline', fn: 'Sparkline', suffix: 'Trend Line', w: 120, h: 32, dates: true, cmp: true, tip: 'The last 12 months as a line, the last point in the status color of the change (MoM, YoY or vs target).' },
  { id: 'varbar', name: 'Variance bar', fn: 'VarianceBar', suffix: 'Variance Bar', w: 120, h: 24, need: 'base', tip: 'How far above or below its target (or comparison) the value is; full width is ±25%.' }
];
const KVF_OUTS = [{ id: 'html', name: 'HTML, for the HTML Content visual' }, { id: 'image', name: 'SVG image, for a card or a table' }];
const kvfStyle = cfg => KVF_STYLES.find(s => s.id === cfg.fnStyle) || KVF_STYLES[0];
const kvfOut = cfg => cfg.fnOut === 'image' ? 'image' : 'html';
const kvfN = n => KVF_PKG + '.' + n;
const kvfFnName = cfg => kvfStyle(cfg).fn + (kvfOut(cfg) === 'html' ? 'Html' : '');
const kvfDays = cfg => Math.max(1, Math.min(366, Math.round(+cfg.fnDays) || 30));
const KVF_FONT = "font-family='Segoe UI, Arial, sans-serif'";
// classes the HTML cards use for the hover; distinct names so they never meet a report's own CSS
const KVF_CSS = '.kvc svg{display:block}.kvb .kvt{visibility:hidden}.kvb:hover .kvt{visibility:visible}.kvb:hover .kvbar{opacity:0.75}';

/* ---------- the date column ---------- */
function kvfDate(cfg){
  const col = (cfg.fnDate || '').trim() || "'Date'[Date]", c = kvColName(col);
  return { col, table: c ? qName(c.table) : "'Date'", asOf: (cfg.fnAsOf || '').trim() ? kvRef(cfg.fnAsOf) : '' };
}

/* ---------- DAX pieces written into each function, with the colors and band from Step 4 ---------- */
function kvfKit(cfg){
  const P = kvInk(cfg), C = cfg.colors, b = +((+cfg.band || 0) / 100).toFixed(4), html = kvfOut(cfg) === 'html', F = kvfN;
  const X = {
    P, html,
    B: (m, from, to) => F('Between') + ' ( ' + m + ', ' + from + ', ' + to + ' )',
    fx: x => 'FORMAT ( ' + x + ', "0.0", "en-US" )',
    // good, neutral or bad for a change (a variable), or ifBlank when there is nothing to compare with
    status(x, part, ifBlank){
      const s = 'IF ( _lowerIsBetter, -' + x + ', ' + x + ' )';
      return 'SWITCH ( TRUE (), ISBLANK ( ' + x + ' ), "' + ifBlank + '", ' + (b > 0 ? s + ' >= ' + b : s + ' > 0') + ', "' + C.good[part] + '", '
        + (b > 0 ? s + ' <= -' + b : s + ' < 0') + ', "' + C.bad[part] + '", "' + C.neutral[part] + '" )';
    },
    // the change from before to now as a fraction (0.05 = 5% up); blank when there is nothing to compare with
    change: (now, before) => 'IF ( NOT ISBLANK ( ' + before + ' ) && ' + before + ' <> 0, DIVIDE ( COALESCE ( ' + now + ', 0 ) - ' + before + ', ABS ( ' + before + ' ) ) )',
    // ▲ 6.2%
    changeText: x => 'IF ( ISBLANK ( ' + x + ' ), "", SWITCH ( TRUE (), ' + x + ' > 0, UNICHAR ( 9650 ), ' + x + ' < 0, UNICHAR ( 9660 ), UNICHAR ( 9658 ) ) & " " & FORMAT ( ABS ( ' + x + ' ), "0.0%" ) )',
    // the currency sign at the start of the format string, for shortened numbers
    sym: ['VAR _f = SUBSTITUTE ( _format, "\\", "" )', 'VAR _sym = IF ( LEFT ( _f, 1 ) IN { "$", "€", "£", "¥" }, LEFT ( _f, 1 ), "" )'],
    // the main value: 12.4K or 1.2M above 10,000, otherwise in its format string
    valueText: (v, x) => ['VAR ' + v + ' =', '    SWITCH (', '        TRUE (),', '        ISBLANK ( ' + x + ' ), "–",', '        CONTAINSSTRING ( _format, "%" ), FORMAT ( ' + x + ', _format ),',
      '        ABS ( ' + x + ' ) >= 1E6, _sym & FORMAT ( ' + x + ' / 1E6, "0.0" ) & "M",', '        ABS ( ' + x + ' ) >= 1E4, _sym & FORMAT ( ' + x + ' / 1E3, "0.0" ) & "K",', '        FORMAT ( ' + x + ', _format )', '    )'],
    // a number in about 4 characters (999, 1.2K, 12K, 1.2M), for the small comparison values
    compact: (v, x) => ['VAR ' + v + ' =', '    SWITCH (', '        TRUE (),', '        ISBLANK ( ' + x + ' ), "–",', '        CONTAINSSTRING ( _format, "%" ), FORMAT ( ' + x + ', _format ),',
      '        ABS ( ' + x + ' ) < 999.5, FORMAT ( ' + x + ', _format ),', '        ABS ( ' + x + ' ) < 9950, _sym & FORMAT ( ' + x + ' / 1E3, "0.0" ) & "K",', '        ABS ( ' + x + ' ) < 999500, _sym & FORMAT ( ' + x + ' / 1E3, "0" ) & "K",',
      '        ABS ( ' + x + ' ) < 9950000, _sym & FORMAT ( ' + x + ' / 1E6, "0.0" ) & "M",', '        _sym & FORMAT ( ' + x + ' / 1E6, "0" ) & "M"', '    )'],
    // what the function returns: the SVG as an image URL, or as HTML with the hover CSS
    out: v => html ? '"<div class=\'kvc\'><style>' + KVF_CSS + '</style>" & ' + v + ' & "</div>"' : '"data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( ' + v + ', "%", "%25" ), "#", "%23" )',
    // the hover tooltip for one column (heading, value, comparison and change) as variables ending in _tip
    tip(ind, cx, bottom, W, fs, head, value, cmp, chg, chgColor){
      const fx = X.fx;
      return ['VAR _tHead = ' + head, 'VAR _tValue = ' + value, 'VAR _tCmp = ' + cmp, 'VAR _tChg = ' + chg, 'VAR _tLh = ' + fs + ' + 4',
        'VAR _tLen = MAX ( MAX ( LEN ( _tHead ), LEN ( _tValue ) ), LEN ( _tCmp ) + IF ( _tChg <> "", LEN ( _tChg ) + 2, 0 ) )',
        'VAR _tW = MIN ( _tLen * ' + fs + ' * 0.56 + 16, ' + W + ' - 8 )', 'VAR _tH = 3 * _tLh + 10',
        'VAR _tX = MAX ( 4, MIN ( ' + W + ' - 4 - _tW, ' + cx + ' - _tW / 2 ) )', 'VAR _tY = ' + bottom + ' - _tH', 'VAR _tTx = ' + fx('_tX + 8'),
        'VAR _tFont = "' + KVF_FONT + ' font-size=\'" & ' + fx(fs) + ' & "\'"',
        'VAR _tip =', '    "<g class=\'kvt\' visibility=\'hidden\'>"',
        '        & "<rect x=\'" & ' + fx('_tX') + ' & "\' y=\'" & ' + fx('_tY') + ' & "\' width=\'" & ' + fx('_tW') + ' & "\' height=\'" & ' + fx('_tH') + ' & "\' rx=\'4\' fill=\'' + P.bg + '\' stroke=\'' + P.line + '\' stroke-width=\'0.75\'/>"',
        '        & "<text x=\'" & _tTx & "\' y=\'" & ' + fx('_tY + 4 + ' + fs) + ' & "\' " & _tFont & " font-weight=\'700\' fill=\'' + P.accent + '\'>" & _tHead & "</text>"',
        '        & "<text x=\'" & _tTx & "\' y=\'" & ' + fx('_tY + 4 + ' + fs + ' + _tLh') + ' & "\' " & _tFont & " font-weight=\'600\' fill=\'' + P.text + '\'>" & _tValue & "</text>"',
        '        & "<text x=\'" & _tTx & "\' y=\'" & ' + fx('_tY + 4 + ' + fs + ' + 2 * _tLh') + ' & "\' " & _tFont & " fill=\'' + P.muted + '\'>" & _tCmp',
        '        & IF ( _tChg <> "", "<tspan dx=\'6\' font-weight=\'600\' fill=\'" & ' + chgColor + ' & "\'>" & _tChg & "</tspan>" )',
        '        & "</text></g>"'].map(l => ind + l);
    }
  };
  return X;
}
// What a card compares with, and the two numbers the pill compares: _now and _before, and their _change
function kvfCompareVars(X){
  const F = kvfN, B = X.B;
  return ['VAR _c = TRIM ( _compare )', 'VAR _mode = SWITCH ( UPPER ( _c ), "", "MOM", "MOM", "MOM", "YOY", "YOY", "TARGET" )',
    'VAR _name = SWITCH ( _mode, "MOM", "MoM", "YOY", "YoY", UPPER ( LEFT ( _c, 1 ) ) & LOWER ( MID ( _c, 2, 50 ) ) )',
    'VAR _start = ' + F('StartDate') + ' ()', 'VAR _end = ' + F('EndDate') + ' ()',
    '-- A filter that ends on the last day of a month compares full months; one that ends mid-month compares the same days',
    'VAR _fullMonth = _end = EOMONTH ( _end, 0 )', 'VAR _anchor = DATE ( YEAR ( _end ), MONTH ( _end ), 1 )',
    'VAR _value = ' + B('_m', '_start', '_end'),
    '-- MoM: this month and the month before. YoY: the date filter and the same dates last year. Otherwise actual and target.',
    'VAR _now = IF ( _mode = "MOM", ' + B('_m', '_anchor', '_end') + ', _value )',
    'VAR _before =', '    SWITCH (', '        _mode,',
    '        "MOM", ' + B('_m', 'EDATE ( _anchor, -1 )', 'IF ( _fullMonth, EOMONTH ( _end, -1 ), EDATE ( _end, -1 ) )') + ',',
    '        "YOY", ' + B('_m', 'EDATE ( _start, -12 )', 'IF ( _fullMonth, EOMONTH ( _end, -12 ), EDATE ( _end, -12 ) )') + ',',
    '        ' + B('_target', '_start', '_end'), '    )',
    'VAR _change = ' + X.change('_now', '_before')];
}
function kvfPillVars(X){
  return ['VAR _pill =', '    IF (', '        ISBLANK ( _change ),', '        SWITCH ( _mode, "MOM", "No data last month", "YOY", "No data last year", "No " & LOWER ( _name ) ),',
    '        ' + X.changeText('_change') + ' & IF ( _mode = "TARGET", " vs " & LOWER ( _name ), " " & _name )', '    )',
    'VAR _pillFill = ' + X.status('_change', 'fill', X.P.track), 'VAR _pillInk = ' + X.status('_change', 'text', X.P.muted)];
}

/* ---------- the library: [{ name, desc, params, body }], only what the chosen card needs, helpers first ---------- */
function kvfLibrary(cfg){
  const X = kvfKit(cfg), P = X.P, d = kvfDate(cfg), F = kvfN, B = X.B, fx = X.fx, s = kvfStyle(cfg), html = X.html, tips = html && s.tips;
  const font = 'VAR _font = "' + KVF_FONT + '"';
  const H = {
    StartDate: { desc: 'The first date in the date filter.', params: '', body: 'MIN ( ' + d.col + ' )' },
    EndDate: { desc: 'The last date in the date filter' + (d.asOf ? ', no later than ' + d.asOf + ' (the last date with data)' : '') + '.', params: '',
      body: d.asOf ? 'MIN ( MAX ( ' + d.col + ' ), ' + d.asOf + ' )' : 'MAX ( ' + d.col + ' )' },
    Between: { desc: 'A measure for the dates from _from to _to, whatever dates are filtered.', params: '_m : EXPR, _from : DATETIME, _to : DATETIME',
      body: 'CALCULATE ( _m, REMOVEFILTERS ( ' + d.table + ' ), DATESBETWEEN ( ' + d.col + ', _from, _to ) )' },
    MonthColumns: { desc: 'The 12 monthly columns ending at the date filter’s last month, as SVG. Columns inside the date filter use the accent color. With YoY or a target, a mark on each column shows last year or the target. With _tips, each column gets a hover tooltip.',
      params: '_m : EXPR, _target : EXPR, _compare : STRING, _format : STRING, _lowerIsBetter : BOOLEAN, _unit : STRING, _W : NUMERIC, _left : NUMERIC, _top : NUMERIC, _bottom : NUMERIC, _fs : NUMERIC, _tips : BOOLEAN',
      body: [
        'VAR _c = TRIM ( _compare )', 'VAR _mode = SWITCH ( UPPER ( _c ), "", "MOM", "MOM", "MOM", "YOY", "YOY", "TARGET" )',
        'VAR _name = SWITCH ( _mode, "MOM", "MoM", "YOY", "YoY", UPPER ( LEFT ( _c, 1 ) ) & LOWER ( MID ( _c, 2, 50 ) ) )',
        'VAR _start = ' + F('StartDate') + ' ()', 'VAR _end = ' + F('EndDate') + ' ()',
        'VAR _fullMonth = _end = EOMONTH ( _end, 0 )', 'VAR _anchor = DATE ( YEAR ( _end ), MONTH ( _end ), 1 )',
        '-- The current month compares with the same days last month when the filter ends mid-month',
        'VAR _lm = ' + B('_m', 'EDATE ( _anchor, -1 )', 'IF ( _fullMonth, EOMONTH ( _end, -1 ), EDATE ( _end, -1 ) )'),
        '-- 13 months, so the oldest column also has a month before it; @c is the same dates last year, or the target',
        'VAR _base =', '    ADDCOLUMNS (', '        ADDCOLUMNS (', '            GENERATESERIES ( 0, 12, 1 ),', '            "@s", EDATE ( _anchor, - [Value] ),',
        '            "@e", MIN ( EOMONTH ( EDATE ( _anchor, - [Value] ), 0 ), _end )', '        ),',
        '        "@v", COALESCE ( ' + B('_m', '[@s]', '[@e]') + ', 0 ),', '        "@c",', '            SWITCH (', '                _mode,',
        '                "YOY", ' + B('_m', 'EDATE ( [@s], -12 )', 'EDATE ( [@e], -12 )') + ',', '                "TARGET", ' + B('_target', '[@s]', '[@e]'), '            )', '    )',
        'VAR _pts = FILTER ( _base, [Value] <= 11 )', 'VAR _hi = MAX ( MAXX ( _pts, MAX ( [@v], COALESCE ( [@c], 0 ) ) ), 1E-9 )',
        'VAR _slot = ( _W - 2 * _left ) / 12', 'VAR _barW = _slot * 0.62', 'VAR _markColor = IF ( _mode = "TARGET", "' + P.text + '", "' + P.line + '" )',
        'RETURN', '    CONCATENATEX (', '        _pts,',
        '        VAR _k = [Value]', '        VAR _x = _left + ( 11 - _k ) * _slot + ( _slot - _barW ) / 2',
        '        VAR _h = MAX ( DIVIDE ( [@v], _hi ) * ( _bottom - _top ), 1.5 )', '        VAR _markY = _bottom - MAX ( DIVIDE ( [@c], _hi ) * ( _bottom - _top ), 0 )',
        '        VAR _bar =', '            "<rect class=\'kvbar\' x=\'" & ' + fx('_x') + ' & "\' y=\'" & ' + fx('_bottom - _h'),
        '                & "\' width=\'" & ' + fx('_barW') + ' & "\' height=\'" & ' + fx('_h'),
        '                & "\' rx=\'1.5\' fill=\'" & IF ( [@e] >= _start, "' + P.accent + '", "' + P.track + '" ) & "\'/>"',
        '                & IF (', '                    _mode <> "MOM" && NOT ISBLANK ( [@c] ),',
        '                    "<line x1=\'" & ' + fx('_x - 1.5') + ' & "\' x2=\'" & ' + fx('_x + _barW + 1.5'),
        '                        & "\' y1=\'" & ' + fx('_markY') + ' & "\' y2=\'" & ' + fx('_markY') + ' & "\' stroke=\'" & _markColor & "\' stroke-width=\'1.5\'/>"', '                )',
        '        VAR _cv = [@v]', '        VAR _pv = IF ( _mode = "MOM", IF ( _k = 0, _lm, MAXX ( FILTER ( _base, [Value] = _k + 1 ), [@v] ) ), [@c] )',
        '        VAR _d = ' + X.change('_cv', '_pv'), '        VAR _mtd = IF ( _k = 0 && NOT _fullMonth, " MTD" )',
        '        VAR _cmp =', '            IF (', '                _mode = "TARGET",', '                _name & ": ",',
        '                "vs " & FORMAT ( EDATE ( [@s], IF ( _mode = "YOY", -12, -1 ) ), "mmm yyyy" ) & _mtd & ": "',
        '            ) & IF ( ISBLANK ( _pv ), "–", FORMAT ( _pv, _format ) )',
        ...X.tip('        ', '_x + _barW / 2', '_top - 6', '_W', '_fs', 'FORMAT ( [@s], "mmm yyyy" ) & _mtd', 'FORMAT ( _cv, _format ) & " " & _unit', '_cmp', X.changeText('_d'), X.status('_d', 'text', P.muted)),
        '        RETURN', '            IF (', '                _tips,',
        '                "<g class=\'kvb\'><rect x=\'" & ' + fx('_left + ( 11 - _k ) * _slot') + ' & "\' y=\'" & ' + fx('_top - 6'),
        '                    & "\' width=\'" & ' + fx('_slot') + ' & "\' height=\'" & ' + fx('_bottom - _top + 12') + ' & "\' fill=\'#000000\' fill-opacity=\'0\'/>"',
        '                    & _bar & _tip & "</g>",', '                _bar', '            ),', '        "", [Value], DESC', '    )'].join('\n'), uses: ['StartDate', 'EndDate', 'Between'] }
  };
  const svgOpen = (w, h) => '"<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100%\' viewBox=\'0 0 " & ' + w + ' & " " & ' + h + ' & "\' preserveAspectRatio=\'xMidYMid meet\'>"';
  const txt = (x, y, size, color, extra, text) => '"<text x=\'' + x + '\' y=\'' + y + '\' " & _font & " font-size=\'' + size + '\'' + (extra ? ' ' + extra : '') + ' fill=\'' + color + '\'>" & ' + text + ' & "</text>"';
  const fixedSvg = (w, h) => '"<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'' + w + '\' height=\'' + h + '\' viewBox=\'0 0 ' + w + ' ' + h + '\'>"';
  const cards = {
    summary: { desc: 'The summary card (295 x 170): the value for the date filter, a pill with the change (MoM, YoY or vs a target), the two numbers the pill compares, and 12 monthly columns.',
      params: '_title : STRING, _m : EXPR, _format : STRING, _lowerIsBetter : BOOLEAN, _compare : STRING, _target : EXPR', uses: ['StartDate', 'EndDate', 'Between', 'MonthColumns'],
      body: [...kvfCompareVars(X), ...kvfPillVars(X), 'VAR _pillW = 14 + LEN ( _pill ) * 6.1', ...X.sym,
        ...X.valueText('_valueText', 'COALESCE ( _value, 0 )'), ...X.compact('_nowText', '_now'), ...X.compact('_beforeText', '_before'),
        'VAR _mtd = IF ( _fullMonth, ":", " MTD:" )', 'VAR _labelX = IF ( _fullMonth || _mode <> "MOM", 196, 171 )',
        'VAR _nowLabel = SWITCH ( _mode, "MOM", FORMAT ( _anchor, "mmm yyyy" ) & _mtd, "YOY", "Current:", "Actual:" )',
        'VAR _beforeLabel = SWITCH ( _mode, "MOM", FORMAT ( EDATE ( _anchor, -1 ), "mmm yyyy" ) & _mtd, "YOY", "Last year:", _name & ":" )',
        font, 'VAR _svg =', '    "<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100%\' viewBox=\'0 0 295 170\' preserveAspectRatio=\'xMidYMid meet\'>"',
        '        & "<rect width=\'295\' height=\'170\' rx=\'10\' fill=\'' + P.bg + '\'/>"',
        '        & ' + txt(16, 24, 11, P.muted, "font-weight='600' letter-spacing='0.6'", '_title'),
        '        & ' + txt(16, 40, 10, P.muted, '', 'FORMAT ( _start, "mmm d, yyyy" ) & " – " & FORMAT ( _end, "mmm d, yyyy" )'),
        '        & ' + txt(16, 76, 32, P.text, "font-weight='700'", '_valueText'),
        '        & "<rect x=\'16\' y=\'85\' width=\'" & ' + fx('_pillW') + ' & "\' height=\'18\' rx=\'9\' fill=\'" & _pillFill & "\'/>"',
        '        & "<text x=\'23\' y=\'98\' " & _font & " font-size=\'10.5\' font-weight=\'600\' fill=\'" & _pillInk & "\'>" & _pill & "</text>"',
        '        -- The two numbers the pill compares',
        '        & "<text x=\'" & _labelX & "\' y=\'56\' " & _font & " font-size=\'10.5\' fill=\'' + P.muted + '\'>" & _nowLabel & "</text>"',
        '        & "<text x=\'279\' y=\'56\' " & _font & " font-size=\'10.5\' font-weight=\'600\' fill=\'' + P.text + '\' text-anchor=\'end\'>" & _nowText & "</text>"',
        '        & "<text x=\'" & _labelX & "\' y=\'72\' " & _font & " font-size=\'10.5\' fill=\'' + P.muted + '\'>" & _beforeLabel & "</text>"',
        '        & "<text x=\'279\' y=\'72\' " & _font & " font-size=\'10.5\' font-weight=\'600\' fill=\'' + P.text + '\' text-anchor=\'end\'>" & _beforeText & "</text>"',
        '        & "<line x1=\'16\' y1=\'148.5\' x2=\'279\' y2=\'148.5\' stroke=\'' + P.track + '\'/>"',
        '        & ' + txt(16, 162, 9.5, P.line, '', 'FORMAT ( EDATE ( _anchor, -11 ), "mmm yyyy" )'),
        '        & ' + txt(279, 162, 9.5, P.line, "text-anchor='end'", 'FORMAT ( _anchor, "mmm yyyy" )'),
        '        -- Columns last, so each tooltip draws over the text above',
        '        & ' + F('MonthColumns') + ' ( _m, _target, _compare, _format, _lowerIsBetter, LOWER ( _title ), 295, 16, 114, 148, 10, ' + (tips ? 'TRUE' : 'FALSE') + ' () )',
        '        & "</svg>"', 'RETURN', '    IF ( _end >= _start, ' + X.out('_svg') + ' )'] },
    trend: { desc: 'The trend tile (_width x 130): the value for the date filter, a pill with the change (MoM, YoY or vs a target) and 12 monthly columns.',
      params: '_title : STRING, _m : EXPR, _format : STRING, _lowerIsBetter : BOOLEAN, _width : INT64, _compare : STRING, _target : EXPR', uses: ['StartDate', 'EndDate', 'Between', 'MonthColumns'],
      body: [...kvfCompareVars(X), ...kvfPillVars(X), 'VAR _pillW = 12 + LEN ( _pill ) * 5.9', ...X.sym, ...X.valueText('_valueText', '_value'),
        font, 'VAR _svg =', '    ' + svgOpen('_width', 130),
        '        & "<rect width=\'" & _width & "\' height=\'130\' rx=\'8\' fill=\'' + P.bg + '\'/>"',
        '        & ' + txt(12, 19, 10, P.muted, "font-weight='600' letter-spacing='0.5'", '_title'),
        '        & ' + txt(12, 32, 9, P.muted, '', 'FORMAT ( _start, "mmm d, yyyy" ) & " – " & FORMAT ( _end, "mmm d, yyyy" )'),
        '        & ' + txt(12, 61, 24, P.text, "font-weight='700'", '_valueText'),
        '        & "<rect x=\'12\' y=\'68\' width=\'" & ' + fx('_pillW') + ' & "\' height=\'15\' rx=\'7.5\' fill=\'" & _pillFill & "\'/>"',
        '        & "<text x=\'18\' y=\'79\' " & _font & " font-size=\'9\' font-weight=\'600\' fill=\'" & _pillInk & "\'>" & _pill & "</text>"',
        '        & "<line x1=\'12\' y1=\'110.5\' x2=\'" & _width - 12 & "\' y2=\'110.5\' stroke=\'' + P.track + '\'/>"',
        '        & ' + txt(12, 122, 8.5, P.line, '', 'FORMAT ( EDATE ( _anchor, -11 ), "mmm yyyy" )'),
        '        & "<text x=\'" & _width - 12 & "\' y=\'122\' " & _font & " font-size=\'8.5\' fill=\'' + P.line + '\' text-anchor=\'end\'>" & FORMAT ( _anchor, "mmm yyyy" ) & "</text>"',
        '        & ' + F('MonthColumns') + ' ( _m, _target, _compare, _format, _lowerIsBetter, LOWER ( _title ), _width, 12, 90, 110, 9, ' + (tips ? 'TRUE' : 'FALSE') + ' () )',
        '        & "</svg>"', 'RETURN', '    IF ( _end >= _start, ' + X.out('_svg') + ' )'] },
    rolling: { desc: 'The rolling tile (_width x 130), for a measure over the last _days days: the value up to the last date, the change from the _days before, and 12 back-to-back windows of _days days.',
      params: '_title : STRING, _m : EXPR, _days : INT64, _format : STRING, _lowerIsBetter : BOOLEAN, _width : INT64', uses: ['StartDate', 'EndDate', 'Between'],
      body: ['VAR _start = ' + F('StartDate') + ' ()', 'VAR _end = ' + F('EndDate') + ' ()',
        'VAR _now = ' + B('_m', '_end - _days + 1', '_end'), 'VAR _prior = ' + B('_m', '_end - 2 * _days + 1', '_end - _days'),
        'VAR _change = ' + X.change('_now', '_prior'),
        'VAR _pill = IF ( ISBLANK ( _change ), "No data in prior " & _days & " days", ' + X.changeText('_change') + ' & " vs prior " & _days & " days" )',
        'VAR _pillW = 12 + LEN ( _pill ) * 5.9', 'VAR _pillFill = ' + X.status('_change', 'fill', P.track), 'VAR _pillInk = ' + X.status('_change', 'text', P.muted),
        ...X.sym, ...X.valueText('_valueText', '_now'),
        '-- 13 windows, so the oldest column also has a window before it',
        'VAR _base =', '    ADDCOLUMNS (', '        ADDCOLUMNS ( GENERATESERIES ( 0, 12, 1 ), "@s", _end - ( [Value] + 1 ) * _days + 1, "@e", _end - [Value] * _days ),',
        '        "@v", COALESCE ( ' + B('_m', '[@s]', '[@e]') + ', 0 )', '    )',
        'VAR _pts = FILTER ( _base, [Value] <= 11 )', 'VAR _hi = MAX ( MAXX ( _pts, [@v] ), 1E-9 )', 'VAR _slot = ( _width - 24 ) / 12', 'VAR _barW = _slot * 0.62',
        font, 'VAR _bars =', '    CONCATENATEX (', '        _pts,', '        VAR _k = [Value]', '        VAR _x = 12 + ( 11 - _k ) * _slot + ( _slot - _barW ) / 2',
        '        VAR _h = MAX ( DIVIDE ( [@v], _hi ) * 20, 1.5 )',
        '        VAR _bar =', '            "<rect class=\'kvbar\' x=\'" & ' + fx('_x') + ' & "\' y=\'" & ' + fx('110 - _h') + ' & "\' width=\'" & ' + fx('_barW'),
        '                & "\' height=\'" & ' + fx('_h') + ' & "\' rx=\'1\' fill=\'" & IF ( _k = 0, "' + P.accent + '", "' + P.track + '" ) & "\'/>"']
        .concat(tips ? ['        VAR _cv = [@v]', '        VAR _pv = MAXX ( FILTER ( _base, [Value] = _k + 1 ), [@v] )', '        VAR _d = ' + X.change('_cv', '_pv'),
          ...X.tip('        ', '_x + _barW / 2', '84', '_width', '9', 'FORMAT ( [@s], "mmm d" ) & " – " & FORMAT ( [@e], "mmm d, yyyy" )', 'FORMAT ( _cv, _format ) & " in " & _days & " days"',
            '"vs prior " & _days & " days: " & IF ( ISBLANK ( _pv ), "–", FORMAT ( _pv, _format ) )', X.changeText('_d'), X.status('_d', 'text', P.muted)),
          '        RETURN', '            "<g class=\'kvb\'><rect x=\'" & ' + fx('12 + ( 11 - _k ) * _slot') + ' & "\' y=\'84\' width=\'" & ' + fx('_slot') + ' & "\' height=\'32\' fill=\'#000000\' fill-opacity=\'0\'/>"',
          '                & _bar & _tip & "</g>",'] : ['        RETURN', '            _bar,'])
        .concat(['        "", [Value], DESC', '    )', 'VAR _svg =', '    ' + svgOpen('_width', 130),
          '        & "<rect width=\'" & _width & "\' height=\'130\' rx=\'8\' fill=\'' + P.bg + '\'/>"',
          '        & ' + txt(12, 19, 10, P.muted, "font-weight='600' letter-spacing='0.5'", '_title'),
          '        & ' + txt(12, 32, 9, P.muted, '', 'FORMAT ( _end - _days + 1, "mmm d, yyyy" ) & " – " & FORMAT ( _end, "mmm d, yyyy" )'),
          '        & ' + txt(12, 61, 24, P.text, "font-weight='700'", '_valueText'),
          '        & "<rect x=\'12\' y=\'68\' width=\'" & ' + fx('_pillW') + ' & "\' height=\'15\' rx=\'7.5\' fill=\'" & _pillFill & "\'/>"',
          '        & "<text x=\'18\' y=\'79\' " & _font & " font-size=\'9\' font-weight=\'600\' fill=\'" & _pillInk & "\'>" & _pill & "</text>"',
          '        & "<line x1=\'12\' y1=\'110.5\' x2=\'" & _width - 12 & "\' y2=\'110.5\' stroke=\'' + P.track + '\'/>"',
          '        & ' + txt(12, 122, 8.5, P.line, '', 'FORMAT ( _end - 12 * _days + 1, "mmm d, yyyy" )'),
          '        & "<text x=\'" & _width / 2 & "\' y=\'122\' " & _font & " font-size=\'8.5\' fill=\'' + P.line + '\' text-anchor=\'middle\'>1 bar = " & _days & " days</text>"',
          '        & "<text x=\'" & _width - 12 & "\' y=\'122\' " & _font & " font-size=\'8.5\' fill=\'' + P.line + '\' text-anchor=\'end\'>" & FORMAT ( _end, "mmm d, yyyy" ) & "</text>"',
          '        & _bars', '        & "</svg>"', 'RETURN', '    IF ( _end >= _start, ' + X.out('_svg') + ' )']) },
    snapshot: { desc: 'The snapshot tile (_width x _height), for a value that doesn’t move with the dates: title, caption, value and, when _share isn’t blank, a share bar.',
      params: '_title : STRING, _text : STRING, _caption : STRING, _share : NUMERIC, _width : INT64, _height : INT64', uses: [],
      body: [font, 'VAR _bar =', '    IF (', '        NOT ISBLANK ( _share ),',
        '        "<rect x=\'12\' y=\'" & _height - 22 & "\' width=\'" & _width - 24 & "\' height=\'6\' rx=\'3\' fill=\'' + P.track + '\'/>"',
        '            & "<rect x=\'12\' y=\'" & _height - 22 & "\' width=\'" & ' + fx('MAX ( MIN ( _share, 1 ), 0 ) * ( _width - 24 )') + ' & "\' height=\'6\' rx=\'3\' fill=\'' + P.accent + '\'/>"', '    )',
        'VAR _svg =', '    ' + svgOpen('_width', '_height'),
        '        & "<rect width=\'" & _width & "\' height=\'" & _height & "\' rx=\'8\' fill=\'' + P.bg + '\'/>"',
        '        & ' + txt(12, 19, 10, P.muted, "font-weight='600' letter-spacing='0.5'", '_title'),
        '        & ' + txt(12, 32, 9, P.muted, '', '_caption'),
        '        & ' + txt(12, 61, 24, P.text, "font-weight='700'", '_text'),
        '        & _bar', '        & "</svg>"', 'RETURN', '    ' + X.out('_svg')] },
    bullet: { desc: 'A bullet chart (120 x 24): the bar is _value in its status color against _target, the dark mark is _target.',
      params: '_value : NUMERIC, _target : NUMERIC, _lowerIsBetter : BOOLEAN', uses: [],
      body: ['VAR _max = MAX ( MAX ( _value, _target ), 0 ) * 1.15', 'VAR _valueW = MAX ( 0, MIN ( 1, DIVIDE ( _value, _max ) ) ) * 112',
        'VAR _targetX = 4 + MAX ( 0, MIN ( 1, DIVIDE ( _target, _max ) ) ) * 112', 'VAR _change = ' + X.change('_value', '_target'),
        'VAR _color = ' + X.status('_change', 'text', P.text),
        'VAR _svg =', '    ' + fixedSvg(120, 24), '        & "<rect x=\'4\' y=\'6\' width=\'112\' height=\'12\' fill=\'' + P.track + '\'/>"',
        '        & "<rect x=\'4\' y=\'8\' width=\'" & ' + fx('_valueW') + ' & "\' height=\'8\' fill=\'" & _color & "\'/>"',
        '        & "<rect x=\'" & ' + fx('_targetX - 1') + ' & "\' y=\'3\' width=\'2\' height=\'18\' fill=\'' + P.text + '\'/>"', '        & "</svg>"',
        'RETURN', '    IF ( NOT ISBLANK ( _value ) && NOT ISBLANK ( _target ), ' + X.out('_svg') + ' )'] },
    progress: { desc: 'A progress bar (120 x 24): _value as a % of _target, in its status color.',
      params: '_value : NUMERIC, _target : NUMERIC, _lowerIsBetter : BOOLEAN', uses: [],
      body: ['VAR _pct = DIVIDE ( _value, _target )', 'VAR _w = MAX ( 0, MIN ( 1, _pct ) ) * 88', 'VAR _change = ' + X.change('_value', '_target'),
        'VAR _color = ' + X.status('_change', 'text', P.text),
        'VAR _svg =', '    ' + fixedSvg(120, 24), '        & "<rect x=\'2\' y=\'8\' width=\'88\' height=\'8\' rx=\'4\' fill=\'' + P.track + '\'/>"',
        '        & "<rect x=\'2\' y=\'8\' width=\'" & ' + fx('_w') + ' & "\' height=\'8\' rx=\'4\' fill=\'" & _color & "\'/>"',
        '        & "<text x=\'118\' y=\'16\' text-anchor=\'end\' ' + KVF_FONT + ' font-size=\'11\' fill=\'' + P.text + '\'>" & FORMAT ( _pct, "0%" ) & "</text>"', '        & "</svg>"',
        'RETURN', '    IF ( NOT ISBLANK ( _pct ), ' + X.out('_svg') + ' )'] },
    spark: { desc: 'A sparkline (120 x 32): the 12 months ending at the date filter’s last month, the last point in the status color of the change (MoM, YoY or vs a target).',
      params: '_m : EXPR, _lowerIsBetter : BOOLEAN, _compare : STRING, _target : EXPR', uses: ['StartDate', 'EndDate', 'Between'],
      body: [...kvfCompareVars(X),
        'VAR _pts =', '    FILTER (', '        ADDCOLUMNS (', '            GENERATESERIES ( 0, 11, 1 ),',
        '            "@v", ' + B('_m', 'EDATE ( _anchor, - [Value] )', 'MIN ( EOMONTH ( EDATE ( _anchor, - [Value] ), 0 ), _end )'), '        ),', '        NOT ISBLANK ( [@v] )', '    )',
        'VAR _lo = MINX ( _pts, [@v] )', 'VAR _hi = MAXX ( _pts, [@v] )', 'VAR _range = IF ( _hi = _lo, 1, _hi - _lo )',
        'VAR _line = CONCATENATEX ( _pts, ' + fx('2 + ( 11 - [Value] ) * 116 / 11') + ' & "," & ' + fx('29 - ( [@v] - _lo ) * 26 / _range') + ', " ", [Value], DESC )',
        'VAR _lastK = MINX ( _pts, [Value] )', 'VAR _lastV = MAXX ( FILTER ( _pts, [Value] = _lastK ), [@v] )',
        'VAR _color = ' + X.status('_change', 'text', P.text),
        'VAR _svg =', '    ' + fixedSvg(120, 32),
        '        & "<polyline points=\'" & _line & "\' fill=\'none\' stroke=\'' + P.line + '\' stroke-width=\'1.5\' stroke-linejoin=\'round\'/>"',
        '        & "<circle cx=\'" & ' + fx('2 + ( 11 - _lastK ) * 116 / 11') + ' & "\' cy=\'" & ' + fx('29 - ( _lastV - _lo ) * 26 / _range') + ' & "\' r=\'2.5\' fill=\'" & _color & "\'/>"',
        '        & "</svg>"', 'RETURN', '    IF ( COUNTROWS ( _pts ) >= 2, ' + X.out('_svg') + ' )'] },
    varbar: { desc: 'A variance bar (120 x 24): how far _value is above or below _base, as a %, in its status color. Full width is ±25%.',
      params: '_value : NUMERIC, _base : NUMERIC, _lowerIsBetter : BOOLEAN', uses: [],
      body: ['VAR _change = ' + X.change('_value', '_base'), '-- full width = +/-25%', 'VAR _w = MIN ( ABS ( _change ) / 0.25, 1 ) * 50', 'VAR _x = IF ( _change >= 0, 60, 60 - _w )',
        'VAR _color = ' + X.status('_change', 'text', P.text),
        'VAR _svg =', '    ' + fixedSvg(120, 24),
        '        & "<rect x=\'" & ' + fx('_x') + ' & "\' y=\'6\' width=\'" & ' + fx('_w') + ' & "\' height=\'12\' fill=\'" & _color & "\'/>"',
        '        & "<rect x=\'59.5\' y=\'2\' width=\'1\' height=\'20\' fill=\'' + P.text + '\'/>"',
        '        & "<text x=\'" & IF ( _change >= 0, 57, 63 ) & "\' y=\'16\' text-anchor=\'" & IF ( _change >= 0, "end", "start" ) & "\' ' + KVF_FONT + ' font-size=\'10\' fill=\'' + P.text + '\'>" & FORMAT ( _change, "+0%;-0%;0%" ) & "</text>"',
        '        & "</svg>"', 'RETURN', '    IF ( NOT ISBLANK ( _change ), ' + X.out('_svg') + ' )'] }
  };
  const c = cards[s.id], need = new Set();
  const add = n => { if (need.has(n)) return; (H[n].uses || []).forEach(add); need.add(n); };
  c.uses.forEach(add);
  const L = ['StartDate', 'EndDate', 'Between', 'MonthColumns'].filter(n => need.has(n)).map(n => Object.assign({ name: n }, H[n]));
  L.push({ name: kvfFnName(cfg), desc: c.desc + (html ? ' As HTML for the HTML Content visual' + (s.tips ? ', with a tooltip on each column.' : '.') : ' As an image URL: set the measure’s data category to Image URL.'), params: c.params, body: c.body.join('\n'), card: true });
  return L.map(f => Object.assign({}, f, { name: F(f.name) }));
}

/* ---------- a measure per KPI that calls the card function ---------- */
// What a KPI's card compares with: the choice in Step 5, or (auto) its target, else last year when it has a comparison, else the month before
const KVF_COMPARES = [{ id: 'auto', name: 'Each KPI’s target, else last year, else last month' }, { id: 'mom', name: 'The month before (MoM)' }, { id: 'yoy', name: 'The same dates last year (YoY)' }, { id: 'target', name: 'The KPI’s target or budget' }];
function kvfCompare(k, cfg){
  const h = kvHas(k), c = KVF_COMPARES.some(x => x.id === cfg.fnCompare) ? cfg.fnCompare : 'auto';
  const pick = c === 'auto' ? (h.target ? 'target' : h.compare ? 'yoy' : 'mom') : c === 'target' && !h.target ? 'mom' : c;
  const word = pick === 'target' ? (/budget/i.test(k.target || '') ? 'Budget' : /plan/i.test(k.target || '') ? 'Plan' : /goal/i.test(k.target || '') ? 'Goal' : 'Target') : pick === 'yoy' ? 'YoY' : 'MoM';
  return { mode: pick, word, target: pick === 'target' ? kvRef(k.target) : 'BLANK ()' };
}
// Whether a KPI has what the chosen card needs
function kvfFits(k, cfg){ const n = kvfStyle(cfg).need, h = kvHas(k); return !n || (n === 'target' ? h.target : h.base); }
// The one-line call for a KPI ('' when it lacks what the card needs)
function kvfCall(k, cfg){
  const s = kvfStyle(cfg), fn = kvfN(kvfFnName(cfg)), h = kvHas(k), fmt = daxString(k.format || '#,0'), title = daxString(kvName(k).toUpperCase()), m = kvRef(k.measure), lower = k.better === 'lower' ? 'TRUE ()' : 'FALSE ()';
  const cmp = kvfCompare(k, cfg), tail = daxString(cmp.word) + ', ' + cmp.target, call = args => fn + ' ( ' + args.join(', ') + ' )';
  if (!kvfFits(k, cfg)) return '';
  switch (s.id) {
    case 'snapshot': return call([title, 'FORMAT ( ' + m + ', ' + fmt + ' )', h.target ? '"Target " & FORMAT ( ' + kvRef(k.target) + ', ' + fmt + ' )' : '"All dates"', h.pct ? m : 'BLANK ()', s.w, s.h]);
    case 'trend': return call([title, m, fmt, lower, s.w, tail]);
    case 'rolling': return call([title, m, kvfDays(cfg), fmt, lower, s.w]);
    case 'bullet': case 'progress': return call([m, kvRef(k.target), lower]);
    case 'varbar': return call([m, kvRef(h.target ? k.target : k.compare), lower]);
    case 'spark': return call([m, lower, tail]);
    default: return call([title, m, fmt, lower, tail]);
  }
}
function kvfMeasures(k, cfg){
  const s = kvfStyle(cfg), html = kvfOut(cfg) === 'html', e = kvfCall(k, cfg);
  if (!e) return [];
  const m = { name: kvMName(k, s.suffix), description: s.name + ' for ' + kvName(k) + (html ? ' as HTML, for the HTML Content visual' : ' as an image') + ' (' + s.w + ' x ' + s.h + ').', expression: e };
  if (!html) m.dataCategory = 'ImageUrl';
  return [m];
}

/* ---------- TMDL and the test query ---------- */
// A function in a createOrReplace script: the function one tab in, its expression three tabs in (deeper than its
// properties, as for a measure). No annotations: they aren't needed, and a script with many of them didn't apply.
function kvfTmdlBlocks(cfg){
  const T = TAB, L = [];
  kvfLibrary(cfg).forEach(f => {
    L.push(T + '/// ' + f.desc, T + 'function ' + qName(f.name) + ' =', T.repeat(3) + '(' + (f.params ? ' ' + f.params + ' ' : '') + ') =>');
    f.body.split('\n').forEach(l => L.push(l ? T.repeat(4) + l : ''));
    L.push('');
  });
  return L;
}
function kvfDefine(cfg){
  const I = '    ', L = [];
  kvfLibrary(cfg).forEach(f => {
    L.push(I + 'FUNCTION ' + f.name + ' = (' + (f.params ? ' ' + f.params + ' ' : '') + ') =>');
    f.body.split('\n').forEach(l => L.push(I + I + l));
  });
  return L;
}

/* ---------- previews in the page (the same drawing, with the preview's numbers) ---------- */
const kvfF = x => (Math.round(x * 10) / 10).toFixed(1);
const KVF_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function kvfCompact(v, fmt){
  if (v == null || !isFinite(v)) return '–';
  if (kvIsPct(fmt)) return kvFmt(v, fmt);
  const a = Math.abs(v), cur = ((fmt || '').replace(/\\/g, '').match(/^[$€£¥]/) || [''])[0];
  return a < 999.5 ? kvFmt(v, fmt) : a < 9950 ? cur + (v / 1e3).toFixed(1) + 'K' : a < 999500 ? cur + Math.round(v / 1e3) + 'K' : a < 9950000 ? cur + (v / 1e6).toFixed(1) + 'M' : cur + Math.round(v / 1e6) + 'M';
}
function kvfValueText(v, fmt){
  if (v == null || !isFinite(v)) return '–';
  if (kvIsPct(fmt)) return kvFmt(v, fmt);
  const a = Math.abs(v), cur = ((fmt || '').replace(/\\/g, '').match(/^[$€£¥]/) || [''])[0];
  return a >= 1e6 ? cur + (v / 1e6).toFixed(1) + 'M' : a >= 1e4 ? cur + (v / 1e3).toFixed(1) + 'K' : kvFmt(v, fmt);
}
// ifBlank: the color when there's nothing to compare with (labels for the cards, text for the small charts)
function kvfStatus(d, lower, fill, cfg, ifBlank){
  const P = kvInk(cfg), C = cfg.colors, b = (+cfg.band || 0) / 100;
  if (d == null || !isFinite(d)) return ifBlank || (fill ? P.track : P.muted);
  const s = lower ? -d : d, st = s >= b && s > 0 ? 'good' : s <= -b && s < 0 ? 'bad' : 'neutral';
  return C[st][fill ? 'fill' : 'text'];
}
const kvfChange = (now, before) => before == null || before === 0 ? null : ((now || 0) - before) / Math.abs(before);
const kvfChangeText = d => d == null ? '' : kvArrow(d) + ' ' + (Math.abs(d) * 100).toFixed(1) + '%';
// The month labels of the preview: the 12 months ending last month
function kvfMonths(){ const now = new Date(), y = now.getFullYear(), m = now.getMonth() - 1; return Array.from({ length: 13 }, (_, i) => { const d = new Date(y, m - (12 - i), 1); return KVF_MON[d.getMonth()] + ' ' + d.getFullYear(); }); }
const kvfDay = (d, year) => KVF_MON[d.getMonth()] + ' ' + d.getDate() + (year ? ', ' + d.getFullYear() : '');
function kvfTip(cx, bottom, W, fs, head, value, cmp, chg, col, P){
  const lh = fs + 4, len = Math.max(head.length, value.length, cmp.length + (chg ? chg.length + 2 : 0)), tw = Math.min(len * fs * 0.56 + 16, W - 8), th = 3 * lh + 10;
  const x = Math.max(4, Math.min(W - 4 - tw, cx - tw / 2)), y = bottom - th, tx = kvfF(x + 8), font = KVF_FONT + " font-size='" + kvfF(fs) + "'";
  return "<g class='kvt' visibility='hidden'><rect x='" + kvfF(x) + "' y='" + kvfF(y) + "' width='" + kvfF(tw) + "' height='" + kvfF(th) + "' rx='4' fill='" + P.bg + "' stroke='" + P.line + "' stroke-width='0.75'/>"
    + "<text x='" + tx + "' y='" + kvfF(y + 4 + fs) + "' " + font + " font-weight='700' fill='" + P.accent + "'>" + kvXml(head) + '</text>'
    + "<text x='" + tx + "' y='" + kvfF(y + 4 + fs + lh) + "' " + font + " font-weight='600' fill='" + P.text + "'>" + kvXml(value) + '</text>'
    + "<text x='" + tx + "' y='" + kvfF(y + 4 + fs + 2 * lh) + "' " + font + " fill='" + P.muted + "'>" + kvXml(cmp) + (chg ? "<tspan dx='6' font-weight='600' fill='" + col + "'>" + kvXml(chg) + '</tspan>' : '') + '</text></g>';
}
// The comparison for the preview: per month (last year or the target), and the two numbers the pill compares
function kvfPreviewCompare(k, cfg){
  const n = kvNums(k), cmp = kvfCompare(k, cfg), pts = n.trend.slice(-12), ly = n.c != null && n.v ? n.c / n.v : 0.94, tg = n.t != null && n.v ? n.t / n.v : 1.04;
  const per = cmp.mode === 'yoy' ? pts.map((v, i) => v * ly * (1 + 0.03 * Math.sin(i * 1.7))) : cmp.mode === 'target' ? pts.map((v, i) => v * tg * (1 - 0.02 * Math.cos(i))) : null;
  const t = n.trend.slice(-13), cm = t[t.length - 1], lm = t.length > 1 ? t[t.length - 2] : null;
  const now = cmp.mode === 'mom' ? cm : n.v, before = cmp.mode === 'mom' ? lm : cmp.mode === 'yoy' ? (n.c != null ? n.c : n.v * ly) : (n.t != null ? n.t : n.v * tg);
  const d = kvfChange(now, before);
  const pill = d == null ? (cmp.mode === 'mom' ? 'No data last month' : cmp.mode === 'yoy' ? 'No data last year' : 'No ' + cmp.word.toLowerCase()) : kvfChangeText(d) + (cmp.mode === 'target' ? ' vs ' + cmp.word.toLowerCase() : ' ' + cmp.word);
  return Object.assign(cmp, { per, d, pill, now, before, n });
}
const kvfLastYear = label => label.replace(/\d{4}$/, y => +y - 1);
function kvfColumns(vals, k, cfg, W, left, top, bottom, fs, tips, cmp){
  const P = kvInk(cfg), mon = kvfMonths(), pts = vals.slice(-12), per = cmp && cmp.per, hi = Math.max(...pts, ...(per || []), 1e-9), slot = (W - 2 * left) / 12, bw = slot * 0.62, unit = kvName(k).toLowerCase();
  return pts.map((v, i) => {
    const x = left + i * slot + (slot - bw) / 2, h = Math.max(v / hi * (bottom - top), 1.5);
    const pv = per ? per[i] : i ? pts[i - 1] : vals.length > 12 ? vals[vals.length - 13] : null, d = kvfChange(v, pv);
    const my = per ? bottom - Math.max(per[i] / hi * (bottom - top), 0) : 0;
    const bar = "<rect class='kvbar' x='" + kvfF(x) + "' y='" + kvfF(bottom - h) + "' width='" + kvfF(bw) + "' height='" + kvfF(h) + "' rx='1.5' fill='" + P.accent + "'/>"
      + (per ? "<line x1='" + kvfF(x - 1.5) + "' x2='" + kvfF(x + bw + 1.5) + "' y1='" + kvfF(my) + "' y2='" + kvfF(my) + "' stroke='" + (cmp.mode === 'target' ? P.text : P.line) + "' stroke-width='1.5'/>" : '');
    if (!tips) return bar;
    const what = cmp && cmp.mode === 'target' ? cmp.word + ': ' : 'vs ' + (cmp && cmp.mode === 'yoy' ? kvfLastYear(mon[i + 1]) : mon[i]) + ': ';
    return "<g class='kvb'><rect x='" + kvfF(left + i * slot) + "' y='" + kvfF(top - 6) + "' width='" + kvfF(slot) + "' height='" + kvfF(bottom - top + 12) + "' fill='#000000' fill-opacity='0'/>" + bar
      + kvfTip(x + bw / 2, top - 6, W, fs, mon[i + 1], kvFmt(v, k.format) + ' ' + unit, what + (pv == null ? '–' : kvFmt(pv, k.format)), kvfChangeText(d), kvfStatus(d, k.better === 'lower', false, cfg), P) + '</g>';
  }).join('');
}
// One card for the preview, as HTML with tooltips (tips) or as the image; '' when the KPI lacks what the card needs
function kvfPreviewSvg(k, cfg, style, tips){
  const P = kvInk(cfg), n = kvNums(k), h = kvHas(k), fmt = k.format, mon = kvfMonths(), font = KVF_FONT, lower = k.better === 'lower';
  const cmp = kvfPreviewCompare(k, cfg), d = cmp.d, pill = cmp.pill, title = kvXml(kvName(k).toUpperCase());
  const txt = (x, y, size, col, s, extra) => "<text x='" + x + "' y='" + y + "' " + font + " font-size='" + size + "' fill='" + col + "'" + (extra || '') + '>' + s + '</text>';
  const need = (KVF_STYLES.find(s => s.id === style) || {}).need;
  if (need === 'target' ? !h.target : need === 'base' ? !h.base : false) return '';
  if (style === 'bullet' || style === 'progress') { const c = kvfStatus(kvfChange(n.v, n.t), lower, false, cfg, P.text); return style === 'bullet' ? kvSvgBullet(n, c, P) : kvSvgProgress(n, c, P); }
  if (style === 'varbar') { const dv = kvfChange(n.v, h.target ? n.t : n.c); return kvSvgVarBar(dv, kvfStatus(dv, lower, false, cfg, P.text), P); }
  if (style === 'spark') return kvSvgSpark(n, kvfStatus(d, lower, false, cfg, P.text), P);
  if (style === 'snapshot') {
    const W = 232, H = 130, share = h.pct ? kvClamp(n.v, 0, 1) : null;
    return "<svg xmlns='http://www.w3.org/2000/svg' width='100%' viewBox='0 0 " + W + ' ' + H + "'>" + "<rect width='" + W + "' height='" + H + "' rx='8' fill='" + P.bg + "'/>"
      + txt(12, 19, 10, P.muted, title, " font-weight='600' letter-spacing='0.5'") + txt(12, 32, 9, P.muted, h.target ? 'Target ' + kvXml(kvFmt(n.t, fmt)) : 'All dates')
      + txt(12, 61, 24, P.text, kvXml(kvFmt(n.v, fmt)), " font-weight='700'")
      + (share != null ? "<rect x='12' y='" + (H - 22) + "' width='" + (W - 24) + "' height='6' rx='3' fill='" + P.track + "'/><rect x='12' y='" + (H - 22) + "' width='" + kvfF(share * (W - 24)) + "' height='6' rx='3' fill='" + P.accent + "'/>" : '') + '</svg>';
  }
  if (style === 'rolling') {
    // the preview's trend as 12 windows of N days ending on the last day of last month
    const W = 232, D = kvfDays(cfg), t = n.trend.slice(-13), pts = t.slice(-12), prev = t.length > 12 ? t[0] : null, hi = Math.max(...pts, 1e-9), slot = (W - 24) / 12, bw = slot * 0.62;
    const now = new Date(), end = new Date(now.getFullYear(), now.getMonth(), 0), day = j => new Date(end.getFullYear(), end.getMonth(), end.getDate() - j);
    const dr = kvfChange(pts[11], pts[10]), rp = dr == null ? 'No data in prior ' + D + ' days' : kvfChangeText(dr) + ' vs prior ' + D + ' days', pw = 12 + rp.length * 5.9;
    const bars = pts.map((v, i) => {
      const k2 = 11 - i, x = 12 + i * slot + (slot - bw) / 2, hh = Math.max(v / hi * 20, 1.5);
      const bar = "<rect class='kvbar' x='" + kvfF(x) + "' y='" + kvfF(110 - hh) + "' width='" + kvfF(bw) + "' height='" + kvfF(hh) + "' rx='1' fill='" + (k2 === 0 ? P.accent : P.track) + "'/>";
      if (!tips) return bar;
      const pv = i ? pts[i - 1] : prev, dd = kvfChange(v, pv);
      return "<g class='kvb'><rect x='" + kvfF(12 + i * slot) + "' y='84' width='" + kvfF(slot) + "' height='32' fill='#000000' fill-opacity='0'/>" + bar
        + kvfTip(x + bw / 2, 84, W, 9, kvfDay(day((k2 + 1) * D - 1)) + ' – ' + kvfDay(day(k2 * D), true), kvFmt(v, fmt) + ' in ' + D + ' days', 'vs prior ' + D + ' days: ' + (pv == null ? '–' : kvFmt(pv, fmt)), kvfChangeText(dd), kvfStatus(dd, lower, false, cfg), P) + '</g>';
    }).join('');
    return "<svg xmlns='http://www.w3.org/2000/svg' width='100%' viewBox='0 0 " + W + " 130'>" + "<rect width='" + W + "' height='130' rx='8' fill='" + P.bg + "'/>"
      + txt(12, 19, 10, P.muted, title, " font-weight='600' letter-spacing='0.5'") + txt(12, 32, 9, P.muted, kvXml(kvfDay(day(D - 1), true) + ' – ' + kvfDay(end, true)))
      + txt(12, 61, 24, P.text, kvXml(kvfValueText(pts[11], fmt)), " font-weight='700'")
      + "<rect x='12' y='68' width='" + kvfF(pw) + "' height='15' rx='7.5' fill='" + kvfStatus(dr, lower, true, cfg) + "'/>" + txt(18, 79, 9, kvfStatus(dr, lower, false, cfg), kvXml(rp), " font-weight='600'")
      + "<line x1='12' y1='110.5' x2='" + (W - 12) + "' y2='110.5' stroke='" + P.track + "'/>" + txt(12, 122, 8.5, P.line, kvXml(kvfDay(day(12 * D - 1), true)))
      + txt(W / 2, 122, 8.5, P.line, '1 bar = ' + D + ' days', " text-anchor='middle'") + txt(W - 12, 122, 8.5, P.line, kvXml(kvfDay(end, true)), " text-anchor='end'") + bars + '</svg>';
  }
  if (style === 'trend') {
    const W = 232, pw = 12 + pill.length * 5.9;
    return "<svg xmlns='http://www.w3.org/2000/svg' width='100%' viewBox='0 0 " + W + " 130'>" + "<rect width='" + W + "' height='130' rx='8' fill='" + P.bg + "'/>"
      + txt(12, 19, 10, P.muted, title, " font-weight='600' letter-spacing='0.5'") + txt(12, 32, 9, P.muted, 'Last 12 months')
      + txt(12, 61, 24, P.text, kvXml(kvfValueText(n.v, fmt)), " font-weight='700'")
      + "<rect x='12' y='68' width='" + kvfF(pw) + "' height='15' rx='7.5' fill='" + kvfStatus(d, lower, true, cfg) + "'/>" + txt(18, 79, 9, kvfStatus(d, lower, false, cfg), kvXml(pill), " font-weight='600'")
      + "<line x1='12' y1='110.5' x2='" + (W - 12) + "' y2='110.5' stroke='" + P.track + "'/>" + txt(12, 122, 8.5, P.line, mon[1]) + txt(W - 12, 122, 8.5, P.line, mon[12], " text-anchor='end'")
      + kvfColumns(n.trend, k, cfg, W, 12, 90, 110, 9, tips, cmp) + '</svg>';
  }
  // the summary card: the two lines are the two numbers the pill compares
  const pw = 14 + pill.length * 6.1, row = (y, label, v) => txt(196, y, 10.5, P.muted, kvXml(label)) + txt(279, y, 10.5, P.text, kvXml(v), " font-weight='600' text-anchor='end'");
  const labels = cmp.mode === 'target' ? ['Actual:', cmp.word + ':'] : cmp.mode === 'yoy' ? ['Current:', 'Last year:'] : [mon[12] + ':', mon[11] + ':'];
  return "<svg xmlns='http://www.w3.org/2000/svg' width='100%' viewBox='0 0 295 170'>" + "<rect width='295' height='170' rx='10' fill='" + P.bg + "'/>"
    + txt(16, 24, 11, P.muted, title, " font-weight='600' letter-spacing='0.6'") + txt(16, 40, 10, P.muted, 'Last 12 months')
    + txt(16, 76, 32, P.text, kvXml(kvfValueText(n.v, fmt)), " font-weight='700'")
    + "<rect x='16' y='85' width='" + kvfF(pw) + "' height='18' rx='9' fill='" + kvfStatus(d, lower, true, cfg) + "'/>" + txt(23, 98, 10.5, kvfStatus(d, lower, false, cfg), kvXml(pill), " font-weight='600'")
    + row(56, labels[0], kvfCompact(cmp.now, fmt)) + row(72, labels[1], kvfCompact(cmp.before, fmt))
    + "<line x1='16' y1='148.5' x2='279' y2='148.5' stroke='" + P.track + "'/>" + txt(16, 162, 9.5, P.line, mon[1]) + txt(279, 162, 9.5, P.line, mon[12], " text-anchor='end'")
    + kvfColumns(n.trend, k, cfg, 295, 16, 114, 148, 10, tips, cmp) + '</svg>';
}
function kvfPreview(k, cfg, style){
  const svg = kvfPreviewSvg(k, cfg, style || kvfStyle(cfg).id, true);
  return svg ? "<div class='kvc kv-fncard'><style>" + KVF_CSS + '</style>' + svg + '</div>' : '';
}

/* ---------- checks ---------- */
function kvfChecks(kpis, cfg, model, add){
  const s = kvfStyle(cfg);
  kpis.filter(k => (k.measure || '').trim() && !kvfFits(k, cfg)).forEach(k => add('info', kvName(k) + ' has no ' + (s.need === 'target' ? 'target' : 'target or comparison') + ', so it gets no ' + s.name.toLowerCase() + '.'));
  if (!s.dates) return;
  const d = (cfg.fnDate || '').trim(), c = kvColName(d);
  if (!c) { add('err', 'Type the date column as \'Table\'[Column], for example \'Date\'[Date].'); return; }
  if (model) {
    const col = model.columns.find(x => lc(x.table) === lc(c.table) && lc(x.name) === lc(c.column));
    if (!col) add('err', 'The date column ' + d + ' isn’t in the model export.');
    else if (!/date/i.test(col.dataType || '')) add('warn', d + ' isn’t a date column in the export. The cards need one date per day.');
    const a = (cfg.fnAsOf || '').trim().replace(/^\[|\]$/g, '');
    if (a && !model.measures.some(m => lc(m.name) === lc(a))) add('warn', bracket(a) + ' isn’t in the model export. Check the name, or leave it empty to end at the last date in the filter.');
  }
}
