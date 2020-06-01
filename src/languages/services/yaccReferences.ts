import { TextDocument, Position, Location, Range } from 'vscode';
import { YACCDocument, ISymbol } from '../parser/yaccParser';

export function doYACCFindReferences(document: TextDocument, position: Position, yaccDocument: YACCDocument): Location[] {
    const offset = document.offsetAt(position);
    const node = yaccDocument.getEmbeddedNode(offset);
    if (node) {
        return [];
    }

    const word = document.getText(document.getWordRangeAtPosition(position));
    var symbol: ISymbol | undefined = yaccDocument.types[word] || yaccDocument.symbols[word] || yaccDocument.tokens[word] || yaccDocument.aliases[`"${word}"`];
    let location: Location[] = [];
    symbol?.references.forEach(reference => {
        location.push(new Location(document.uri, new Range(document.positionAt(reference[0]), document.positionAt(reference[1]))));
    })
    symbol?.alias?.references.forEach(reference => {
        location.push(new Location(document.uri, new Range(document.positionAt(reference[0]), document.positionAt(reference[1]))));
    })
    return location;
}