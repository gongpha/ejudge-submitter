import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';

const URL_HEAD = 'https://ejudge.it.kmitl.ac.th';
const URL_LOGIN_NEW = '/auth/login';
const URL_LOGIN = '/auth/loggedin';
const URL_ACCOUNT_ME = '/account/me';
const URL_COURSE = '/course';
const URL_PROBLEM = '/problem';

export interface Course {
	id: number;

	title?: string;
	desc?: string;
	owner?: Account;
	release: Date;
	expire: Date;
	//descUpdatedDate : string;
	//whoUpdated : Account;

	problems?: Problem[];
	//quizzes <-- Soon(tm)
	students?: Account[];

	// other data will get setup here soon . . .
}

export interface Account {
	id: number;

	username?: string;
	fullname?: string;
	email?: string;
	desc?: string;
	profileURL?: string;

	//problems
	//quizzes

	// other data will get setup here soon . . .
}

export interface Quality {
	of: Submission;
	percent: number; // 0-100
	summary: string;
}

export enum SubmissionCaseStatus {
	passed,
	error,
	incorrect
}

export interface SubmissionCase {
	of: Submission;
	caseIndex: number;
	caseNumber: number;
	status: SubmissionCaseStatus;
	desc: string;
	time: number; // sec
}

export interface Submission {
	id: number;

	problem?: Problem;
	from?: Account;
	language?: string;
	correctnessScore?: number;
	bonusScore?: number;
	quality?: Quality;
	summaryScore?: number;
	timestamp?: Date;

	cases?: SubmissionCase[];
	code?: string;
}

export enum SubmissionLiteStatus {
	what,
	success,
	danger,
	warning
}

export interface SubmissionLite {
	id: number;

	problem: Problem;
	//from : Account;

	display: string;
	status: SubmissionLiteStatus;
}

export interface Problem {
	id: number;

	title?: string;
	descRaw?: string;
	specIn?: string;
	specOut?: string;

	samples?: string[][]; // in, out

	deadline?: Date
	restictWord?: string[];

	//fullScore? : number;
	//bonusScore? : number;

	lastSubmission?: SubmissionLite;

	// Front
	displayStatus?: SubmissionLiteStatus; // a checking button on "/course" page
	rank?: number; // stars (1 - 5)
	passed?: number;
	attempt?: number;

	// other data will get setup here soon . . .
}

function getStringOrEnv(that: string): string {
	if (that.startsWith('?')) {
		return process.env[that.substring(1)] ?? '';
	}
	return that;
}

export class EJudge {
	username: string = "";
	password: string = "";

	axiosInstance: AxiosInstance;


	webToken: string = "";

	cookies: string[] = [];

	constructor(cookies: string[] = []) {
		this.cookies = cookies;
		this.axiosInstance = axios.create({
			baseURL: URL_HEAD,
			maxRedirects: 0,
			validateStatus: function (status) {
				return status >= 200 && status < 303;
			}
		});
	}

	login(next: string | undefined): Promise<cheerio.CheerioAPI> {
		return new Promise<cheerio.CheerioAPI>((resolve, reject) => {
			const p = this.tryGetCheerOfURL(URL_LOGIN_NEW)
				.then($ => { this.loginWithCheer($, next).then($ => resolve($)); })
				.catch(r => reject);
		});
	}

	onCookiesChanged(cookies: string[]): void { }
	onLogin(message: string): Promise<{
		username: string;
		password: string;
		remember: boolean;
	}> {
		return Promise.resolve({
			username: "",
			password: "",
			remember: false
		});
	}
	onLoginSuccess(): void {}

	loginWithCheer($: cheerio.CheerioAPI, next: string | undefined, message: string = ""): Promise<cheerio.CheerioAPI> {
		return new Promise<cheerio.CheerioAPI>((resolve, reject) => {
			console.log("loging in (cheer)");
			// find form
			const webToken = $("input[name=_token]").attr('value');
			if (webToken === undefined) {
				reject("Failed to login : Cannot get a web token");
				return;
			}

			this.webToken = webToken!;

			// waiting for login
			this.onLogin(message).then(loginData => {
				// try loging in
				const data = new URLSearchParams({
					"username": loginData.username,
					"password": loginData.password,
					"_token": this.webToken,
					"remember": loginData.remember ? "true" : "false"
				});

				const nextURL = new URL(URL_HEAD + URL_LOGIN);
				nextURL.searchParams.set('next', next ?? '');

				this.tryGetCheerOfURL(nextURL.pathname + nextURL.search, "POST", data)
					.then(
						$ => {
							if (this.isCheerLoginPage($)) {
								// retry with message
								const message = $("#login-box .alert").first().html()!;

								this.loginWithCheer($, next, message).then($ => resolve($))
									.catch(r => reject(r));
								return;
							}
							this.onLoginSuccess();
							resolve($);
						}
					)
					.catch(r => {
						reject("Failed to login : Authentication Failed");
					});
			}).catch(r => {
				reject("Loging in canceled");
			});
		});
	}

	isCheerLoginPage($: cheerio.CheerioAPI): boolean {
		// find a class content
		const content = $("#login-box");
		return content.length !== 0;
	}



	tryGetCheerOfURL(url: string, method: string = "GET", data: {} | undefined = undefined): Promise<cheerio.CheerioAPI> {
		return new Promise<cheerio.CheerioAPI>((resolve, reject) => {
			console.log("get cheer of " + url);
			this.axiosInstance.request({
				method: method,
				data: data,
				url: url,
				headers: {
					cookie: this.cookies.join(';'),
				}
			})
				.then(response => {
					this.cookies = response.headers['set-cookie']!;
					this.onCookiesChanged(this.cookies);

					// is redirected
					if (response.status === 302) {
						const next = response.headers['location'];
						const nextURL = new URL(next);
						console.log("redirecting to " + nextURL.pathname);

						this.tryGetCheerOfURL(nextURL.pathname + nextURL.search)
							.then($ => resolve($))
							.catch(r => reject(r));
						return;
					}

					resolve(cheerio.load(response.data));
				})
				.catch(r => {
					console.error(r);
					reject("Getting HTML Failed");
				});
		});
	}

	tryGetCheerOfURLAndCheckAvailability(url: string): Promise<cheerio.CheerioAPI> {
		return new Promise<cheerio.CheerioAPI>((resolve, reject) => {
			this.tryGetCheerOfURL(url).then($ => {
				if (this.isCheerLoginPage($)) {
					this.loginWithCheer($, url).then($ => resolve($))
						.catch(r => reject(r));
				} else {
					resolve($);
				}
			}).catch(r => reject(r));
		});
	}

	getIDfromLink(url: string): number {
		return parseInt(url.substring(url.lastIndexOf('/') + 1));
	}

	getAllCourceBasics(): Promise<Course[]> {
		return new Promise<Course[]>((resolve, reject) => {
			this.tryGetCheerOfURLAndCheckAvailability(URL_COURSE)
				.then(
					$ => {
						const courses: Course[] = [];

						const table = $("table");
						const rows = table.find("tbody").find("tr");
						rows.each((i, row) => {
							const tds = $(row).find("td");
							let aHref = $(tds[0]).find("a").first();
							let url = aHref.attr("href");
							if (url === undefined) {
								// hmm
								reject("Failed to get course list : Cannot get a course URL");
								return;
							}
							const courseID = this.getIDfromLink(url);

							const courseTitle = aHref.contents().filter(function () {
								return this.type === 'text';
							}).text().trim();

							// owner

							aHref = $(tds[3]).find("a").first();
							url = aHref.attr("href");
							if (url === undefined) {
								// hmm, no owner ?
								reject("Failed to get course list : Cannot get a course owner URL");
								return;
							}
							const ownerID = this.getIDfromLink(url);

							const ownerFullname = aHref.contents().filter(function () {
								return this.type === 'text';
							}).text().trim();

							const account: Account = {
								id: ownerID,
								fullname: ownerFullname
							};

							// more data can be imported here !

							courses.push({
								id: courseID,
								title: courseTitle,
								release: new Date($(tds[1]).text()),
								expire: new Date($(tds[2]).text()),
								owner: account
							});
						});
						resolve(courses);
					}
				)
				.catch(r => reject(r));
		});
	}

	fillCourseProblems(course: Course) {
		return new Promise<Problem[]>((resolve, reject) => {
			// Enter the course first
			const nextURL = new URL(URL_HEAD + URL_COURSE + `/${course.id}/enter`);
			nextURL.searchParams.set("next", "/problem");
			this.tryGetCheerOfURLAndCheckAvailability(nextURL.pathname + nextURL.search)
				.then(
					$ => {
						// $ is a problem page
						const problems: Problem[] = [];

						const tbody = $(".col-xs-12").find("table > tbody");
						const rows = tbody.find("tr");
						rows.each((i, row) => {
							// each problem
							const tds = $(row).find("td");


							// 1. problem name
							let aHref = $($(tds[0]).find('a')[1]);
							const link = aHref.attr("href");
							if (link === undefined) {
								reject("Failed to get a problem link");
								return;
							}
							const problemName = aHref.text();

							// 2. rank (stars)
							const fasList = $(tds[1]).find(".fas").length;

							// 3. Checking Button
							aHref = $($(tds[0]).find('a')[0]);
							const status = aHref.attr("title");
							let statusEnum: SubmissionLiteStatus = SubmissionLiteStatus.what;
							switch (status) {
								case "Passed":
									statusEnum = SubmissionLiteStatus.success;
									break;
								case "Not Passed":
									statusEnum = SubmissionLiteStatus.danger;
									break;
								case "Passed (Quality < 100%)":
									statusEnum = SubmissionLiteStatus.warning;
									break;
							}

							// 4. Deadline
							const deadline = new Date($(tds[5]).text());

							// 5. Passed / Attempt
							const passed = $($(tds[2]).find('a').first()).text();
							const attempt = $($(tds[3]).find('a').first()).text();


							problems.push({
								id: this.getIDfromLink(link),
								title: problemName.trim(),
								rank: fasList,
								displayStatus: statusEnum,
								deadline: deadline,
								passed: parseInt(passed),
								attempt: parseInt(attempt)
							});

						});

						course.problems = problems;
						resolve(problems);
					}
				)
				.catch(r => reject(r));
		});
	}

	getProblem(problemID: number): Promise<Problem> {
		return new Promise<Problem>((resolve, reject) => {
			this.tryGetCheerOfURLAndCheckAvailability(URL_PROBLEM + `/${problemID}`)
				.then(
					$ => {
						const problem: Problem = { id: problemID };

						problem.title = $('.content-header > h1').first().text().trim();

						let rows = $(".col-lg-9 > .row");
						let data: Map<string, string>;

						/* rows.each((i, e) => {
							const E = $(e);
						}); */

						let _, __: any;

						// Desc
						_ = $(rows[0]).find(".box-body");
						problem.descRaw = _.html()!.trim();

						// Spec
						let table = $(rows[1]).find(".box-body > table");
						_ = table.find("tbody > tr");

						__ = _.get(0);
						if (__ !== undefined) { problem.specIn = $(__).text().trim(); };
						__ = _.get(1);
						if (__ !== undefined) { problem.specOut = $(__).text().trim(); };

						// Cases
						table = $(rows[2]).find(".box-body > table");
						_ = table.find("tbody > tr");
						let temp: string[] | undefined;
						const strarray: string[][] = [];
						_.each((i, e) => {
							const E = $(e).find('td > pre');
							strarray.push([
								$(E[0]).text().trim(),
								$(E[1]).text().trim()
							]);
						});

						problem.samples = strarray;

						// Info
						rows = $(".col-lg-3 > .row");
						_ = $(rows[1]).find(".box-body");
						_ = $(_).find('dd');
						__ = _.get(3);
						if (__ !== undefined) {
							problem.deadline = new Date($(__).text());
						}

						__ = _.get(5);
						if (__ !== undefined) {
							const span = $(__).find("span");
							if (span.hasClass('label-danger')){
								problem.restictWord = $(span).text().trim().split(" ");
							}
						}

						__ = _.get(11);
						if (__ !== undefined) {
							const a = $(__).find("a");
							let link = $(a).attr("href");
							if (link !== undefined) {
								const s = link.split('/');
								const submissionID = parseInt(s[s.length - 1]);

								const p = $(a).find("p");
								const P = $(p);
								let status: SubmissionLiteStatus;
								if (P.hasClass("label-success")) { status = SubmissionLiteStatus.success; }
								else if (P.hasClass("label-danger")) { status = SubmissionLiteStatus.danger; }
								else { status = SubmissionLiteStatus.warning; }

								const submissionLite: SubmissionLite = {
									id: submissionID,
									problem: problem,
									display: $(p).text().trim(),
									status: status
								};
								problem.lastSubmission = submissionLite;
							}
						}

						resolve(problem);
					}
				)
				.catch(r => reject(r));
		});
	}

}