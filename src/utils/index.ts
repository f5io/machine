export type Transition = {
  [key: string]: { from: string | number | number[] | string[]; to: string | number };
};

export type Edge = {
  [key: string]: [string, string][];
};

export type DefaultMethods = {
  can: (to: any) => any;
  edge: (to: any) => any;
  to: (to: any) => any;
  will: (...to: any[]) => any;
  thru: (...to: any[]) => any;
  path: (...to: any[]) => any;
  transitions: () => any;
};

export type CreateMachineFactoryParams = {
  transitions?: Transition;
  handlers?: { [key: string]: any };
  stateKey?: string;
  allowCyclicalTransitions?: boolean;
};

export type Context = DefaultMethods;
export type InitFn<CustomContext, CustomTransitionKeys extends string> = (
  ctx: CustomContext
) => { [key in CustomTransitionKeys]: () => Promise<void> } & CustomContext & Context;

export const unique: <T = any>(arr: T[]) => T[] = arr => [...new Set(arr)];

export const toArray: <T = any>(arr: T) => T[] = arr => (Array.isArray(arr) ? arr : [arr]);

export const sentenceCase: (string: string) => string = string =>
  string.charAt(0).toUpperCase() + string.slice(1);

export const first: <T>(x: T[]) => T = x => x[0];
export const last: <T>(x: T[]) => T = x => x[x.length - 1];

export type MapFn<T = any, U = T> = (x: T, index: number, arr: T[]) => U;
export const map: <T = any, U = T>(fn: MapFn<T, U>) => (x: T[]) => U[] = fn => x => x.map(fn);

export type Fn<T, U> = (...x: T[]) => U;
export const compose = <T, U>(fn: Fn<any, U>, ...fns: Fn<any, any>[]): Fn<T, U> =>
  [fn].concat(fns).reduce((f, g) => (...x: any[]) => f(g(...x))) as Fn<any, U>;

export type FN = <T>(args: T) => T;
export const sequence = <T = any>(...fns: FN[]): Promise<T> =>
  fns.reduce<Promise<T>>((acc, fn) => acc.then(fn), Promise.resolve() as any);

export const getPairs: <T = any, R = T>(items: T | R) => [T, R][] = items =>
  (items as any).reduce(
    (acc, item, i, arr) => (arr[i + 1] != null ? acc.concat([[item, arr[i + 1]]]) : acc),
    []
  );

export const getJoins = <T = any, R = any>(edges: [T, R][]): [T, R[]][] => [
  ...edges
    .reduce(
      (acc, [from, to]) => acc.set(from, acc.has(from) ? acc.get(from).concat(to) : [to]),
      new Map<T, R[]>()
    )
    .entries()
];

export const getSequence: (paths: string[]) => string = paths =>
  paths.reduce((acc, p) => acc.concat(p.slice(1)), paths[0].slice(0, 1));

export const getStates: (transitions: Transition) => string[] = transitions =>
  Object.values(transitions).reduce(
    (acc, { from, to }) => unique(acc.concat(...toArray(from), ...toArray(to))),
    []
  );

export const getEdges: (transitions: Transition) => Edge = transitions =>
  Object.entries(transitions).reduce(
    (acc, [name, { from, to }]) => (
      (acc[name] = unique([].concat(...toArray(from).map(x => toArray(to).map(y => [x, y]))))), acc
    ),
    {}
  );

export const getAllEdges: (edges: Edge) => [string, string][] = edges =>
  Object.values(edges).reduce((acc, arr) => unique(acc.concat(arr)), []);

export const enforceUppercase: (any: string) => string = any => sentenceCase(any.toString());

export default {
  first,
  last,
  map,
  compose,
  sequence,
  getPairs,
  getJoins,
  getSequence,
  getStates,
  getEdges,
  getAllEdges,
  enforceUppercase
};
