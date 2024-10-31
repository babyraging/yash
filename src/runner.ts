/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. 
 *  
 *  Modified to adapt the project
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vscode';

export function formatError(message: string, err: any): string {
    if (err instanceof Error) {
        let error = <Error>err;
        return `${message}: ${error.message}\n${error.stack}`;
    } else if (typeof err === 'string') {
        return `${message}: ${err}`;
    } else if (err) {
        return `${message}: ${err.toString()}`;
    }
    return message;
}

export function runSafeAsync<T>(func: () => Thenable<T>, errorVal: T, errorMessage: string, token: CancellationToken): Thenable<T> {
    return new Promise<T>((resolve) => {
        setImmediate(async () => {
            if (token.isCancellationRequested) {
                resolve(cancelValue());
            }
            return func().then(result => {
                if (token.isCancellationRequested) {
                    resolve(cancelValue());
                    return;
                } else {
                    resolve(result);
                }
            }, e => {
                console.error(formatError(errorMessage, e));
                resolve(errorVal);
            });
        });
    });
}

export function runSafe<T>(func: () => T, errorVal: T, errorMessage: string, token: CancellationToken): Thenable<T> {
    return new Promise<T>((resolve) => {
        setImmediate(() => {
            if (token.isCancellationRequested) {
                resolve(cancelValue());
            } else {
                try {
                    let result = func();
                    if (token.isCancellationRequested) {
                        resolve(cancelValue());
                        return;
                    } else {
                        resolve(result);
                    }

                } catch (e) {
                    console.error(formatError(errorMessage, e));
                    resolve(errorVal);
                }
            }
        });
    });
}

function cancelValue<E>() {
    console.log("Request cancelled...");
    return undefined as unknown as E;
}