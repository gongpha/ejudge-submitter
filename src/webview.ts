import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { Problem } from './ejudge';

export function getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
	return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}

function getMetaAndScriptTabs(webview: Webview, extensionUri: Uri, script: string) {
	const toolkitUri = getUri(webview, extensionUri, [
		"node_modules",
		"@vscode",
		"webview-ui-toolkit",
		"dist",
		"toolkit.js",
	]);
	const styleUri = getUri(webview, extensionUri, ["src", "webview", "style.css"]);
	const mainUri = getUri(webview, extensionUri, ["src", "webview", script]);

	return `<meta charset="UTF-8">
			  <meta name="viewport" content="width=device-width, initial-scale=1.0">
			  <script type="module" src="${toolkitUri}"></script>
			  <script type="module" src="${mainUri}"></script>
			  <link rel="stylesheet" href="${styleUri}">`;
}

export function getLoginContent(webview: Webview, extensionUri: Uri, message: string): string {
	return `
		<!DOCTYPE html>
		<html lang="en">
		  <head>
		  		${getMetaAndScriptTabs(webview, extensionUri, "login.js")}
				<title>Login</title>
		  </head>
		  <body id="webview-body">
			<header>
				<h1>Login</h1>
			</header>
			<h3>${message}</h3>
			<section id="login-form">
				<vscode-text-field id="username" placeholder="">Username</vscode-text-field>
				<vscode-text-field id="password" type="password" placeholder="" resize="vertical">Password</vscode-text-field>
				<vscode-checkbox id="remember" value="true">Remember me</vscode-checkbox>
				<vscode-button id="login-button">Sign in</vscode-button>
				<vscode-button id="cancel-button" appearance="secondary">Cancel</vscode-button>
			</section>
		  </body>
		</html>
	  `;
};

export function getProblemContent(webview: Webview, extensionUri: Uri, problem: Problem): string {
	const samples = (problem.samples ??= []).map(sample => {
		`<vscode-data-grid-row>\
		<vscode-data-grid-cell grid-column="1">${sample[0]}</vscode-data-grid-cell>\
		<vscode-data-grid-cell grid-column="2">${sample[1]}</vscode-data-grid-cell>\
		</vscode-data-grid-row>`;
	});

	return `
		<!DOCTYPE html>
		<html lang="en">
		  <head>
			  ${getMetaAndScriptTabs(webview, extensionUri, "problem.js")}
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