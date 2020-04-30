import { TextDocument, TextEdit, Range, FormattingOptions } from 'vscode';
import { YACCDocument, ISymbol, NodeType } from '../parser/yaccParser';
import { formatError } from '../../runner';

function removeExtraSpaces(result: string) {
	return result.replace(/[ ]+/g, (m) => {
		return ' ';
	});
}

function removeTabs(result: string) {
	return result.replace(/[\t]/g, (m) => {
		return ' ';
	});
}

function removeSpacesAfterEOL(result: string) {
	return result.replace(/\n[\s]+/mg, (m) => {
		return '';
	});
}


export function doYACCFormat(document: TextDocument, range: Range, options: FormattingOptions, yaccDocument: YACCDocument): TextEdit[] {
    var node;
    let edit = Array();
    console.log("Formatting...");
    let offsetStart = document.offsetAt(range.start);
    node = yaccDocument.getNodeByOffset(offsetStart);
    let offsetEnd = offsetStart;
    if (node) offsetEnd = node.end + 1;
    while ((node) && (offsetEnd <= document.offsetAt(range.end))) {
        var textRange = new Range(document.positionAt(offsetStart), document.positionAt(offsetEnd))
        var formattedText;
        if (node.nodeType == NodeType.Token) {
            formattedText = document.getText(textRange);
            console.log("originalText:^" + formattedText + "$");
            formattedText = formattedText.trimLeft();
            formattedText = removeSpacesAfterEOL(formattedText);
            formattedText = removeTabs(formattedText);
            formattedText = removeExtraSpaces(formattedText);
            /* if \n is not the last char */
            formattedText = formattedText.replace(/[^\n]$/, (m) => { return m +'\n'; });
            console.log("formattedText:^" + formattedText + "$")
        }
        if(formattedText) edit.push(TextEdit.replace(textRange, formattedText));
        offsetStart = offsetEnd;
        node = yaccDocument.getNodeByOffset(offsetStart);
        if (node) {
            offsetStart = node.offset;
            offsetEnd = node.end + 1;
        }
    }
    return edit;
}