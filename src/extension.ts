import * as vscode from 'vscode';
import { EJudge, Problem } from './ejudge';
import { getProblemContent, getLoginContent } from './webview';
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

	context.subscriptions.push(vscode.commands.registerCommand(EXTENSION_NAME + '.submitProblem', async () => {
		vscode.window.showInformationMessage("Gathering data from <e>judge . . .");

		const problemIDRaw = await vscode.window.showInputBox({
			value: '',
			placeHolder: 'Type a problem ID (https://ejudge.it.kmitl.ac.th/problem/XXX)',
		});

		if (!problemIDRaw) {
			return;
		}

		const problemID: number = parseInt(problemIDRaw);
		vscode.window.showInformationMessage(`Submitting code to #${problemID}`);

		// try ^^
		student.getProblem(problemID)
			.then(problem => {
				console.log("k");
			})
			.catch(r => vscode.window.showErrorMessage);
	}));

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
		return;
	});
	context.subscriptions.push(openProblem);
}

export function deactivate() { }

