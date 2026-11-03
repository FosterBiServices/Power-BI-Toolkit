let
    fxRemoveBlankRows = (InputTable as table) as table =>
        Table.SelectRows(InputTable, each not List.IsEmpty(List.Select(Record.FieldValues(_), (v) => v <> null and not (v is text and Text.Trim(v) = "")))),
    Documented = Value.ReplaceType(fxRemoveBlankRows, Value.ReplaceMetadata(Value.Type(fxRemoveBlankRows), [
        Documentation.Name = "fxRemoveBlankRows",
        Documentation.LongDescription = "Removes rows where every value is null, empty text or only spaces.",
        Documentation.Examples = {[Description = "Drop blank rows", Code = "fxRemoveBlankRows(PromotedHeaders)", Result = "The table without blank rows"]}
    ]))
in
    Documented
