import { toString } from "cheerio/lib/api/manipulation";
import { Event, EventEmitter, ProviderResult, ThemeIcon, TreeDataProvider, TreeItem } from "vscode";
import { EJudge, Problem, Course } from './ejudge';

type TreeDataOnChangeEvent = ProblemItem | undefined | null | void;

export class EJudgeCourseTreeProvider implements TreeDataProvider<ProblemItem | CourseItem | TreeItem> {
	private _onDidChangeTreeData = new EventEmitter<TreeDataOnChangeEvent>();
	readonly onDidChangeTreeData: Event<TreeDataOnChangeEvent> = this._onDidChangeTreeData.event;

	cached: CourseItem[] | undefined;

	ejudge: EJudge;

	constructor(ejudge: EJudge) {
		this.ejudge = ejudge;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();

		// gathers all courses
		this.ejudge.getAllCourceBasics().then((courses) => {
			this.cached = courses.map((course) => new CourseItem(course));
		});
	}

	getTreeItem(element: CourseItem | ProblemItem): TreeItem | Thenable<TreeItem> {
		return element;
	}

	getChildren(element?: CourseItem | ProblemItem | undefined): ProviderResult<TreeItem[]> {
		if (element === undefined) {
			return this.cached;
		}
		return element.requestFullItem(this.ejudge);
	}

	getParent() {
		return null;
	}
}

class CourseItem extends TreeItem {
	children?: ProblemItem[];
	course: Course;

	constructor(course: Course) {
		super(course.title ??= "<undefined>");
		this.course = course;
		this.iconPath = new ThemeIcon("list-unordered");
		// this.command = {
		// 	title: "View a course",
		// 	command: "ejudge-submitter.viewProblem",
		// };
	}

	requestFullItem(ejudge: EJudge) : Promise<ProblemItem[]> {
		return new Promise<ProblemItem[]>((resolve, reject) => {
			ejudge.fillCourseProblems(this.course).then((problems) => {
				resolve(problems.map((problem) => new ProblemItem(problem)));
			}).catch((reason) => resolve([])); // sorry bro
		});
	}
}

class ProblemItem extends TreeItem {
	cached?: ProblemItem[];

	constructor(problem: Problem) {
		super(problem.title ??= "<undefined>");
		this.iconPath = new ThemeIcon("code");
		this.command = {
			title: "View a problem",
			command: "ejudge-submitter.viewProblem",
			arguments: [problem.id],
		};
	}

	requestFullItem(ejudge: EJudge) : Promise<TreeItem[]> {
		return new Promise<TreeItem[]>((resolve, reject) => {
			resolve([]);
		});
	}
}
