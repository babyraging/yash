export function binarySearch<T>(array: T[], key: number, comparator: (op1: T, op2: number) => number): T | undefined {
    let low = 0,
        high = array.length - 1;

    while (low <= high) {
        const mid = ((low + high) / 2) | 0;
        const comp = comparator(array[mid], key);
        if (comp < 0) {
            low = mid + 1;
        } else if (comp > 0) {
            high = mid - 1;
        } else {
            return array[mid];
        }
    }
    return undefined;
}

export const _NWL = '\n'.charCodeAt(0);
export const _CAR = '\r'.charCodeAt(0);
export const _LFD = '\f'.charCodeAt(0);
export const _TAB = '\t'.charCodeAt(0);
export const _WSP = ' '.charCodeAt(0);

export const _LAN = '<'.charCodeAt(0);
export const _RAN = '>'.charCodeAt(0);
export const _FSL = '/'.charCodeAt(0);
export const _BSL = '\\'.charCodeAt(0);
export const _AST = '*'.charCodeAt(0);
export const _COL = ':'.charCodeAt(0);
export const _BAR = '|'.charCodeAt(0);
export const _BOP = '{'.charCodeAt(0);
export const _BCL = '}'.charCodeAt(0);
export const _PCS = '%'.charCodeAt(0);
export const _DOT = '.'.charCodeAt(0);
export const _DQO = '"'.charCodeAt(0);
export const _SQO = '\''.charCodeAt(0);
export const _SBO = '['.charCodeAt(0);
export const _SBC = ']'.charCodeAt(0);
export const _SCL = ';'.charCodeAt(0);
export const _AND = '&'.charCodeAt(0);

/**
 * Imported form Microsoft's vscode-html-languageservice's scanner.
 * 
 * Thank you Microsoft.
 */
export class MultiLineStream {
    private source: string;
    private len: number;
    private position: number;

    constructor(source: string, position: number) {
        this.source = source;
        this.len = source.length;
        this.position = position;
    }

    public eos(): boolean {
        return this.len <= this.position;
    }

    public getSource(): string {
        return this.source;
    }

    public pos(): number {
        return this.position;
    }

    public goBackTo(pos: number): void {
        this.position = pos;
    }

    public goBack(n: number): void {
        this.position -= n;
    }

    public advance(n: number): void {
        this.position += n;
    }

    public goToEnd(): void {
        this.position = this.source.length;
    }

    public nextChar(): number {
        return this.source.charCodeAt(this.position++) || 0;
    }

    public peekChar(n: number = 0): number {
        return this.source.charCodeAt(this.position + n) || 0;
    }

    public advanceIfChar(ch: number): boolean {
        if (ch === this.source.charCodeAt(this.position)) {
            this.position++;
            return true;
        }
        return false;
    }

    public advanceIfChars(ch: number[]): boolean {
        let i: number;
        if (this.position + ch.length > this.source.length) {
            return false;
        }
        for (i = 0; i < ch.length; i++) {
            if (this.source.charCodeAt(this.position + i) !== ch[i]) {
                return false;
            }
        }
        this.advance(i);
        return true;
    }

    public advanceIfRegExp(regex: RegExp): string {
        const str = this.source.substr(this.position);
        const match = str.match(regex);
        if (match) {
            this.position = this.position + match.index! + match[0].length;
            return match[0];
        }
        return '';
    }

    public advanceUntilRegExp(regex: RegExp): string {
        const str = this.source.substr(this.position);
        const match = str.match(regex);
        if (match) {
            this.position = this.position + match.index!;
            return match[0];
        } else {
            this.goToEnd();
        }
        return '';
    }

    public advanceUntilChar(ch: number): boolean {
        while (this.position < this.source.length) {
            if (this.source.charCodeAt(this.position) === ch) {
                return true;
            }
            this.advance(1);
        }
        return false;
    }

    public advanceUntilChars(ch: number[]): boolean {
        while (this.position + ch.length <= this.source.length) {
            let i = 0;
            for (; i < ch.length && this.source.charCodeAt(this.position + i) === ch[i]; i++) {
            }
            if (i === ch.length) {
                return true;
            }
            this.advance(1);
        }
        this.goToEnd();
        return false;
    }

    public skipWhitespace(): boolean {
        const n = this.advanceWhileChar(ch => {
            return ch === _WSP || ch === _TAB || ch === _NWL || ch === _LFD || ch === _CAR;
        });
        return n > 0;
    }

    public skipWitheSpaceWithoutNewLine(): boolean {
        const n = this.advanceWhileChar(ch => {
            return ch === _WSP || ch === _TAB || ch === _LFD;
        });
        return n > 0;
    }

    public advanceWhileChar(condition: (ch: number) => boolean): number {
        const posNow = this.position;
        while (this.position < this.len && condition(this.source.charCodeAt(this.position))) {
            this.position++;
        }
        return this.position - posNow;
    }
}
