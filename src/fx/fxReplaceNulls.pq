let
    fxReplaceNulls = (InputTable as table, Columns as list, Value as any) as table =>
        let
            Cols = List.Intersect({Columns, Table.ColumnNames(InputTable)}),
            Result = Table.ReplaceValue(InputTable, null, Value, Replacer.ReplaceValue, Cols)
        in
            Result,
    Documented = Value.ReplaceType(fxReplaceNulls, Value.ReplaceMetadata(Value.Type(fxReplaceNulls), [
        Documentation.Name = "fxReplaceNulls",
        Documentation.LongDescription = "Replaces null with Value in the columns named. Columns the table doesn't have are skipped.",
        Documentation.Examples = {[Description = "Unknown region", Code = "fxReplaceNulls(Source, {""Region""}, ""Unknown"")", Result = "Region with Unknown where it was null"]}
    ]))
in
    Documented
