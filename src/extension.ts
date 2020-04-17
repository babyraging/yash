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
	const yacc = new YaccSemanticAnalyzer();
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('yacc', yacc, '%'));
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider('yacc', yacc, legend));

	const lex = new LexSemanticAnalyzer();
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lex', lex, '%', '{', '<'));
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider('lex', lex, legend));
}

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}

abstract class SemanticAnalyzer implements vscode.DocumentSemanticTokensProvider, vscode.CompletionItemProvider {
	protected keywords: string[];
	protected invalidRegions: vscode.Range[] = [];
	protected startingLine = -1;
	protected endingLine = -1;

	constructor(keywords: string[]) {
		this.keywords = keywords;
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
		if (position.line >= this.startingLine) {
			return [];
		}
		return this.keywords.map((keyword) => {
			const completion = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Constructor);
			completion.detail = "keyword";
			return completion;
		});
	}


	protected abstract _handleTrigger(document: vscode.TextDocument, position: vscode.Position, character: string | undefined): vscode.CompletionItem[] | vscode.CompletionList;
	protected abstract _rulesCompletion(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | vscode.CompletionList;
	protected abstract _parseText(document: vscode.TextDocument): IParsedToken[];
}

class YaccSemanticAnalyzer extends SemanticAnalyzer {
	private symbols: Set<string> = new Set();
	private tokens: Set<string> = new Set();
	private types: Set<string> = new Set();

	constructor() {
		super(['type', 'option', 'token', 'left', 'right', 'define', 'output', 'precedence', 'nterm', 'destructor', 'union', 'code', 'printer', 'parse-param', 'lex-param']);
	}

	protected _handleTrigger(document: vscode.TextDocument, position: vscode.Position, character: string | undefined): vscode.CompletionItem[] | vscode.CompletionList {
		let line = document.lineAt(position).text.substr(0, position.character);
		if (character === '%') {
			if (line.startsWith('%'))
				return this._keywordCompletions(document, position);
		}

		return [];
	}

	protected _rulesCompletion(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | vscode.CompletionList {
		let line = document.lineAt(position).text.substr(0, position.character);
		/**
		 * Result suggestion on defining type
		 */
		if (line.match(/^%type\s*<.*>.*/)) {
			var completions: vscode.CompletionItem[] = [];
			this.symbols.forEach((result) => {
				const completion = new vscode.CompletionItem(result, vscode.CompletionItemKind.Class);
				completion.detail = "symbol"
				completions.push(completion);
			})
			return completions;
		}

		if (line.match(/^%(?:type|token)\s*<.*/)) {
			return this._typeParamCompletions(document, position);
		}

		/**
		 * Token and result suggestion only inside the rules section
		 */
		if (position.line >= this.startingLine && position.line <= this.endingLine) {
			line = line.trim()
			if (line.startsWith(':') || line.startsWith('|')) {
				var completions: vscode.CompletionItem[] = [];
				var completion: vscode.CompletionItem;
				this.symbols.forEach((symbol) => {
					completion = new vscode.CompletionItem(symbol, vscode.CompletionItemKind.Class)
					completion.detail = "symbol";
					completions.push(completion);
				})
				this.tokens.forEach((token) => {
					completion = new vscode.CompletionItem(token, vscode.CompletionItemKind.Field)
					completion.detail = "token";
					completions.push(completion);
				})
				return completions;
			}
		}
		return [];
	}

	private _typeParamCompletions(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | vscode.CompletionList {
		if (position.line >= this.startingLine) {
			return [];
		}

		var completion: vscode.CompletionItem;
		var completions: vscode.CompletionItem[] = [];
		this.types.forEach((yyType) => {
			completion = new vscode.CompletionItem(yyType, vscode.CompletionItemKind.TypeParameter)
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
		let rules: string[] = [];

		/**
		 * Find all invalid regions
		 */
		const codeMatcher = /%(?=top)?{[\s\S]*?%}|{[\s\S]*?}/g;
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
				this.types.add(res[1]);
			}
		}

		/**
		 * Find rule section
		 */
		this.startingLine = -1;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line.startsWith('%%')) {
				if (this.startingLine !== -1) {
					/**
					 * If we are inside of rules section
					 */
					const filtered = line.replace(/{[\s\S]*}/, "");
					rules.push(filtered);
				} else {
					if (line.startsWith('%token')) {
						const tokenSymbols = line.slice(6).replace(/<.*>/, "").trim().split(" ");
						tokenSymbols.forEach(token => {
							if (token.length > 0) {
								this.tokens.add(token);
							}
						});
					}
				}
				continue;
			} else {
				if (this.startingLine === -1) {
					this.startingLine = i + 1;
				} else {
					this.endingLine = i + 1;
				}
			}
		}

		/**
		 * Find all symbols
		 */
		for (let i = 0; i < rules.length; i++) {
			const ruleMatcher = /^[a-zA-Z0-9_]+/;
			const rule = ruleMatcher.exec(rules[i]);
			if (rule !== null) {
				this.symbols.add(rule[0]);
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

class LexSemanticAnalyzer extends SemanticAnalyzer {
	private defines: Set<string> = new Set();
	private states: Set<string> = new Set();

	constructor() {
		super(['array', 'pointer', 'option', 's', 'x']);
	}

	protected _handleTrigger(document: vscode.TextDocument, position: vscode.Position, character: string | undefined): vscode.CompletionItem[] | vscode.CompletionList {
		var completion: vscode.CompletionItem;
		const completions: vscode.CompletionItem[] = [];
		let line = document.lineAt(position).text.substr(0, position.character);
		if (character === '%') {
			if (line.startsWith('%'))
				return this._keywordCompletions(document, position);
		} else if (character === '{') {
			if (line.charAt(position.character - 2) !== ' ')
				this.defines.forEach((define) => {
					completion = new vscode.CompletionItem(define, vscode.CompletionItemKind.Class);
					completion.detail = "definition";
					completions.push(completion);
				})
		} else if (character === '<' && position.line >= this.startingLine && position.line <= this.endingLine) {
			if (line.match(/^</)) {
				this.states.forEach((state) => {
					completion = new vscode.CompletionItem(state, vscode.CompletionItemKind.Class);
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
				if (this.startingLine !== -1) {
					/**
					 * If we are inside of rules section
					 */
					cpp = /(?<=[\t\v\f ]){[\s\S]*?}/.exec(line);
					if (cpp !== null) {
						let start = new vscode.Position(i, cpp.index);
						let end = new vscode.Position(i, cpp.index + cpp[0].length);
						this.invalidRegions.push(new vscode.Range(start, end));
					}
				} else {
					/**
					 * If we are inside of definition section
					 */
					if (line.startsWith('%s') || line.startsWith('%x')) {
						const tokenSymbols = line.slice(2).trim().split(" ");
						tokenSymbols.forEach(token => {
							if (token.length > 0) {
								this.states.add(token);
							}
						});
					}
					const defined = line.match(/^[a-zA-Z0-9_]+/);
					if (defined !== null) {
						this.defines.add(defined[0]);
					}
				}
			} else {
				if (this.startingLine === -1) {
					this.startingLine = i + 1;
				} else {
					this.endingLine = i + 1;
				}
			}
		}
		return r;
	}
}