r"""Upgrade the shared model export query (as JS string lines inside each page) with the
columns the Model Linter needs: Summarize, SortBy, Hierarchies, measure text/dynamic-format
flags, and one Model row (Discourage implicit measures). Column order stays the same in
every SELECTCOLUMNS so UNION lines up."""

MARK = r"'VAR _levels = SELECTCOLUMNS ( INFO.LEVELS ()"

EMPTY = r"""'\t\t"Summarize", "",',
'\t\t"SortBy", "",',
'\t\t"Hierarchies", "",',
"""

COLS = r"""'\t\t"Summarize", [SummarizeBy],',
'\t\t"SortBy", [SortByColumn],',
'\t\t"Hierarchies",',
'\t\t\tVAR _cid = [ID]',
'\t\t\tVAR _hids = SELECTCOLUMNS ( FILTER ( _levels, [LCID] = _cid ), "H", [LHID] )',
'\t\t\tRETURN CONCATENATEX ( FILTER ( _hierarchies, [HID] IN _hids ), [HName], ", " ),',
"""

LOOKUPS = r"""'// Hierarchy levels, to tell which columns a hierarchy uses',
'VAR _levels = SELECTCOLUMNS ( INFO.LEVELS (), "LCID", [ColumnID], "LHID", [HierarchyID] )',
'VAR _hierarchies = SELECTCOLUMNS ( INFO.HIERARCHIES (), "HID", [ID], "HName", [Name] )',
"""

MODEL = r"""'VAR _model =',
'\tSELECTCOLUMNS (',
'\t\tINFO.MODEL (),',
'\t\t"Kind", "Model",',
'\t\t"Table", "",',
'\t\t"Name", [Name],',
'\t\t"Type", "",',
'\t\t"Folder", "",',
'\t\t"Flags", IF ( [DiscourageImplicitMeasures], "discourage-implicit", "" ),',
'\t\t"Description", "",',
'\t\t"Expression", "",',
'\t\t"ToTable", "",',
'\t\t"ToColumn", "",',
'\t\t"Summarize", "",',
'\t\t"SortBy", "",',
'\t\t"Hierarchies", "",',
'\t\t"Storage", "",',
'\t\t"Source", ""',
'\t)',
"""


CLEANED = 'SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( MAXX ( FILTER ( _calcParts, [CTID] = _ctid ), [CExpr] ), UNICHAR ( 13 ), "" ), UNICHAR ( 10 ), UNICHAR ( 8629 ) ), UNICHAR ( 9 ), "    " )'
CALC_EXPR = r"""'\t\t"Expression",',
'\t\t\tVAR _ctn = [Name]',
'\t\t\tVAR _ctid = MAXX ( FILTER ( _tableIds, [TName] = _ctn ), [TID] )',
'\t\t\tRETURN """ + CLEANED + r""",',
"""
FMT_LOOKUP = r"""'// Measure format strings: INFO.VIEW.MEASURES can leave FormatString empty and put a static one in FormatStringDefinition',
'VAR _measureFormats = SELECTCOLUMNS ( INFO.MEASURES (), "MName", [Name], "MFmt", [FormatString], "MDyn", [FormatStringDefinitionID] )',
"""
FMT_TYPE = r"""'\t\t"Type", VAR _mn = [Name] RETURN MAXX ( FILTER ( _measureFormats, [MName] = _mn ), [MFmt] ),',
"""
FMT_DYN = 'IF ( VAR _mn = [Name] RETURN MAXX ( FILTER ( _measureFormats, [MName] = _mn ), [MDyn] ) > 0, " dynamic-format", "" )'
CALC_LOOKUP = r"""'// Calculated tables (partition type 2), for field parameters and other DAX tables',
'VAR _calcParts = SELECTCOLUMNS ( FILTER ( INFO.PARTITIONS (), [Type] = 2 ), "CTID", [TableID], "CExpr", [QueryDefinition] )',
"""


def once(s, old, new):
    assert s.count(old) == 1, (old, s.count(old))
    return s.replace(old, new)


QMARK = r"'VAR _mParts ="

Q_LOOKUP = r"""'// Power Query: the query behind each loaded table (one per table) and what each other query returns',
'VAR _mParts = SELECTCOLUMNS ( FILTER ( INFO.PARTITIONS (), [Type] = 4 ), "QTID", [TableID], "QCode", [QueryDefinition] )',
'VAR _mTypes = SELECTCOLUMNS ( FILTER ( INFO.ANNOTATIONS (), [Name] = "PBI_ResultType" ), "AID", [ObjectID], "AValue", [Value] )',
"""

Q_TAIL = r"""'\t\t"ToTable", "",',
'\t\t"ToColumn", "",',
'\t\t"Summarize", "",',
'\t\t"SortBy", "",',
'\t\t"Hierarchies", "",',
'\t\t"Storage", "",',
'\t\t"Source", ""',
'\t)',
"""

QUERIES = r"""'// Power Query code: loaded tables (Table = the table), then queries that aren\u2019t loaded, parameters and functions (Table empty)',
'VAR _queries =',
'\tSELECTCOLUMNS (',
'\t\tFILTER ( _tableIds, VAR _qt = [TID] RETURN NOT ISEMPTY ( FILTER ( _mParts, [QTID] = _qt ) ) ),',
'\t\t"Kind", "Query",',
'\t\t"Table", [TName],',
'\t\t"Name", [TName],',
'\t\t"Type", "Table",',
'\t\t"Folder", "",',
'\t\t"Flags", "",',
'\t\t"Description", "",',
'\t\t"Expression", VAR _qt = [TID] RETURN """ + "' + CLEAN('MAXX ( FILTER ( _mParts, [QTID] = _qt ), [QCode] )', '    ') + '," + r"""',
""" + Q_TAIL + r"""'VAR _mOther =',
'\tSELECTCOLUMNS (',
'\t\tFILTER ( INFO.EXPRESSIONS (), [Kind] = 0 ),',
'\t\t"Kind", "Query",',
'\t\t"Table", "",',
'\t\t"Name", [Name],',
'\t\t"Type", VAR _qe = [ID] RETURN CONCATENATEX ( FILTER ( _mTypes, [AID] = _qe ), [AValue], ", " ),',
'\t\t"Folder", "",',
'\t\t"Flags", "",',
'\t\t"Description", "",',
'\t\t"Expression", ' + CLEAN('[Expression]', '    ') + ',',
""" + Q_TAIL


def add_queries(s):
    """Power Query code in the shared export (Kind "Query" rows), so Power Query Writer and Power Query
    Explainer read each table's query, and the queries that aren't loaded, from the one export."""
    if "'VAR _model =',"  not in s or QMARK in s:
        return s
    exp = "'VAR _expressions = SELECTCOLUMNS ( INFO.EXPRESSIONS (), \"EID\", [ID], \"EName\", [Name] )',\n"
    s = once(s, exp, exp + Q_LOOKUP)
    s = once(s, "'VAR _model =',", QUERIES + "'VAR _model =',")
    s = once(s, "UNION ( _tables, _columns, _measures, _relationships, _model )", "UNION ( _tables, _columns, _measures, _relationships, _model, _queries, _mOther )")
    return s


def upgrade(s):
    return add_queries(_upgrade(s))


def _upgrade(s):
    if "'VAR _columns ='," not in s or MARK in s:
        return s
    exp = r"""'VAR _expressions = SELECTCOLUMNS ( INFO.EXPRESSIONS (), "EID", [ID], "EName", [Name] )',
"""
    s = once(s, exp, exp + LOOKUPS)
    st = r"""'\t\t"Storage", [StorageMode],',
"""
    s = once(s, st, EMPTY + st)
    # columns, measures, relationships: the next Storage line after each VAR
    empty_storage = r"""'\t\t"Storage", "",',
"""
    for var, extra in (("'VAR _columns =',", COLS), ("'VAR _measures =',", EMPTY), ("'VAR _relationships =',", EMPTY)):
        i = s.index(var)
        j = s.index(empty_storage, i)
        s = s[:j] + extra + s[j:]
    mf = r"""'\t\t"Flags", IF ( [IsHidden], "hidden", "" ),',
"""
    s = once(s, mf, r"""'\t\t"Flags", IF ( [IsHidden], "hidden", "" ) & IF ( [DataType] IN { "Text", "String" }, " text", "" ) & """ + FMT_DYN + r""",',
""")
    i = s.index("'VAR _measures =',")
    t = r"""'\t\t"Type", [FormatString],',
"""
    j = s.index(t, i)
    s = s[:j] + FMT_TYPE + s[j + len(t):]
    s = once(s, exp + LOOKUPS, exp + LOOKUPS + FMT_LOOKUP)
    # calculated tables (field parameters, date tables): their DAX, so measures and columns used only there count as used
    i = s.index("'VAR _tables =',")
    j = s.index(r"""'\t\t"Expression", "",',""", i)
    s = s[:j] + CALC_EXPR + s[j + len(r"""'\t\t"Expression", "",'""") + 1:]
    s = once(s, exp + LOOKUPS, exp + LOOKUPS + CALC_LOOKUP)
    s = once(s, r"""'RETURN',
'\tUNION ( _tables, _columns, _measures, _relationships )',""",
             MODEL + r"""'RETURN',
'\tUNION ( _tables, _columns, _measures, _relationships, _model )',""")
    return s
