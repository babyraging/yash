import { TextDocument, Position, Range, WorkspaceEdit, TextEdit } from 'vscode';
import { YACCDocument, ISymbol } from "../parser/yaccParser";

export function doYACCRename(document: TextDocument, position: Position, newName: string, yaccDocument: YACCDocument): WorkspaceEdit | null {
    const offset = document.offsetAt(position);
    const node = yaccDocument.getEmbeddedNode(offset);
    if (node) {
        return null;
    }

    const word = document.getText(document.getWordRangeAtPosition(position));
    var symbol: ISymbol | undefined = yaccDocument.types[word] || yaccDocument.symbols[word] || yaccDocument.tokens[word];
    const edits = new WorkspaceEdit();
    symbol?.references.forEach(reference => {
        edits.replace(document.uri, new Range(document.positionAt(reference[0]), document.positionAt(reference[1])), newName);
    })
    return edits;
}