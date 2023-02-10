const PENDING = "pending",
  FULFILLED = "fulfilled",
  REJECTED = "rejected";
class MyPromise {
  constructor(fn) {
    this.status = PENDING;
    this.value = undefined;
    this.reason = undefined;

    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    const resolve = (value) => {};
    const reject = (reason) => {};
    try {
      fn();
    } catch (error) {
      reject(error);
    }

    // if (typeof fn !== "function") {
    // }
  }
  then(onFulfilled, onRejected) {
    const realOnFulfilled =
      typeof onFulfilled === "function" ? onFulfilled : (value) => value;
    const realOnRejected =
      typeof onRejected === "function" ? onRejected : (value) => value;
    if (this.status === FULFILLED) {
      onFulfilled(this.value);
    }
    if (this.status === REJECTED) {
      onRejected(this.reason);
    }
    if (this.status === PENDING) {
      this.onFulfilledCallbacks.push(() => {
        realOnFulfilled(this.value);
      });
      this.onRejectedCallbacks.push(() => {
        realOnRejected(this.reason);
      });
    }
  }
}
