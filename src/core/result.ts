/**
 * Typed result for operations that can fail.
 *
 * System context:
 * - Used in repositories/services/handlers to model errors without using `throw`.
 * - Allows distinguishing between "no data" (`Ok(null)`) and "operation failed" (`Err(error)`).
 *
 * Invariants and contract:
 * - **Runtime no-throw**: the codebase aims not to bring down the process due to a point failure.
 * - `Err.unwrap()` **does not throw**. Logs a warning and returns `undefined`.
 * - Callers must **check** `isErr()`/`isOk()` before using `unwrap()`, unless `undefined` is acceptable.
 *
 * Gotchas:
 * - If you call `unwrap()` on `Err` and then access properties (`unwrap().foo`), you get
 *   a `TypeError`. This is deliberate: the contract requires guards.
 *
 * Recommended pattern:
 * ```ts
 * const res = await repoCall();
 * if (res.isErr()) return ErrResult(res.error);
 * const value = res.unwrap();
 * // ... use value
 * ```
 */
export type Result<T, E = Error> = Ok<T, E> | Err<T, E>;

export class Ok<T, E> {
  readonly ok = true;
  readonly err = false;

  constructor(public readonly value: T) {}

  isOk(): this is Ok<T, E> { return true; }
  isErr(): this is Err<T, E> { return false; }

  unwrap(): T { return this.value; }
  unwrapOr(_default: T): T { return this.value; }

  map<U>(fn: (value: T) => U): Result<U, E> { return new Ok(fn(this.value)); }
  mapErr<F>(_fn: (error: E) => F): Result<T, F> { return new Ok<T, F>(this.value); }

  inspect(fn: (value: T) => void): Result<T, E> { fn(this.value); return this; }
  inspectErr(_fn: (error: E) => void): Result<T, E> { return this; }
}

export class Err<T, E> {
  readonly ok = false;
  readonly err = true;

  constructor(public readonly error: E) {}

  isOk(): this is Ok<T, E> { return false; }
  isErr(): this is Err<T, E> { return true; }

  /** Does NOT throw. Logs and returns undefined. Caller must check isOk() first. */
  unwrap(): T {
    console.warn("[Result] unwrap called on Err; returning undefined.", this.error);
    return undefined as unknown as T;
  }

  unwrapOr(defaultValue: T): T { return defaultValue; }

  map<U>(_fn: (value: T) => U): Result<U, E> { return new Err<U, E>(this.error); }
  mapErr<F>(fn: (error: E) => F): Result<T, F> { return new Err<T, F>(fn(this.error)); }

  inspect(_fn: (value: T) => void): Result<T, E> { return this; }
  inspectErr(fn: (error: E) => void): Result<T, E> { fn(this.error); return this; }
}

/** Creates a successful result wrapping `value`. */
export const OkResult = <T, E = Error>(value: T): Result<T, E> => new Ok(value);

/** Creates a failed result wrapping `error`. */
export const ErrResult = <T, E = Error>(error: E): Result<T, E> => new Err(error);
