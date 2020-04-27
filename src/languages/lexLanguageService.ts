import { createScanner } from './parser/lexScanner';
import { parse, LexDocument } from './parser/lexParser';
import { Scanner } from './lexLanguageTypes';
import { TextDocument, Position, WorkspaceEdit, Hover, CompletionList, CompletionItem, Definition, Location, Diagnostic } from 'vscode';
import { doLEXCompletion } from './services/lexCompletions';
import { doLEXHover } from './services/lexHover';
import { doLEXFindDefinition } from './services/lexDefinition';
import { doLEXRename } from './services/lexRename';
import { doLEXFindReferences } from './services/lexReferences';
import { doLEXValidation } from './services/lexValidation';

export interface LanguageService {
    createScanner(input: string, initialOffset?: number): Scanner;
    parseLexDocument(document: TextDocument): LexDocument;
    doValidation: (document: TextDocument, lexDocument: LexDocument) => Diagnostic[];
    doComplete(document: TextDocument, position: Position, lexDocument: LexDocument): CompletionItem[] | CompletionList;
    doHover(document: TextDocument, position: Position, lexDocument: LexDocument): Hover | null;
    findDefinition(document: TextDocument, position: Position, lexDocument: LexDocument): Definition | null;
    findReferences(document: TextDocument, position: Position, lexDocument: LexDocument): Location[];
    doRename(document: TextDocument, position: Position, newName: string, lexDocument: LexDocument): WorkspaceEdit | null;
}

export function getLanguageService(): LanguageService {
    return {
        createScanner,
        parseLexDocument: document => parse(document.getText()),
        doValidation: (document, lexDocument) => doLEXValidation(document, lexDocument),
        doComplete: (document, position, lexDocument) => doLEXCompletion(document, position, lexDocument),
        doHover: (document, position, lexDocument) => doLEXHover(document, position, lexDocument),
        findDefinition: (document, position, lexDocument) => doLEXFindDefinition(document, position, lexDocument),
        findReferences: (document, position, lexDocument) => doLEXFindReferences(document, position, lexDocument),
        doRename: (document, position, newName, lexDocument) => doLEXRename(document, position, newName, lexDocument)
    };
}