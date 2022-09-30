// my dear, ES6 Promise is not cancelable
// i hate my life
export default class CancelablePromise<T> {
    promise: Promise<T>;
    rejectFunction: (reason?: any) => void = () => { };

    constructor(promise: Promise<T>) {
        this.promise = new Promise<T>((resolve, reject) => {
            this.rejectFunction = reject;

            Promise.resolve(promise)
                .then(resolve)
                .catch(reject);
        });
    };

    cancel(r: any = undefined) {
        this.rejectFunction(r);
    }
}