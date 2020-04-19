# Yet Another Syntax Highlighter

This is yet an another syntax highlighter for lex/yacc and flex/bison.

## Features

This extension provides full syntax highlight for these languages and also for the embedded language C/C++.

Since 1.43.0 VSCode enabled a new feature called Semantic Highlighting, this extension supports it. 

By default, only the built-in themes has semantic highlighting enabled, so if you are using a 3rd party theme for example [Dracula](https://github.com/dracula/visual-studio-code/) which doesn't support the semantic coloring yet, you have to add these lines to your `settings.json` file to have the feature enabled. 
```json
"editor.tokenColorCustomizations": {
	"[name of the theme]": {
		"semanticHighlighting": true
	}
}
```
For extra information see https://github.com/microsoft/vscode/wiki/Semantic-Highlighting-Overview.

Here is the comparison with and without semantic highlighting. 

On left enabled, on right disabled

![](images/semantic_comparison.png)

### Completion features

### Auto-Completion for keywords, declared definitions in lex/flex

![](images/lex_define.gif)

![](images/lex_rule.gif)

### Auto-Completion for keywords, declared union types in yacc/bison

![](images/yacc_token.gif)


### Auto-Completion for symbols in yacc/bison
![](images/yacc_symbol.gif)

### Auto-Completion for symbol type in yacc/bison
![](images/yacc_type.gif)

## Requirements

VSCode 1.44.0+

## Contributors

- [@babyraging](https://github.com/babyraging) - creator
- [@sceriffo](https://github.com/Sceriffo) - creator 