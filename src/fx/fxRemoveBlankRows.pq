// fxRemoveBlankRows: Removes rows where every value is null, empty text or only spaces.
// Example: fxRemoveBlankRows(PromotedHeaders)
(InputTable as table) as table =>
    Table.SelectRows(InputTable, each not List.IsEmpty(List.Select(Record.FieldValues(_), (v) => v <> null and not (v is text and Text.Trim(v) = ""))))
