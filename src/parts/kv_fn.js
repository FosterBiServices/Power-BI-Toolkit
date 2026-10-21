/* ---------- KPI Visualizer: reusable card functions (DAX user-defined functions) ---------- */
// The functions draw whole KPI cards from any measure: a summary card, a trend tile, a rolling tile and a snapshot tile,
// each as an SVG image (for the card visual's image) or as HTML (for the HTML Content visual), where every monthly
// column shows a tooltip on hover. Colors are small functions of their own, filled from Step 4, so a color can be
// changed later in one place in the model.
const KVF_PKG = 'FosterBIServices.KPICards';
const KVF_VERSION = '1.0.0';
const KVF_STYLES = [
  { id: 'summary', name: 'Summary card', w: 295, h: 170, tip: 'Value, a pill with the change (MoM, YoY or vs target), the comparison numbers, last year and 12 monthly columns.' },
  { id: 'trend', name: 'Trend tile', w: 232, h: 130, tip: 'A compact tile: value, a pill with the change (MoM, YoY or vs target) and 12 monthly columns.' },
  { id: 'snapshot', name: 'Snapshot tile', w: 232, h: 130, tip: 'A value that doesn’t move with the dates, with an optional share bar.' }
];
const KVF_OUTS = [{ id: 'html', name: 'HTML, with hover tooltips' }, { id: 'image', name: 'SVG image' }, { id: 'both', name: 'Both' }];
const kvfStyle = cfg => KVF_STYLES.find(s => s.id === cfg.fnStyle) || KVF_STYLES[0];
const kvfOut = cfg => KVF_OUTS.some(o => o.id === cfg.fnOut) ? cfg.fnOut : 'html';
const kvfN = n => KVF_PKG + '.' + n;
const KVF_FONT = "font-family='Segoe UI, Arial, sans-serif'";
// classes the HTML cards use for the hover; distinct names so they never meet a report's own CSS
const KVF_CSS = '.kvc svg{display:block}.kvb .kvt{visibility:hidden}.kvb:hover .kvt{visibility:visible}.kvb:hover .kvbar{opacity:0.75}';

/* ---------- the date column ---------- */
function kvfDate(cfg){
  const col = (cfg.fnDate || '').trim() || "'Date'[Date]", c = kvColName(col);
  return { col, table: c ? qName(c.table) : "'Date'", asOf: (cfg.fnAsOf || '').trim() ? kvRef(cfg.fnAsOf) : '' };
}

/* ---------- the library: [{ name, desc, params, body }] in the order they're added ---------- */
function kvfLibrary(cfg){
  const P = kvInk(cfg), C = cfg.colors, d = kvfDate(cfg), F = kvfN, band = ((+cfg.band || 0) / 100).toString();
  const color = (n, hex, what) => ({ name: 'Color.' + n, desc: what + '. Change the hex code here to change it on every card.', params: '', body: '"' + hex + '"' });
  const L = [
    color('Background', P.bg, 'Card background'),
    color('Ink', P.text, 'The main value'),
    color('Label', P.muted, 'Titles, dates and labels'),
    color('Line', P.line, 'Axis labels and the tooltip border'),
    color('Track', P.track, 'Axis lines, columns outside the date filter, and empty pills'),
    color('Accent', P.accent, 'Columns inside the date filter and tooltip headings'),
    color('Good', C.good.text, 'Status text when the change is good'),
    color('GoodFill', C.good.fill, 'Status fill when the change is good'),
    color('Neutral', C.neutral.text, 'Status text when the change is small'),
    color('NeutralFill', C.neutral.fill, 'Status fill when the change is small'),
    color('Bad', C.bad.text, 'Status text when the change is bad'),
    color('BadFill', C.bad.fill, 'Status fill when the change is bad'),
    { name: 'NeutralBand', desc: 'A change smaller than this (as a fraction, 0.02 = 2%) counts as neutral.', params: '', body: band },
    { name: 'StartDate', desc: 'The first date in the date filter.', params: '', body: 'MIN ( ' + d.col + ' )' },
    { name: 'EndDate', desc: 'The last date in the date filter' + (d.asOf ? ', no later than ' + d.asOf + ' (the last date with data)' : '') + '.', params: '',
      body: d.asOf ? 'MIN ( MAX ( ' + d.col + ' ), ' + d.asOf + ' )' : 'MAX ( ' + d.col + ' )' },
    { name: 'Between', desc: 'A measure for the dates from _from to _to, whatever dates are filtered.', params: '_m : EXPR, _from : DATETIME, _to : DATETIME',
      body: 'CALCULATE ( _m, REMOVEFILTERS ( ' + d.table + ' ), DATESBETWEEN ( ' + d.col + ', _from, _to ) )' },
    { name: 'Change', desc: 'The change from _before to _now as a fraction (0.05 = 5% up). Blank when there is nothing to compare with.', params: '_now : NUMERIC, _before : NUMERIC',
      body: 'IF ( NOT ISBLANK ( _before ) && _before <> 0, DIVIDE ( COALESCE ( _now, 0 ) - _before, ABS ( _before ) ) )' },
    { name: 'StatusColor', desc: 'The status text color (or with _fill, its fill) for a change: good, neutral or bad.', params: '_change : NUMERIC, _lowerIsBetter : BOOLEAN, _fill : BOOLEAN',
      body: `VAR _s = IF ( _lowerIsBetter, -_change, _change )
VAR _band = ${F('NeutralBand')} ()
RETURN
    SWITCH (
        TRUE (),
        ISBLANK ( _change ), IF ( _fill, ${F('Color.Track')} (), ${F('Color.Label')} () ),
        _s >= _band && _s > 0, IF ( _fill, ${F('Color.GoodFill')} (), ${F('Color.Good')} () ),
        _s <= -_band && _s < 0, IF ( _fill, ${F('Color.BadFill')} (), ${F('Color.Bad')} () ),
        IF ( _fill, ${F('Color.NeutralFill')} (), ${F('Color.Neutral')} () )
    )` },
    { name: 'ChangeText', desc: 'An arrow and the change as a %, like ▲ 6.2%. Empty when there is no change to show.', params: '_change : NUMERIC',
      body: 'IF ( ISBLANK ( _change ), "", SWITCH ( TRUE (), _change > 0, UNICHAR ( 9650 ), _change < 0, UNICHAR ( 9660 ), UNICHAR ( 9658 ) ) & " " & FORMAT ( ABS ( _change ), "0.0%" ) )' },
    { name: 'ValueText', desc: 'The main value: 12.4K or 1.2M above 10,000, otherwise in its format string. A dash when blank.', params: '_v : NUMERIC, _format : STRING',
      body: `VAR _f = SUBSTITUTE ( _format, "\\", "" )
VAR _cur = IF ( LEFT ( _f, 1 ) IN { "$", "€", "£", "¥" }, LEFT ( _f, 1 ), "" )
RETURN
    SWITCH (
        TRUE (),
        ISBLANK ( _v ), "–",
        CONTAINSSTRING ( _format, "%" ), FORMAT ( _v, _format ),
        ABS ( _v ) >= 1E6, _cur & FORMAT ( _v / 1E6, "0.0" ) & "M",
        ABS ( _v ) >= 1E4, _cur & FORMAT ( _v / 1E3, "0.0" ) & "K",
        FORMAT ( _v, _format )
    )` },
    { name: 'Compact', desc: 'A number in about 4 characters (999, 1.2K, 12K, 1.2M), for the small comparison values. A dash when blank.', params: '_v : NUMERIC, _format : STRING',
      body: `VAR _f = SUBSTITUTE ( _format, "\\", "" )
VAR _cur = IF ( LEFT ( _f, 1 ) IN { "$", "€", "£", "¥" }, LEFT ( _f, 1 ), "" )
RETURN
    SWITCH (
        TRUE (),
        ISBLANK ( _v ), "–",
        CONTAINSSTRING ( _format, "%" ), FORMAT ( _v, _format ),
        ABS ( _v ) < 999.5, FORMAT ( _v, _format ),
        ABS ( _v ) < 9950, _cur & FORMAT ( _v / 1E3, "0.0" ) & "K",
        ABS ( _v ) < 999500, _cur & FORMAT ( _v / 1E3, "0" ) & "K",
        ABS ( _v ) < 9950000, _cur & FORMAT ( _v / 1E6, "0.0" ) & "M",
        _cur & FORMAT ( _v / 1E6, "0" ) & "M"
    )` },
    { name: 'CardRow', desc: 'One comparison line on a card as SVG: the label left-aligned at _labelX, the value right-aligned at _valueX.', params: '_labelX : NUMERIC, _valueX : NUMERIC, _y : NUMERIC, _label : STRING, _value : STRING',
      body: `"<text x='" & _labelX & "' y='" & _y & "' ${KVF_FONT} font-size='10.5' fill='" & ${F('Color.Label')} () & "'>" & _label & "</text>"
    & "<text x='" & _valueX & "' y='" & _y & "' ${KVF_FONT} font-size='10.5' font-weight='600' fill='" & ${F('Color.Ink')} () & "' text-anchor='end'>" & _value & "</text>"` },
    { name: 'BarTip', desc: 'The hover tooltip for one column as SVG: a heading, the value, and the change from the period before. Hidden until its column is hovered.',
      params: '_cx : NUMERIC, _bottom : NUMERIC, _W : NUMERIC, _fs : NUMERIC, _head : STRING, _value : STRING, _cmp : STRING, _chg : STRING, _chgColor : STRING',
      body: `VAR _lh = _fs + 4
VAR _len = MAX ( MAX ( LEN ( _head ), LEN ( _value ) ), LEN ( _cmp ) + IF ( _chg <> "", LEN ( _chg ) + 2, 0 ) )
VAR _tw = MIN ( _len * _fs * 0.56 + 16, _W - 8 )
VAR _th = 3 * _lh + 10
VAR _x = MAX ( 4, MIN ( _W - 4 - _tw, _cx - _tw / 2 ) )
VAR _y = _bottom - _th
VAR _tx = FORMAT ( _x + 8, "0.0", "en-US" )
VAR _font = "${KVF_FONT} font-size='" & FORMAT ( _fs, "0.0", "en-US" ) & "'"
RETURN
    "<g class='kvt' visibility='hidden'>"
        & "<rect x='" & FORMAT ( _x, "0.0", "en-US" ) & "' y='" & FORMAT ( _y, "0.0", "en-US" ) & "' width='" & FORMAT ( _tw, "0.0", "en-US" ) & "' height='" & FORMAT ( _th, "0.0", "en-US" ) & "' rx='4' fill='" & ${F('Color.Background')} () & "' stroke='" & ${F('Color.Line')} () & "' stroke-width='0.75'/>"
        & "<text x='" & _tx & "' y='" & FORMAT ( _y + 4 + _fs, "0.0", "en-US" ) & "' " & _font & " font-weight='700' fill='" & ${F('Color.Accent')} () & "'>" & _head & "</text>"
        & "<text x='" & _tx & "' y='" & FORMAT ( _y + 4 + _fs + _lh, "0.0", "en-US" ) & "' " & _font & " font-weight='600' fill='" & ${F('Color.Ink')} () & "'>" & _value & "</text>"
        & "<text x='" & _tx & "' y='" & FORMAT ( _y + 4 + _fs + 2 * _lh, "0.0", "en-US" ) & "' " & _font & " fill='" & ${F('Color.Label')} () & "'>" & _cmp
        & IF ( _chg <> "", "<tspan dx='6' font-weight='600' fill='" & _chgColor & "'>" & _chg & "</tspan>" )
        & "</text></g>"` },
    { name: 'HoverCss', desc: 'The CSS that shows a column’s tooltip while it is hovered. The tooltips stay hidden without it, so a card still looks right.', params: '', body: '"<style>' + KVF_CSS + '</style>"' },
    { name: 'ToImage', desc: 'An SVG as an image URL, for a card visual’s image or a table column marked Image URL.', params: '_svg : STRING',
      body: 'IF ( _svg = "", BLANK (), "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" ) )' },
    { name: 'ToHtml', desc: 'An SVG as HTML for the HTML Content visual, with the hover CSS.', params: '_svg : STRING',
      body: `IF ( _svg = "", BLANK (), "<div class='kvc'>" & ${F('HoverCss')} () & _svg & "</div>" )` },
    { name: 'CompareMode', desc: 'What a card compares with: "MOM" (the month before), "YOY" (the same dates last year) or "TARGET" (any other word, like "Target" or "Budget", with the _target measure).', params: '_compare : STRING',
      body: `VAR _c = UPPER ( TRIM ( _compare ) )
RETURN
    SWITCH ( TRUE (), _c IN { "", "MOM" }, "MOM", _c IN { "YOY", "LY", "PY" }, "YOY", "TARGET" )` },
    { name: 'CompareLabel', desc: 'The comparison as readers see it: MoM, YoY, or the target word with a capital (Target, Budget).', params: '_compare : STRING',
      body: `VAR _c = TRIM ( _compare )
RETURN
    SWITCH ( ${F('CompareMode')} ( _c ), "MOM", "MoM", "YOY", "YoY", UPPER ( LEFT ( _c, 1 ) ) & LOWER ( MID ( _c, 2, 50 ) ) )` },
    { name: 'MonthColumns', desc: 'The 12 monthly columns ending at the date filter’s last month, as SVG. Columns inside the date filter use the accent color. With YoY or a target, a mark on each column shows last year or the target. With _tips, each column gets a hover tooltip.',
      params: '_m : EXPR, _target : EXPR, _compare : STRING, _format : STRING, _lowerIsBetter : BOOLEAN, _unit : STRING, _W : NUMERIC, _left : NUMERIC, _top : NUMERIC, _bottom : NUMERIC, _fs : NUMERIC, _tips : BOOLEAN',
      body: `VAR _mode = ${F('CompareMode')} ( _compare )
VAR _name = ${F('CompareLabel')} ( _compare )
VAR _start = ${F('StartDate')} ()
VAR _end = ${F('EndDate')} ()
VAR _fullMonth = _end = EOMONTH ( _end, 0 )
VAR _anchor = DATE ( YEAR ( _end ), MONTH ( _end ), 1 )
-- The current month compares with the same days last month when the filter ends mid-month
VAR _lm = ${F('Between')} ( _m, EDATE ( _anchor, -1 ), IF ( _fullMonth, EOMONTH ( _end, -1 ), EDATE ( _end, -1 ) ) )
-- 13 months, so the oldest column also has a month before it; @c is the same dates last year, or the target
VAR _base =
    ADDCOLUMNS (
        ADDCOLUMNS (
            GENERATESERIES ( 0, 12, 1 ),
            "@s", EDATE ( _anchor, - [Value] ),
            "@e", MIN ( EOMONTH ( EDATE ( _anchor, - [Value] ), 0 ), _end )
        ),
        "@v", COALESCE ( ${F('Between')} ( _m, [@s], [@e] ), 0 ),
        "@c",
            SWITCH (
                _mode,
                "YOY", ${F('Between')} ( _m, EDATE ( [@s], -12 ), EDATE ( [@e], -12 ) ),
                "TARGET", ${F('Between')} ( _target, [@s], [@e] )
            )
    )
VAR _pts = FILTER ( _base, [Value] <= 11 )
VAR _hi = MAX ( MAXX ( _pts, MAX ( [@v], COALESCE ( [@c], 0 ) ) ), 1E-9 )
VAR _slot = ( _W - 2 * _left ) / 12
VAR _barW = _slot * 0.62
VAR _on = ${F('Color.Accent')} ()
VAR _off = ${F('Color.Track')} ()
VAR _markColor = IF ( _mode = "TARGET", ${F('Color.Ink')} (), ${F('Color.Line')} () )
RETURN
    CONCATENATEX (
        _pts,
        VAR _k = [Value]
        VAR _x = _left + ( 11 - _k ) * _slot + ( _slot - _barW ) / 2
        VAR _h = MAX ( DIVIDE ( [@v], _hi ) * ( _bottom - _top ), 1.5 )
        VAR _markY = _bottom - MAX ( DIVIDE ( [@c], _hi ) * ( _bottom - _top ), 0 )
        VAR _bar =
            "<rect class='kvbar' x='" & FORMAT ( _x, "0.0", "en-US" ) & "' y='" & FORMAT ( _bottom - _h, "0.0", "en-US" )
                & "' width='" & FORMAT ( _barW, "0.0", "en-US" ) & "' height='" & FORMAT ( _h, "0.0", "en-US" )
                & "' rx='1.5' fill='" & IF ( [@e] >= _start, _on, _off ) & "'/>"
                & IF (
                    _mode <> "MOM" && NOT ISBLANK ( [@c] ),
                    "<line x1='" & FORMAT ( _x - 1.5, "0.0", "en-US" ) & "' x2='" & FORMAT ( _x + _barW + 1.5, "0.0", "en-US" )
                        & "' y1='" & FORMAT ( _markY, "0.0", "en-US" ) & "' y2='" & FORMAT ( _markY, "0.0", "en-US" ) & "' stroke='" & _markColor & "' stroke-width='1.5'/>"
                )
        VAR _cv = [@v]
        VAR _pv = IF ( _mode = "MOM", IF ( _k = 0, _lm, MAXX ( FILTER ( _base, [Value] = _k + 1 ), [@v] ) ), [@c] )
        VAR _d = ${F('Change')} ( _cv, _pv )
        VAR _mtd = IF ( _k = 0 && NOT _fullMonth, " MTD" )
        VAR _cmp =
            IF (
                _mode = "TARGET",
                _name & ": ",
                "vs " & FORMAT ( EDATE ( [@s], IF ( _mode = "YOY", -12, -1 ) ), "mmm yyyy" ) & _mtd & ": "
            ) & IF ( ISBLANK ( _pv ), "–", FORMAT ( _pv, _format ) )
        RETURN
            IF (
                _tips,
                "<g class='kvb'><rect x='" & FORMAT ( _left + ( 11 - _k ) * _slot, "0.0", "en-US" ) & "' y='" & FORMAT ( _top - 6, "0.0", "en-US" )
                    & "' width='" & FORMAT ( _slot, "0.0", "en-US" ) & "' height='" & FORMAT ( _bottom - _top + 12, "0.0", "en-US" ) & "' fill='#000000' fill-opacity='0'/>"
                    & _bar
                    & ${F('BarTip')} (
                        _x + _barW / 2, _top - 6, _W, _fs,
                        FORMAT ( [@s], "mmm yyyy" ) & _mtd,
                        FORMAT ( _cv, _format ) & " " & _unit,
                        _cmp,
                        ${F('ChangeText')} ( _d ), ${F('StatusColor')} ( _d, _lowerIsBetter, FALSE )
                    )
                    & "</g>",
                _bar
            ),
        "", [Value], DESC
    )` },
    { name: 'CompareChange', desc: 'The change the pill shows: this month against the month before (MoM), the date filter against the same dates last year (YoY), or the date filter against the _target measure.',
      params: '_m : EXPR, _target : EXPR, _compare : STRING',
      body: `VAR _mode = ${F('CompareMode')} ( _compare )
VAR _start = ${F('StartDate')} ()
VAR _end = ${F('EndDate')} ()
-- A filter that ends on the last day of a month compares full months; one that ends mid-month compares the same days
VAR _fullMonth = _end = EOMONTH ( _end, 0 )
VAR _anchor = DATE ( YEAR ( _end ), MONTH ( _end ), 1 )
RETURN
    SWITCH (
        _mode,
        "MOM", ${F('Change')} ( ${F('Between')} ( _m, _anchor, _end ), ${F('Between')} ( _m, EDATE ( _anchor, -1 ), IF ( _fullMonth, EOMONTH ( _end, -1 ), EDATE ( _end, -1 ) ) ) ),
        "YOY", ${F('Change')} ( ${F('Between')} ( _m, _start, _end ), ${F('Between')} ( _m, EDATE ( _start, -12 ), IF ( _fullMonth, EOMONTH ( _end, -12 ), EDATE ( _end, -12 ) ) ) ),
        ${F('Change')} ( ${F('Between')} ( _m, _start, _end ), ${F('Between')} ( _target, _start, _end ) )
    )` },
    { name: 'PillText', desc: 'The pill’s text: ▲ 6.2% MoM, ▼ 1.4% YoY or ▲ 3.0% vs budget, or what is missing.', params: '_change : NUMERIC, _compare : STRING',
      body: `VAR _mode = ${F('CompareMode')} ( _compare )
VAR _name = ${F('CompareLabel')} ( _compare )
RETURN
    IF (
        ISBLANK ( _change ),
        SWITCH ( _mode, "MOM", "No data last month", "YOY", "No data last year", "No " & LOWER ( _name ) ),
        ${F('ChangeText')} ( _change ) & IF ( _mode = "TARGET", " vs " & LOWER ( _name ), " " & _name )
    )` },
    { name: 'SummaryCardSvg', desc: 'The summary card (295 x 170) as SVG: the value for the date filter, a pill with the change (MoM, YoY or vs a target), the comparison numbers, last year when it has data, and 12 monthly columns.',
      params: '_title : STRING, _m : EXPR, _format : STRING, _lowerIsBetter : BOOLEAN, _compare : STRING, _target : EXPR, _tips : BOOLEAN',
      body: `VAR _mode = ${F('CompareMode')} ( _compare )
VAR _start = ${F('StartDate')} ()
VAR _end = ${F('EndDate')} ()
VAR _fullMonth = _end = EOMONTH ( _end, 0 )
VAR _anchor = DATE ( YEAR ( _end ), MONTH ( _end ), 1 )
VAR _value = ${F('Between')} ( _m, _start, _end )
VAR _lyEnd = IF ( _fullMonth, EOMONTH ( _end, -12 ), EDATE ( _end, -12 ) )
VAR _ly = ${F('Between')} ( _m, EDATE ( _start, -12 ), _lyEnd )
VAR _cm = ${F('Between')} ( _m, _anchor, _end )
VAR _lm = ${F('Between')} ( _m, EDATE ( _anchor, -1 ), IF ( _fullMonth, EOMONTH ( _end, -1 ), EDATE ( _end, -1 ) ) )
VAR _change = ${F('CompareChange')} ( _m, _target, _compare )
VAR _pill = ${F('PillText')} ( _change, _compare )
VAR _pillW = 14 + LEN ( _pill ) * 6.1
VAR _mtd = IF ( _fullMonth, ":", " MTD:" )
VAR _labelX = IF ( _fullMonth || _mode = "TARGET", 196, 171 )
-- The comparison lines: the two latest months (MoM), this month and the same month last year (YoY), or actual and target
VAR _row1 =
    IF (
        _mode = "TARGET",
        ${F('CardRow')} ( _labelX, 279, 52, "Actual:", ${F('Compact')} ( _value, _format ) ),
        ${F('CardRow')} ( _labelX, 279, 52, FORMAT ( _anchor, "mmm yyyy" ) & _mtd, ${F('Compact')} ( _cm, _format ) )
    )
VAR _row2 =
    SWITCH (
        _mode,
        "MOM", ${F('CardRow')} ( _labelX, 279, 66, FORMAT ( EDATE ( _anchor, -1 ), "mmm yyyy" ) & _mtd, ${F('Compact')} ( _lm, _format ) ),
        "YOY", ${F('CardRow')} ( _labelX, 279, 66, FORMAT ( EDATE ( _anchor, -12 ), "mmm yyyy" ) & _mtd, ${F('Compact')} ( ${F('Between')} ( _m, EDATE ( _anchor, -12 ), _lyEnd ), _format ) ),
        ${F('CardRow')} ( _labelX, 279, 66, ${F('CompareLabel')} ( _compare ) & ":", ${F('Compact')} ( ${F('Between')} ( _target, _start, _end ), _format ) )
    )
VAR _font = "${KVF_FONT}"
VAR _label = ${F('Color.Label')} ()
VAR _svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='100%' viewBox='0 0 295 170' preserveAspectRatio='xMidYMid meet'>"
        & "<rect width='295' height='170' rx='10' fill='" & ${F('Color.Background')} () & "'/>"
        & "<text x='16' y='24' " & _font & " font-size='11' font-weight='600' letter-spacing='0.6' fill='" & _label & "'>" & _title & "</text>"
        & "<text x='16' y='40' " & _font & " font-size='10' fill='" & _label & "'>" & FORMAT ( _start, "mmm d, yyyy" ) & " – " & FORMAT ( _end, "mmm d, yyyy" ) & "</text>"
        & "<text x='16' y='76' " & _font & " font-size='32' font-weight='700' fill='" & ${F('Color.Ink')} () & "'>" & ${F('ValueText')} ( COALESCE ( _value, 0 ), _format ) & "</text>"
        & "<rect x='16' y='85' width='" & FORMAT ( _pillW, "0.0", "en-US" ) & "' height='18' rx='9' fill='" & ${F('StatusColor')} ( _change, _lowerIsBetter, TRUE ) & "'/>"
        & "<text x='23' y='98' " & _font & " font-size='10.5' font-weight='600' fill='" & ${F('StatusColor')} ( _change, _lowerIsBetter, FALSE ) & "'>" & _pill & "</text>"
        & _row1
        & _row2
        & IF ( NOT ISBLANK ( _ly ), ${F('CardRow')} ( _labelX, 279, 80, "Last year:", ${F('Compact')} ( _ly, _format ) ) )
        & "<line x1='16' y1='148.5' x2='279' y2='148.5' stroke='" & ${F('Color.Track')} () & "'/>"
        & "<text x='16' y='162' " & _font & " font-size='9.5' fill='" & ${F('Color.Line')} () & "'>" & FORMAT ( EDATE ( _anchor, -11 ), "mmm yyyy" ) & "</text>"
        & "<text x='279' y='162' " & _font & " font-size='9.5' fill='" & ${F('Color.Line')} () & "' text-anchor='end'>" & FORMAT ( _anchor, "mmm yyyy" ) & "</text>"
        -- Columns last, so each tooltip draws over the text above
        & ${F('MonthColumns')} ( _m, _target, _compare, _format, _lowerIsBetter, LOWER ( _title ), 295, 16, 114, 148, 10, _tips )
        & "</svg>"
RETURN
    IF ( _end >= _start, _svg )` },
    { name: 'TrendTileSvg', desc: 'The trend tile (_width x 130) as SVG: the value for the date filter, a pill with the change (MoM, YoY or vs a target) and 12 monthly columns.',
      params: '_title : STRING, _m : EXPR, _format : STRING, _lowerIsBetter : BOOLEAN, _width : INT64, _compare : STRING, _target : EXPR, _tips : BOOLEAN',
      body: `VAR _start = ${F('StartDate')} ()
VAR _end = ${F('EndDate')} ()
VAR _anchor = DATE ( YEAR ( _end ), MONTH ( _end ), 1 )
VAR _value = ${F('Between')} ( _m, _start, _end )
VAR _change = ${F('CompareChange')} ( _m, _target, _compare )
VAR _pill = ${F('PillText')} ( _change, _compare )
VAR _pillW = 12 + LEN ( _pill ) * 5.9
VAR _font = "${KVF_FONT}"
VAR _label = ${F('Color.Label')} ()
VAR _svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='100%' viewBox='0 0 " & _width & " 130' preserveAspectRatio='xMidYMid meet'>"
        & "<rect width='" & _width & "' height='130' rx='8' fill='" & ${F('Color.Background')} () & "'/>"
        & "<text x='12' y='19' " & _font & " font-size='10' font-weight='600' letter-spacing='0.5' fill='" & _label & "'>" & _title & "</text>"
        & "<text x='12' y='32' " & _font & " font-size='9' fill='" & _label & "'>" & FORMAT ( _start, "mmm d, yyyy" ) & " – " & FORMAT ( _end, "mmm d, yyyy" ) & "</text>"
        & "<text x='12' y='61' " & _font & " font-size='24' font-weight='700' fill='" & ${F('Color.Ink')} () & "'>" & ${F('ValueText')} ( _value, _format ) & "</text>"
        & "<rect x='12' y='68' width='" & FORMAT ( _pillW, "0.0", "en-US" ) & "' height='15' rx='7.5' fill='" & ${F('StatusColor')} ( _change, _lowerIsBetter, TRUE ) & "'/>"
        & "<text x='18' y='79' " & _font & " font-size='9' font-weight='600' fill='" & ${F('StatusColor')} ( _change, _lowerIsBetter, FALSE ) & "'>" & _pill & "</text>"
        & "<line x1='12' y1='110.5' x2='" & _width - 12 & "' y2='110.5' stroke='" & ${F('Color.Track')} () & "'/>"
        & "<text x='12' y='122' " & _font & " font-size='8.5' fill='" & ${F('Color.Line')} () & "'>" & FORMAT ( EDATE ( _anchor, -11 ), "mmm yyyy" ) & "</text>"
        & "<text x='" & _width - 12 & "' y='122' " & _font & " font-size='8.5' fill='" & ${F('Color.Line')} () & "' text-anchor='end'>" & FORMAT ( _anchor, "mmm yyyy" ) & "</text>"
        & ${F('MonthColumns')} ( _m, _target, _compare, _format, _lowerIsBetter, LOWER ( _title ), _width, 12, 90, 110, 9, _tips )
        & "</svg>"
RETURN
    IF ( _end >= _start, _svg )` },
    { name: 'RollingTileSvg', desc: 'The rolling tile (_width x 130) as SVG, for a measure like active in the last _days days: the value up to the last date, the change from the _days before, and 12 back-to-back windows of _days days.',
      params: '_title : STRING, _m : EXPR, _days : INT64, _format : STRING, _lowerIsBetter : BOOLEAN, _width : INT64, _tips : BOOLEAN',
      body: `VAR _start = ${F('StartDate')} ()
VAR _end = ${F('EndDate')} ()
VAR _cur = ${F('Between')} ( _m, _end - _days + 1, _end )
VAR _prior = ${F('Between')} ( _m, _end - 2 * _days + 1, _end - _days )
VAR _change = ${F('Change')} ( _cur, _prior )
VAR _pill = IF ( ISBLANK ( _change ), "No data in prior " & _days & " days", ${F('ChangeText')} ( _change ) & " vs prior " & _days & " days" )
VAR _pillW = 12 + LEN ( _pill ) * 5.9
-- 13 windows, so the oldest column also has a window before it
VAR _base =
    ADDCOLUMNS (
        ADDCOLUMNS ( GENERATESERIES ( 0, 12, 1 ), "@s", _end - ( [Value] + 1 ) * _days + 1, "@e", _end - [Value] * _days ),
        "@v", COALESCE ( ${F('Between')} ( _m, [@s], [@e] ), 0 )
    )
VAR _pts = FILTER ( _base, [Value] <= 11 )
VAR _hi = MAX ( MAXX ( _pts, [@v] ), 1E-9 )
VAR _slot = ( _width - 24 ) / 12
VAR _barW = _slot * 0.62
VAR _font = "${KVF_FONT}"
VAR _label = ${F('Color.Label')} ()
VAR _bars =
    CONCATENATEX (
        _pts,
        VAR _k = [Value]
        VAR _x = 12 + ( 11 - _k ) * _slot + ( _slot - _barW ) / 2
        VAR _h = MAX ( DIVIDE ( [@v], _hi ) * 20, 1.5 )
        VAR _bar =
            "<rect class='kvbar' x='" & FORMAT ( _x, "0.0", "en-US" ) & "' y='" & FORMAT ( 110 - _h, "0.0", "en-US" ) & "' width='" & FORMAT ( _barW, "0.0", "en-US" )
                & "' height='" & FORMAT ( _h, "0.0", "en-US" ) & "' rx='1' fill='" & IF ( _k = 0, ${F('Color.Accent')} (), ${F('Color.Track')} () ) & "'/>"
        VAR _cv = [@v]
        VAR _pv = MAXX ( FILTER ( _base, [Value] = _k + 1 ), [@v] )
        VAR _d = ${F('Change')} ( _cv, _pv )
        RETURN
            IF (
                _tips,
                "<g class='kvb'><rect x='" & FORMAT ( 12 + ( 11 - _k ) * _slot, "0.0", "en-US" ) & "' y='84' width='" & FORMAT ( _slot, "0.0", "en-US" ) & "' height='32' fill='#000000' fill-opacity='0'/>"
                    & _bar
                    & ${F('BarTip')} (
                        _x + _barW / 2, 84, _width, 9,
                        FORMAT ( [@s], "mmm d" ) & " – " & FORMAT ( [@e], "mmm d, yyyy" ),
                        FORMAT ( _cv, _format ) & " in " & _days & " days",
                        "vs prior " & _days & " days: " & IF ( ISBLANK ( _pv ), "–", FORMAT ( _pv, _format ) ),
                        ${F('ChangeText')} ( _d ), ${F('StatusColor')} ( _d, _lowerIsBetter, FALSE )
                    )
                    & "</g>",
                _bar
            ),
        "", [Value], DESC
    )
VAR _svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='100%' viewBox='0 0 " & _width & " 130' preserveAspectRatio='xMidYMid meet'>"
        & "<rect width='" & _width & "' height='130' rx='8' fill='" & ${F('Color.Background')} () & "'/>"
        & "<text x='12' y='19' " & _font & " font-size='10' font-weight='600' letter-spacing='0.5' fill='" & _label & "'>" & _title & "</text>"
        & "<text x='12' y='32' " & _font & " font-size='9' fill='" & _label & "'>" & FORMAT ( _end - _days + 1, "mmm d, yyyy" ) & " – " & FORMAT ( _end, "mmm d, yyyy" ) & "</text>"
        & "<text x='12' y='61' " & _font & " font-size='24' font-weight='700' fill='" & ${F('Color.Ink')} () & "'>" & ${F('ValueText')} ( _cur, _format ) & "</text>"
        & "<rect x='12' y='68' width='" & FORMAT ( _pillW, "0.0", "en-US" ) & "' height='15' rx='7.5' fill='" & ${F('StatusColor')} ( _change, _lowerIsBetter, TRUE ) & "'/>"
        & "<text x='18' y='79' " & _font & " font-size='9' font-weight='600' fill='" & ${F('StatusColor')} ( _change, _lowerIsBetter, FALSE ) & "'>" & _pill & "</text>"
        & "<line x1='12' y1='110.5' x2='" & _width - 12 & "' y2='110.5' stroke='" & ${F('Color.Track')} () & "'/>"
        & "<text x='12' y='122' " & _font & " font-size='8.5' fill='" & ${F('Color.Line')} () & "'>" & FORMAT ( _end - 12 * _days + 1, "mmm d, yyyy" ) & "</text>"
        & "<text x='" & _width / 2 & "' y='122' " & _font & " font-size='8.5' fill='" & ${F('Color.Line')} () & "' text-anchor='middle'>1 bar = " & _days & " days</text>"
        & "<text x='" & _width - 12 & "' y='122' " & _font & " font-size='8.5' fill='" & ${F('Color.Line')} () & "' text-anchor='end'>" & FORMAT ( _end, "mmm d, yyyy" ) & "</text>"
        & _bars
        & "</svg>"
RETURN
    IF ( _end >= _start, _svg )` },
    { name: 'SnapshotTileSvg', desc: 'The snapshot tile (_width x _height) as SVG, for a value that doesn’t move with the dates: title, caption, value and, when _share isn’t blank, a share bar.',
      params: '_title : STRING, _text : STRING, _caption : STRING, _share : NUMERIC, _width : INT64, _height : INT64',
      body: `VAR _font = "${KVF_FONT}"
VAR _label = ${F('Color.Label')} ()
VAR _bar =
    IF (
        NOT ISBLANK ( _share ),
        "<rect x='12' y='" & _height - 22 & "' width='" & _width - 24 & "' height='6' rx='3' fill='" & ${F('Color.Track')} () & "'/>"
            & "<rect x='12' y='" & _height - 22 & "' width='" & FORMAT ( MAX ( MIN ( _share, 1 ), 0 ) * ( _width - 24 ), "0.0", "en-US" ) & "' height='6' rx='3' fill='" & ${F('Color.Accent')} () & "'/>"
    )
RETURN
    "<svg xmlns='http://www.w3.org/2000/svg' width='100%' viewBox='0 0 " & _width & " " & _height & "' preserveAspectRatio='xMidYMid meet'>"
        & "<rect width='" & _width & "' height='" & _height & "' rx='8' fill='" & ${F('Color.Background')} () & "'/>"
        & "<text x='12' y='19' " & _font & " font-size='10' font-weight='600' letter-spacing='0.5' fill='" & _label & "'>" & _title & "</text>"
        & "<text x='12' y='32' " & _font & " font-size='9' fill='" & _label & "'>" & _caption & "</text>"
        & "<text x='12' y='61' " & _font & " font-size='24' font-weight='700' fill='" & ${F('Color.Ink')} () & "'>" & _text & "</text>"
        & _bar
        & "</svg>"` }
  ];
  // the cards themselves: an image and an HTML version of each
  const card = (n, what, params, args) => [
    { name: n, desc: what + ' as an image URL. Set the measure’s data category to Image URL and show it in a card’s image or a table column.', params, body: F('ToImage') + ' ( ' + F(n + 'Svg') + ' ( ' + args + ', FALSE ) )', card: true },
    { name: n + 'Html', desc: what + ' as HTML for the HTML Content visual, with a tooltip on each column.', params, body: F('ToHtml') + ' ( ' + F(n + 'Svg') + ' ( ' + args + ', TRUE ) )', card: true }];
  L.push(...card('SummaryCard', 'The summary card (295 x 170)', '_title : STRING, _m : EXPR, _format : STRING, _lowerIsBetter : BOOLEAN, _compare : STRING, _target : EXPR', '_title, _m, _format, _lowerIsBetter, _compare, _target'));
  L.push(...card('TrendTile', 'The trend tile (_width x 130)', '_title : STRING, _m : EXPR, _format : STRING, _lowerIsBetter : BOOLEAN, _width : INT64, _compare : STRING, _target : EXPR', '_title, _m, _format, _lowerIsBetter, _width, _compare, _target'));
  L.push(...card('RollingTile', 'The rolling tile (_width x 130)', '_title : STRING, _m : EXPR, _days : INT64, _format : STRING, _lowerIsBetter : BOOLEAN, _width : INT64', '_title, _m, _days, _format, _lowerIsBetter, _width'));
  L.push({ name: 'SnapshotTile', desc: 'The snapshot tile (_width x _height) as an image URL.', params: '_title : STRING, _text : STRING, _caption : STRING, _share : NUMERIC, _width : INT64, _height : INT64', body: F('ToImage') + ' ( ' + F('SnapshotTileSvg') + ' ( _title, _text, _caption, _share, _width, _height ) )', card: true });
  L.push({ name: 'SnapshotTileHtml', desc: 'The snapshot tile (_width x _height) as HTML for the HTML Content visual.', params: '_title : STRING, _text : STRING, _caption : STRING, _share : NUMERIC, _width : INT64, _height : INT64', body: F('ToHtml') + ' ( ' + F('SnapshotTileSvg') + ' ( _title, _text, _caption, _share, _width, _height ) )', card: true });
  return L.map(f => Object.assign({}, f, { name: F(f.name) }));
}

/* ---------- a measure per KPI that calls a card function ---------- */
// What a KPI's card compares with: the choice in Step 5, or (auto) its target, else last year when it has a comparison, else the month before
const KVF_COMPARES = [{ id: 'auto', name: 'Each KPI’s target, else last year, else last month' }, { id: 'mom', name: 'The month before (MoM)' }, { id: 'yoy', name: 'The same dates last year (YoY)' }, { id: 'target', name: 'The KPI’s target or budget' }];
function kvfCompare(k, cfg){
  const h = kvHas(k), c = KVF_COMPARES.some(x => x.id === cfg.fnCompare) ? cfg.fnCompare : 'auto';
  const pick = c === 'auto' ? (h.target ? 'target' : h.compare ? 'yoy' : 'mom') : c === 'target' && !h.target ? 'mom' : c;
  const word = pick === 'target' ? (/budget/i.test(k.target || '') ? 'Budget' : /plan/i.test(k.target || '') ? 'Plan' : /goal/i.test(k.target || '') ? 'Goal' : 'Target') : pick === 'yoy' ? 'YoY' : 'MoM';
  return { mode: pick, word, target: pick === 'target' ? kvRef(k.target) : 'BLANK ()' };
}
function kvfCall(k, cfg, html){
  const s = kvfStyle(cfg), fmt = daxString(k.format || '#,0'), title = daxString(kvName(k).toUpperCase()), m = kvRef(k.measure), lower = k.better === 'lower' ? 'TRUE ()' : 'FALSE ()';
  const cmp = kvfCompare(k, cfg), tail = ', ' + daxString(cmp.word) + ', ' + cmp.target;
  if (s.id === 'snapshot') {
    const h = kvHas(k), cap = h.target ? '"Target " & FORMAT ( ' + kvRef(k.target) + ', ' + fmt + ' )' : '"All dates"';
    return kvfN('SnapshotTile' + (html ? 'Html' : '')) + ' ( ' + title + ', FORMAT ( ' + m + ', ' + fmt + ' ), ' + cap + ', ' + (h.pct ? m : 'BLANK ()') + ', ' + s.w + ', ' + s.h + ' )';
  }
  if (s.id === 'trend') return kvfN('TrendTile' + (html ? 'Html' : '')) + ' ( ' + title + ', ' + m + ', ' + fmt + ', ' + lower + ', ' + s.w + tail + ' )';
  return kvfN('SummaryCard' + (html ? 'Html' : '')) + ' ( ' + title + ', ' + m + ', ' + fmt + ', ' + lower + tail + ' )';
}
function kvfMeasures(k, cfg){
  const out = kvfOut(cfg), s = kvfStyle(cfg), L = [];
  if (out !== 'image') L.push({ name: kvMName(k, out === 'both' ? 'Card HTML' : 'Card'), description: s.name + ' for ' + kvName(k) + ' as HTML, for the HTML Content visual (' + s.w + ' x ' + s.h + ').', expression: kvfCall(k, cfg, true) });
  if (out !== 'html') L.push({ name: kvMName(k, 'Card'), dataCategory: 'ImageUrl', description: s.name + ' for ' + kvName(k) + ' as an image (' + s.w + ' x ' + s.h + ').', expression: kvfCall(k, cfg, false) });
  return L;
}

/* ---------- TMDL and the test query ---------- */
// The layout Power BI Desktop itself writes for a function: the quoted name, then the expression indented under it
function kvfTmdlBlocks(cfg){
  const T = TAB, L = [];
  kvfLibrary(cfg).forEach(f => {
    L.push(T + '/// ' + f.desc, T + 'function ' + qName(f.name) + ' =', T + T + '(' + (f.params ? ' ' + f.params + ' ' : '') + ') =>');
    f.body.split('\n').forEach(l => L.push(T + T + '    ' + l));
    L.push('', T + T + 'annotation DAXLIB_PackageId = ' + KVF_PKG, '', T + T + 'annotation DAXLIB_PackageVersion = ' + KVF_VERSION, '');
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
function kvfStatus(d, lower, fill, cfg){
  const P = kvInk(cfg), C = cfg.colors, b = (+cfg.band || 0) / 100;
  if (d == null || !isFinite(d)) return fill ? P.track : P.muted;
  const s = lower ? -d : d, st = s >= b && s > 0 ? 'good' : s <= -b && s < 0 ? 'bad' : 'neutral';
  return C[st][fill ? 'fill' : 'text'];
}
const kvfChange = (now, before) => before == null || before === 0 ? null : ((now || 0) - before) / Math.abs(before);
const kvfChangeText = d => d == null ? '' : kvArrow(d) + ' ' + (Math.abs(d) * 100).toFixed(1) + '%';
// The month labels of the preview: the 12 months ending last month
function kvfMonths(){ const now = new Date(), y = now.getFullYear(), m = now.getMonth() - 1; return Array.from({ length: 13 }, (_, i) => { const d = new Date(y, m - (12 - i), 1); return KVF_MON[d.getMonth()] + ' ' + d.getFullYear(); }); }
function kvfTip(cx, bottom, W, fs, head, value, cmp, chg, col, P){
  const lh = fs + 4, len = Math.max(head.length, value.length, cmp.length + (chg ? chg.length + 2 : 0)), tw = Math.min(len * fs * 0.56 + 16, W - 8), th = 3 * lh + 10;
  const x = Math.max(4, Math.min(W - 4 - tw, cx - tw / 2)), y = bottom - th, tx = kvfF(x + 8), font = KVF_FONT + " font-size='" + kvfF(fs) + "'";
  return "<g class='kvt' visibility='hidden'><rect x='" + kvfF(x) + "' y='" + kvfF(y) + "' width='" + kvfF(tw) + "' height='" + kvfF(th) + "' rx='4' fill='" + P.bg + "' stroke='" + P.line + "' stroke-width='0.75'/>"
    + "<text x='" + tx + "' y='" + kvfF(y + 4 + fs) + "' " + font + " font-weight='700' fill='" + P.accent + "'>" + kvXml(head) + '</text>'
    + "<text x='" + tx + "' y='" + kvfF(y + 4 + fs + lh) + "' " + font + " font-weight='600' fill='" + P.text + "'>" + kvXml(value) + '</text>'
    + "<text x='" + tx + "' y='" + kvfF(y + 4 + fs + 2 * lh) + "' " + font + " fill='" + P.muted + "'>" + kvXml(cmp) + (chg ? "<tspan dx='6' font-weight='600' fill='" + col + "'>" + kvXml(chg) + '</tspan>' : '') + '</text></g>';
}
// The comparison for the preview: per month (last year or the target) and for the pill, from the preview's numbers
function kvfPreviewCompare(k, cfg){
  const n = kvNums(k), cmp = kvfCompare(k, cfg), pts = n.trend.slice(-12), ly = n.c != null && n.v ? n.c / n.v : 0.94, tg = n.t != null && n.v ? n.t / n.v : 1.04;
  const per = cmp.mode === 'yoy' ? pts.map((v, i) => v * ly * (1 + 0.03 * Math.sin(i * 1.7))) : cmp.mode === 'target' ? pts.map((v, i) => v * tg * (1 - 0.02 * Math.cos(i))) : null;
  const t = n.trend.slice(-13), cm = t[t.length - 1], lm = t.length > 1 ? t[t.length - 2] : null;
  const d = cmp.mode === 'mom' ? kvfChange(cm, lm) : kvfChange(n.v, cmp.mode === 'yoy' ? (n.c != null ? n.c : n.v * ly) : (n.t != null ? n.t : n.v * tg));
  const pill = d == null ? (cmp.mode === 'mom' ? 'No data last month' : cmp.mode === 'yoy' ? 'No data last year' : 'No ' + cmp.word.toLowerCase()) : kvfChangeText(d) + (cmp.mode === 'target' ? ' vs ' + cmp.word.toLowerCase() : ' ' + cmp.word);
  return Object.assign(cmp, { per, d, pill, cm, lm, n });
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
// One card for the preview: style summary | trend | snapshot, as HTML with tooltips (tips) or as the image
function kvfPreviewSvg(k, cfg, style, tips){
  const P = kvInk(cfg), n = kvNums(k), h = kvHas(k), fmt = k.format, mon = kvfMonths(), font = KVF_FONT, lower = k.better === 'lower';
  const cmp = kvfPreviewCompare(k, cfg), d = cmp.d, pill = cmp.pill, title = kvXml(kvName(k).toUpperCase());
  const txt = (x, y, size, col, s, extra) => "<text x='" + x + "' y='" + y + "' " + font + " font-size='" + size + "' fill='" + col + "'" + (extra || '') + '>' + s + '</text>';
  if (style === 'snapshot') {
    const W = 232, H = 130, share = h.pct ? kvClamp(n.v, 0, 1) : null;
    return "<svg xmlns='http://www.w3.org/2000/svg' width='100%' viewBox='0 0 " + W + ' ' + H + "'>" + "<rect width='" + W + "' height='" + H + "' rx='8' fill='" + P.bg + "'/>"
      + txt(12, 19, 10, P.muted, title, " font-weight='600' letter-spacing='0.5'") + txt(12, 32, 9, P.muted, h.target ? 'Target ' + kvXml(kvFmt(n.t, fmt)) : 'All dates')
      + txt(12, 61, 24, P.text, kvXml(kvFmt(n.v, fmt)), " font-weight='700'")
      + (share != null ? "<rect x='12' y='" + (H - 22) + "' width='" + (W - 24) + "' height='6' rx='3' fill='" + P.track + "'/><rect x='12' y='" + (H - 22) + "' width='" + kvfF(share * (W - 24)) + "' height='6' rx='3' fill='" + P.accent + "'/>" : '') + '</svg>';
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
  const pw = 14 + pill.length * 6.1, row = (y, label, v) => txt(196, y, 10.5, P.muted, kvXml(label)) + txt(279, y, 10.5, P.text, kvXml(v), " font-weight='600' text-anchor='end'");
  const rows = cmp.mode === 'target' ? row(52, 'Actual:', kvfCompact(n.v, fmt)) + row(66, cmp.word + ':', kvfCompact(n.t != null ? n.t : n.v * 1.04, fmt))
    : cmp.mode === 'yoy' ? row(52, mon[12] + ':', kvfCompact(cmp.cm, fmt)) + row(66, kvfLastYear(mon[12]) + ':', kvfCompact(cmp.per[11], fmt))
    : row(52, mon[12] + ':', kvfCompact(cmp.cm, fmt)) + row(66, mon[11] + ':', kvfCompact(cmp.lm, fmt));
  return "<svg xmlns='http://www.w3.org/2000/svg' width='100%' viewBox='0 0 295 170'>" + "<rect width='295' height='170' rx='10' fill='" + P.bg + "'/>"
    + txt(16, 24, 11, P.muted, title, " font-weight='600' letter-spacing='0.6'") + txt(16, 40, 10, P.muted, 'Last 12 months')
    + txt(16, 76, 32, P.text, kvXml(kvfValueText(n.v, fmt)), " font-weight='700'")
    + "<rect x='16' y='85' width='" + kvfF(pw) + "' height='18' rx='9' fill='" + kvfStatus(d, lower, true, cfg) + "'/>" + txt(23, 98, 10.5, kvfStatus(d, lower, false, cfg), kvXml(pill), " font-weight='600'")
    + rows + (h.compare && n.c != null ? row(80, 'Last year:', kvfCompact(n.c, fmt)) : '')
    + "<line x1='16' y1='148.5' x2='279' y2='148.5' stroke='" + P.track + "'/>" + txt(16, 162, 9.5, P.line, mon[1]) + txt(279, 162, 9.5, P.line, mon[12], " text-anchor='end'")
    + kvfColumns(n.trend, k, cfg, 295, 16, 114, 148, 10, tips, cmp) + '</svg>';
}
function kvfPreview(k, cfg, style){ return "<div class='kvc kv-fncard'><style>" + KVF_CSS + '</style>' + kvfPreviewSvg(k, cfg, style || kvfStyle(cfg).id, true) + '</div>'; }

/* ---------- checks ---------- */
function kvfChecks(cfg, model, add){
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
