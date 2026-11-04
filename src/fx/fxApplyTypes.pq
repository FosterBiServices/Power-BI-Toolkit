// fxApplyTypes: Sets column types from a list of {column, type} pairs in one step. Pairs for columns the table doesn't have
// are skipped, so a missing or renamed source column doesn't break the refresh. Every other column gets
// Options[DefaultType] (type text unless you say otherwise; null leaves them as they are). Options[Culture]
// reads dates and numbers in that culture, for example "en-GB".
// Example: fxApplyTypes(PromotedHeaders, {{"CREATE DATE", type date}, {"USER ID", Int64.Type}})
(InputTable as table, TypePairs as list, optional Options as nullable record) as table =>
    let
        Opts = if Options = null then [] else Options,
        // the type for any column TypePairs doesn't list; null leaves those columns as they are
        DefaultType = Record.FieldOrDefault(Opts, "DefaultType", type text),
        Culture = Record.FieldOrDefault(Opts, "Culture", null),
        ExistingCols = Table.ColumnNames(InputTable),
        // the last pair for a column wins; pairs for columns that aren't in the table are skipped
        TypeOf = (c as text) => let m = List.Select(TypePairs, each _{0} = c) in if List.IsEmpty(m) then DefaultType else List.Last(m){1},
        AllPairs = List.Select(List.Transform(ExistingCols, (c) => {c, TypeOf(c)}), each _{1} <> null),
        Typed = Table.TransformColumnTypes(InputTable, AllPairs, Culture)
    in
        Typed
