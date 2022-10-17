const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

let button, testing, testResult, judgeButton;

window.addEventListener('message', event => {
	const message = event.data; // The JSON data our extension sent

	switch (message.command) {
		case 'done':
			testing.hidden = true;
			button.hidden = false;

			testResult.innerHTML = `
				(${message.result.filename})
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
						} else if (element.status === 1) {
							statusText = "Error : " + element.description;
							classStyle = "submission-not-passed";
						} else {
							statusText = "Incorrect";
							classStyle = "submission-not-passed";
						}

						res += `<pre class="tested-item ${classStyle}">(#${i + 1}) ${statusText}</pre>`;
					});
					return res;
				})()}
			`;

			break;
		case 'file_update':
			updateFile(message.filename);
			break;
	}
});

function updateFile(filename) {
	console.log(filename);
	if (filename === undefined) {
		judgeButton.disabled = true;
		judgeButton.innerHTML = 'Judge (No active file)';
		button.disabled = true;
		button.innerHTML = 'Test sample (No active file)';
	} else {
		judgeButton.disabled = false;
		judgeButton.innerHTML = `Judge (${filename})`;
		button.disabled = false;
		button.innerHTML = `Test sample (${filename})`;
	}
}

function main() {
	button = document.getElementById("test-sample-button");
	testing = document.getElementById("testing");
	testResult = document.getElementById("test-result");
	judgeButton = document.getElementById("judge-button");

	updateFile(undefined);

	testing.hidden = true;


	document.getElementById("test-sample-button").addEventListener("click", () => {
		testing.hidden = false;
		button.hidden = true;
		testResult.innerHTML = "";
		vscode.postMessage({
			command: "test_sample",
		});
	});

	document.getElementById("judge-button").addEventListener("click", () => {

	});
}