import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { Problem, SubmissionLite, SubmissionLiteStatus } from './ejudge';

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

export function getSubmissionLiteHTML(submission: SubmissionLite | undefined) {
	if (!submission) {
		return ". . .";
	}
	return `<pre class="submission-lite ${submission.status === SubmissionLiteStatus.danger ? "submission-not-passed" : "submission-passed"
		}">${submission.display}</pre>&nbsp&nbsp(#${submission.id})`;
}

export function getProblemContent(webview: Webview, extensionUri: Uri, problem: Problem): string {
	const samples = (problem.samples ??= []).map(sample => {
		return `<vscode-data-grid-row class="samples-row">
			<vscode-data-grid-cell grid-column="1" class="samples-cell head"><pre>${sample[0]}</pre></vscode-data-grid-cell>
			<vscode-data-grid-cell grid-column="2" class="samples-cell"><pre>${sample[1]}</pre></vscode-data-grid-cell>
			</vscode-data-grid-row>`;
	});

	const restricts = (problem.restictWord ??= []).map(sample => {
		return "<code>" + sample + "</code>";
	});
	const rest = (
		restricts.length > 0 ? restricts.join(", "): "<i>No Restrict</i>"
	);

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
				<a href="https://ejudge.it.kmitl.ac.th/problem/${problem.id}">Problem page</a>
				<base href="https://ejudge.it.kmitl.ac.th/">
			</header>
			<div class="problem-body">
				<vscode-data-grid aria-label="Basic">
					<vscode-data-grid-row>
						<vscode-data-grid-cell grid-column="1">Deadline</vscode-data-grid-cell>
						<vscode-data-grid-cell grid-column="2">${problem.deadline?.toLocaleString()}</vscode-data-grid-cell>
					</vscode-data-grid-row>
					<vscode-data-grid-row>
						<vscode-data-grid-cell grid-column="1">Restrict Words</vscode-data-grid-cell>
						<vscode-data-grid-cell grid-column="2">${rest}</vscode-data-grid-cell>
					</vscode-data-grid-row>
					<vscode-data-grid-row>
						<vscode-data-grid-cell grid-column="1">Your Score</vscode-data-grid-cell>
						<vscode-data-grid-cell grid-column="2">${getSubmissionLiteHTML(problem.lastSubmission)}</vscode-data-grid-cell>
					</vscode-data-grid-row>
				</vscode-data-grid>
				<vscode-divider></vscode-divider>
				<vscode-panels>
					<vscode-panel-tab id="tab-1">Description</vscode-panel-tab>
					<vscode-panel-tab id="tab-2">
						Specification & Samples
						<vscode-badge appearance="secondary">${problem.samples.length}</vscode-badge>
					</vscode-panel-tab>
					<vscode-panel-view id="view-1">
						<div class="problem-description">
							${problem.descRaw ??= ". . ."}
						</div>
					</vscode-panel-view>
					<vscode-panel-view id="view-2">
						<div class="samples-body">
							<h3>Specification</h3>
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
							<vscode-divider></vscode-divider>
							<h3>Samples</h3>
							<vscode-data-grid aria-label="Basic">
								<vscode-data-grid-row row-type="header">
									<vscode-data-grid-cell cell-type="columnheader" grid-column="1">Input</vscode-data-grid-cell>
									<vscode-data-grid-cell cell-type="columnheader" grid-column="2">Output</vscode-data-grid-cell>
								</vscode-data-grid-row>
								${samples.join('')}
							</vscode-data-grid>
						</div>
					</vscode-panel-view>
				</vscode-panels>
			</div>
		  </body>
		</html>
	  `;
}

export function getLoadingContent(webview: Webview, extensionUri: Uri, title: string): string {
	return `
		<!DOCTYPE html>
		<html lang="en">
			<head>
				${getMetaAndScriptTabs(webview, extensionUri, "")}
				<title>${title}</title>
		 	</head>
			<body id="webview-body">
				<div class="loading-box">
					<vscode-progress-ring class="loading-box-center"></vscode-progress-ring>
					<h3>Loading . . .</h3>
				</div>
			</body>
		</html>
	`;
}