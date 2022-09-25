import {
	Event, EventEmitter, ProviderResult, ThemeIcon, TreeDataProvider, TreeItem,
	TreeItemCollapsibleState, FileDecorationProvider, Uri, window, Disposable,
	FileDecoration,
	ThemeColor
} from "vscode";
import { EJudge, Problem, Course, SubmissionLiteStatus } from './ejudge';

type TreeDataOnChangeEvent = ProblemItem | undefined | null | void;

export class EJudgeCourseTreeProvider implements TreeDataProvider<ProblemItem | CourseItem | TreeItem> {
	private _onDidChangeTreeData = new EventEmitter<TreeDataOnChangeEvent>();
	readonly onDidChangeTreeData: Event<TreeDataOnChangeEvent> = this._onDidChangeTreeData.event;

	cached: CourseItem[] = [];

	ejudge: EJudge;
	deco: EJudgeCourseTreeDecorationProvider;

	constructor(ejudge: EJudge) {
		this.ejudge = ejudge;
		this.deco = new EJudgeCourseTreeDecorationProvider();
	}

	refresh(): void {


		// gathers all courses
		this.ejudge.getAllCourceBasics().then((courses) => {
			this.cached = courses.map((course) => new CourseItem(course));
			this._onDidChangeTreeData.fire();
		});

	}

	getTreeItem(element: CourseItem | ProblemItem): TreeItem | Thenable<TreeItem> {
		return element;
	}

	getChildren(element?: CourseItem | ProblemItem | undefined): Thenable<TreeItem[]> {
		if (element === undefined) {
			return Promise.resolve(this.cached);
		}
		return element.requestFullItem(this.ejudge);
	}

	getParent() {
		return null;
	}
}

class EJudgeCourseTreeDecorationProvider implements FileDecorationProvider {
	disposables: Disposable[];
	constructor() {
		this.disposables = [];
		this.disposables.push(window.registerFileDecorationProvider(this));
	}

	provideFileDecoration(uri: Uri): ProviderResult<FileDecoration> {
		// file://ejudge/object/status/rank/passed/attempt/
		// file://ejudge/problem/success/2/15/20/ <-- EXAMPLE
		if (uri.authority === "ejudge") {
			const slist = uri.path.split("/");
			if (slist[1] === "problem") {
				let color: string = "";
				switch (slist[2]) {
					case "success":
						color = "terminal.ansiGreen";
						break;
					case "danger":
						color = "terminal.ansiRed";
						break;
					case "warning":
						color = "terminal.ansiYellow";
						break;
				}
				return {
					badge: "\u2605" + slist[3],
					color: new ThemeColor(color)
				};
			}
		}
		return {};
	}

	dispose() {
		this.disposables.forEach((d) => d.dispose());
	}
}

class CourseItem extends TreeItem {
	children?: ProblemItem[];
	course: Course;

	constructor(course: Course) {
		super(course.title ??= "<undefined>", TreeItemCollapsibleState.Collapsed);
		this.course = course;
		this.iconPath = new ThemeIcon("list-unordered");
		this.contextValue = "course";
		// this.command = {
		// 	title: "View a course",
		// 	command: "ejudge-submitter.viewProblem",
		// };
		this.tooltip = `Owned by ${(course.owner!.fullname) ??= "(Someone . . .)"}\
			\nRelease : ${(course.release!.toLocaleDateString())}\nExpire : ${course.expire!.toLocaleDateString()}`;
	}

	requestFullItem(ejudge: EJudge): Promise<ProblemItem[]> {
		return new Promise<ProblemItem[]>((resolve, reject) => {
			ejudge.fillCourseProblems(this.course).then((problems) => {
				resolve(problems.map((problem) => new ProblemItem(problem)));
			}).catch((reason) => {
				//window.showInformationMessage(reason);
				reject(reason);
			}); // sorry bro
		});
	}
}

class ProblemItem extends TreeItem {
	constructor(problem: Problem) {
		super(problem.title ??= "<undefined>");
		this.iconPath = new ThemeIcon("code");
		this.command = {
			title: "Open a problem",
			command: "ejudge-submitter.openProblem",
			arguments: [problem.id],
		};
		const stars = (
			problem.rank === undefined ? "U_U" :
				"\u2605".repeat(problem.rank) + "\u2606".repeat(5 - problem.rank)
		);
		const percent = (
			(
				problem.passed === undefined || problem.attempt === undefined ? 666 :
					(problem.passed / problem.attempt * 100).toFixed(2)
			)
		);
		this.tooltip = `Rank : ${stars}\nPassed/Attempt : ${problem.passed}/${problem.attempt}\nRatio : ${percent}%`;

		// file://ejudge/object/status/rank/passed/attempt/
		const status = (
			problem.displayStatus === SubmissionLiteStatus.success ? "success" :
				problem.displayStatus === SubmissionLiteStatus.danger ? "danger" :
					problem.displayStatus === SubmissionLiteStatus.warning ? "warning" : "what"
		);
		this.resourceUri = Uri.parse(`file://ejudge/problem/${status}/${problem.rank}/${problem.passed}/${problem.attempt}/`);
	}

	requestFullItem(ejudge: EJudge): Promise<TreeItem[]> {
		return Promise.resolve([]); // No children !
	}
}
