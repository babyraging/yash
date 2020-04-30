import { TextDocument, Position , TextEdit} from 'vscode';
import { YACCDocument, ISymbol } from '../parser/yaccParser';

export function doYACCFormat(document: TextDocument, position: Position, yaccDocument: YACCDocument): TextEdit[] {
    let edit = Array();
    return edit;
}