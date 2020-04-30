import { TextDocument, TextEdit, Range, FormattingOptions } from 'vscode';
import { YACCDocument, ISymbol, NodeType } from '../parser/yaccParser';


export function doYACCFormat(document: TextDocument, range: Range, options: FormattingOptions, yaccDocument: YACCDocument): TextEdit[] {
    var node;
    let edit = Array();
    let offset = range.start.line;
    node = yaccDocument.getNodeByOffset(offset);
    while ( node !== undefined ) {
        if (node.nodeType == NodeType.Token) {
            
        }
        offset += node?.length;
        node = yaccDocument.getNodeByOffset(offset);
    }

    return edit;
}