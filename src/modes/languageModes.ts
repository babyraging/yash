import { getLanguageService as getYACCLanguageService } from '../languages/yaccLanguageServices';
import { getLanguageService as getLEXLanguageService } from '../languages/lexLanguageService';
import { SemanticTokenData } from '../languages/semanticTokens';

import {
    TextDocument,
    Position,
    SelectionRange,
    CompletionList,
    CompletionItem,
    Diagnostic,
    Hover,
    Definition,
    Location,
    WorkspaceEdit,
    SignatureHelp,
    DocumentHighlight,
    FormattingOptions,
    TextEdit,
    Range
} from 'vscode'

import { DocumentCache } from '../documentCache';
import { getYACCMode } from './yaccMode';
import { getLEXMode } from './lexMode';

export interface LanguageMode {
    getId(): string;
    getSelectionRange?: (document: TextDocument, position: Position) => SelectionRange;
    doValidation?: (document: TextDocument) => Diagnostic[];
    doComplete?: (document: TextDocument, position: Position) => CompletionList | CompletionItem[];
    doResolve?: (document: TextDocument, item: CompletionItem) => CompletionItem;
    doHover?: (document: TextDocument, position: Position) => Hover | null;
    doSignatureHelp?: (document: TextDocument, position: Position) => SignatureHelp | null;
    doRename?: (document: TextDocument, position: Position, newName: string) => WorkspaceEdit | null;
    doOnTypeRename?: (document: TextDocument, position: Position) => Range[] | null;
    findDocumentHighlight?: (document: TextDocument, position: Position) => DocumentHighlight[];
    // findDocumentSymbols?: (document: TextDocument) => SymbolInformation[];
    // findDocumentLinks?: (document: TextDocument, documentContext: DocumentContext) => DocumentLink[];
    findTypeDefinition?: (document: TextDocument, position: Position) => Definition | null;
    findDefinition?: (document: TextDocument, position: Position) => Definition | null;
    findReferences?: (document: TextDocument, position: Position) => Location[];
    format?: (document: TextDocument, range: Range, options: FormattingOptions) => TextEdit[];
    // findDocumentColors?: (document: TextDocument) => ColorInformation[];
    // getColorPresentations?: (document: TextDocument, color: Color, range: Range) => ColorPresentation[];
    // doAutoClose?: (document: TextDocument, position: Position) => string | null;
    // getFoldingRanges?: (document: TextDocument) => FoldingRange[];
    getSemanticTokens?(document: TextDocument): SemanticTokenData[];
    getSemanticTokenLegend?(): { types: string[], modifiers: string[] };
    onDocumentRemoved(document: TextDocument): void;
    dispose(): void;
}

export interface LanguageModes {
    getAllModes(): LanguageMode[];
    getMode(languageId: string): LanguageMode | undefined;
    onDocumentRemoved(document: TextDocument): void;
    dispose(): void;
}

export function getLanguageModes(supportedLanguages: { [languageId: string]: boolean; }): LanguageModes {
    const yaccLanguageService = getYACCLanguageService();
    const lexLanguageService = getLEXLanguageService();

    let modelCaches: DocumentCache<any>[] = [];

    let modes = Object.create(null);
    if (supportedLanguages['yacc']) {
        modes['yacc'] = getYACCMode(yaccLanguageService);
    }

    if (supportedLanguages['lex']) {
        modes['lex'] = getLEXMode(lexLanguageService);
    }

    return {
        getAllModes(): LanguageMode[] {
            let result = [];
            for (let languageId in modes) {
                let mode = modes[languageId];
                if (mode) {
                    result.push(mode);
                }
            }
            return result;
        },
        getMode(languageId: string): LanguageMode {
            return modes[languageId];
        },
        onDocumentRemoved(document: TextDocument) {
            modelCaches.forEach(mc => mc.onDocumentRemoved(document));
            for (let mode in modes) {
                modes[mode].onDocumentRemoved(document);
            }
        },
        dispose(): void {
            modelCaches.forEach(mc => mc.dispose());
            modelCaches = [];
            for (let mode in modes) {
                modes[mode].dispose();
            }
            modes = {};
        }
    };
}
