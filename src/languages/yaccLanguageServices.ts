import { createScanner } from './parser/yaccScanner';
import { parse, YACCDocument } from './parser/yaccParser';
import { Scanner } from './yaccLanguageTypes';
import { TextDocument, Position, Diagnostic, WorkspaceEdit, Hover, CompletionList, CompletionItem, Range, Definition, Location, TextEdit, FormattingOptions } from 'vscode';
import { doYACCComplete } from './services/yaccCompletions';
import { doYACCHover } from './services/yaccHover';
import { SemanticTokenData } from './semanticTokens';
import { doYACCFindDefinition } from './services/yaccDefinitions';
import { doYACCFindReferences } from './services/yaccReferences';
import { doYACCRename } from './services/yaccRename';
import { doYACCValidation } from './services/yaccValidation';
import { doYACCFindTypeDefinition } from './services/yaccTypeDefinition';
import { doYACCFormat } from './services/yaccFormatter';

export interface LanguageService {
    createScanner(input: string, initialOffset?: number): Scanner;
    parseYACCDocument(document: TextDocument): YACCDocument;
    doComplete(document: TextDocument, position: Position, yaccDocument: YACCDocument): CompletionItem[] | CompletionList;
    doValidation: (document: TextDocument, yaccDocument: YACCDocument) => Diagnostic[];
    getSemanticTokens(Document: TextDocument, yaccDocument: YACCDocument): SemanticTokenData[];
    doHover(document: TextDocument, position: Position, yaccDocument: YACCDocument): Hover | null;
    findTypeDefinition(document: TextDocument, position: Position, yaccDocument: YACCDocument): Definition | null;
    findDefinition(document: TextDocument, position: Position, yaccDocument: YACCDocument): Definition | null;
    findReferences(document: TextDocument, position: Position, yaccDocument: YACCDocument): Location[];
    doRename(document: TextDocument, position: Position, newName: string, yaccDocument: YACCDocument): WorkspaceEdit | null;
    format(document: TextDocument, range: Range, options: FormattingOptions, yaccDocument: YACCDocument): TextEdit[];
}

export function getLanguageService(): LanguageService {
    return {
        createScanner,
        parseYACCDocument: document => parse(document.getText()),
        doComplete: (document, position, yaccDocument) => doYACCComplete(document, position, yaccDocument),
        doValidation: (document, yaccDocument) => doYACCValidation(document, yaccDocument),
        getSemanticTokens: (document, yaccDocument) => yaccDocument.getSemanticTokens(document.positionAt.bind(document)),
        doHover: (document, position, yaccDocument) => doYACCHover(document, position, yaccDocument),
        findTypeDefinition: (document, position, yaccDocument) => doYACCFindTypeDefinition(document, position, yaccDocument),
        findDefinition: (document, position, yaccDocument) => doYACCFindDefinition(document, position, yaccDocument),
        findReferences: (document, position, yaccDocument) => doYACCFindReferences(document, position, yaccDocument),
        doRename: (document, position, newName, yaccDocument) => doYACCRename(document, position, newName, yaccDocument),
        format: (document, range, options, yaccDocument) => doYACCFormat(document, range, options, yaccDocument)
    };
}
