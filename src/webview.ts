import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { Problem } from './ejudge';

export function getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
	return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}

export function getProblemContent(webview: Webview, extensionUri: Uri, problem: Problem): string {
	const toolkitUri = getUri(webview, extensionUri, [
		"node_modules",
		"@vscode",
		"webview-ui-toolkit",
		"dist",
		"toolkit.js",
	]);
	const styleUri = getUri(webview, extensionUri, ["style.css"]);
	const mainUri = getUri(webview, extensionUri, ["problem.js"]);

	const samples = (problem.samples ??= []).map(sample => {
		`<vscode-data-grid-row>\
		<vscode-data-grid-cell grid-column="1">${sample[0]}</vscode-data-grid-cell>\
		<vscode-data-grid-cell grid-column="2">${sample[1]}</vscode-data-grid-cell>\
		</vscode-data-grid-row>`;
	});

	return /*html*/ `
		<!DOCTYPE html>
		<html lang="en">
		  <head>
			  <meta charset="UTF-8">
			  <meta name="viewport" content="width=device-width, initial-scale=1.0">
			  <script type="module" src="${toolkitUri}"></script>
			  <script type="module" src="${mainUri}"></script>
			  <link rel="stylesheet" href="${styleUri}">
			  <title>${problem.title ??= "<unfilled object>"}</title>
		  </head>
		  <body id="webview-body">
			<header>
			  <h1>${problem.title ??= "<unfilled object>"}</h1>
			</header>
			<vscode-panels>
				<vscode-panel-tab id="tab-1">Description</vscode-panel-tab>
				<vscode-panel-tab id="tab-2">Specifications</vscode-panel-tab>
				<vscode-panel-tab id="tab-3">Samples</vscode-panel-tab>
				<vscode-panel-view id="view-1">${problem.descRaw ??= ". . ."}</vscode-panel-view>
				<vscode-panel-view id="view-2">
					<vscode-data-grid aria-label="Basic">
						<vscode-data-grid-row row-type="header">
							<vscode-data-grid-cell cell-type="columnheader" grid-column="1">Input</vscode-data-grid-cell>
							<vscode-data-grid-cell cell-type="columnheader" grid-column="2">Output</vscode-data-grid-cell>
						</vscode-data-grid-row>
						<vscode-data-grid-row>
							<vscode-data-grid-cell grid-column="1">${problem.specIn}</vscode-data-grid-cell>
							<vscode-data-grid-cell grid-column="2">${problem.specIn}</vscode-data-grid-cell>
						</vscode-data-grid-row>
					</vscode-data-grid>
				</vscode-panel-view>
				<vscode-panel-view id="view-3">
				<vscode-data-grid aria-label="Basic">
					<vscode-data-grid-row row-type="header">
						<vscode-data-grid-cell cell-type="columnheader" grid-column="1">Input</vscode-data-grid-cell>
						<vscode-data-grid-cell cell-type="columnheader" grid-column="2">Output</vscode-data-grid-cell>
					</vscode-data-grid-row>
					${samples}
				</vscode-data-grid>
				</vscode-panel-view>
			</vscode-panels>
		  </body>
		</html>
	  `;
}