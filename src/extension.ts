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

const keywords =
	['type', 'option', 'token', 'left', 'right', 'define', 'output', 'precedence', 'nterm', 'destructor', 'union', 'code', 'printer', 'parse-param', 'lex-param'];

export function activate(context: vscode.ExtensionContext) {
	const provider = new DocumentSemanticTokensProvider();
	// context.subscriptions.push(vscode.languages.registerCompletionItemProvider('bison', provider));
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('bison', provider, '%'));
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider('bison', provider, legend));
}

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider, vscode.CompletionItemProvider {
	private results: Set<string> = new Set();
	private tokens: Set<string> = new Set();
	private types: Set<string> = new Set();
	private startingLine = -1;
	private endingLine = -1;
	private invalidRegions: vscode.Range[] = [];

	async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
		/**
		 * Don't suggest anything if the current cursor falls in invalid regions.
		 */
		for (let i = 0; i < this.invalidRegions.length; i++) {
			const range = this.invalidRegions[i];
			if (range.contains(position)) {
				return [];
			}
		}

		let line = document.lineAt(position).text.substr(0, position.character);
		if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter) {
			if (line.startsWith('%'))
				return this._keywordCompletions(document, position);

			return [];
		}

		/**
		 * Result suggestion on defining type
		 */
		if (line.match(/^%type\s*<.*>.*/)) {
			var completions: vscode.CompletionItem[] = [];
			this.results.forEach((result) => {
				completions.push(new vscode.CompletionItem(result, vscode.CompletionItemKind.Class));
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
			var completions: vscode.CompletionItem[] = [];
			this.results.forEach((result) => {
				completions.push(new vscode.CompletionItem(result, vscode.CompletionItemKind.Class));
			})
			this.tokens.forEach((token) => {
				completions.push(new vscode.CompletionItem(token, vscode.CompletionItemKind.Field));
			})
			return completions;
		}

		return [];
	}

	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const allTokens = this._parseText(document);
		const builder = new vscode.SemanticTokensBuilder();
		allTokens.forEach((token) => {
			builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType), this._encodeTokenModifiers(token.tokenModifiers));
		});
		return builder.build();
	}

	private _keywordCompletions(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | vscode.CompletionList {
		if (position.line >= this.startingLine) {
			return [];
		}

		const completions = keywords.map((keyword) => new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Constructor));
		return completions;
	}

	private _typeParamCompletions(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | vscode.CompletionList {
		if (position.line >= this.startingLine) {
			return [];
		}

		var completions: vscode.CompletionItem[] = [];
		this.types.forEach((yyType) => {
			completions.push(new vscode.CompletionItem(yyType, vscode.CompletionItemKind.TypeParameter));
		})
		return completions;
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

	private _parseText(document: vscode.TextDocument): IParsedToken[] {
		let text = document.getText();
		this.tokens.clear();
		this.results.clear();
		this.invalidRegions = [];
		let r: IParsedToken[] = [];
		let lines = text.split(/\r\n|\r|\n/);
		let rules: string[] = [];

		/**
		 * Find all invalid regions
		 */
		const codeMatcher = /%{[\s\S]*?%}|{[\s\S]*?}/g;
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
		 * Find all results
		 */
		for (let i = 0; i < rules.length; i++) {
			const ruleMatcher = /^[a-zA-Z0-9_]+/;
			const rule = ruleMatcher.exec(rules[i]);
			if (rule !== null) {
				this.results.add(rule[0]);
			}
		}

		/**
		 * Highlight results in rules section
		 */
		const matcher = /[a-zA-Z0-9_]+/g;
		for (let i = 0; i < rules.length; i++) {
			const line = rules[i];
			var match;
			while ((match = matcher.exec(line)) != null) {
				const word = match[0];
				if (this.results.has(word)) {
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
