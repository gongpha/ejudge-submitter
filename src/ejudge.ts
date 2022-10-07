import CancelablePromise from './util/cancelable_promise';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { maxHeaderSize } from 'http';

const URL_HEAD = 'https://ejudge.it.kmitl.ac.th';
const URL_LOGIN_NEW = '/auth/login';
const URL_LOGOUT = '/auth/logout';
const URL_LOGIN = '/auth/loggedin';
const URL_ACCOUNT = '/account/';
const URL_COURSE = '/course';
const URL_PROBLEM = '/problem';

export interface Authentication {
	username: string;
	password: string;
	remember: boolean;
}

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
	profilePicURL?: string;
	email?: string;
	desc?: string;

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

// Internals
interface AlertBoxContent {
	header: string;
	content: string;
}

export class EJudge {
	axiosInstance: AxiosInstance;
	webToken: string = "";
	cookies: string[] = [];
	waitingLogin: CancelablePromise<Authentication> | undefined;

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

	attemptLogin(): Promise<boolean> {
		// really a CHEAP method for attempting a login form
		// don't use this if you prefer page content from the single request
		// use tryGetCheerOfURLAndCheckAvailability instead (for internally usage)
		return new Promise<boolean>((resolve, reject) => {
			this.tryGetCheerOfURLAndCheckAvailability(URL_COURSE).then($ => {
				resolve(true);
			}).catch(r => {
				resolve(false);
			});
		});
	}

	tryLogout(): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			this.tryGetCheerOfURL(URL_LOGOUT).then($ => {
				resolve(this.isCheerLoginPage($));
			}).catch(r => reject(r));
		});
	}

	getMyAccountOrGuest(): Promise<Account | undefined> {
		return new Promise<Account | undefined>((resolve, reject) => {
			this.tryGetCheerOfURL(URL_ACCOUNT + "me").then($ => {
				if (this.isCheerLoginPage($)) {
					resolve(undefined);
				} else {
					resolve(this.getAccountFromCheer($));
				}
			});
		});
	}

	getAccount(accountID: number | "me"): Promise<Account> {
		return new Promise<Account>((resolve, reject) => {
			const p = this.tryGetCheerOfURLAndCheckAvailability(URL_ACCOUNT + (
				(accountID === "me") ? "me" : accountID.toString()
			))
				.then($ => {

					const col = $(".col-xs-12");
					const col3 = col.find(".col-xs-3");
					const well = col.find(".col-xs-9 > .well");
					const aList = col3.find('a');

					const aEdit = aList[aList.length - 1];
					const link = $(aEdit).attr('href')?.split('/');
					if (link === undefined) {
						reject("Link wasn't found");
						return;
					}
					if (link?.length < 2) {
						reject("Invalid link");
						return;
					}
					const id = link[link.length - 2];

					const aSpan = col3.find('span');


					const account: Account = {
						id: parseInt(id),
						profilePicURL: $(".img-responsive").attr("src"),

						username: $(aSpan[0]).text().trim(),
						fullname: $(aSpan[1]).text().trim(),
						email: $(aSpan[2]).find('a').first().text().trim(),
						desc: well.text().trim(),
					};
					resolve(account);
				})
				.catch(r => reject);
		});
	}

	getAccountFromCheer($: cheerio.CheerioAPI): Promise<Account> {
		return new Promise<Account>((resolve, reject) => {
			const col = $(".col-xs-12");
			const col3 = col.find(".col-xs-3");
			const well = col.find(".col-xs-9 > .well");
			const aList = col3.find('a');

			const aEdit = aList[aList.length - 1];
			const link = $(aEdit).attr('href')?.split('/');
			if (link === undefined) {
				reject("Link wasn't found");
				return;
			}
			if (link?.length < 2) {
				reject("Invalid link");
				return;
			}
			const id = link[link.length - 2];

			const aSpan = col3.find('span');


			const account: Account = {
				id: parseInt(id),
				profilePicURL: $(".img-responsive").attr("src"),

				username: $(aSpan[0]).text().trim(),
				fullname: $(aSpan[1]).text().trim(),
				email: $(aSpan[2]).find('a').first().text().trim(),
				desc: well.text().trim(),
			};
			resolve(account);
		});
	}

	onCookiesChanged(cookies: string[]): void { }
	onLogin(message: string): Promise<Authentication> {
		return Promise.resolve({
			username: "",
			password: "",
			remember: false
		});
	}
	onLoginSuccess(): void { }

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

			if (this.waitingLogin !== undefined) {
				// cancel that pending promise
				this.waitingLogin.cancel();
			}

			this.waitingLogin = new CancelablePromise<Authentication>(this.onLogin(message));

			this.waitingLogin.promise.then(loginData => {
				// try loging in
				this.waitingLogin = undefined;
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
			this.tryGetResponseOfURL(url, method, data)
				.then(
					resp => {
						resolve(cheerio.load(resp.data));
					}
				)
				.catch(r => reject(r));
		});
	}

	tryGetResponseOfURL(url: string, method: string = "GET", data: {} | undefined = undefined): Promise<AxiosResponse<any, any>> {
		return new Promise<AxiosResponse<any, any>>((resolve, reject) => {
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

						this.tryGetResponseOfURL(nextURL.pathname + nextURL.search)
							.then(resp => {
								resolve(resp);
							})
							.catch(r => reject(r));
						return;
					}

					resolve(response);
				})
				.catch(r => {
					console.error(r);
					reject("Getting HTML Failed : " + url);
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

						// Verify that the page is the course page
						const headerText = this.getPageHeader($);

						if (headerText !== "Course") {
							this.rejectReasonByAlertBox($, reject);
							return;
						}

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

	getPageHeader($: cheerio.CheerioAPI): string | undefined {
		const header = $(".content-header > h1");
		return header.contents().filter(function () {
			return this.type === 'text';
		}).text().trim();
	}

	getAlertMessage($: cheerio.CheerioAPI): AlertBoxContent | undefined {
		const alertBox = $("body > .alert");
		if (alertBox === undefined) {
			return undefined;
		}
		return {
			header: alertBox.find("strong").text().trim(),
			content: alertBox.find("p").text().trim()
		};
	}

	rejectReasonByAlertBox($: cheerio.CheerioAPI, reject: (reason?: any) => void): boolean {
		var alertContent = this.getAlertMessage($);
		if (alertContent === undefined) {
			reject("Error occured with an unknown alert message.");
			return false;
		}
		reject(alertContent.header + " : " + alertContent.content);
		return true;
	}

	fillCourseProblems(course: Course) {
		return new Promise<Problem[]>((resolve, reject) => {
			// Enter the course first
			const problems: Problem[] = [];
			let pageNumber = 1;

			const getProblemsByPage = (pageNumber: number): Promise<Problem[] | undefined> => {
				return new Promise<Problem[] | undefined>((resolve, reject) => {
					const nextURL = new URL(URL_HEAD + URL_COURSE + `/${course.id}/enter`);
					const paramURL = new URL(URL_HEAD + "/problem");
					paramURL.searchParams.set('page', pageNumber.toString());
					nextURL.searchParams.set("next", paramURL.pathname + paramURL.search);
					this.tryGetCheerOfURLAndCheckAvailability(nextURL.pathname + nextURL.search)
						.then(
							$ => {
								// Verify that the page is the problem page
								const headerText = this.getPageHeader($);

								if (headerText !== "Problem") {
									this.rejectReasonByAlertBox($, reject);
									return;
								}

								// $ is a problem page

								const tbody = $(".col-xs-12").find("table > tbody");
								const rows = tbody.find("tr");
								if (rows.length === 0) {
									resolve(undefined);
									return;
								}
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
								resolve(problems);
							}
						)
						.catch(r => {
							reject(r);
						});
				});
			};

			const runGetProblemByPage = (): Promise<Problem[] | undefined> => {
				return getProblemsByPage(pageNumber)
					.then((problems) => {
						if (problems === undefined) {
							course.problems = problems;
							return Promise.resolve(problems);
						}
						pageNumber += 1;
						problems = [
							...(course.problems ?? []),
							...problems
						];
						return runGetProblemByPage();

					}).catch(r => {
						return Promise.reject(r);
					});
			};

			runGetProblemByPage().then(r => {
				resolve(problems ?? []);
			}).catch(r => {
				reject(r);
			});
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
						if (__ !== undefined) { problem.specIn = ($(__).html() ?? "").trim(); };
						__ = _.get(1);
						if (__ !== undefined) { problem.specOut = ($(__).html() ?? "").trim(); };

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
							if (span.hasClass('label-danger')) {
								const list = $(span).text().split(" ");
								const words: string[] = [];
								list.forEach((e) => {
									e = e.trim();
									e.split(",").forEach((f) => {
										f = f.trim();
										if (f.length > 0) {
											words.push(f.trim());
										}
									});
								});
								problem.restictWord = words;
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