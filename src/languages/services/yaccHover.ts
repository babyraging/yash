import { TextDocument, Hover, Position, MarkdownString, workspace } from 'vscode';
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
        const config = workspace.getConfiguration('yash');
        const yyType = config.get('YYTYPE', '');
        const guess = yyType !== '' ? yyType : '?';
        message = createMarkedCodeString(`%type <${symbol.type ? symbol.type : guess}> ${symbol.name}`, 'yacc');
    } else if ((symbol = yaccDocument.tokens[word])) {
        const node = yaccDocument.getNodeByOffset(symbol.offset)!;
        const head = document.getText(document.getWordRangeAtPosition(document.positionAt(node!.offset + 1)));
        message = createMarkedCodeString(`%${head} <${symbol.type ? symbol.type : '?'}> ${symbol.name}`, 'yacc');
    } else if ((symbol = yaccDocument.aliases[`"${word}"`])) {
        if (symbol.alias) {
            symbol = symbol.alias;
            const node = yaccDocument.getNodeByOffset(symbol.offset)!;
            const head = document.getText(document.getWordRangeAtPosition(document.positionAt(node!.offset + 1)));
            message = createMarkedCodeString(`%${head} <${symbol.type ? symbol.type : '?'}> ${symbol.name}`, 'yacc');
        }
    } else if (predefined[word]) {
        message = createMarkedCodeString(predefined[word], 'yacc');
    }

    const namedReference = yaccDocument.namedReferences[`[${word}]`]
    if (namedReference) {
        if (namedReference.symbol) {
            message = createMarkedCodeString(`Named reference for ${namedReference.symbol}`, 'plaintext');
        } else {
            message = createMarkedCodeString(`Middle rule action reference`, 'plaintext');
        }
    }

    if (message)
        return { contents: [message] };

    return null;
}