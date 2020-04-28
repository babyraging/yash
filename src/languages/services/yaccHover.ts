import { TextDocument, Hover, Position, MarkedString, MarkdownString } from 'vscode';
import { YACCDocument, ISymbol, NodeType } from "../parser/yaccParser";
import { createMarkedCodeString } from "./utils";

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
    }

    if ((symbol = yaccDocument.tokens[word])) {
        message = createMarkedCodeString(`%token <${symbol.type ? symbol.type : '?'}> ${symbol.name}`, 'yacc');
    }

    if (message)
        return { contents: [message] };

    return null;
}