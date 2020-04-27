import { TextDocument, Position, Definition, Location, Range } from 'vscode';
import { LexDocument, ISymbol } from "../parser/lexParser";

export function doLEXFindDefinition(document: TextDocument, position: Position, lexDocument: LexDocument): Definition | null {
    const offset = document.offsetAt(position);
    const node = lexDocument.getEmbeddedCode(offset);
    if (node) {
        return null;
    }

    const word = document.getText(document.getWordRangeAtPosition(position));
    var symbol: ISymbol | undefined = lexDocument.defines[word] || lexDocument.states[word];
    let location: Location | null = null;
    if (symbol) {
        location = new Location(document.uri, new Range(document.positionAt(symbol.definition[0]), document.positionAt(symbol.definition[1])));
    }
    return location;
}