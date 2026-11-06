// fxTextToNumber: Turns text in the columns named into numbers, ignoring currency signs, spaces and percent signs: "$1,234.50"
// is 1234.5, "(45)" is -45 and "12%" is 0.12. Options[Culture] reads the separators of that culture (for example
// "de-DE" for 1.234,50). Options[WholeNumber] (default false) rounds to whole numbers. Values that can't be read
// become null.
// Example: fxTextToNumber(Source, {"Amount"})
(InputTable as table, Columns as list, optional Options as nullable record) as table =>
    let
        Opts = if Options = null then [] else Options,
        Culture = Record.FieldOrDefault(Opts, "Culture", null),
        WholeNumber = Record.FieldOrDefault(Opts, "WholeNumber", false),
        // "$1,234.50", "(45)", "12%", " 7 " -> 1234.5, -45, 0.12, 7; null when it can't be read
        ToNumber = (v as any) as nullable number =>
            if v = null then null
            else if v is number then (if WholeNumber then Number.Round(v, 0, RoundingMode.AwayFromZero) else v)
            else if v is text then
                let
                    t = Text.Trim(Text.Replace(v, "#(00A0)", " ")),
                    Negative = Text.StartsWith(t, "(") and Text.EndsWith(t, ")") or Text.StartsWith(t, "-"),
                    Percent = Text.EndsWith(t, "%"),
                    Digits = Text.Remove(t, {"$", "€", "£", "%", "(", ")", " ", "-"}),
                    n = if Digits = "" then null else try Number.FromText(Digits, Culture) otherwise null,
                    Signed = if n = null then null else (if Negative then -n else n) / (if Percent then 100 else 1)
                in
                    if Signed = null then null else if WholeNumber then Number.Round(Signed, 0, RoundingMode.AwayFromZero) else Signed
            else null,
        Cols = List.Intersect({Columns, Table.ColumnNames(InputTable)}),
        Result = Table.TransformColumns(InputTable, List.Transform(Cols, (c) => {c, ToNumber, if WholeNumber then Int64.Type else type nullable number}))
    in
        Result
