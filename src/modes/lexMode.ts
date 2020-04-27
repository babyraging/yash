import { LanguageService as LEXLanguageService } from '../languages/lexLanguageService';
import { LanguageMode } from './languageModes';
import { TextDocument, CompletionList, CompletionItem, Position, Hover, Location, Definition, WorkspaceEdit, Diagnostic } from 'vscode';
import { CreateDocumentCache } from '../documentCache';
import { LexDocument } from '../languages/parser/lexParser';

export function getLEXMode(lexLanguageService: LEXLanguageService): LanguageMode {
    const cache = CreateDocumentCache<LexDocument>(10, 60, document => lexLanguageService.parseLexDocument(document));
    return {
        getId() {
            return 'lex';
        },
        doValidation(document: TextDocument): Diagnostic[] {
            const lex = cache.get(document);
            return lexLanguageService.doValidation(document, lex);
        },
        doComplete(document: TextDocument, position: Position): CompletionList | CompletionItem[] {
            const lex = cache.get(document);
            return lexLanguageService.doComplete(document, position, lex);
        },
        doHover(document: TextDocument, position: Position): Hover | null {
            const lex = cache.get(document);
            return lexLanguageService.doHover(document, position, lex);
        },
        findDefinition(document: TextDocument, position: Position): Definition | null {
            const lex = cache.get(document);
            return lexLanguageService.findDefinition(document, position, lex);
        },
        findReferences(document: TextDocument, position: Position): Location[] {
            const lex = cache.get(document);
            return lexLanguageService.findReferences(document, position, lex);
        },
        doRename(document: TextDocument, position: Position, newName: string): WorkspaceEdit | null {
            const lex = cache.get(document);
            return lexLanguageService.doRename(document, position, newName, lex);
        },
        onDocumentRemoved(document: TextDocument) {
            cache.onDocumentRemoved(document);
        },
        dispose() {
            cache.dispose();
        }
    };
}