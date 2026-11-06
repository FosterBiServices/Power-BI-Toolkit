// fxAddDateTimeFromPairs: For each {source column, name} pair, adds "<name> date" and "<name> time" columns from a date-time value or
// text. Values that can't be read become null. Options: KeepOriginalColumns (default true), Overwrite (default
// true: replaces existing "<name> date"/"<name> time" columns), Culture for reading text, for example "en-US".
// Example: fxAddDateTimeFromPairs(Source, {{"sys_updated_on", "Updated"}}, [Culture = "en-US"])
(InputTable as table, Pairs as list, optional Options as nullable record) as table =>
    let
        Opts = if Options = null then [] else Options,
        KeepOriginal = Record.FieldOrDefault(Opts, "KeepOriginalColumns", true),
        Overwrite = Record.FieldOrDefault(Opts, "Overwrite", true),
        Culture = Record.FieldOrDefault(Opts, "Culture", null),
        // any date/time value, or text in Options[Culture], as a datetime; null when it can't be read
        ToDateTime = (v as any) as nullable datetime =>
            if v = null then null
            else if v is datetime then v
            else if v is datetimezone then DateTimeZone.RemoveZone(v)
            else if v is date then DateTime.From(v)
            else if v is time then #datetime(1899, 12, 30, 0, 0, 0) + (v - #time(0, 0, 0))
            else if v is text then (try DateTime.FromText(Text.Trim(v), Culture) otherwise null)
            else (try DateTime.From(v, Culture) otherwise null),
        SourceCols = List.Transform(Pairs, each _{0}),
        Missing = List.Difference(SourceCols, Table.ColumnNames(InputTable)),
        // used by every step after it, so a missing column stops the query with this message
        Checked = if List.IsEmpty(Missing) then InputTable else error Error.Record("Column not found", "These columns were not found: " & Text.Combine(Missing, ", ")),
        AddPair = (state as table, pair as list) as table =>
            let
                Src = pair{0},
                DateName = pair{1} & " date",
                TimeName = pair{1} & " time",
                Cleared = if Overwrite then Table.RemoveColumns(state, {DateName, TimeName}, MissingField.Ignore) else state,
                // read each value once, then split it
                WithDT = Table.AddColumn(Cleared, "__dt", (r) => ToDateTime(Record.Field(r, Src)), type nullable datetime),
                WithDate = Table.AddColumn(WithDT, DateName, each if [__dt] = null then null else DateTime.Date([__dt]), type nullable date),
                WithTime = Table.AddColumn(WithDate, TimeName, each if [__dt] = null then null else DateTime.Time([__dt]), type nullable time)
            in
                Table.RemoveColumns(WithTime, {"__dt"}),
        Added = List.Accumulate(Pairs, Checked, AddPair),
        // the source columns go last, after the new columns have been read from them
        Result = if KeepOriginal then Added else Table.RemoveColumns(Added, SourceCols)
    in
        Result
