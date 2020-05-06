import { TextDocument, Hover, Position, MarkdownString } from 'vscode';
import { YACCDocument, ISymbol, predefined } from '../parser/yaccParser';
import { createMarkedCodeString } from './utils';

export function doYACCHover(document: TextDocument, position: Position, yaccDocument: YACCDocument): Hover | null {
    const offset = document.offsetAt(position);
    const code = yaccDocument.getEmbeddedNode(offset);
    if (code) {
        return null;
    }

    var symbol: ISymbol;
    const word = document.getText(document.getWordRangeAtPosition(position));
    const node = yaccDocument.getNodeByOffset(offset);
    if (node) {
        // Inside <...>
        if (node.typeOffset && offset > node.typeOffset) {
            if (!node.typeEnd || offset <= node.typeEnd) {
                if ((symbol = yaccDocument.types[word])) {
                    message = createMarkedCodeString(symbol.type, 'yacc');
                    return { contents: [createMarkedCodeString(symbol.type, 'yacc')] }
                }
                return null;
            }
        }
    }

    var message: MarkdownString | undefined = undefined;
    if ((symbol = yaccDocument.symbols[word])) {
        message = createMarkedCodeString(`%type <${symbol.type ? symbol.type : '?'}> ${symbol.name}`, 'yacc');
    } else if ((symbol = yaccDocument.tokens[word])) {
        const node = yaccDocument.getNodeByOffset(symbol.offset)!;
        const head = document.getText(document.getWordRangeAtPosition(document.positionAt(node!.offset + 1)));
        message = createMarkedCodeString(`%${head} <${symbol.type ? symbol.type : '?'}> ${symbol.name}`, 'yacc');
    } else if (predefined[word]) {
        message = createMarkedCodeString(predefined[word], 'yacc');
    }

    if (message)
        return { contents: [message] };

    return null;
}