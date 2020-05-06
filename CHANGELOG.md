# What's New?

## UnReleased

## Release

## 0.2.4

### Added
- Added diagnostic error when semantic value ($$) is used but the type was not declared
- Now %left %right %nonassoc creates new tokens when a token was not already declared

### Changed
- Removed some predefined keywords as there are not predefined

### Bug fixes
- Fixed syntax highlight single line comment inside keywords (yacc)
- Fixed a small bug which didn't allow spaces in regex quantifier

## 0.2.3

### Added
- Added override predefined symbols detection (yacc)
- Added predefined symbols to completion (yacc)

### Changed
- Changed default value for rules region range (lex/yacc)
- Changed lex completion rule, now supports more cases (lex)
- Now predefined symbols have different color (yacc)

### Bug fixes
- Fixed wrongly detect regex quantifier {1, 2} as symbol (lex)
- Fixed missing `error` predefined symbol to yacc (yacc)
- Fixed escaped {}s detection (flex)

## 0.2.2

### Added
- Added feature: find type definition support (yacc)
- Added more file extensions support according to <https://www.gnu.org/software/automake/manual/html_node/Yacc-and-Lex.html>
  - .yy
  - .y++
  - .yxx
  - .ypp
  - .ll
  - .l++
  - .lxx
  - .lpp

### Changed
- Change dollars syntax scope naming
- Simple refactoring, add common files

### Bug fixes
- Fixed unable to detect int name[100]; variable name pattern. (yacc)
- Fixed a missing case for start state scope detection (lex)

## 0.2.1
### Added
- Added support for start state scope (lex)

### Changed
- Now uses a parser to parse the %union types instead of regex (yacc)
- Modified README.md

### Bug fixes
- Fixed wrong string highlight when quotes are escaped. Issue #1 (lex)
- Fixed wrong type detection in the %union scope (yacc)
- Fixed an hover issue when the non-terminal name is the same as a typename (yacc) 

## 0.2.0 27/04/2020
### Added
- Added lex/yacc parsers and language services
- Added feature: basic diagnostics support (lex/yacc)
- Added feature: rename symbol support (lex/yacc)
- Added feature: find references support (lex/yacc)
  
### Changed
- Architectural changing, now uses language service pattern
- Better completion handling/detection (lex/yacc)
- General optimization 
  - parsing time 3x less than before
  - binary search to detect C code region, computation time reduced from O(n) to O(log(n))
- Updated README.md

### Bug Fixes
- Minor bug fixes related to completion handling/detection

## 0.1.2
### Added
- Added recognition of start condition block (lex)

### Changed
- Changed validation method for token/symbol completion

### Bug Fixes
- Fixed recognition of extended non-terminal name reference (name for action section) (yacc)
- Change \b with \s that support also tab, \n, .. (yacc)
- Fix pattern of variables, non-terminal extension and result (yacc)
- Fix spaces in %left, %right, %nonassoc, %token, %type (yacc)

## 0.1.1
### Added
- Added folding for %{ ... %}
- Added auto closing for %% %% pair

### Bug Fixes
- Fixed wrong type detection for multiline token/symbol (yacc)
- Fixed recognition of not allowed single line comment in declatation (lex)
- Fixed confusion with % and %%; should not suggest keyword on %%

## 0.1.0 21/04/2020
### Added
- Added more keywords, expect-rr|start|skeleton|glr-parser|language|token-table|code imports (yacc)
- Added a fancier hover message, now shows the type definition of the symbols (lex/yacc)

### Changed
- Changed rules to completion for lex definition, better 
- Removed preview tag

### Bug Fixes
- Fixed multiple type/token definitions on multiple lines (yacc)
- %define support string as value (yacc)
- Fixed nested C block detection, better implementation (lex/yacc)
- Fixed a bug on wrong detection of tokens (yacc) 
- Fixed recognition of comment in %type, keywords, keywords-block, rules (yacc)

## 0.0.7
### Added
- Added comment highlight (lex)
- Added multi start states <a, b, c, d> highlight (lex)
- Added basic hover and goto definition support (lex/yacc)
- Added new keywords, nonassoc|pure-parser|name-prefix|locations (yacc)
- Added multiline token definitions detection (yacc)

### Bug fixes
- Fixed not auto-completing when writing the rule on the same line (yacc)
- Fixed wrong semantic coloring inside the C block (yacc)
- Fixed wrong semantic coloring for inline commented statement (lex/yacc)
- Fixed inline comment highlighting on %xxx line (lex/yacc)
- Temporary fixed nested C code detection (lex/yacc)
- Fixed %top{} statement (lex/yacc)

## 0.0.6
### Changed
- update extension icon

## 0.0.5
### Changed
- Update README.md

## 0.0.4
### Changed
- Removed gif samples from assets folder
- Exclude gifs from extension package
  
## 0.0.3 
### Added
- Updated README.md, added examples

### Changed
- Removed auto closing pair [<, >] since it is also on under the C code block

### Bug fixes
- Fixed a problem that prevents lex to suggest already declared definitions (lex)
- Fixed a not able to trigger completion when typing '<' in correct section (yacc)

## 0.0.2

- update icon 

## 0.0.1

- Initial release
