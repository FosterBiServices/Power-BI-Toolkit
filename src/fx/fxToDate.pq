let
    fxToDate = (InputTable as table, Columns as list, optional Options as nullable record) as table =>
        let
            Opts = if Options = null then [] else Options,
            Culture = Record.FieldOrDefault(Opts, "Culture", null),
            Format = Record.FieldOrDefault(Opts, "Format", null),
            ReadOpts = [Format = Format, Culture = Culture],
            // dates, date-times, Excel serial numbers and text; null when it can't be read
            ToDate = (v as any) as nullable date =>
                if v = null then null
                else if v is date then v
                else if v is datetime then DateTime.Date(v)
                else if v is datetimezone then DateTime.Date(DateTimeZone.RemoveZone(v))
                else if v is number then (if v >= 1 and v < 2958466 then Date.From(v) else null)
                else if v is text then
                    let t = Text.Trim(v)
                    in
                        if t = "" then null
                        else try Date.FromText(t, ReadOpts)
                        otherwise try DateTime.Date(DateTime.FromText(t, ReadOpts))
                        otherwise try Date.From(Number.FromText(t, "en-US"))
                        otherwise null
                else null,
            Cols = List.Intersect({Columns, Table.ColumnNames(InputTable)}),
            Result = Table.TransformColumns(InputTable, List.Transform(Cols, (c) => {c, ToDate, type nullable date}))
        in
            Result,
    Documented = Value.ReplaceType(fxToDate, Value.ReplaceMetadata(Value.Type(fxToDate), [
        Documentation.Name = "fxToDate",
        Documentation.LongDescription = "Turns the columns named into dates: dates, date-times (the time is dropped), Excel serial numbers and text. Text is read in Options[Culture] (for example ""en-GB"" for day-first dates) or with Options[Format] (for example ""yyyyMMdd""). Values that can't be read become null instead of errors.",
        Documentation.Examples = {[Description = "Day-first text dates", Code = "fxToDate(Source, {""Order Date"", ""Ship Date""}, [Culture = ""en-GB""])", Result = "Order Date and Ship Date as dates"]}
    ]))
in
    Documented
