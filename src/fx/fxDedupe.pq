let
    fxDedupe = (InputTable as table, KeyColumns as list, optional Options as nullable record) as table =>
        let
            Opts = if Options = null then [] else Options,
            KeepLast = Record.FieldOrDefault(Opts, "KeepLast", false),
            IgnoreCase = Record.FieldOrDefault(Opts, "IgnoreCase", false),
            Keys = if IgnoreCase then List.Transform(KeyColumns, each {_, Comparer.OrdinalIgnoreCase}) else KeyColumns,
            // buffered so "first" and "last" follow the row order the table has here
            Ordered = Table.Buffer(if KeepLast then Table.ReverseRows(InputTable) else InputTable),
            Distinct = Table.Distinct(Ordered, Keys),
            Result = if KeepLast then Table.ReverseRows(Distinct) else Distinct
        in
            Result,
    Documented = Value.ReplaceType(fxDedupe, Value.ReplaceMetadata(Value.Type(fxDedupe), [
        Documentation.Name = "fxDedupe",
        Documentation.LongDescription = "Keeps one row for each combination of the key columns: the first one, or the last with Options[KeepLast] = true (in the table's current row order; sort before calling it to choose). Options[IgnoreCase] (default false) treats ""ABC"" and ""abc"" as the same key.",
        Documentation.Examples = {[Description = "One row per user, the latest", Code = "fxDedupe(SortedByDate, {""USER ID""}, [KeepLast = true])", Result = "One row per USER ID"]}
    ]))
in
    Documented
