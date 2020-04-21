import * as vscode from 'vscode';

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = (function () {
	const tokenTypesLegend = [
		'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
		'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
		'member', 'macro', 'variable', 'parameter', 'property', 'label'
	];
	tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

	const tokenModifiersLegend = [
		'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
		'modification', 'async'
	];
	tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

	return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

export function activate(context: vscode.ExtensionContext) {
	const yacc = new YaccSemanticProvider();
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('yacc', yacc, '%', '<'));
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider('yacc', yacc, legend));
	context.subscriptions.push(vscode.languages.registerHoverProvider('yacc', yacc));
	context.subscriptions.push(vscode.languages.registerDefinitionProvider('yacc', yacc));

	const lex = new LexSemanticProvider();
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lex', lex, '%', '{', '<'));
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider('lex', lex, legend));
	context.subscriptions.push(vscode.languages.registerHoverProvider('lex', lex));
	context.subscriptions.push(vscode.languages.registerDefinitionProvider('lex', lex));
}

function getEqualLengthSpaces(str: string) {
	return str.replace(/[^\n]*/mg, (m) => {
		return ' '.repeat(m.length);
	});
}

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}

abstract class SemanticAnalyzer implements vscode.DocumentSemanticTokensProvider, vscode.CompletionItemProvider, vscode.HoverProvider, vscode.DefinitionProvider {
	protected keywords: string[];
	protected invalidRegions: vscode.Range[] = [];
	protected startingLine = -1;
	protected endingLine = -1;

	constructor(keywords: string[]) {
		this.keywords = keywords;
	}

	async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location | vscode.Location[] | vscode.LocationLink[]> {
		for (let i = 0; i < this.invalidRegions.length; i++) {
			const range = this.invalidRegions[i];
			if (range.contains(position)) {
				return [];
			}
		}

		return this._provideDefinition(document, position);
	}

	async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover> {
		for (let i = 0; i < this.invalidRegions.length; i++) {
			const range = this.invalidRegions[i];
			if (range.contains(position)) {
				return { contents: [] };
			}
		}

		return this._provideHover(document, position);
	}

	async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
		for (let i = 0; i < this.invalidRegions.length; i++) {
			const range = this.invalidRegions[i];
			if (range.contains(position)) {
				return [];
			}
		}

		if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter) {
			return this._handleTrigger(document, position, context.triggerCharacter);
		}

		return this._rulesCompletion(document, position);
	}

	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const t0 = Date.now();
		const allTokens = this._parseText(document);
		const t1 = Date.now();
		console.log("Parse time: " + (t1 - t0));
		const builder = new vscode.SemanticTokensBuilder();
		allTokens.forEach((token) => {
			builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType), this._encodeTokenModifiers(token.tokenModifiers));
		});
		return builder.build()
	}

	private _encodeTokenType(tokenType: string): number {
		if (!tokenTypes.has(tokenType)) {
			return 0;
		}
		return tokenTypes.get(tokenType)!;
	}

	private _encodeTokenModifiers(strTokenModifiers: string[]): number {
		let result = 0;
		for (let i = 0; i < strTokenModifiers.length; i++) {
			const tokenModifier = strTokenModifiers[i];
			if (tokenModifiers.has(tokenModifier)) {
				result = result | (1 << tokenModifiers.get(tokenModifier)!);
			}
		}
		return result;
	}

	protected _keywordCompletions(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | vscode.CompletionList {
		if (position.line > this.startingLine) {
			return [];
		}
		return this.keywords.map((keyword) => {
			const completion = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Constructor);
			completion.detail = "keyword";
			return completion;
		});
	}

	protected abstract _buildHoverMsg(info: string, code?: string, lang?: string): vscode.MarkdownString;

	protected abstract _provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.Location | vscode.Location[] | vscode.LocationLink[];
	protected abstract _provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover;

	protected abstract _handleTrigger(document: vscode.TextDocument, position: vscode.Position, character: string | undefined): vscode.CompletionItem[] | vscode.CompletionList;
	protected abstract _rulesCompletion(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | vscode.CompletionList;
	protected abstract _parseText(document: vscode.TextDocument): IParsedToken[];
}

interface ISymbolDefinition {
	name: string;
	snippet?: string;
	position: vscode.Position;
};

class YaccSemanticProvider extends SemanticAnalyzer {
	private symbols: Map<string, ISymbolDefinition> = new Map();
	private tokens: Map<string, ISymbolDefinition> = new Map();
	private types: Map<string, ISymbolDefinition> = new Map();

	constructor() {
		super(['type', 'option', 'token', 'left', 'right', 'define', 'output',
			'precedence', 'nterm', 'destructor', 'union', 'code', 'printer',
			'parse-param', 'lex-param', 'pure-parser', 'expect', 'name-prefix', 'locations', 'nonassoc']);
	}

	protected _buildHoverMsg(info: string, code?: string, lang?: string): vscode.MarkdownString {
		const msg = new vscode.MarkdownString();
		if (code !== undefined) {
			msg.appendCodeblock(code, lang !== undefined ? lang : 'yacc');
			msg.appendMarkdown('---\n');
		}
		msg.appendMarkdown(info);
		return msg;
	}

	protected _provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.Location | vscode.Location[] | vscode.LocationLink[] {
		const word = document.getText(document.getWordRangeAtPosition(position));

		if (this.symbols.has(word)) {
			const pos = this.symbols.get(word)!;
			return new vscode.Location(document.uri, pos.position);
		}

		if (this.tokens.has(word)) {
			const pos = this.tokens.get(word)!;
			return new vscode.Location(document.uri, pos.position);
		}

		if (this.types.has(word)) {
			const pos = this.types.get(word)!;
			return new vscode.Location(document.uri, pos.position);
		}

		return [];
	}

	protected _provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover {
		const word = document.getText(document.getWordRangeAtPosition(position));
		if (this.symbols.has(word)) {
			const symbol = this.symbols.get(word)!;
			return { contents: [this._buildHoverMsg("symbol", symbol.snippet)] }
		}

		if (this.tokens.has(word)) {
			const symbol = this.tokens.get(word)!;
			return { contents: [this._buildHoverMsg("token", symbol.snippet)] }
		}

		if (this.types.has(word)) {
			const symbol = this.types.get(word)!;
			return { contents: [this._buildHoverMsg("type", symbol.snippet)] }
		}

		return { contents: [] };
	}

	protected _handleTrigger(document: vscode.TextDocument, position: vscode.Position, character: string | undefined): vscode.CompletionItem[] | vscode.CompletionList {
		let line = document.lineAt(position).text.substr(0, position.character);
		if (character === '%') {
			if (line.startsWith('%'))
				return this._keywordCompletions(document, position);
		} else if (character === '<') {
			if (line.match(/^%(?:type|token)\s*<.*/)) {
				return this._typeParamCompletions(document, position);
			}
		}

		return [];
	}

	protected _rulesCompletion(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | vscode.CompletionList {
		let line = document.lineAt(position).text.substr(0, position.character);
		/**
		 * Result suggestion on defining type
		 */
		if (line.match(/^%type\s*<.*>[\sa-zA-Z0-9_]*$/)) {
			var completions: vscode.CompletionItem[] = [];
			this.symbols.forEach((value, key) => {
				const completion = new vscode.CompletionItem(key, vscode.CompletionItemKind.Class);
				completion.detail = "symbol"
				completions.push(completion);
			})
			return completions;
		}

		if (line.match(/^%(?:type|token)\s*<[^>\n]+$/)) {
			return this._typeParamCompletions(document, position);
		}

		/**
		 * Token and result suggestion only inside the rules section
		 */
		if (position.line > this.startingLine && position.line < this.endingLine) {
			if (line.indexOf('|') !== -1 || line.indexOf(':') !== -1) {
				var completions: vscode.CompletionItem[] = [];
				var completion: vscode.CompletionItem;
				this.symbols.forEach((value, key) => {
					completion = new vscode.CompletionItem(key, vscode.CompletionItemKind.Class)
					completion.detail = "symbol";
					completions.push(completion);
				})
				this.tokens.forEach((value, key) => {
					completion = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field)
					completion.detail = "token";
					completions.push(completion);
				})
				return completions;
			}
		}
		return [];
	}

	private _typeParamCompletions(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | vscode.CompletionList {
		if (position.line > this.startingLine) {
			return [];
		}

		var completion: vscode.CompletionItem;
		var completions: vscode.CompletionItem[] = [];
		this.types.forEach((value, key) => {
			completion = new vscode.CompletionItem(key, vscode.CompletionItemKind.TypeParameter)
			completion.detail = "type"
			completions.push(completion);
		})
		return completions;
	}

	protected _parseText(document: vscode.TextDocument): IParsedToken[] {
		let text = document.getText();
		this.startingLine = -1;
		this.endingLine = document.lineCount;
		this.tokens.clear();
		this.symbols.clear();
		this.invalidRegions = [];

		const r: IParsedToken[] = [];
		text = text.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\/\*[\s\S]*?\*\//mg, getEqualLengthSpaces);

		const lines = text.split(/\r\n|\r|\n/);

		let brackets = 0;
		let currentPos: vscode.Position | undefined = undefined;
		let tokenContinue = false;
		let tokenType = '';
		let symbolContinue = false;
		let symbolType = '';
		let unionFound = false;
		let rulesText: string = '';
		const rules: string[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.startsWith('%%')) {
				if (this.startingLine === -1)
					this.startingLine = i;
				else {
					/**
					 * Stop on end rules section
					 */
					this.endingLine = i;
					break;
				}
			}

			if (line.startsWith('%')) {
				// save tokens
				if (line.startsWith('%token')) {
					const type = line.match(/(<.*>)/);
					if (type) tokenType = ' ' + type[1];
					else tokenType = '';
					const tokenSymbols = line.slice(6).replace(/<.*>/, "").trim().split(" ");
					tokenSymbols.forEach(token => {
						if (token.length > 0) {
							this.tokens.set(token, { name: token, snippet: '%token' + tokenType + ' ' + token, position: new vscode.Position(i, 0) });
						}
					});
					tokenContinue = true;
					continue;
				} else {
					tokenContinue = false;
				}

				if (line.startsWith('%type')) {
					const type = line.match(/(<.*>)/);
					if (type) symbolType = ' ' + type[1];
					else symbolType = '';
					const symbols = line.slice(5).replace(/<.*>/, "").trim().split(" ");
					symbols.forEach(symbol => {
						if (symbol.length > 0) {
							this.symbols.set(symbol, { name: symbol, snippet: '%type' + symbolType + ' ' + symbol, position: new vscode.Position(i, 0) });
						}
					});
					symbolContinue = true;
					continue;
				} else {
					symbolContinue = false;
				}

				if (line.startsWith('%union')) {
					unionFound = true;
				}
			} else {
				// continue saving tokens
				if (tokenContinue) {
					const tokenSymbols = line.trim().split(" ");
					tokenSymbols.forEach(token => {
						if (token.length > 0) {
							this.tokens.set(token, { name: token, snippet: '%token' + tokenType + ' ' + token, position: new vscode.Position(i, 0) });
						}
					});
					tokenType = ''
					continue;
				}

				if (symbolContinue) {
					const symbols = line.trim().split(" ");
					symbols.forEach(symbol => {
						if (symbol.length > 0) {
							this.symbols.set(symbol, { name: symbol, snippet: '%type' + symbolType + ' ' + symbol, position: new vscode.Position(i, 0) });
						}
					});
					symbolType = ''
					continue;
				}
			}

			if (unionFound) {
				const type = /^(.*[ \t\f*&])([a-zA-Z0-9_]+)\s*;$/.exec(line);
				if (type !== null) {
					const snippet = type[1].replace(/\s*/g, "") + " " + type[2];
					this.types.set(type[2], { name: type[2], snippet: snippet, position: new vscode.Position(i, type.index) });
				}
			}

			/**
			 * Finding nested C code block
			 */
			for (let j = 0; j < line.length; j++) {
				const ch = line[j];
				switch (ch) {
					case '{':
						brackets++;
						if (currentPos === undefined) {
							currentPos = new vscode.Position(i, j);
						}
						if (this.startingLine !== -1) {
							rulesText += ' ';
						}
						break;
					case '}':
						brackets--;
						if (brackets === 0) {
							this.invalidRegions.push(new vscode.Range(currentPos!, new vscode.Position(i, j)));
							currentPos = undefined;
							if (unionFound)
								unionFound = false;
						}
						if (this.startingLine !== -1) {
							rulesText += ' ';
						}
						break;
					default:
						if (this.startingLine !== -1) {
							/**
							 * Clear out C code and save yacc code
							 */
							if (brackets === 0)
								rulesText += ch;
							else
								rulesText += ' ';
						}
						break;
				}
			}

			if (this.startingLine !== -1) {
				rules.push(rulesText);
				rulesText = '';
			}
		}

		/**
		 * Find all symbols
		 */
		for (let i = 0; i < rules.length; i++) {
			const ruleMatcher = /^[a-zA-Z0-9_]+/;
			const rule = ruleMatcher.exec(rules[i]);
			if (rule !== null) {
				const symbol = this.symbols.get(rule[0]);
				if (symbol !== undefined) {
					this.symbols.set(rule[0], { name: rule[0], snippet: symbol.snippet, position: new vscode.Position(this.startingLine + i, 1) });
				} else {
					this.symbols.set(rule[0], { name: rule[0], position: new vscode.Position(this.startingLine + i, 1) });
				}
			}
		}

		/**
		 * Highlight symbols in rules section
		 */
		const matcher = /[a-zA-Z0-9_]+/g;
		for (let i = 0; i < rules.length; i++) {
			const line = rules[i];
			var match;
			while ((match = matcher.exec(line)) != null) {
				const word = match[0];
				if (this.symbols.has(word)) {
					r.push({
						line: this.startingLine + i,
						startCharacter: match.index,
						length: word.length,
						tokenType: "class",
						tokenModifiers: []
					});
				}
			}
		}
		return r;
	}
}

class LexSemanticProvider extends SemanticAnalyzer {
	private defines: Map<string, ISymbolDefinition> = new Map();
	private states: Map<string, ISymbolDefinition> = new Map();

	constructor() {
		super(['array', 'pointer', 'option', 's', 'x']);
	}

	protected _buildHoverMsg(info: string, code?: string, lang?: string): vscode.MarkdownString {
		const msg = new vscode.MarkdownString();
		if (code !== undefined) {
			msg.appendCodeblock(code, lang !== undefined ? lang : 'lex');
			msg.appendMarkdown('---\n');
		}
		msg.appendMarkdown(info);
		return msg;
	}

	protected _provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.Location | vscode.Location[] | vscode.LocationLink[] {
		const word = document.getText(document.getWordRangeAtPosition(position));

		if (this.defines.has(word)) {
			const pos = this.defines.get(word)!;
			return new vscode.Location(document.uri, pos.position);
		}

		if (this.states.has(word)) {
			const pos = this.states.get(word)!;
			return new vscode.Location(document.uri, pos.position);
		}

		return [];
	}

	protected _provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover {
		const word = document.getText(document.getWordRangeAtPosition(position));
		if (this.defines.has(word)) {
			const symbol = this.defines.get(word)!;
			return { contents: [this._buildHoverMsg("definition", symbol.snippet)] };
		}

		if (this.states.has(word)) {
			const symbol = this.states.get(word)!;
			return { contents: [this._buildHoverMsg("initial state", symbol.snippet)] };
		}

		return { contents: [] };
	}

	protected _handleTrigger(document: vscode.TextDocument, position: vscode.Position, character: string | undefined): vscode.CompletionItem[] | vscode.CompletionList {
		var completion: vscode.CompletionItem;
		const completions: vscode.CompletionItem[] = [];
		let line = document.lineAt(position).text.substr(0, position.character);
		if (character === '%') {
			if (line.startsWith('%'))
				return this._keywordCompletions(document, position);
		} else if (character === '{') {
			var ok = false;
			if (position.line < this.startingLine) {
				// if before rules zone, definition need to be on the right
				ok = line.match(/^[a-zA-Z0-9_]+/) !== null;
			} else if (position.line < this.endingLine) {
				// if inside rules zone
				const res = line.match(/^(?:{[a-zA-Z0-9_]*}?)+/);
				if (res) {
					ok = res[0].length === position.character;
				}
			}
			if (ok) {
				this.defines.forEach((value, key) => {
					completion = new vscode.CompletionItem(key, vscode.CompletionItemKind.Class);
					completion.detail = "definition";
					completions.push(completion);
				})
			}
		} else if (character === '<' && position.line > this.startingLine && position.line < this.endingLine) {
			if (line.match(/^</)) {
				this.states.forEach((value, key) => {
					completion = new vscode.CompletionItem(key, vscode.CompletionItemKind.Class);
					completion.detail = "initial state";
					completions.push(completion);
				})
			}
		}

		return completions;
	}

	protected _rulesCompletion(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | vscode.CompletionList {
		const line = document.lineAt(position).text.substr(0, position.character);
		const res = line.match(/^(?:{[a-zA-Z0-9_]*}?)+/);
		console.log(line)
		if (res) {
			if (res[0].length === position.character) {
				const completions: vscode.CompletionItem[] = [];
				this.defines.forEach((value, key) => {
					const completion = new vscode.CompletionItem(key, vscode.CompletionItemKind.Class);
					completion.detail = "definition";
					completions.push(completion);
				})

				return completions;
			}
		}
		return [];
	}

	protected _parseText(document: vscode.TextDocument): IParsedToken[] {
		let text = document.getText();
		this.startingLine = -1;
		this.endingLine = document.lineCount;
		this.defines.clear();
		this.invalidRegions = [];

		const r: IParsedToken[] = [];
		text = text.replace(/"\/\*[\s\S]*?\*\//mg, getEqualLengthSpaces);

		const lines = text.split(/\r\n|\r|\n/);

		let brackets = 0;
		let currentPos: vscode.Position | undefined = undefined;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.startsWith('%%')) {
				if (this.startingLine === -1)
					this.startingLine = i;
				else {
					/**
					 * Stop on end rules section
					 */
					this.endingLine = i;
					break;
				}
			}

			if (this.startingLine === -1) {
				const defined = line.match(/^[a-zA-Z0-9_]+/);
				if (defined !== null) {
					this.defines.set(defined[0], { name: defined[0], snippet: line.trim(), position: new vscode.Position(i, 0) });
				}
			}

			if (line.startsWith('%x') || line.startsWith('%s')) {
				const tokenSymbols = line.slice(2).trim().split(" ");
				tokenSymbols.forEach(token => {
					if (token.length > 0) {
						this.states.set(token, { name: token, snippet: line.trim(), position: new vscode.Position(i, 0) });
					}
				});
				continue;
			}

			if (this.startingLine !== -1 || line.startsWith('%')) {
				let j = 0;
				const defines = /^(?:{[a-zA-Z0-9_]+})+\s+/.exec(line);
				if (defines) {
					j = defines[0].length;
				}

				/**
				 * Finding nested C code block
				 */
				for (; j < line.length; j++) {
					const ch = line[j];
					switch (ch) {
						case '{':
							brackets++;
							if (currentPos === undefined) {
								currentPos = new vscode.Position(i, j);
							}
							break;
						case '}':
							brackets--;
							if (brackets === 0) {
								this.invalidRegions.push(new vscode.Range(currentPos!, new vscode.Position(i, j)));
								currentPos = undefined;
							}
							break;
						default:
							break;
					}
				}
			}
		}

		return r;
	}
}