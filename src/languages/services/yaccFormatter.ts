import { TextDocument, TextEdit, Range, FormattingOptions } from 'vscode';
import { YACCDocument, ISymbol, NodeType, Node } from '../parser/yaccParser';
import { formatError } from '../../runner';


function findNearestNodes(nodes: Node[], offsetStart: number, offsetEnd: number): [ number, number ] {
    let minStart = Number.MAX_VALUE;
    let minEnd = Number.MAX_VALUE;
    let indexStart = -1 , indexEnd = -1;
    nodes.forEach( (node, i) => { 
        if ( Math.abs(node.offset - offsetStart) < minStart) { 
            minStart =  Math.abs(node.offset - offsetStart);
            indexStart = i;
        }
        if ( Math.abs(node.end - offsetEnd) < minEnd) { 
            minEnd =  Math.abs(node.end - offsetEnd);
            indexEnd = i;
        }
    });
    return [indexStart, indexEnd];
}

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
	return result.replace(/\n[ \t]+/mg, (m) => {
		return '';
	});
}


export function doYACCFormat(document: TextDocument, range: Range, options: FormattingOptions, yaccDocument: YACCDocument): TextEdit[] {
    var node;
    let edit = Array();
    console.log("Formatting...");
    console.log(document.offsetAt(range.start) + " " + document.offsetAt(range.end))
    let indices = findNearestNodes(yaccDocument.nodes, document.offsetAt(range.start), document.offsetAt(range.end));
    let startIndex = indices[0];
    let endIndex = indices[1];
    console.log(startIndex + " " + endIndex)
    for( let i = startIndex; i <= endIndex; i++) {
        let node = yaccDocument.nodes[i];
        console.log(node);
        var textRange = new Range(document.positionAt(node.offset), document.positionAt(node.end + 1))
        var formattedText = undefined
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
        if (formattedText) edit.push(TextEdit.replace(textRange, formattedText));
    }
    return edit;
}