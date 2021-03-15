import { TextDocument, Hover, Position, MarkdownString } from 'vscode';
import { LexDocument, ISymbol, predefinedStates } from '../parser/lexParser';
import { createMarkedCodeString } from './utils';

export function doLEXHover(document: TextDocument, position: Position, lexDocument: LexDocument): Hover | null {
    const offset = document.offsetAt(position);
    const node = lexDocument.getEmbeddedCode(offset);
    if (node) {
        return null;
    }

    const word = document.getText(document.getWordRangeAtPosition(position));
    var symbol: ISymbol = lexDocument.defines[word] || lexDocument.states[word];
    if (symbol) {
        const line = document.lineAt(document.positionAt(symbol.offset)).text;
        return { contents: [createMarkedCodeString(line, 'lex')] };
    } else if (predefinedStates[word]) {
        return { contents: [createMarkedCodeString(predefinedStates[word], 'lex')] };
    }

    return null;
}