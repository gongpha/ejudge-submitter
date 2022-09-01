import * as vscode from 'vscode';
import EJudge from './ejudge';


const EXTENSION_NAME : String = "ejudge-submitter";

const student : EJudge = new EJudge("USER", "PASS");


export function activate(context: vscode.ExtensionContext) {
	const command = EXTENSION_NAME + '.submitProblem';

	vscode.window.showInformationMessage("Gathering data from <e>judge . . .");

	

	
	const commandHandler = async () => {
		const problemIDRaw = await vscode.window.showInputBox({
			value: '',
			placeHolder: 'Type a problem ID (https://ejudge.it.kmitl.ac.th/problem/XXX)',
		});
	
		if (!problemIDRaw) {
			return;
		}
	
		const problemID : number = parseInt(problemIDRaw);
		vscode.window.showInformationMessage(`Submitting code to #${problemID}`);

		// try ^^
		student.getProblem(problemID)
		.then(problem => {
			console.log("k");
		})
		.catch(r => vscode.window.showErrorMessage);
	};
	
	context.subscriptions.push(vscode.commands.registerCommand(command, commandHandler));
}

export function deactivate() {}
