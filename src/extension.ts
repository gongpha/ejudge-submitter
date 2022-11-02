import * as vscode from 'vscode';
import {
	EJudge, Problem, Authentication, Account, SubmissionCaseStatus,
	Submission
} from './ejudge';
import {
	getProblemContent, getLoginContent, getLoadingContent,
	getSubmissionLiteHTML
} from './webview';
import { EJudgeCourseTreeProvider } from './provider';
import CancelablePromise from './util/cancelable_promise';
import { spawn } from 'child_process';
import path = require('path');
const sha1 = require('sha1');

const EXTENSION_NAME: String = "ejudge-submitter";

let panel: vscode.WebviewPanel | undefined = undefined;
//let panelSubmission: vscode.WebviewPanel | undefined = undefined;

let panelLoading: CancelablePromise<any> | undefined;
let problemDisp: vscode.Disposable | undefined = undefined;

let currentTextEditor: vscode.TextEditor | undefined = undefined;

let currentSubmission: Submission | undefined;

function closeAllPanel() {
	panel?.dispose();
}

function setCurrentSubmission(submission: Submission | undefined, knownFinished: boolean = false) {
	currentSubmission = submission;
	updateSubmissionToPanel(currentSubmission, knownFinished);
}

function updateSubmissionToPanel(submission: Submission | undefined, knownFinished: boolean = false) {
	if (panel) {
		panel.webview.postMessage({
			command: "submission_update",
			submission: submission,
			currentSubmission: currentSubmission,
			knownFinished: knownFinished
		});
	}
}

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

	function setMeToStatusBar() {
		student.getMyAccountOrGuest().then(account => {
			myAccount = account;
			setAccountToStatusBar();
		}).catch(r => {
			vscode.window.showErrorMessage("Login failed : " + r);
		});
	};

	function setAccountToStatusBar(account: Account | undefined = myAccount) {
		if (account === undefined) {
			item.text = "$(code)$(accounts-view-bar-icon) Guest";
			item.tooltip = "Logging as Guest";
		} else {
			item.text = `$(code)$(accounts-view-bar-icon) ${account.username}`;
			item.tooltip = `Logging as ${account.fullname} (${account.username})`;
		}

		if (currentSubmission !== undefined) {
			item.tooltip += ` (Pending Submission: ${currentSubmission.id})`;
		}
	};

	student.onLogin = (m: string): Promise<Authentication> => {
		return new Promise<Authentication>((resolve, reject) => {
			setAccountToStatusBar(undefined);

			const after = (message: any) => {
				let title: string = "@@@";
				if (message.command === "login") {
					title = "Logging in...";
					panel.webview.html = getLoadingContent(panel.webview, context.extensionUri, title);
					resolve({
						username: message.username,
						password: message.password,
						remember: message.remember,
					});
				} else if (message.command === "cancel") {
					reject();
					title = "Canceling...";
					panel.dispose();
				}
			};
			const panel = getWebview(context);
			panel.title = "Login to <e>judge";
			panel.webview.html = getLoginContent(panel.webview, context.extensionUri, m);
			panel.webview.onDidReceiveMessage(after);
		});

	};

	student.onLoginSuccess = () => {
		if (panel) {
			panel.dispose(); // close the login panel
			provider.refresh(); // refresh the tree
		}
	};

	function loginCommand() {
		student.attemptLogin().then(r => {
			setMeToStatusBar();
		}).catch(r => {
			//vscode.window.showErrorMessage("Login failed : " + r);
		}); // do nothing
	};

	function logoutCommand() {
		student.tryLogout().then(r => {
			myAccount = undefined;
			setAccountToStatusBar();
			closeAllPanel();
			provider.clear();
		});
	};

	function getHeader(problem: Problem, source: string): string[] {
		/* !!! CUSTOM YOUR HEADER HERE !!! */
		return [
			`${sha1(source)}`,
			`${sha1(problem.uploadToken)}`,
			`${sha1(problem.id)}`,
		];
	}

	function getFooter(problem: Problem, source: string): string[] {
		/* !!! CUSTOM YOUR FOOTER HERE !!! */
		return getHeader(problem, source).reverse();
	}

	/* ----------------------------------- */

	// when open another file
	const dotdDisp = vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor | undefined) => {
		if (e === undefined) {
			return;
		}

		currentTextEditor = e;
		splashUpdateFile();
	});

	function splashUpdateFile() {
		if (panel) {
			panel.webview.postMessage({
				command: "file_update",
				filename: currentTextEditor ? path.basename(currentTextEditor.document.fileName) : undefined,
				currentSubmission: currentSubmission
			});
		}
	};

	context.subscriptions.push(dotdDisp);

	/* Login */
	const login = vscode.commands.registerCommand(EXTENSION_NAME + '.login', loginCommand);
	context.subscriptions.push(login);
	const logout = vscode.commands.registerCommand(EXTENSION_NAME + '.logout', logoutCommand);
	context.subscriptions.push(logout);

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

	// const openSubmission = vscode.commands.registerCommand(EXTENSION_NAME + '.openSubmission', (submissionID: number) => {
	// 	const panel = getWebview(context);
	// 	panel.title = `Submission #${submissionID}`;
	// 	panel.webview.html = getLoadingContent(panel.webview, context.extensionUri, panel.title);
	// 	if (panelLoading !== undefined) {
	// 		panelLoading.cancel();
	// 	}
	// 	panelLoading = new CancelablePromise<Submission>(student.getSubmission(submissionID));
	// 	panelLoading.promise.then((submission) => {
	// 		panelLoading = undefined;
	// 		panel.webview.html = getSubmissionContent(panel.webview, context.extensionUri, submission);
	// 	});
	// });

	const openProblem = vscode.commands.registerCommand(EXTENSION_NAME + '.openProblem', (problemID: number) => {
		const panel = getWebview(context);
		panel.title = `Problem #${problemID}`;
		panel.webview.html = getLoadingContent(panel.webview, context.extensionUri, panel.title);

		if (panelLoading !== undefined) {
			panelLoading.cancel();
		}
		panelLoading = new CancelablePromise<Problem>(student.getProblem(problemID));
		panelLoading.promise.then((problem: Problem) => {
			panelLoading = undefined;
			panel.title = `${problem.title} (#${problemID})`;
			panel.webview.html = getProblemContent(panel.webview, context.extensionUri, problem);
			if (problemDisp !== undefined) {
				problemDisp.dispose();
			}

			// load last submission of the problem
			if (problem.lastSubmission) {
				student.getSubmission(problem.lastSubmission.id).then((submission) => {
					updateSubmissionToPanel(submission);
				});
			}

			splashUpdateFile();

			problemDisp = panel.webview.onDidReceiveMessage((message) => {

				if (currentTextEditor?.document?.fileName === undefined) {
					vscode.window.showInformationMessage("No editor is active");
					return;
				}
				if (message.command === "test_sample") {
					tryCases(problem, currentTextEditor.document.fileName, context.extensionUri).then(r => {
						panel.webview.postMessage({
							command: "done",
							result: r
						});
					});
				} else if (message.command === "judge") {
					const source = currentTextEditor.document.getText();
					student.sendJudge(problem,
						source,
						path.basename(currentTextEditor.document.fileName),
						getHeader(problem, source), getFooter(problem, source)
					).then(r => {
						panel.webview.postMessage({
							command: "focus_panels",
							panel: 3
						});
						setCurrentSubmission(r);
					});
				} else if (message.command === "force_refresh") {
					if (currentSubmission === undefined) {
						vscode.window.showErrorMessage("No submission to refresh");
						return;
					}
					student.getSubmission(currentSubmission.id).then(r => {
						// compare
						let finished = false;
						if (r.cases?.length === 0) {
							// still being judged. continue
							finished = false;
						} else if (r.cases?.length === currentSubmission?.cases?.length) {
							// FINISHED
							finished = true;
						}

						if (finished) {
							setCurrentSubmission(r, true);
							currentSubmission = undefined;
						} else {
							setCurrentSubmission(r);
						}
					});
				}
			});
			context.subscriptions.push(problemDisp);
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
	filename: string;
}

function tryCases(problem: Problem, filePath: string, extensionUri: vscode.Uri): Promise<TestResult> {
	function test(idx: number): Promise<TestCaseResult> {
		return new Promise<TestCaseResult>((resolve, reject) => {
			const caseItem = problem.samples![idx];
			const params = [(
				vscode.Uri.joinPath(extensionUri, "src", "testsrc.py").fsPath
			), filePath, JSON.stringify(caseItem[0]).slice(1, -1), JSON.stringify(caseItem[1]).slice(1, -1)];
			let child = spawn('python', params);

			child.stdout.on('data', function (data) {
				const output: string = data.toString().trim();
				let result: SubmissionCaseStatus;
				let desc: string = "";
				if (output === 't') {
					result = SubmissionCaseStatus.passed;
				} else if (output === 'f') {
					result = SubmissionCaseStatus.incorrect;
				} else {
					result = SubmissionCaseStatus.error;
					desc = output.substring(1);
					if (desc === "EOFError") {
						desc += " (Not enough input)";
					}
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
		const filename = path.basename(filePath);
		const samples = problem.samples;
		if (samples === undefined) {
			resolve({
				results: [],
				passed: true,
				filename: filename
			});
			return;
		}
		let idx = 0;

		const result: TestResult = {
			results: [],
			passed: true,
			filename: filename
		};

		testLoop(result, samples).then(() => {
			resolve(result);
		}).catch((err) => reject(err));
	});

}


export function deactivate() { }

