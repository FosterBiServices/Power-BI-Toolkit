// fxReplaceNulls: Replaces null with Value in the columns named. Columns the table doesn't have are skipped.
// Example: fxReplaceNulls(Source, {"Region"}, "Unknown")
(InputTable as table, Columns as list, Value as any) as table =>
    let
        Cols = List.Intersect({Columns, Table.ColumnNames(InputTable)}),
        Result = Table.ReplaceValue(InputTable, null, Value, Replacer.ReplaceValue, Cols)
    in
        Result
