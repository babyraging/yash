import { TextDocument, Position, Range, WorkspaceEdit, TextEdit } from 'vscode';
import { LexDocument, ISymbol } from "../parser/lexParser"

export function doLEXRename(document: TextDocument, position: Position, newName: string, lexDocument: LexDocument): WorkspaceEdit | null {
    const offset = document.offsetAt(position);
    const node = lexDocument.getEmbeddedCode(offset);
    if (node) {
        return null;
    }

    const word = document.getText(document.getWordRangeAtPosition(position));
    var symbol: ISymbol | undefined = lexDocument.defines[word] || lexDocument.states[word];
    const edits = new WorkspaceEdit();
    symbol?.references.forEach(reference => {
        edits.replace(document.uri, new Range(document.positionAt(reference[0]), document.positionAt(reference[1])), newName);
    })
    return edits;
}