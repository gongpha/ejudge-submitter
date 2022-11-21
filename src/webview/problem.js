const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

let button, testing, testResult, judgeButton;

function renderResult(results, fromServer = false) {
	let res = "";

	if (fromServer) {
		res = "<vscode-data-grid aria-label=\"Basic\">";
	}

	results.forEach((element, i) => {
		let classStyle = "";
		let statusText = "";

		function putDescription() {
			return `
					<vscode-data-grid-cell grid-column="3">
						<pre class="submission-lite submission-time">${element.desc}</pre>
					</vscode-data-grid-cell>
				`;
		}

		if (fromServer) {
			let col3 = element.timeString === undefined ? "" : `
				<vscode-data-grid-cell grid-column="3">
					<pre class="submission-lite submission-time">${element.timeString}</pre>
				</vscode-data-grid-cell>
			`;
			if (element.status === 0) {
				statusText = "Passed";
				classStyle = "submission-passed";
			} else if (element.status === 1) {
				statusText = "Error";
				classStyle = "submission-error";
				col3 = putDescription();
			} else if (element.status === 2) {
				statusText = "Incorrect";
				classStyle = "submission-not-passed";
			} else if (element.status === 3) {
				statusText = "Timeout";
				classStyle = "submission-timeout";
				col3 = '';
			} else if (element.status === 4) {
				statusText = "Memory Error";
				classStyle = "submission-error";
				col3 = '';
			} else {
				statusText = "Restrict Word";
				classStyle = "submission-error";
				col3 = putDescription();
			}

			res += `
				<vscode-data-grid-row>
					<vscode-data-grid-cell grid-column="1">${element.caseHeader}</vscode-data-grid-cell>
					<vscode-data-grid-cell grid-column="2"><pre class="submission-lite ${classStyle}">${statusText}</pre></vscode-data-grid-cell>
					${col3}
				</vscode-data-grid-row>
			`;
		} else {
			if (element.status === 0) {
				statusText = "Passed";
				classStyle = "submission-passed";
			} else if (element.status === 1) {
				statusText = "Error : " + element.description;
				classStyle = "submission-error";
			} else if (element.status === 3) {
				statusText = "Timeout (+5 sec.)";
				classStyle = "submission-timeout";
			} else {
				statusText = "Incorrect";
				classStyle = "submission-not-passed";
			}

			let timestr = "";
			if (element.time !== undefined) {
				timestr = ` : ${(element.time).toFixed(8)} sec.`;
			}

			res += `<pre class="tested-item ${classStyle}">(#${i + 1}) ${statusText}${timestr}</pre>`;
		}
	});
	if (fromServer) {
		res += "</vscode-data-grid>";
	}
	return res;
}

function renderSubmission(submission) {
	let quality = "";
	let summary = "";

	if (submission.quality !== undefined) {
		const is100percent = submission.quality.percent === 100;
		quality = `
		<vscode-data-grid-row>
			<vscode-data-grid-cell grid-column="1">Quality</vscode-data-grid-cell>
			<vscode-data-grid-cell grid-column="2"><pre class="submission-lite ${is100percent ? "submission-quality-100" : "submission-quality-under-100"
			}">${submission.quality.percent}%</pre></vscode-data-grid-cell>
		</vscode-data-grid-row>
		`;

		if (!is100percent) {
			summary += `
			<vscode-divider></vscode-divider>
			<h3>Summary</h3>
			<pre class=" submission-summary-highlight submission-quality-under-100">${submission.quality.summary}</pre>
			`;
		}
	}

	// count items

	let badgeCorrect = 0;
	let badgeIncorrect = 0;
	submission.cases.forEach((element, i) => {
		if (element.status === 0) {
			badgeCorrect++;
		} else {
			badgeIncorrect++;
		}
	});

	submissionBadgePassed.innerText = badgeCorrect.toString();
	submissionBadgeIncorrect.innerText = badgeIncorrect.toString();

	return `
	<vscode-data-grid aria-label="Basic">
		<vscode-data-grid-row>
			<vscode-data-grid-cell grid-column="1">ID</vscode-data-grid-cell>
			<vscode-data-grid-cell grid-column="2">${submission.id}</vscode-data-grid-cell>
		</vscode-data-grid-row>
		${quality}
		<vscode-data-grid-row>
			<vscode-data-grid-cell grid-column="1">Summary Score</vscode-data-grid-cell>
			<vscode-data-grid-cell grid-column="2">${submission.summaryScore}</vscode-data-grid-cell>
		</vscode-data-grid-row>
		<vscode-data-grid-row>
			<vscode-data-grid-cell grid-column="1">Timestamp</vscode-data-grid-cell>
			<vscode-data-grid-cell grid-column="2">${submission.timestamp.toLocaleString()}</vscode-data-grid-cell>
		</vscode-data-grid-row>
	</vscode-data-grid>
	${summary}
	<vscode-divider></vscode-divider>
	${renderResult(submission.cases, true)}
	`;
}

function renderSubmissionLite(submission) {
	if (!submission) {
		return "<pre class=\"submission-lite submission-time\". . .</pre>";
	}
	if ("problemID" in submission) {
		// Client-side rendering a submission lite of submission
		let status = submission.cases?.length === knownTestCases ? "submission-passed" : "submission-time";
		let label = "";

		for (const caseItem of submission.cases ?? []) {
			if (caseItem.status === 1) {
				status = "submission-not-passed";
				label += "E";
			} else if (caseItem.status === 2) {
				status = "submission-not-passed";
				label += "-";
			} else if (caseItem.status === 4) {
				status = "submission-not-passed";
				label += "M";
			} else if (caseItem.status === 5) {
				status = "submission-not-passed";
				label += "R";
			} else if (caseItem.status === 3) {
				status = "submission-not-passed";
				label += "T";
			} else if (caseItem.status === 0) {
				label += "P";
			}
		}

		for (let i = submission.cases?.length ?? 0; i < knownTestCases; i++) {
			label += ".";
		}

		if (label.length >= 32) {
			label = label.substring(0, 32) + " ...";
		}

		if (label === "") {
			label = ". . .";
		}

		return `<pre class="submission-lite ${status}"
				}">${label}</pre>&nbsp&nbsp(#${submission.id})`;
	}
	return `<pre class="submission-lite ${submission.status === 2 ? "submission-not-passed" : "submission-passed"
		}">${submission.display}</pre>&nbsp&nbsp(#${submission.id})`;
}

let filename = undefined;
let currentSubmission = undefined;
let submission = undefined;
let knownTestCases = 0;

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
				${(() => renderResult(message.result.results))()}
			`;

			break;
		case 'file_update':
			filename = message.filename;
			update();
			break;
		case 'submission_update':
			submission = message.submission;
			currentSubmission = message.currentSubmission;
			knownTestCases = message.knownTestCases;
			update();
			break;
		case 'focus_panels':
			mainPanels.setAttribute('activeid', `tab-${message.panel}`);
			break;
	}
});

function update() {
	let htmlSubmission = "Press \"Judge\" to judge this problem";

	let testText = "Test Sample";
	let judgeText = "Judge (...)";
	let textDisabled = true;
	let judgeDisabled = true;
	let refreshHidden = true;

	let targetSubmission = submission;

	if (currentSubmission) {
		refreshHidden = false;
		if (currentSubmission.problemID === submission.problemID) {
			// match
			judgeText = 'Judging';
			htmlSubmission = "Currently judging" + `
				<vscode-progress-ring></vscode-progress-ring>
			`;
			targetSubmission = currentSubmission;
		} else {
			judgeText = 'Judge (Busying)';
			htmlSubmission = `Currently judging another problem. (Problem #${currentSubmission.problemID})`;
		}
	} else {
		if (filename === undefined) {
			judgeText = 'Judge (No active file)';
		} else {
			judgeDisabled = false;
			judgeText = `Judge (${filename})`;

		}
	}

	if (filename === undefined) {
		testText = 'Test Sample (No active file)';
	}
	else {
		textDisabled = false;
		testText = `Test Sample (${filename})`;
	}

	button.innerHTML = testText;
	button.disabled = textDisabled;
	judgeButton.innerHTML = judgeText;
	judgeButton.disabled = judgeDisabled;
	submissionForceRefresh.disabled = false;
	submissionForceRefresh.hidden = refreshHidden;

	if (targetSubmission) {
		htmlSubmission += renderSubmission(targetSubmission);
		submissionsView.innerHTML = htmlSubmission;
		sublite.innerHTML = renderSubmissionLite(targetSubmission);
	}
}
let submissionBadgePassed, submissionBadgeIncorrect, submissionsView;
let submissionForceRefresh, idLink, mainPanels, sublite;

function main() {
	button = document.getElementById("test-sample-button");
	testing = document.getElementById("testing");
	testResult = document.getElementById("test-result");
	judgeButton = document.getElementById("judge-button");
	submissionBadgePassed = document.getElementById("submission-badge-passed");
	submissionBadgeIncorrect = document.getElementById("submission-badge-incorrect");
	submissionForceRefresh = document.getElementById("submission-force-refresh");
	submissionsView = document.getElementById("submissions-view");
	idLink = document.getElementById("id-link");
	mainPanels = document.getElementById("main-panels");
	sublite = document.getElementById("sublite");

	testing.hidden = true;
	update();


	button.addEventListener("click", () => {
		testing.hidden = false;
		button.hidden = true;
		testResult.innerHTML = "";
		vscode.postMessage({
			command: "test_sample",
		});
	});

	judgeButton.addEventListener("click", () => {
		vscode.postMessage({
			command: "judge",
		});
		judgeButton.disabled = true;
	});

	submissionForceRefresh.addEventListener("click", () => {
		vscode.postMessage({
			command: "force_refresh",
		});
		submissionForceRefresh.disabled = true;
	});

	vscode.postMessage({
		command: "fetch"
	});
}