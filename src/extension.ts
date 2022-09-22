import * as vscode from 'vscode';
import { EJudge, Problem } from './ejudge';
import { getProblemContent } from './webview';
import { EJudgeCourseTreeProvider } from './provider';


const EXTENSION_NAME: String = "ejudge-submitter";

const student: EJudge = new EJudge("?EJudgeUsername", "?EJudgePassword");


export function activate(context: vscode.ExtensionContext) {
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

	/* WebView */
	let panel: vscode.WebviewPanel | undefined = undefined;
	const provider = new EJudgeCourseTreeProvider(student);

	const treeView = vscode.window.createTreeView("ejudge-submitter.courseTree", {
		treeDataProvider: provider,
		showCollapseAll: false,
	});

	provider.refresh();

	const openProblem = vscode.commands.registerCommand(EXTENSION_NAME + '.openProblem', (problemID: number) => {
		student.getProblem(problemID).then(problem => {
			if (!panel) {
				// create a new one
				panel = vscode.window.createWebviewPanel("problemDetail", "<@@@>", vscode.ViewColumn.One, {
					enableScripts: true,
				});
			}
			panel.title = problem.title ??= "<undefined>";
    		panel.webview.html = getProblemContent(panel.webview, context.extensionUri, problem);
			panel.webview.onDidReceiveMessage((message) => {});
		});
	});
	context.subscriptions.push(openProblem);
}

export function deactivate() { }

