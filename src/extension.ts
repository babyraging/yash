import * as vscode from 'vscode';
import { newSemanticTokenProvider } from './modes/semanticProvider';
import { getLanguageModes } from './modes/languageModes';
import { runSafe } from './runner';
const pendingValidationRequests: { [uri: string]: NodeJS.Timer } = {};
const validationDelayMs = 500;

const languageModes = getLanguageModes({ yacc: true, lex: true })
const semanticProvider = newSemanticTokenProvider(languageModes)

const selector: vscode.DocumentSelector = [{ scheme: 'file', language: 'yacc' }, { scheme: 'file', language: 'lex' }]
const diagnostics = vscode.languages.createDiagnosticCollection();

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(diagnostics);

	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, {
		async provideCompletionItems(document, position, token): Promise<vscode.CompletionItem[] | vscode.CompletionList | null> {
			return runSafe(() => {
				const mode = languageModes.getMode(document.languageId);
				if (!mode || !mode.doComplete) {
					return { isIncomplete: true, items: [] };
				}
				const doComplete = mode.doComplete!;
				return doComplete(document, position);
			}, null, `Error while computing completion for ${document.uri.toString()}`, token);
		}
	}, '%', '<', '{'));

	context.subscriptions.push(vscode.languages.registerHoverProvider(selector, {
		async provideHover(document, position, token): Promise<vscode.Hover | null> {
			return runSafe(() => {
				const mode = languageModes.getMode(document.languageId);
				if (!mode || !mode.doHover) {
					return null;
				}
				return mode.doHover(document, position);
			}, null, `Error while computing hover for ${document.uri.toString()}`, token);
		}
	}));

	context.subscriptions.push(vscode.languages.registerTypeDefinitionProvider(selector, {
		async provideTypeDefinition(document, position, token): Promise<vscode.Location | vscode.Location[] | null> {
			return runSafe(() => {
				const mode = languageModes.getMode(document.languageId);
				if (!mode || !mode.findTypeDefinition) {
					return null;
				}
				return mode.findTypeDefinition(document, position);
			}, null, `Error while computing find type definition for ${document.uri.toString()}`, token);
		}
	}));

	context.subscriptions.push(vscode.languages.registerDefinitionProvider(selector, {
		async provideDefinition(document, position, token): Promise<vscode.Location | vscode.Location[] | null> {
			return runSafe(() => {
				const mode = languageModes.getMode(document.languageId);
				if (!mode || !mode.findDefinition) {
					return null;
				}
				return mode.findDefinition(document, position);
			}, null, `Error while computing find definition for ${document.uri.toString()}`, token);
		}
	}));

	context.subscriptions.push(vscode.languages.registerRenameProvider(selector, {
		async provideRenameEdits(document, position, newName, token): Promise<vscode.WorkspaceEdit | null> {
			return runSafe(() => {
				const mode = languageModes.getMode(document.languageId);
				if (!mode || !mode.doRename) {
					return null;
				}
				return mode.doRename(document, position, newName);
			}, null, `Error while computing find definition for ${document.uri.toString()}`, token);
		}
	}));

	context.subscriptions.push(vscode.languages.registerReferenceProvider(selector, {
		async provideReferences(document, position, context, token): Promise<vscode.Location[] | null> {
			return runSafe(() => {
				const mode = languageModes.getMode(document.languageId);
				if (!mode || !mode.findReferences) {
					return null;
				}
				return mode.findReferences(document, position);
			}, null, `Error while computing find references for ${document.uri.toString()}`, token);
		}
	}));

	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider('yacc', {
		async provideDocumentSemanticTokens(document, token): Promise<vscode.SemanticTokens | null> {
			return runSafe(() => {
				return semanticProvider.getSemanticTokens(document);
			}, null, `Error while computing semantic tokens for ${document.uri.toString()}`, token);
		}
	}, new vscode.SemanticTokensLegend(semanticProvider.legend.types, semanticProvider.legend.modifiers)));

	context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(selector, {
		async provideDocumentRangeFormattingEdits(document, range, options, token): Promise<vscode.TextEdit[] | null> {
			return runSafe(() => {
				const mode = languageModes.getMode(document.languageId);
				if (!mode || !mode.format) {
					return null;
				}
				return mode.format(document, range, options);
			}, null, `Error while formatting for ${document.uri.toString()}`, token);
		}
	}));

	// The content of a text document has changed. 
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(change => {
		triggerValidation(change.document);
	}));

	// A document has closed: clear all diagnostics
	context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document => {
		cleanPendingValidation(document);
		diagnostics.set(document.uri, []);
	}));

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			triggerValidation(editor.document);
		}
	}));

	if (vscode.window.activeTextEditor) {
		triggerValidation(vscode.window.activeTextEditor.document);
	}
}

function cleanPendingValidation(textDocument: vscode.TextDocument): void {
	const request = pendingValidationRequests[textDocument.uri.toString()];
	if (request) {
		clearTimeout(request);
		delete pendingValidationRequests[textDocument.uri.toString()];
	}
}

function triggerValidation(textDocument: vscode.TextDocument): void {
	cleanPendingValidation(textDocument);
	pendingValidationRequests[textDocument.uri.toString()] = setTimeout(() => {
		delete pendingValidationRequests[textDocument.uri.toString()];
		validateTextDocument(textDocument);
	}, validationDelayMs);
}

async function validateTextDocument(document: vscode.TextDocument) {
	const mode = languageModes.getMode(document.languageId);
	if (!mode || !mode.doValidation) {
		return null;
	}
	diagnostics.set(document.uri, mode.doValidation(document));
}