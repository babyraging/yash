import { TextDocument, Position, Location, Range } from 'vscode';
import { LexDocument, ISymbol } from "../parser/lexParser";

export function doLEXFindReferences(document: TextDocument, position: Position, lexDocument: LexDocument): Location[] {
    const offset = document.offsetAt(position);
    const node = lexDocument.getEmbeddedCode(offset);
    if (node) {
        return [];
    }

    const word = document.getText(document.getWordRangeAtPosition(position));
    var symbol: ISymbol | undefined = lexDocument.defines[word] || lexDocument.states[word];
    let location: Location[] = [];
    symbol?.references.forEach(reference => {
        location.push(new Location(document.uri, new Range(document.positionAt(reference[0]), document.positionAt(reference[1]))));
    })
    return location;
}