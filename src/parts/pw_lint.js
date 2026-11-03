/* ---------- Power Query Writer: deeper checks on Copilot's query (no AI) ----------
   The M parser (mq_core.js) already stops on unbalanced brackets and unclosed quotes. These read the tokens for:
   functions that don't exist and wrong argument counts (a list of common M functions), each/_ used in the wrong
   context, steps that use a step defined after them, step names that hide a function library, Table.RemoveColumns
   without MissingField.Ignore, and the type map coming back changed. Each returns { level, title, detail, step }. */
const PWL = (() => {
  // name: "min-max" (or "n"). A library listed in FULL is complete enough that a name missing from it is flagged.
  const A = {
    Table: 'AddColumn 3-4 AddFuzzyClusterColumn 3-4 AddIndexColumn 2-5 AddJoinColumn 5 AddKey 3 AddRankColumn 3-4 AggregateTableColumn 3 AlternateRows 4 ApproximateRowCount 1 Buffer 1-2 Column 2 ColumnCount 1 ColumnNames 1 ColumnsOfType 2 Combine 1-2 CombineColumns 4 CombineColumnsToRecord 3-4 ConformToPageReader 2 Contains 2-3 ContainsAll 2-3 ContainsAny 2-3 DemoteHeaders 1 Distinct 1-2 DuplicateColumn 3-4 ExpandListColumn 2 ExpandRecordColumn 3-4 ExpandTableColumn 3-4 FillDown 2 FillUp 2 FilterWithDataTable 2 FindText 2 First 1-2 FirstN 2 FirstValue 1-2 FromColumns 1-2 FromList 1-5 FromPartitions 2-3 FromRecords 1-3 FromRows 1-2 FromValue 1-2 FuzzyGroup 3-4 FuzzyJoin 6-7 FuzzyNestedJoin 7-8 Group 3-5 HasColumns 2 InsertRows 3 IsDistinct 1-2 IsEmpty 1 Join 5-7 Keys 1 Last 1-2 LastN 2 MatchesAllRows 2 MatchesAnyRows 2 Max 2-3 MaxN 3 Min 2-3 MinN 3 NestedJoin 6-8 Partition 4 PartitionKey 1 PartitionValues 1 Pivot 4-5 PositionOf 2-4 PositionOfAny 2-4 PrefixColumns 2 Profile 1-2 PromoteHeaders 1-2 Range 2-3 RemoveColumns 2-3 RemoveFirstN 1-2 RemoveLastN 1-2 RemoveMatchingRows 2-3 RemoveRows 2-3 RemoveRowsWithErrors 1-2 RenameColumns 2-3 ReorderColumns 2-3 Repeat 2 ReplaceErrorValues 2 ReplaceKeys 2 ReplaceMatchingRows 2-3 ReplacePartitionKey 2 ReplaceRelationshipIdentity 2 ReplaceRows 4 ReplaceValue 5 ReverseRows 1 RowCount 1 Schema 1 SelectColumns 2-3 SelectRows 2 SelectRowsWithErrors 1-2 SingleRow 1 Skip 1-2 Sort 2 Split 2 SplitAt 2 SplitColumn 3-6 StopFolding 1 ToColumns 1 ToList 1-2 ToRecords 1 ToRows 1 TransformColumnNames 2-3 TransformColumns 2-4 TransformColumnTypes 2-3 TransformRows 2 Transpose 1-2 Unpivot 4 UnpivotOtherColumns 4 View 2 ViewError 1 ViewFunction 1',
    List: 'Accumulate 3 AllTrue 1 Alternate 2-4 AnyTrue 1 Average 1-2 Buffer 1 Combine 1 ConformToPageReader 2 Contains 2-3 ContainsAll 2-3 ContainsAny 2-3 Count 1 Covariance 2 Dates 3 DateTimes 3 DateTimeZones 3 Difference 2-3 Distinct 1-2 Durations 3 FindText 2 First 1-2 FirstN 2 Generate 3-4 InsertRange 3 Intersect 1-2 IsDistinct 1-2 IsEmpty 1 Last 1-2 LastN 1-2 MatchesAll 2 MatchesAny 2 Max 1-4 MaxN 2-4 Median 1-2 Min 1-4 MinN 2-4 Mode 1-2 Modes 1-2 NonNullCount 1 Numbers 2-3 Percentile 2-3 PositionOf 2-4 PositionOfAny 2-4 Positions 1 Product 1-2 Random 1-2 Range 2-3 RemoveFirstN 1-2 RemoveItems 2 RemoveLastN 1-2 RemoveMatchingItems 2-3 RemoveNulls 1 RemoveRange 2-3 Repeat 2 ReplaceMatchingItems 2-3 ReplaceRange 4 ReplaceValue 4 Reverse 1 Select 2 Single 1 SingleOrDefault 1-2 Skip 1-2 Sort 1-2 Split 2 StandardDeviation 1 Sum 1-2 Times 3 Transform 2 TransformMany 3 Union 1-2 Zip 1',
    Text: 'AfterDelimiter 2-3 At 2 BeforeDelimiter 2-3 BetweenDelimiters 3-5 Clean 1 Combine 1-2 Contains 2-3 End 2 EndsWith 2-3 Format 2-3 From 1-2 FromBinary 1-2 InferNumberType 1-2 Insert 3 Length 1 Lower 1-2 Middle 2-3 NewGuid 0 PadEnd 2-3 PadStart 2-3 PositionOf 2-4 PositionOfAny 2-3 Proper 1-2 Range 2-3 Remove 2 RemoveRange 2-3 Repeat 2 Replace 3 ReplaceRange 4 Reverse 1 Select 2 Split 2 SplitAny 2 Start 2 StartsWith 2-3 ToBinary 1-3 ToList 1 Trim 1-2 TrimEnd 1-2 TrimStart 1-2 Upper 1-2',
    Record: 'AddField 3-4 Combine 1 Field 2 FieldCount 1 FieldNames 1 FieldOrDefault 2-3 FieldValues 1 FromList 2 FromTable 1 HasFields 2 Location 1 RemoveFields 2-3 RenameFields 2-3 ReorderFields 2-3 SelectFields 2-3 ToList 1 ToTable 1 TransformFields 2-3',
    Date: 'AddDays 2 AddMonths 2 AddQuarters 2 AddWeeks 2 AddYears 2 Day 1 DayOfWeek 1-2 DayOfWeekName 1-2 DayOfYear 1 DaysInMonth 1 EndOfDay 1 EndOfMonth 1 EndOfQuarter 1 EndOfWeek 1-2 EndOfYear 1 From 1-2 FromText 1-2 IsInCurrentDay 1 IsInCurrentMonth 1 IsInCurrentQuarter 1 IsInCurrentWeek 1 IsInCurrentYear 1 IsInNextDay 1 IsInNextMonth 1 IsInNextNDays 2 IsInNextNMonths 2 IsInNextNQuarters 2 IsInNextNWeeks 2 IsInNextNYears 2 IsInNextQuarter 1 IsInNextWeek 1 IsInNextYear 1 IsInPreviousDay 1 IsInPreviousMonth 1 IsInPreviousNDays 2 IsInPreviousNMonths 2 IsInPreviousNQuarters 2 IsInPreviousNWeeks 2 IsInPreviousNYears 2 IsInPreviousQuarter 1 IsInPreviousWeek 1 IsInPreviousYear 1 IsInYearToDate 1 IsLeapYear 1 Month 1 MonthName 1-2 QuarterOfYear 1 StartOfDay 1 StartOfMonth 1 StartOfQuarter 1 StartOfWeek 1-2 StartOfYear 1 ToRecord 1 ToText 1-3 WeekOfMonth 1-2 WeekOfYear 1-2 Year 1',
    Duration: 'Days 1 From 1 FromText 1 Hours 1 Minutes 1 Seconds 1 ToRecord 1 ToText 1-2 TotalDays 1 TotalHours 1 TotalMinutes 1 TotalSeconds 1',
    Number: 'Abs 1 Acos 1 Asin 1 Atan 1 Atan2 2 BitwiseAnd 2 BitwiseNot 1 BitwiseOr 2 BitwiseShiftLeft 2 BitwiseShiftRight 2 BitwiseXor 2 Combinations 2 Cos 1 Cosh 1 Exp 1 Factorial 1 From 1-2 FromText 1-2 IntegerDivide 2-3 IsEven 1 IsNaN 1 IsOdd 1 Ln 1 Log 1-2 Log10 1 Mod 2-3 Permutations 2 Power 2 Random 0 RandomBetween 2 Round 1-3 RoundAwayFromZero 1-2 RoundDown 1-2 RoundTowardZero 1-2 RoundUp 1-2 Sign 1 Sin 1 Sinh 1 Sqrt 1 Tan 1 Tanh 1 ToText 1-3'
  };
  const FULL = new Set(['Table', 'List', 'Text', 'Record', 'Duration']);
  const ARITY = {};
  Object.keys(A).forEach(lib => { const p = A[lib].split(' '); for (let i = 0; i < p.length; i += 2) { const [a, b] = p[i + 1].split('-').map(Number); ARITY[lib + '.' + p[i]] = [a, b === undefined ? a : b]; } });
  const LIBS = ['Table', 'List', 'Text', 'Number', 'Date', 'DateTime', 'DateTimeZone', 'Duration', 'Time', 'Record', 'Value', 'Type', 'Splitter', 'Combiner', 'Replacer', 'Comparer', 'Function', 'Binary', 'Json', 'Csv', 'Excel', 'Folder', 'File', 'Web', 'Character', 'Expression', 'Lines', 'Uri', 'Logical', 'Error', 'Diagnostics', 'Cube'];
  const KW = new Set(['each', 'and', 'or', 'not', 'if', 'then', 'else', 'in', 'let', 'try', 'otherwise', 'meta', 'as', 'is', 'type', 'error']);
  const VALUE_FNS = /^(Text|Number|Date|DateTime|DateTimeZone|Duration|Time|Logical)\./;
  // names Copilot tends to invent, and the real function
  const ALIAS = { 'Table.FilterRows': 'Table.SelectRows', 'Table.Filter': 'Table.SelectRows', 'Table.Where': 'Table.SelectRows', 'Table.RemoveColumn': 'Table.RemoveColumns', 'Table.RenameColumn': 'Table.RenameColumns',
    'Table.AddColumns': 'Table.AddColumn', 'Table.ChangeType': 'Table.TransformColumnTypes', 'Table.ChangeTypes': 'Table.TransformColumnTypes', 'Table.ChangeColumnTypes': 'Table.TransformColumnTypes', 'Table.Merge': 'Table.NestedJoin',
    'Table.MergeQueries': 'Table.NestedJoin', 'Table.Append': 'Table.Combine', 'Table.GroupBy': 'Table.Group', 'Table.KeepColumns': 'Table.SelectColumns', 'Table.Count': 'Table.RowCount', 'Table.OrderBy': 'Table.Sort',
    'Table.SortBy': 'Table.Sort', 'Table.UnpivotColumns': 'Table.Unpivot', 'Table.ReplaceValues': 'Table.ReplaceValue', 'Text.Left': 'Text.Start', 'Text.Right': 'Text.End', 'Text.Substring': 'Text.Middle', 'Text.Mid': 'Text.Middle',
    'Text.Concat': 'Text.Combine', 'Text.Concatenate': 'Text.Combine', 'Text.Join': 'Text.Combine', 'Text.ToUpper': 'Text.Upper', 'Text.ToLower': 'Text.Lower', 'Text.IndexOf': 'Text.PositionOf', 'Text.Len': 'Text.Length',
    'Text.Find': 'Text.PositionOf', 'Text.Substitute': 'Text.Replace', 'Text.IsBlank': 'a comparison such as [Column] = null or Text.Trim([Column]) = ""', 'List.Filter': 'List.Select', 'List.Map': 'List.Transform',
    'List.Length': 'List.Count', 'List.Where': 'List.Select', 'List.Concat': 'List.Combine', 'List.Unique': 'List.Distinct', 'Record.GetField': 'Record.Field', 'Duration.TotalDay': 'Duration.TotalDays' };
  const near = n => {
    if (ALIAS[n]) return [ALIAS[n]]; const [lib, f] = n.split('.'), lf = (f || '').toLowerCase(); return Object.keys(ARITY).filter(k => k.startsWith(lib + '.')).map(k => k.split('.')[1]).filter(x => x.toLowerCase().includes(lf.slice(0, 5)) || lf.includes(x.toLowerCase().slice(0, 5))).slice(0, 3).map(x => lib + '.' + x); };

  // the calls in the code: { name, args: [[from, to] token ranges], open, close, line }
  function calls(toks, src, named){
    const out = [], sig = toks.map((t, i) => i).filter(i => toks[i].t !== 'ws' && toks[i].t !== 'comment');
    const S = sig.map(i => toks[i]);
    for (let k = 0; k < S.length - 1; k++) {
      // library calls (Table.AddColumn), and calls of functions by name: fx… and the ones the person listed
      if (S[k].t !== 'id' || S[k + 1].v !== '(' || !(/^[A-Z][A-Za-z0-9]*\.[A-Z][A-Za-z0-9.]*$/.test(S[k].v) || /^fx[A-Z0-9_]/.test(S[k].v) || (named && named.has(S[k].v)))) continue;
      // a step or variable defined as a function here (Name = (x) => …) is not a call of the library
      if (k > 0 && S[k - 1].v === '.') continue;
      let d = 0, args = [], start = k + 2, j = k + 1;
      for (; j < S.length; j++) {
        const v = S[j].v;
        if (v === '(' || v === '[' || v === '{') d++;
        else if (v === ')' || v === ']' || v === '}') { d--; if (d === 0) break; }
        else if (v === ',' && d === 1) { args.push([start, j]); start = j + 1; }
      }
      if (j > start) args.push([start, j]); else if (args.length) args.push([start, j]);
      out.push({ name: S[k].v, args, open: k + 1, close: j, line: lineOf(src, S[k].s) });
    }
    return { calls: out, S };
  }

  function lint(code, q, inp, cols){
    const out = [], add = (level, title, detail, step) => out.push({ level, title, detail, step });
    const tk = mTokenize(code); if (tk.error) return out;
    const fx = PW.fxInfo(inp), named = new Map(fx.known.map(f => [f.name, f]));
    const { calls: cs, S } = calls(tk.toks, code, named), stepNames = new Set(q.steps.map(s => s.name));
    // 1. functions that don't exist, and argument counts
    const unknown = [], wrongN = [], notListed = [];
    cs.forEach(c => {
      const lib = c.name.split('.')[0];
      if (named.has(c.name)) { const f = named.get(c.name), n = c.args.length; if (f.min != null && (n < f.min || n > f.max)) wrongN.push(c.name + ' on line ' + c.line + ' has ' + n + ' argument' + (n === 1 ? '' : 's') + '; it takes ' + (f.min === f.max ? f.min : f.min + ' to ' + f.max) + '.'); return; }
      if (!c.name.includes('.')) { if (!stepNames.has(c.name) && !new RegExp('(^|[^A-Za-z0-9_])' + c.name + '\\s*=\\s*\\(').test(code)) notListed.push(c.name + ' (line ' + c.line + ')'); return; }
      if (ARITY[c.name]) { const [a, b] = ARITY[c.name], n = c.args.length; if (n < a || n > b) wrongN.push(c.name + ' on line ' + c.line + ' has ' + n + ' argument' + (n === 1 ? '' : 's') + '; it takes ' + (a === b ? a : a + ' to ' + b) + '.'); }
      else if (FULL.has(lib) && c.name.split('.').length === 2) unknown.push(c.name + ' (line ' + c.line + ')' + (near(c.name).length ? ', perhaps ' + near(c.name).join(' or ') : ''));
    });
    if (unknown.length) add('err', unknown.length + ' function' + (unknown.length > 1 ? 's that don’t' : ' that doesn’t') + ' exist in Power Query', Array.from(new Set(unknown)).join('; ') + '. Copilot sometimes makes up function names: ask it to use a real function.');
    if (wrongN.length) add('err', 'Wrong number of arguments', Array.from(new Set(wrongN)).join(' '));
    if (notListed.length) add('warn', 'Calls a function that isn\u2019t listed', Array.from(new Set(notListed)).join('; ') + '. It isn\u2019t a Power Query function or one the page knows you have. If it\u2019s a query in your file, add it under \u201cFunctions you already have\u201d; if not, ask Copilot to use a real function.');
    // 2. each in the wrong context
    const ctx = [];
    cs.forEach(c => {
      const value = c.name === 'Table.TransformColumns', row = /^Table\.(AddColumn|SelectRows|RemoveMatchingRows)$/.test(c.name);
      if (!value && !row) return;
      for (let k = c.open + 1; k < c.close; k++) {
        if (S[k].t !== 'id' || S[k].v !== 'each') continue;
        // the body runs to the next comma or closing bracket at this depth
        let d = 0, e = k + 1;
        for (; e < c.close; e++) { const v = S[e].v; if (v === '(' || v === '[' || v === '{') d++; else if (v === ')' || v === ']' || v === '}') { if (d === 0) break; d--; } else if (v === ',' && d === 0) break; }
        for (let m = k + 1; m < e; m++) {
          const t = S[m], prev = S[m - 1];
          if (value && t.v === '[' && S[m + 2] && S[m + 2].v === ']' && !(((prev.t === 'id' && !KW.has(prev.v)) || prev.t === 'qid') || [']', ')', '}'].includes(prev.v)))
            ctx.push('[' + S[m + 1].v.replace(/^#"|"$/g, '') + '] inside ' + c.name + ' (line ' + c.line + '): here each gets the column’s value, so write _ (for example each Text.Upper(_)).');
          if (row && t.t === 'id' && t.v === '_' && S[m + 1] && !['[', '{'].includes(S[m + 1].v) && prev.v === '(' && S[m - 2] && VALUE_FNS.test(S[m - 2].v))
            ctx.push(S[m - 2].v + '(_) inside ' + c.name + ' (line ' + c.line + '): here _ is the whole row, so name the column, for example ' + S[m - 2].v + '([Column]).');
        }
        k = e - 1;
      }
    });
    if (ctx.length) add('err', 'each used in the wrong context', Array.from(new Set(ctx)).join(' '));
    // 3. a step that uses a step defined after it
    const pos = new Map(q.steps.map((s, i) => [s.name, i]));
    const later = q.steps.filter((s, i) => (s.refs || []).some(r => pos.get(r) > i)).map(s => s.name + ' uses ' + s.refs.filter(r => pos.get(r) > pos.get(s.name)).join(', '));
    if (later.length) add('warn', 'Steps out of order', later.join('; ') + ', defined after it. Power Query runs it, but the query is hard to follow and Copilot was asked for each step to build on an earlier one.');
    // 4. step names that hide a function library
    const libNames = q.steps.filter(s => LIBS.includes(s.name)).map(s => s.name);
    if (libNames.length) add('info', 'Step named after a function library', libNames.map(n => '“' + n + '”').join(', ') + ' is also the name of Power Query’s ' + libNames.join(', ') + ' functions. It works, but it’s confusing to read: use a name like With' + libNames[0] + '.', libNames[0]);
    // 5. Table.RemoveColumns that breaks if a column is gone
    cs.filter(c => c.name === 'Table.RemoveColumns' && c.args.length < 3).forEach(c => add('warn', 'Removes columns without MissingField.Ignore', 'Table.RemoveColumns on line ' + c.line + ' fails the refresh if a named column is no longer in the source. Add MissingField.Ignore as the third argument.'));
    // 6. the type map came back as given
    // the cleaning steps: every function they use is called
    if (fx.rs) {
      // (fxApplyTypes has its own check below)
      const called = new Set(cs.map(c => c.name)), clean = fx.rs.fns.filter(f => f !== 'fxApplyTypes'), gone = clean.filter(f => !called.has(f));
      if (gone.length) add('warn', 'Cleaning steps missing', gone.join(', ') + (gone.length > 1 ? ' aren\u2019t' : ' isn\u2019t') + ' called. Copilot was asked to use the cleaning steps as given; ask it to put them back after the step where the column names are final.');
      else if (clean.length) add('ok', 'Cleaning steps as given', clean.join(', ') + '.');
    }
    const want = new Map(((fx.rs ? fx.rs.types : cols) || []).map(c => [c.name, PWF.M_TYPE[c.type] || 'type text']));
    const pairsIn = text => { const got = new Map(); (text.match(/\{\s*"((?:[^"]|"")*)"\s*,\s*(type\s+[a-z]+|[A-Za-z0-9.]+\.Type)\s*\}/g) || []).forEach(m => { const x = /"((?:[^"]|"")*)"\s*,\s*(.+?)\s*\}$/.exec(m); got.set(x[1].replace(/""/g, '"'), x[2].replace(/\s+/g, ' ')); }); return got; };
    const diff = got => { const missing = [...want.keys()].filter(n => !got.has(n)), changed = [...want.keys()].filter(n => got.has(n) && got.get(n) !== want.get(n)).map(n => n + ' is ' + got.get(n) + ' (was ' + want.get(n) + ')');
      return [].concat(missing.length ? ['missing pairs: ' + missing.join(', ')] : [], changed.length ? ['changed types: ' + changed.join('; ')] : []); };
    if (inp.typeMap && cols && cols.length && fx.rs && fx.rs.fns.includes('fxApplyTypes')) {
      // the type map as a call to fxApplyTypes: its pairs, and no DefaultType other than text
      const call = cs.find(c => c.name === 'fxApplyTypes');
      if (!call) add('warn', 'The type map is missing', 'There\u2019s no fxApplyTypes step. Copilot was asked to set the types with it; ask it to put the ChangeTypes step back.');
      else {
        const text = S.slice(call.open, call.close + 1).map(t => t.v).join(' '), got = pairsIn(text);
        const probs = diff(got).concat(/DefaultType/.test(text) ? ['a DefaultType was added, so other columns aren\u2019t text'] : []);
        if (probs.length) add('warn', 'The type map was changed', cap2(probs.join('; ')) + '. Check that the TASK asked for it.', 'ChangeTypes');
        else add('ok', 'Type map as given', got.size + ' column types with fxApplyTypes, text for any other column.');
      }
    } else if (inp.typeMap && cols && cols.length) {
      const tp = q.steps.find(s => s.name === 'TypePairs');
      if (!tp) add('warn', 'The type map is missing', 'There’s no TypePairs step. Copilot was asked to use the type map as given; ask it to add it after the step where the column names are final.');
      else {
        const got = pairsIn(tp.expr);
        const dflt = q.steps.some(s => /Record\.FieldOrDefault\s*\([^)]*type\s+text\s*\)/.test(s.expr)), one = q.steps.filter(s => s.fn === 'Table.TransformColumnTypes').length === 1 && q.steps.some(s => s.fn === 'Table.TransformColumnTypes' && /AllTypePairs/.test(s.expr));
        const probs = diff(got).concat(dflt ? [] : ['the default of type text for other columns is gone'], one ? [] : ['the types aren’t applied in one Table.TransformColumnTypes with AllTypePairs']);
        if (probs.length) add('warn', 'The type map was changed', cap2(probs.join('; ')) + '. Check that the TASK asked for it.', 'TypePairs');
        else add('ok', 'Type map as given', got.size + ' column types, text for any other column, applied in one step.');
      }
    }
    return out;
  }
  const cap2 = s => s.charAt(0).toUpperCase() + s.slice(1);
  return { lint, ARITY };
})();
