import * as vscode from 'vscode';
import { EJudge, Problem, Authentication, Account, SubmissionCaseStatus } from './ejudge';
import { getProblemContent, getLoginContent, getLoadingContent } from './webview';
import { EJudgeCourseTreeProvider } from './provider';
import CancelablePromise from './util/cancelable_promise';
import { spawn } from 'child_process';

const EXTENSION_NAME: String = "ejudge-submitter";

let panel: vscode.WebviewPanel | undefined = undefined;
let panelLoading: CancelablePromise<any> | undefined;

function getWebview(context: vscode.ExtensionContext): vscode.WebviewPanel {
	if (!panel) {
		panel = vscode.window.createWebviewPanel("problemDetail", "<@@@>", vscode.ViewColumn.Beside, {
			enableScripts: true,
		});
		context.subscriptions.push(panel);
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
	let myAccount: Account | undefined;

	student.onCookiesChanged = (cookies: string[]) => {
		context.workspaceState.update("cookies", cookies);
	};

	const setMeToStatusBar = () => {
		student.getMyAccountOrGuest().then(account => {
			myAccount = account;
			setAccountToStatusBar(myAccount);
		}).catch(r => {
			vscode.window.showErrorMessage("Login failed : " + r);
		});
	};

	const setAccountToStatusBar = (account: Account | undefined) => {
		if (account === undefined) {
			item.text = "$(code)$(accounts-view-bar-icon) Guest";
			item.tooltip = "Logging as Guest";
		} else {
			item.text = `$(code)$(accounts-view-bar-icon) ${account.username}`;
			item.tooltip = `Logging as ${account.fullname} (${account.username})`;
		}
	};

	student.onLogin = (m: string): Promise<Authentication> => {
		return new Promise<Authentication>((resolve, reject) => {
			setAccountToStatusBar(undefined);

			const after = (message: any) => {
				let title: string = "@@@";
				if (message.command === "login") {
					resolve({
						username: message.username,
						password: message.password,
						remember: message.remember,
					});
					title = "Logging in...";
				} else if (message.command === "cancel") {
					reject();
					title = "Canceling...";
				}
				panel.webview.html = getLoadingContent(panel.webview, context.extensionUri, title);
			};
			const panel = getWebview(context);
			panel.title = "Login to <e>judge";
			panel.webview.html = getLoginContent(panel.webview, context.extensionUri, m);
			panel.webview.onDidReceiveMessage(after);
		});

	};

	student.onLoginSuccess = () => {
		if (panel) {
			if (panel.title === "Login to <e>judge") {
				panel.dispose(); // close the login panel
			}
		}
	};

	const loginCommand = () => {
		student.attemptLogin().then(r => {
			setMeToStatusBar();
		}); // do nothing
	};

	const logoutCommand = () => {
		student.tryLogout().then(r => {
			myAccount = undefined;
			setAccountToStatusBar(myAccount);
		});
	};

	/* ----------------------------------- */


	/* Login */
	const login = vscode.commands.registerCommand(EXTENSION_NAME + '.login', loginCommand);
	context.subscriptions.push(login);
	const logout = vscode.commands.registerCommand(EXTENSION_NAME + '.logout', logoutCommand);
	context.subscriptions.push(login);

	/* Status bar */
	const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	item.command = "ejudge-submitter.manageAccount";
	context.subscriptions.push(item);

	item.text = "$(sync~spin) Connecting to <e>judge";
	item.tooltip = "Waiting for connection";
	item.show();
	setMeToStatusBar();

	const manageAccount = vscode.commands.registerCommand(EXTENSION_NAME + '.manageAccount', () => {
		const list: Array<vscode.QuickPickItem> = [];
		if (myAccount === undefined) {
			list.push({
				label: "Login",
				description: "Logging in to <E>Judge",
			});
		} else {
			list.push({
				label: "Logout",
				description: "Logging out from <E>Judge",
			});
		}

		vscode.window.showQuickPick(list).then((value) => {
			if (value === undefined) {
				return;
			}

			if (value.label === "Login") {
				loginCommand();
			}
			else if (value.label === "Logout") {
				logoutCommand();
			}
		});
	});
	context.subscriptions.push(manageAccount);

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

		if (panelLoading !== undefined) {
			panelLoading.cancel();
		}
		panelLoading = new CancelablePromise<Problem>(student.getProblem(problemID));
		panelLoading.promise.then((problem) => {
			panelLoading = undefined;
			panel.title = `${problem.title} (#${problemID})`;
			panel.webview.html = getProblemContent(panel.webview, context.extensionUri, problem);
			panel.webview.onDidReceiveMessage((message) => {
				if (message.command === "test_sample") {
					const editors = vscode.window.visibleTextEditors;
					if (editors.length === 0) {
						vscode.window.showInformationMessage("No editor is active");
						return;
					}
					const editor = editors[0];
					const filePath = editor.document.fileName;
					tryCases(problem, filePath, context.extensionUri).then(r => {
						panel.webview.postMessage({
							command:"done",
							result: r
						});
					});
				}
			});
		});
	});
	context.subscriptions.push(openProblem);
}

interface TestCaseResult {
	status: SubmissionCaseStatus;
	description: string;
}

interface TestResult {
	results: TestCaseResult[];
	passed: boolean;
}

function tryCases(problem: Problem, filePath: string, extensionUri: vscode.Uri): Promise<TestResult> {
	function test(idx: number): Promise<TestCaseResult> {
		return new Promise<TestCaseResult>((resolve, reject) => {
			const caseItem = problem.samples![idx];
			const params = [(
				vscode.Uri.joinPath(extensionUri, "src", "testsrc.py").fsPath
			), filePath, caseItem[0], caseItem[1]];
			let child = spawn('python', params);

			child.stdout.on('data', function (data) {
				const output = data.toString().trim();
				let result: SubmissionCaseStatus;
				let desc: string = "";
				if (output === 't') {
					result = SubmissionCaseStatus.passed;
				} else if (output === 'f') {
					result = SubmissionCaseStatus.incorrect;
				} else {
					result = SubmissionCaseStatus.error;
					desc = output;
				}

				resolve({
					status: result,
					description: desc
				});
				return;
			});
		});
	}

	function testLoop(result: TestResult, samples: string[][]): Promise<any> {
		return new Promise<any>((resolve, reject) => {
			test(result.results.length).then(r => {
				if (r.status !== SubmissionCaseStatus.passed) {
					result.passed = false;
				}
				result.results.push(r);
				if (result.results.length < samples.length) {
					testLoop(result, samples).then(result => {
						resolve(result);
					}).catch(err => reject(err));
				} else {
					resolve(result);
				}
			}).catch(err => reject(err));
		});
	}

	return new Promise<TestResult>((resolve, reject) => {
		const samples = problem.samples;
		if (samples === undefined) {
			resolve({
				results: [],
				passed: true
			});
			return;
		}
		let idx = 0;

		const result: TestResult = {
			results: [],
			passed: true
		};

		testLoop(result, samples).then(() => {
			resolve(result);
		}).catch((err) => reject(err));
	});

}


export function deactivate() { }

