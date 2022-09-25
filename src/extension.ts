import * as vscode from 'vscode';
import { EJudge, Problem } from './ejudge';
import { getProblemContent, getLoginContent, getLoadingContent } from './webview';
import { EJudgeCourseTreeProvider } from './provider';

const EXTENSION_NAME: String = "ejudge-submitter";

let panel: vscode.WebviewPanel | undefined = undefined;

function getWebview(context: vscode.ExtensionContext): vscode.WebviewPanel {
	if (!panel) {
		panel = vscode.window.createWebviewPanel("problemDetail", "<@@@>", vscode.ViewColumn.Beside, {
			enableScripts: true,
		});
		panel.onDidDispose(
			() => {
				panel = undefined;
			},
			null,
			context.subscriptions
		);
	}
	return panel;
}

export function activate(context: vscode.ExtensionContext) {
	const student: EJudge = new EJudge(context.workspaceState.get("cookies", []));

	student.onCookiesChanged = (cookies: string[]) => {
		context.workspaceState.update("cookies", cookies);
	};

	student.onLogin = (m: string): Promise<{
		username: string;
		password: string;
		remember: boolean;
	}> => {
		return new Promise<{
			username: string;
			password: string;
			remember: boolean;
		}>((resolve, reject) => {
			const after = (message: any) => {
				if (message.command === "login") {
					resolve({
						username: message.username,
						password: message.password,
						remember: message.remember,
					});
				} else if (message.command === "cancel") {
					reject();
				}
			};
			const panel = getWebview(context);
			panel.title = "Login";
			panel.webview.html = getLoginContent(panel.webview, context.extensionUri, m);
			panel.webview.onDidReceiveMessage(after);
		});

	};

	student.onLoginSuccess = () => {
		if (!panel) {
			return;
		}

		if (panel.title === "Login") {
			panel.dispose(); // close the login panel
		}
	};

	/* Login */
	const login = vscode.commands.registerCommand(EXTENSION_NAME + '.login', () => {

	});
	context.subscriptions.push(login);

	/* WebView */




	/* Tree (Provider) */
	const provider = new EJudgeCourseTreeProvider(student);
	const treeView = vscode.window.createTreeView("ejudge-submitter.courseTree", {
		treeDataProvider: provider,
		showCollapseAll: false,
	});

	provider.refresh();

	const openProblem = vscode.commands.registerCommand(EXTENSION_NAME + '.openProblem', (problemID: number) => {
		const panel = getWebview(context);
		panel.title = `Problem #${problemID}`;
		panel.webview.html = getLoadingContent(panel.webview, context.extensionUri, panel.title);

		student.getProblem(problemID).then((problem) => {
			panel.title = `${problem.title} (#${problemID})`;
			panel.webview.html = getProblemContent(panel.webview, context.extensionUri, problem);
		});
	});
	context.subscriptions.push(openProblem);
}

export function deactivate() { }

