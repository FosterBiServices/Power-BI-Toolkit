// fxSetCase: Upper, lower or proper case for the text in the columns named. Columns the table doesn't have are skipped;
// values that aren't text are left as they are.
// Example: fxSetCase(Trimmed, {"OFFICE"}, "Upper")
(InputTable as table, Columns as list, Case as text) as table =>
    let
        Fn = if Case = "Upper" then Text.Upper else if Case = "Lower" then Text.Lower else if Case = "Proper" then Text.Proper
            else error Error.Record("Unknown case", "Case is ""Upper"", ""Lower"" or ""Proper"", not """ & Case & """."),
        Cols = List.Intersect({Columns, Table.ColumnNames(InputTable)}),
        Result = Table.TransformColumns(InputTable, List.Transform(Cols, (c) => {c, each if _ is text then Fn(_) else _, Type.TableColumn(Value.Type(InputTable), c)}))
    in
        Result
