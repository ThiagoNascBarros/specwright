/** Side effects the tools need from the outside world; injectable for tests. */
export interface Deps {
  /** Clock used for dates written to disk. */
  now: () => Date;
}

export const defaultDeps: Deps = { now: () => new Date() };
