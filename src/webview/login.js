const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {
	document.getElementById("login-button").addEventListener("click", () => {
		vscode.postMessage({
			command: "login",
			username: document.getElementById("username").value,
			password: document.getElementById("password").value,
			remember: document.getElementById("remember").checked
		});
	});
	document.getElementById("cancel-button").addEventListener("click", () => {
		vscode.postMessage({
			command: "cancel",
		});
	});
}
