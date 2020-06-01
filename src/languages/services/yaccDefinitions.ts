import { TextDocument, Position, Definition, Location, Range } from 'vscode';
import { YACCDocument, ISymbol } from '../parser/yaccParser';

export function doYACCFindDefinition(document: TextDocument, position: Position, yaccDocument: YACCDocument): Definition | null {
    const offset = document.offsetAt(position);
    const node = yaccDocument.getEmbeddedNode(offset);
    if (node) {
        return null;
    }

    const word = document.getText(document.getWordRangeAtPosition(position));
    var symbol: ISymbol | undefined = yaccDocument.types[word] || yaccDocument.symbols[word] || yaccDocument.tokens[word] || yaccDocument.aliases[`"${word}"`];
    let location: Location | null = null;
    if (symbol) {
        location = new Location(document.uri, new Range(document.positionAt(symbol.definition[0]), document.positionAt(symbol.definition[1])));
    }
    return location;
}