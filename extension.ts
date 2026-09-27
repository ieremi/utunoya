import * as vscode from 'vscode';

const SCHEME = 'utunoya-preview';
const COMMAND = 'utunoya.open';
const VIEW_ID = 'utunoya.view';
const LINE_WIDTH = 30;

async function closePreview(): Promise<void> {
    const tabs = vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .filter(
            (tab) =>
                tab.input instanceof vscode.TabInputText
                && tab.input.uri.scheme === SCHEME,
        );

    await vscode.window.tabGroups.close(tabs);
}

export function activate(
    context: vscode.ExtensionContext,
): void {
    const provider = new UtunoyaPreviewProvider();

    const counter = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100,
    );

    counter.name = 'Utunoya character count';
    counter.tooltip =
        'Manuscript character count';

    const view = vscode.window.createTreeView(
        VIEW_ID,
        {
            treeDataProvider: {
                getTreeItem: (item: never) => item,
                getChildren: () => [],
            },
        },
    );

    view.onDidChangeVisibility((event) => {
        if (event.visible) {
            void vscode.commands.executeCommand(COMMAND);
        } else {
            void closePreview();
        }
    });

    if (view.visible) {
        void vscode.commands.executeCommand(COMMAND);
    }

    context.subscriptions.push(
        view,
        counter,

        vscode.workspace.registerTextDocumentContentProvider(
            SCHEME,
            provider,
        ),

        vscode.commands.registerCommand(
            COMMAND,
            async () => {
                const editor =
                    vscode.window.activeTextEditor;

                if (!editor) {
                    return;
                }

                if (editor.document.uri.scheme === SCHEME) {
                    return;
                }

                const sourceUri =
                    editor.document.uri;

                const previewUri =
                    createPreviewUri(sourceUri);

                provider.register(sourceUri);
                provider.refresh(sourceUri);

                const previewDocument =
                    await vscode.workspace.openTextDocument(
                        previewUri,
                    );

                await vscode.window.showTextDocument(
                    previewDocument,
                    {
                        viewColumn: vscode.ViewColumn.Beside,
                        preview: true,
                        preserveFocus: true,
                    },
                );

                updateCounter(
                    counter,
                    editor.document,
                );
            },
        ),

        vscode.workspace.onDidChangeTextDocument(
            (event) => {
                if (
                    event.document.uri.scheme === SCHEME
                ) {
                    return;
                }

                provider.refresh(
                    event.document.uri,
                );

                const activeDocument =
                    vscode.window.activeTextEditor
                        ?.document;

                if (
                    activeDocument?.uri.toString()
                    === event.document.uri.toString()
                ) {
                    updateCounter(
                        counter,
                        event.document,
                    );
                }
            },
        ),

        vscode.window.onDidChangeActiveTextEditor(
            (editor) => {
                if (!editor) {
                    counter.hide();
                    return;
                }

                if (
                    editor.document.uri.scheme === SCHEME
                ) {
                    return;
                }

                updateCounter(
                    counter,
                    editor.document,
                );
            },
        ),

        vscode.workspace.onDidCloseTextDocument(
            (document) => {
                if (
                    document.uri.scheme !== SCHEME
                ) {
                    provider.unregister(
                        document.uri,
                    );
                }
            },
        ),
    );
}

class UtunoyaPreviewProvider
    implements vscode.TextDocumentContentProvider {
    private readonly changeEmitter =
        new vscode.EventEmitter<vscode.Uri>();

    private readonly sources =
        new Map<string, vscode.Uri>();

    public readonly onDidChange =
        this.changeEmitter.event;

    public register(
        sourceUri: vscode.Uri,
    ): void {
        const previewUri =
            createPreviewUri(sourceUri);

        this.sources.set(
            previewUri.toString(),
            sourceUri,
        );
    }

    public unregister(
        sourceUri: vscode.Uri,
    ): void {
        const previewUri =
            createPreviewUri(sourceUri);

        this.sources.delete(
            previewUri.toString(),
        );
    }

    public refresh(
        sourceUri: vscode.Uri,
    ): void {
        const previewUri =
            createPreviewUri(sourceUri);

        if (
            this.sources.has(
                previewUri.toString(),
            )
        ) {
            this.changeEmitter.fire(
                previewUri,
            );
        }
    }

    public async provideTextDocumentContent(
        previewUri: vscode.Uri,
    ): Promise<string> {
        const sourceUri =
            this.sources.get(
                previewUri.toString(),
            );

        if (!sourceUri) {
            return '';
        }

        const sourceDocument =
            await vscode.workspace.openTextDocument(
                sourceUri,
            );

        const sourceText =
            sourceDocument.getText();

        const previewText =
            wrapText(sourceText)
                .replace(/\n+$/, '');

        const count =
            countPreviewCharacters(
                sourceText,
            );

        if (previewText.length === 0) {
            return `Character count: ${count}`;
        }

        return [
            previewText,
            '',
            `Character count: ${count}`,
        ].join('\n');
    }
}

function createPreviewUri(
    sourceUri: vscode.Uri,
): vscode.Uri {
    return vscode.Uri.from({
        scheme: SCHEME,
        path: `/${encodeURIComponent(
            sourceUri.toString(),
        )}`,
    });
}

/**
 * Wraps text at fifteen manuscript cells.
 *
 * Digits and spaces use one unit. All other
 * characters use two units.
 *
 * Thirty units are equivalent to fifteen cells.
 */
function wrapText(
    text: string,
): string {
    const paddedText =
        padHalfWidthRuns(text);

    let result = '';
    let currentWidth = 0;

    for (const character of paddedText) {
        if (character === '\r') {
            continue;
        }

        if (character === '\n') {
            result += '\n';
            currentWidth = 0;
            continue;
        }

        const characterWidth =
            isHalfWidthCharacter(character)
                ? 1
                : 2;

        if (
            currentWidth > 0
            && currentWidth + characterWidth
            > LINE_WIDTH
        ) {
            result += '\n';
            currentWidth = 0;
        }

        result += character;
        currentWidth += characterWidth;
    }

    return result;
}

/**
 * Appends one ASCII space to each run of digits
 * containing an odd number of characters.
 */
function padHalfWidthRuns(
    text: string,
): string {
    return text.replace(
        /[0-9]+/g,
        (run) => (
            run.length % 2 === 0
                ? run
                : `${run} `
        ),
    );
}

/**
 * Returns true when a character occupies
 * half of a manuscript cell.
 */
function isHalfWidthCharacter(
    character: string,
): boolean {
    return /^[0-9 ]$/.test(
        character,
    );
}

/**
 * Counts manuscript cells in the generated
 * preview.
 *
 * Half-width characters use one unit.
 * Full-width characters use two units.
 * Line breaks are excluded.
 */
function countPreviewCharacters(
    text: string,
): number {
    const paddedText =
        padHalfWidthRuns(text);

    let units = 0;

    for (const character of paddedText) {
        if (
            character === '\r'
            || character === '\n'
        ) {
            continue;
        }

        units +=
            isHalfWidthCharacter(character)
                ? 1
                : 2;
    }

    return units / 2;
}

function updateCounter(
    counter: vscode.StatusBarItem,
    document: vscode.TextDocument,
): void {
    const count =
        countPreviewCharacters(
            document.getText(),
        );

    counter.text =
        `$(symbol-string) ${count} chars`;

    counter.show();
}

export function deactivate(): void { }