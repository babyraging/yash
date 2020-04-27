import { TextDocument, Hover, Position, MarkedString, MarkdownString } from 'vscode';
import { YACCDocument, ISymbol } from "../parser/yaccParser";
import { createMarkedCodeString } from "./utils";

export function doYACCHover(document: TextDocument, position: Position, yaccDocument: YACCDocument): Hover | null {
    const offset = document.offsetAt(position);
    const node = yaccDocument.getEmbeddedNode(offset);
    if (node) {
        return null;
    }

    const word = document.getText(document.getWordRangeAtPosition(position));

    var message: MarkdownString | undefined = undefined;
    var symbol: ISymbol;
    if ((symbol = yaccDocument.types[word])) {
        message = createMarkedCodeString(`${symbol.type} ${symbol.name}`, 'yacc');
    }

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