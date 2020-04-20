# What's New?

## UnReleased

## Release

## 0.0.7
### Added
- Added comment highlight (lex)
- Added multi initial states <a, b, c, d> highlight (lex)
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