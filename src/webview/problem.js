const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

let button, testing, testResult;

window.addEventListener('message', event => {
	const message = event.data; // The JSON data our extension sent

	switch (message.command) {
		case 'done':
			testing.hidden = true;
			button.hidden = false;

			testResult.innerHTML = `
				${(message.result.passed) ? "Passed !" : "Failed !"}
				<br/>
				${(() => {
					let res = "";
					message.result.results.forEach((element, i) => {
						let classStyle = "";
						let statusText = "";

						if (element.status === 0) {
							statusText = "Passed";
							classStyle = "submission-passed";
						} else if (element.status === 0) {
							statusText = "Error";
							classStyle = "submission-not-passed";
						} else {
							statusText = "Incorrect";
							classStyle = "submission-not-passed";
						}
						
						res += `<pre class="tested-item ${classStyle}">(#${i}) ${statusText}</pre>`;
					});
					return res;
				})()}
			`;

			break;
	}
});

function main() {
	button = document.getElementById("test-sample-button");
	testing = document.getElementById("testing");
	testResult = document.getElementById("test-result");

	testing.hidden = true;


	document.getElementById("test-sample-button").addEventListener("click", () => {
		testing.hidden = false;
		button.hidden = true;
		vscode.postMessage({
			command: "test_sample",
		});
	});
	document.getElementById("cancel-button").addEventListener("click", () => {
		vscode.postMessage({
			command: "cancel",
		});
	});
}