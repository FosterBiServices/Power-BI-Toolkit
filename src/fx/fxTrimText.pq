let
    fxTrimText = (InputTable as table, optional Columns as nullable list, optional Options as nullable record) as table =>
        let
            Opts = if Options = null then [] else Options,
            Clean = Record.FieldOrDefault(Opts, "Clean", true),
            BlankToNull = Record.FieldOrDefault(Opts, "BlankToNull", true),
            CollapseSpaces = Record.FieldOrDefault(Opts, "CollapseSpaces", false),
            // every column when Columns is null; only text values change, so number and date columns are safe
            Cols = if Columns = null then Table.ColumnNames(InputTable) else List.Intersect({Columns, Table.ColumnNames(InputTable)}),
            Tidy = (v as any) as any =>
                if v is text then
                    let
                        NoNbsp = Text.Replace(v, "#(00A0)", " "),
                        Cleaned = if Clean then Text.Clean(NoNbsp) else NoNbsp,
                        Trimmed = Text.Trim(Cleaned),
                        Collapsed = if CollapseSpaces then Text.Combine(List.Select(Text.Split(Trimmed, " "), each _ <> ""), " ") else Trimmed
                    in
                        if BlankToNull and Collapsed = "" then null else Collapsed
                else v,
            // keep each column's type
            Result = Table.TransformColumns(InputTable, List.Transform(Cols, (c) => {c, Tidy, Type.TableColumn(Value.Type(InputTable), c)}))
        in
            Result,
    Documented = Value.ReplaceType(fxTrimText, Value.ReplaceMetadata(Value.Type(fxTrimText), [
        Documentation.Name = "fxTrimText",
        Documentation.LongDescription = "Trims text in the columns named (every column when Columns is null): leading and trailing spaces, non-breaking spaces and, with Options[Clean] (default true), control characters such as line breaks. Empty text becomes null (Options[BlankToNull], default true). Options[CollapseSpaces] (default false) turns runs of spaces inside the text into one. Values that aren't text are left as they are.",
        Documentation.Examples = {[Description = "Tidy every text value", Code = "fxTrimText(ChangeTypes)", Result = "The table with trimmed text and null for empty text"]}
    ]))
in
    Documented
