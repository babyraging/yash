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
	return str.replace(/[^\n]*/g, (m) => {
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
		const allTokens = this._parseText(document);
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


	protected abstract _provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.Location | vscode.Location[] | vscode.LocationLink[];
	protected abstract _provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover;

	protected abstract _handleTrigger(document: vscode.TextDocument, position: vscode.Position, character: string | undefined): vscode.CompletionItem[] | vscode.CompletionList;
	protected abstract _rulesCompletion(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | vscode.CompletionList;
	protected abstract _parseText(document: vscode.TextDocument): IParsedToken[];
}

class YaccSemanticProvider extends SemanticAnalyzer {
	private symbols: Map<string, vscode.Position> = new Map();
	private tokens: Map<string, vscode.Position> = new Map();
	private types: Map<string, vscode.Position> = new Map();

	constructor() {
		super(['type', 'option', 'token', 'left', 'right', 'define', 'output',
			'precedence', 'nterm', 'destructor', 'union', 'code', 'printer',
			'parse-param', 'lex-param', 'pure-parser', 'expect', 'name-prefix', 'locations', 'nonassoc']);
	}

	protected _provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.Location | vscode.Location[] | vscode.LocationLink[] {
		const word = document.getText(document.getWordRangeAtPosition(position));

		if (this.symbols.has(word)) {
			const pos = this.symbols.get(word)!;
			return new vscode.Location(document.uri, pos);
		}

		if (this.tokens.has(word)) {
			const pos = this.tokens.get(word)!;
			return new vscode.Location(document.uri, pos);
		}

		if (this.types.has(word)) {
			const pos = this.types.get(word)!;
			return new vscode.Location(document.uri, pos);
		}

		return [];
	}

	protected _provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover {
		const word = document.getText(document.getWordRangeAtPosition(position));
		if (this.symbols.has(word)) {
			return { contents: ['symbol'] }
		}

		if (this.tokens.has(word)) {
			return { contents: ['token'] }
		}

		if (this.types.has(word)) {
			return { contents: ['type'] }
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
		this.tokens.clear();
		this.symbols.clear();
		this.invalidRegions = [];
		let r: IParsedToken[] = [];
		let lines = text.split(/\r\n|\r|\n/);

		/**
		 * Find all invalid regions
		 */
		const codeMatcher = /%(?=top)?{[\s\S]*?%?}|{[\s\S]*?}(?=\s*[|;])/g;
		var cpp;
		while ((cpp = codeMatcher.exec(text)) !== null) {
			let start = document.positionAt(cpp.index);
			let end = document.positionAt(cpp.index + cpp[0].length);
			this.invalidRegions.push(new vscode.Range(start, end));
		}

		const yyType = /%union\s*{([\s\S]*?)}/.exec(text);
		if (yyType !== null) {
			const typeMatcher = /([a-zA-Z0-9_]*)\s*;/g
			var res;
			while ((res = typeMatcher.exec(yyType[1])) !== null) {
				const position = document.positionAt(yyType.index + res.index);
				this.types.set(res[1], position);
			}
		}

		this.startingLine = -1;
		this.endingLine = -1;
		let tokenContinue = false;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			/**
			 * Find rules section
			 */
			if (line.startsWith('%%')) {
				this.startingLine = i;
				for (i++; i < lines.length; i++) {
					if (lines[i].startsWith('%%')) {
						this.endingLine = i;
						break;
					}
				}
				break;
			}

			if (line.startsWith('%')) {
				// save tokens
				if (line.startsWith('%token')) {
					const tokenSymbols = line.slice(6).replace(/<.*>/, "").trim().split(" ");
					tokenSymbols.forEach(token => {
						if (token.length > 0) {
							this.tokens.set(token, new vscode.Position(i, 0));
						}
					});
					tokenContinue = true;
				} else {
					tokenContinue = false;
				}
			} else {
				// continue saving tokens
				if (tokenContinue) {
					const tokenSymbols = line.trim().split(" ");
					tokenSymbols.forEach(token => {
						if (token.length > 0) {
							this.tokens.set(token, new vscode.Position(i, 0));
						}
					});
				}
			}
		}

		const ruleZone = new vscode.Range(new vscode.Position(this.startingLine, 0), new vscode.Position(this.endingLine, 0));
		const rulesText = document.getText(ruleZone);

		// TODO: optimize and review this.
		// now remove literals, brackets and comments
		const filtered = rulesText.replace(/\/\*[\s\S]*?\*\//g, getEqualLengthSpaces)
			.replace(/'[^']*?'/g, getEqualLengthSpaces)
			.replace(/{[\s\S]*?}(?=\s*[|;])/g, getEqualLengthSpaces); // TODO: this is a temporary fix
		const rules = filtered.split(/\r\n|\r|\n/);

		/**
		 * Find all symbols
		 */
		for (let i = 0; i < rules.length; i++) {
			const ruleMatcher = /^[a-zA-Z0-9_]+/;
			const rule = ruleMatcher.exec(rules[i]);
			if (rule !== null) {
				this.symbols.set(rule[0], new vscode.Position(this.startingLine + i, 1));
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
	private defines: Map<string, vscode.Position> = new Map();
	private states: Map<string, vscode.Position> = new Map();

	constructor() {
		super(['array', 'pointer', 'option', 's', 'x']);
	}

	protected _provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.Location | vscode.Location[] | vscode.LocationLink[] {
		const word = document.getText(document.getWordRangeAtPosition(position));

		if (this.defines.has(word)) {
			const pos = this.defines.get(word)!;
			return new vscode.Location(document.uri, pos);
		}

		if (this.states.has(word)) {
			const pos = this.states.get(word)!;
			return new vscode.Location(document.uri, pos);
		}

		return [];
	}

	protected _provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover {
		const word = document.getText(document.getWordRangeAtPosition(position));
		if (this.defines.has(word)) {
			return { contents: ['definition'] };
		}

		if (this.states.has(word)) {
			return { contents: ['initial state'] };
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
			if (position.line < this.startingLine || line.charAt(position.character - 2) !== ' ')
				this.defines.forEach((value, key) => {
					completion = new vscode.CompletionItem(key, vscode.CompletionItemKind.Class);
					completion.detail = "definition";
					completions.push(completion);
				})
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
		return [];
	}

	protected _parseText(document: vscode.TextDocument): IParsedToken[] {
		this.invalidRegions = [];
		this.defines.clear();

		let text = document.getText();
		let r: IParsedToken[] = [];
		let lines = text.split(/\r\n|\r|\n/);

		/**
		 * Find all invalid regions
		 */
		const codeMatcher = /%(?=top)?{[\s\S]*?%}/g;
		var cpp;
		while ((cpp = codeMatcher.exec(text)) !== null) {
			let start = document.positionAt(cpp.index);
			let end = document.positionAt(cpp.index + cpp[0].length);
			this.invalidRegions.push(new vscode.Range(start, end));
		}

		/**
		 * Find rule section
		 */
		this.startingLine = -1;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line.startsWith('%%')) {
				if (this.startingLine === -1) {
					/**
					 * If we are inside of definition section
					 */
					if (line.startsWith('%s') || line.startsWith('%x')) {
						const tokenSymbols = line.slice(2).trim().split(" ");
						tokenSymbols.forEach(token => {
							if (token.length > 0) {
								this.states.set(token, new vscode.Position(i, 0));
							}
						});
					}
					const defined = line.match(/^[a-zA-Z0-9_]+/);
					if (defined !== null) {
						this.defines.set(defined[0], new vscode.Position(i, 0));
					}
				}
			} else {
				if (this.startingLine === -1) {
					this.startingLine = i;
				} else {
					this.endingLine = i;
				}
			}
		}

		const ruleZone = new vscode.Range(new vscode.Position(this.startingLine, 0), new vscode.Position(this.endingLine, 0));
		const rulesText = document.getText(ruleZone);
		const rulesOffset = document.offsetAt(new vscode.Position(this.startingLine, 0));

		// TODO: optimize and review this.
		// now remove literals, brackets and comments
		const filtered = rulesText.replace(/\/\*[\s\S]*?\*\//g, getEqualLengthSpaces)
			.replace(/"[^"]*?"/g, getEqualLengthSpaces);
		const action = /.{[\s\S]*?}(?=\s*[{<%".])/mg; // TODO: temporary fix, doesn't work for all patterns
		var cpp;
		while ((cpp = action.exec(filtered)) !== null) {
			let start = document.positionAt(rulesOffset + cpp.index);
			let end = document.positionAt(rulesOffset + cpp.index + cpp[0].length);
			this.invalidRegions.push(new vscode.Range(start, end));
		}

		return r;
	}
}