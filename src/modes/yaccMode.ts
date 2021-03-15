import { LanguageService as YACCLanguageService } from '../languages/yaccLanguageServices';
import { tokenTypes, tokenModifiers } from '../languages/yaccLanguageTypes';
import { LanguageMode } from './languageModes';
import { TextDocument, CompletionList, CompletionItem, Position, Hover, Definition, Location, WorkspaceEdit, Diagnostic } from 'vscode';
import { SemanticTokenData } from '../languages/semanticTokens';
import { CreateDocumentCache } from '../documentCache';
import { YACCDocument } from '../languages/parser/yaccParser';

export function getYACCMode(yaccLanguageService: YACCLanguageService): LanguageMode {
    const cache = CreateDocumentCache<YACCDocument>(10, 60, document => yaccLanguageService.parseYACCDocument(document));
    return {
        getId() {
            return 'yacc';
        },
        doValidation(document: TextDocument, force?:boolean): Diagnostic[] {
            if (force) {
                return yaccLanguageService.doValidation(document, yaccLanguageService.parseYACCDocument(document));
            }
            const yacc = cache.get(document);
            return yaccLanguageService.doValidation(document, yacc);
        },
        doComplete(document: TextDocument, position: Position): CompletionList | CompletionItem[] {
            const yacc = cache.get(document);
            return yaccLanguageService.doComplete(document, position, yacc);
        },
        doHover(document: TextDocument, position: Position): Hover | null {
            const yacc = cache.get(document);
            return yaccLanguageService.doHover(document, position, yacc);
        },
        findTypeDefinition(document: TextDocument, position: Position): Definition | null {
            const yacc = cache.get(document);
            return yaccLanguageService.findTypeDefinition(document, position, yacc);
        },
        findDefinition(document: TextDocument, position: Position): Definition | null {
            const yacc = cache.get(document);
            return yaccLanguageService.findDefinition(document, position, yacc);
        },
        findReferences(document: TextDocument, position: Position): Location[] {
            const yacc = cache.get(document);
            return yaccLanguageService.findReferences(document, position, yacc);
        },
        doRename(document: TextDocument, position: Position, newName: string): WorkspaceEdit | null {
            const yacc = cache.get(document);
            return yaccLanguageService.doRename(document, position, newName, yacc);
        },
        getSemanticTokens(document: TextDocument): SemanticTokenData[] {
            const yacc = cache.get(document);
            return yaccLanguageService.getSemanticTokens(document, yacc);
        },
        getSemanticTokenLegend() {
            return { types: tokenTypes, modifiers: tokenModifiers };
        },
        onDocumentRemoved(document: TextDocument) {
            cache.onDocumentRemoved(document);
        },
        dispose() {
            cache.dispose();
        }
    };
}