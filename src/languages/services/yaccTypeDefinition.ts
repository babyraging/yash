import { TextDocument, Position, Definition, Location, Range } from 'vscode';
import { YACCDocument, ISymbol } from '../parser/yaccParser';

export function doYACCFindTypeDefinition(document: TextDocument, position: Position, yaccDocument: YACCDocument): Definition | null {
    const offset = document.offsetAt(position);
    const node = yaccDocument.getEmbeddedNode(offset);
    if (node) {
        return null;
    }

    const word = document.getText(document.getWordRangeAtPosition(position));
    var symbol: ISymbol | undefined = yaccDocument.symbols[word] || yaccDocument.tokens[word];
    let location: Location | null = null;
    if (symbol && symbol.type) {
        const type = yaccDocument.types[symbol.type];
        if (type) {
            location = new Location(document.uri, new Range(document.positionAt(type.definition[0]), document.positionAt(type.definition[1])));
        }
    }
    return location;
}