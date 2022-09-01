import { rejects } from 'assert';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'https';

axios.defaults.withCredentials = true;

const httpsAgent = new https.Agent({ keepAlive: true });

const URL_HEAD                       = 'https://ejudge.it.kmitl.ac.th';
const URL_LOGIN_NEW                  = '/auth/login';
const URL_LOGIN                      = '/auth/loggedin';
const URL_ACCOUNT_ME                 = '/account/me';
const URL_COURSE                     = '/course';
const URL_PROBLEM                    = '/problem';

export interface Course {
	id : number;
	
	title? : string;
	desc? : string;
	owner? : Account;
	//descUpdatedDate : string;
	//whoUpdated : Account;
	
	problems? : Problem[];
	//quizzes <-- Soon(tm)
	students? : Account[];

	// other data will get setup here soon . . .
}

export interface Account {
	id : number;

	username? : string;
	fullname? : string;
	email? : string;
	desc? : string;
	profileURL? : string;

	//problems
	//quizzes

	// other data will get setup here soon . . .
}

export interface Quality {
	of : Submission;
	percent : number; // 0-100
	summary : string;
}

export enum SubmissionCaseStatus {
	passed,
	error,
	incorrect
}

export interface SubmissionCase {
	of : Submission;
	caseIndex : number;
	caseNumber : number;
	status : SubmissionCaseStatus;
	desc : string;
	time : number; // sec
}

export interface Submission {
	id : number;
	
	problem? : Problem;
	from? : Account;
	language? : string;
	correctnessScore? : number;
	bonusScore? : number;
	quality? : Quality;
	summaryScore? : number;
	timestamp? : Date;

	cases? : SubmissionCase[];
	code? : string;
}

export enum SubmissionLiteStatus {
	success,
	danger,
	warning
}

export interface SubmissionLite {
	id : number;
	
	problem : Problem;
	//from : Account;

	display : string;
	status : SubmissionLiteStatus;
}

export interface Problem {
	id : number;

	title? : string;
	descRaw? : string;
	specIn? : string;
	specOut? : string;

	samples? : string[][]; // in, out

	deadline? : Date
	restictWord? : string;

	//fullScore? : number;
	//bonusScore? : number;

	lastSubmission? : Submission;

	// other data will get setup here soon . . .
}

export default class EJudge {
	username : string;
	password : string;

	axiosInstance : AxiosInstance;
	webToken : string = "";

	setCookie : string = "";

	constructor(username : string, password : string) {
		this.username = username;
		this.password = password;
		
		this.axiosInstance = axios.create({
			baseURL: URL_HEAD,
			withCredentials : true,
			httpsAgent: httpsAgent
		});
	}

	login() : Promise<String> {
		return new Promise<string>((resolve, reject) => {
			const p = this.tryGetCheerOfURL(URL_LOGIN_NEW)
			.then($ => {this.loginWithCheer($).then($ => resolve($));})
			.catch(r => reject);
		});
	}

	loginWithCheer($ : cheerio.CheerioAPI) : Promise<string> {
		return new Promise<string>((resolve, reject) => {
			// find form
			const webToken = $("input[name=_token]").attr('value');
			if (webToken === undefined) {
				reject("Failed to login : Cannot get a web token");
			}
			
			this.webToken = webToken!;

			// try login
			const data = new URLSearchParams({
				"username" : this.username,
				"password" : this.password,
				"_token"   : this.webToken,
				"remember" : "true"
			});
			this.axiosInstance.post(URL_LOGIN, data, {
				withCredentials: true,
				headers: {
					"Content-Type" : "application/x-www-form-urlencoded",
					"Accept" : "*/*",
					"Cookie" : this.setCookie
				}
			}).then(
				response => {
					resolve(this.webToken);
				}
			)
			.catch(r => {
				reject("Failed to login : Authentication Failed");
			});
		});
	}

	isCheerLoginPage($ : cheerio.CheerioAPI) : boolean {
		// find class content
		const content = $(".login-box");
		return content !== undefined;
	}

	tryGetCheerOfURL(url : string) : Promise<cheerio.CheerioAPI> {
		return new Promise<cheerio.CheerioAPI>((resolve, reject) => {
			this.axiosInstance.get(url)
			.then(response => {
				this.setCookie = response.headers['set-cookie']![0];
				resolve(cheerio.load(response.data));
			})
			.catch(r => {
				console.error(r);
				reject("Getting HTML Failed");
			});
		});
	}

	tryGetCheerOfURLAndCheckAvailability(url : string) : Promise<cheerio.CheerioAPI> {
		return new Promise<cheerio.CheerioAPI>((resolve, reject) => {
			return this.tryGetCheerOfURL(url)
			.then(
				$ => {
					if (this.isCheerLoginPage($)) {
						// re-login
						this.loginWithCheer($)
						.then(() => {
							// re-get
							this.tryGetCheerOfURL(url)
							.then($ => {resolve($);})
							.catch(r => reject);
						})
						.catch(r => reject);
					}
				}
			)
			.catch(r => reject(r));
		});
	}

	getProblem(problemID : number) : Promise<Problem> {
		return new Promise<Problem>((resolve, reject) => {
			this.tryGetCheerOfURLAndCheckAvailability(URL_PROBLEM + `/${problemID}`)
			.then(
				$ => {
					const problem : Problem = {id : problemID};

					const rows = $(".col-lg-9 > .row");
					let data : Map<string, string>;

					/* rows.each((i, e) => {
						const E = $(e);
					}); */
					
					let _, __ : any;

					// Desc
					_ = $(rows[0]).find("box-body");
					problem.descRaw = _.text();

					// Spec
					_ = $(rows[1]).find("box-body > td");

					__ = _.get(0);
					if (__ !== undefined) {problem.specIn = $(__).text();};
					__ = _.get(1);
					if (__ !== undefined) {problem.specOut = $(__).text();};

					// Cases
					_ = $(rows[2]).find("box-body > td");
					let temp : string[] | undefined;
					const strarray : string[][] = [];
					rows.each((i, e) => {
						const E = $(e);
						if (temp === undefined) {
							temp = [E.text(), ""];
						} else {
							temp[1] = E.text();
							strarray.push(temp);
							temp = undefined;
						}
					});

					problem.samples = strarray;

					// Info
					_ = $(rows[1]).find("box-body > dd");
					__ = _.get(3);
					if (__ !== undefined) {
						problem.deadline = new Date($(__).text());
					}
					
					__ = _.get(4);
					if (__ !== undefined) {
						const span = $(__).find("span");
						problem.restictWord = $(span).text();
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
							let status : SubmissionLiteStatus;
							if (P.hasClass("label-success")) {status = SubmissionLiteStatus.success;}
							else if (P.hasClass("label-danger")) {status = SubmissionLiteStatus.danger;}
							else {status = SubmissionLiteStatus.warning;}
							const col = $(p).hasClass;

							const submissionLite : SubmissionLite = {
								id : submissionID,
								problem : problem,
								display : $(p).text(),
								status : status
							};
						}
					}
					
					resolve(problem);
				}
			)
			.catch(r => reject(r));
		});
	}

}