import { EJudge, UserActivity, Account } from "./ejudge";
import CancelablePromise from './util/cancelable_promise';
import { getLoadingContent, getMetaAndScriptTabs } from './webview';
import vscode = require("vscode");

export class EJudgeStalker {
	ejudge: EJudge;
	context: vscode.ExtensionContext;
	panel: vscode.WebviewPanel | undefined = undefined;
	task: CancelablePromise<void> | undefined = undefined;

	cacheAccount = new Map<number, Account>();

	constructor(ejudge: EJudge, context: vscode.ExtensionContext) {
		this.ejudge = ejudge;
		this.context = context;
	}

	launch() {
		if (this.panel) {
			this.panel.reveal();
			return;
		}
		
		this.panel = vscode.window.createWebviewPanel("userStalker", "User Stalker", vscode.ViewColumn.Beside, {
			enableScripts: true, localResourceRoots: [
				this.context.extensionUri
			]
		});
		this.context.subscriptions.push(this.panel);
		this.panel.onDidDispose(
			() => this.shutdown(),
			null,
			this.context.subscriptions
		);

		this.panel.webview.html = getLoadingContent(this.panel.webview, this.context.extensionUri, "User Stalker");

		console.log("Stalker launched!");

		// run fetch every 5 seconds
		this.task = new CancelablePromise<void>(new Promise<void>((resolve, reject) => {
			setInterval(() => {
				this.fetch();
			}, 5000);
		}));

		this.fetch();
	}

	fetch() {
		this.ejudge.getUserOnline().then(users => {
			this.update(users);
		});
	}

	shutdown() {
		// bye
		console.log("Stalker shutdown!");
		if (this.task) { this.task.cancel(); }
		if (this.panel) {
			this.panel.dispose();
		}
	}

	update(users: UserActivity[]) {
		// render users
		Promise.all(users.map((userAct) => {
			if (this.cacheAccount.has(userAct.account.id)) {
				return Promise.resolve(this.cacheAccount.get(userAct.account.id));
			}
			return new Promise<Account>((resolve, reject) => {
				this.ejudge.getAccount(userAct.account.id).then((acc) => {
					this.cacheAccount.set(userAct.account.id, acc);
					resolve(acc);	
				});
			});
		})).then(accounts => this.render(accounts));
	}

	render(accounts: (Account | undefined)[]) {
		this.panel!.title = `${accounts.length} online`;

		const accountAvatar = (acc: Account | undefined): string => {
			if (!acc) { return ""; }
			return `<img title="${acc.fullname} (${acc.username})" class="stalker-profile-pic" src="${acc.profilePicURL}" alt="avatar" />`;
		};

		this.panel!.webview.html = `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					${getMetaAndScriptTabs(this.panel!.webview, this.context.extensionUri, "")}
					<title>${accounts.length} online</title>
				</head>
				<body id="webview-body">
					${accounts.map(accountAvatar).join("")}
				</body>
			</html>
		`;
	}
}