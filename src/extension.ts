import * as vscode from 'vscode';
import {
	EJudge, Problem, Authentication, Account, SubmissionCaseStatus,
	Submission
} from './ejudge';
import {
	getProblemContent, getLoginContent, getLoadingContent
} from './webview';
import { EJudgeCourseTreeProvider } from './provider';
import CancelablePromise from './util/cancelable_promise';
import { spawn } from 'child_process';
import path = require('path');
import { formatBlock } from './util/stringtool';

let panel: vscode.WebviewPanel | undefined = undefined;

let panelLoading: CancelablePromise<any> | undefined;
let problemDisp: vscode.Disposable | undefined = undefined;

let currentTextEditor: vscode.TextEditor | undefined = undefined;

let judgingSubmission: Submission | undefined;
let judgingProblem: Problem | undefined;
let showingSubmission: Submission | undefined;

function closeAllPanel() {
	panel?.dispose();
}

function updateSubmissionToPanel(knownTestCases: number | undefined) {
	if (panel) {
		panel.webview.postMessage({
			command: "submission_update",
			submission: showingSubmission,
			currentSubmission: judgingSubmission,
			knownTestCases: knownTestCases,
		});
	}
}

function getWebview(context: vscode.ExtensionContext): vscode.WebviewPanel {
	if (!panel) {
		panel = vscode.window.createWebviewPanel("problemDetail", "<@@@>", vscode.ViewColumn.Beside, {
			enableScripts: true, localResourceRoots: [
				context.extensionUri
			]
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

	function strFormat(s: string) {
		let i = 0, args = arguments;
		return s.replace(/{}/g, function () {
			return typeof args[i] !== 'undefined' ? args[i++] : '';
		});
	};

	function parseCustomComment(problem: Problem, raw: string): string[] {
		if (raw === "") { return []; }
		return [
			formatBlock(raw, {
				"username": myAccount?.username ?? "Guest",
				"fullname": myAccount?.fullname ?? "Guest",

				"problemID": problem.id.toString(),
				"problemTitle": problem.title ?? "<unknown>",
			})
		];
	}

	function getHeader(problem: Problem, source: string): string[] {
		/* !!! CUSTOM YOUR HEADER HERE !!! */
		return parseCustomComment(problem, vscode.workspace.getConfiguration('ejudge-submitter').get('uploadHeader', '') || '');
	}

	function getFooter(problem: Problem, source: string): string[] {
		/* !!! CUSTOM YOUR FOOTER HERE !!! */
		return [];
		//return parseCustomComment(problem, vscode.workspace.getConfiguration().get('uploadFooter', '') || '');
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
				//currentSubmission: currentSubmission
			});
		}
	};

	context.subscriptions.push(dotdDisp);

	/* Login */
	const login = vscode.commands.registerCommand('login', loginCommand);
	context.subscriptions.push(login);
	const logout = vscode.commands.registerCommand('logout', logoutCommand);
	context.subscriptions.push(logout);

	/* Status bar */
	const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	item.command = "manageAccount";
	context.subscriptions.push(item);

	item.text = "$(sync~spin) Connecting to <e>judge";
	item.tooltip = "Waiting for connection";
	item.show();
	setMeToStatusBar();

	const manageAccount = vscode.commands.registerCommand('manageAccount', () => {
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
	const treeView = vscode.window.createTreeView("courseTree", {
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

	const openProblem = vscode.commands.registerCommand('openProblem', (problemID: number) => {
		const panel = getWebview(context);
		panel.title = `Problem #${problemID}`;
		panel.webview.html = getLoadingContent(panel.webview, context.extensionUri, panel.title);
		showingSubmission = undefined;

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

			function updateSubmission(r: Submission, update: boolean | "both") {
				if (update === "both") {
					judgingSubmission = r;
					showingSubmission = r;
				}
				else if (update) { judgingSubmission = r; } else { showingSubmission = r; }

				if (judgingProblem && judgingSubmission) {
					if (judgingSubmission.cases?.length === judgingProblem.testcases) {
						// FINISHED
						if (showingSubmission?.problemID === judgingSubmission.problemID) {
							// update both
							showingSubmission = judgingSubmission;
						}
						judgingSubmission = undefined;
					}
				}
				updateSubmissionToPanel(problem.testcases);
			}

			function fetch() {
				// load last submission of the problem
				if (problem.lastSubmission) {
					student.getSubmission(problem.lastSubmission.id).then(r => updateSubmission(r, false));
				}

				splashUpdateFile();
			}

			problemDisp = panel.webview.onDidReceiveMessage((message) => {
				if (message.command === "test_sample") {
					if (currentTextEditor === undefined) { return; }
					tryCases(problem, currentTextEditor.document.fileName, context.extensionUri).then(r => {
						panel.webview.postMessage({
							command: "done",
							result: r
						});
					});
				} else if (message.command === "judge") {
					if (currentTextEditor === undefined) { return; }
					const source = currentTextEditor.document.getText();
					student.sendJudge(problem,
						source,
						path.basename(currentTextEditor.document.fileName),
						getHeader(problem, source), getFooter(problem, source)
					).then(r => {
						judgingProblem = problem;
						panel.webview.postMessage({
							command: "focus_panels",
							panel: 3
						});
						updateSubmission(r, "both");
					});
				} else if (message.command === "force_refresh") {
					if (judgingSubmission === undefined) {
						vscode.window.showErrorMessage("No submission to refresh");
						return;
					}
					student.getSubmission(judgingSubmission.id).then(r => updateSubmission(r, true));
				} else if (message.command === "fetch") {
					fetch();
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
	time: number;
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
				vscode.Uri.joinPath(extensionUri, "src", "mini-ejudge.py").fsPath
			), filePath, JSON.stringify(caseItem[0]).slice(1, -1), JSON.stringify(caseItem[1]).slice(1, -1)];
			let child = spawn('python', params);

			function catchTime(out: string): number {
				return parseFloat(out.substring(1));
			}
			let time: number;

			child.stdout.on('data', function (data) {
				const output: string = data.toString().trim();
				let result: SubmissionCaseStatus;
				let desc: string = "";
				if (output[0] === 't') {
					result = SubmissionCaseStatus.passed;
					time = catchTime(output);
				} else if (output[0] === 'f') {
					result = SubmissionCaseStatus.incorrect;
					time = catchTime(output);
				} else {
					result = SubmissionCaseStatus.error;
					desc = output.substring(1);
					if (desc === "EOFError") {
						desc += " (Not enough input)";
					}
				}

				resolve({
					status: result,
					description: desc,
					time: time
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

