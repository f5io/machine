import {
  compose,
  sequence,
  map,
  getJoins,
  getPairs,
  getSequence,
  getStates,
  getEdges,
  getAllEdges,
  enforceUppercase,
  first,
  last,
  Fn,
  Edge,
  DefaultMethods,
  CreateMachineFactoryParams,
  InitFn
} from './utils';

const lock = Symbol('lock');
const _edges = Symbol.for('@@fsm/edges');
const _states = Symbol.for('@@fsm/states');

const createSetter = <C>(
  ctx: C,
  stateKey: string,
  map: { [key: string]: any }
): ((val: string, transition: string) => Promise<{ [key: string]: any }>) => (val, transition) => {
  const newState = enforceUppercase(val);
  const oldState = enforceUppercase(ctx[stateKey]);
  const transitionName = enforceUppercase(transition);
  return sequence<{ [key: string]: any }>(
    () => map[`onBefore${transitionName}`](ctx),
    () => map[`onLeave${oldState}`](ctx),
    () => map[`on${transitionName}`](ctx),
    () => ((ctx[stateKey] = [lock, val]), null),
    () => map[`onEnter${newState}`](ctx),
    () => map[`on${newState}`](ctx),
    () => map[`onAfter${transitionName}`](ctx)
  );
};

const createMap = (handlers: { [key: string]: any }): ProxyHandler<{ [key: string]: any }> =>
  new Proxy(handlers, {
    get: (target, name) => target[name as string] || (() => {})
  });

const guardSetter: <C = {}>(ctx: C & {}, stateKey: string) => ProxyHandler<C & {}> = (
  ctx,
  stateKey
) =>
  new Proxy(ctx, {
    set: (target, name, value) => {
      if (name !== stateKey) return (target[name] = value);
      if (!Array.isArray(value) || value[0] !== lock) throw new Error('Missing lock');
      return (target[name] = value[1]);
    }
  });

const shortestPath: (
  joins: [string, string[]][]
) => (from: string, to: string, visited?: string[], arr?: string[]) => [string, string] = joins => {
  function recurse(from, to, visited = [], arr = [to]) {
    return !visited.includes(to)
      ? joins
          .filter(([, v]) => v.includes(to))
          .reduce((acc, [k]) => {
            return k !== from
              ? acc.concat(recurse(from, k, [to, ...visited], [k].concat(arr)))
              : acc.concat([[k].concat(arr)]);
          }, [])
          .sort((a, b) => a.length - b.length)
      : [];
  }
  return (...x) => recurse(...x).shift();
};

const createFinder: (edges: Edge) => (arr: [string, string]) => string[] = edges => ([from, to]) =>
  Object.keys(edges).filter(k => edges[k].find(([x, y]) => x === from && y === to));

const prepareThru: <C = {}>(
  finder: (arr: [string, string]) => string[],
  allEdges: [string, string][],
  stateKey: string,
  allowCyclicalTransitions: boolean
) => (ctx: C) => Function & { path?: Function } = (
  finder,
  allEdges,
  stateKey,
  allowCyclicalTransitions
) => {
  const joins = getJoins<string, string>(allEdges);
  const recurse = shortestPath(joins);

  // if a path is found, get pairs of the sequence, ie. [ [ A, B ], [ B, C ] ]
  const getPathPairs: (x: string[]) => boolean | [string, string][] = x =>
    !x.some(y => y === undefined) ? getPairs(getSequence(x)) : false;

  const getPaths = compose<any, boolean | [string, string][]>(
    getPathPairs,
    map((x: [string, string]) => recurse(...x)),
    getPairs
  );
  const getNames: (arr: [string, string][]) => string[] = map<[string, string], string>(x =>
    finder(x).shift()
  );

  // taking into account the current state and supplied thru states, get pairs for the sequence
  const statesToPairs: <C = {}>(
    ctx: C
  ) => (...states: string[]) => boolean | [string, string][] = ctx => (...states) => {
    const s = [ctx[stateKey] as string, ...states];
    if (!allowCyclicalTransitions && first(s) === last(s) && s.length === 2) return false;
    return getPaths(s);
  };

  return ctx => {
    const stp = statesToPairs(ctx);
    const thru: Fn<any, boolean | (string)[]> & {
      path?: (...states: string[]) => boolean | ([string, string])[];
    } = compose<any, boolean | string[]>(
      x => (x ? (getNames(x) as string[]) : (x as boolean)),
      stp
    );
    thru.path = stp;
    return thru;
  };
};

const prepareDefaultMethods: <C = {}>(
  edges: Edge,
  stateKey: string,
  allowCyclicalTransitions: boolean
) => (ctx: C) => DefaultMethods = (edges, stateKey, allowCyclicalTransitions) => {
  const finder = createFinder(edges);
  const allEdges = getAllEdges(edges);
  const createThru = prepareThru(finder, allEdges, stateKey, allowCyclicalTransitions);
  return ctx => {
    const thru = createThru(ctx);
    return {
      can: to => !!allEdges.find(([x, y]) => x === ctx[stateKey] && y === to),
      to(to) {
        const name = finder([ctx[stateKey], to]).pop();
        if (!name) throw new Error('Invalid transition');
        return this[name]();
      },
      edge: to => {
        const name = finder([ctx[stateKey], to]).pop();
        if (!name) throw new Error('Invalid edge');
        return name;
      },
      will: (...to) => !!thru(...to),
      thru(...to) {
        const s = [ctx[stateKey], ...to];
        if (!allowCyclicalTransitions && first(s) === last(s) && s.length === 2)
          throw new Error('Potential cyclic transition');

        const names = thru(...to);
        if (!names) throw new Error('Invalid transition');
        return sequence(...names.map(x => this[x]));
      },
      path: (...to) => thru.path(...to),
      transitions: () => Object.keys(edges).filter(k => edges[k].find(([x]) => x === ctx[stateKey]))
    };
  };
};

const checkInitialState: <C>(
  states: (string | number)[],
  stateKey: string
) => (ctx: C) => boolean = (states, stateKey) => ctx => states.includes(ctx[stateKey]);

const createMachineFactory = <C extends object, T extends string>({
  transitions,
  handlers = {},
  stateKey = 'state',
  allowCyclicalTransitions = false
}: CreateMachineFactoryParams = {}): InitFn<C, T> => {
  if (!transitions) throw new Error('No transitions supplied');

  const map = createMap(handlers);
  const states = getStates(transitions);
  const edges = getEdges(transitions);
  const transit = Object.keys(edges);
  const check = checkInitialState<C>(states, stateKey);
  const createDefaultMethods = prepareDefaultMethods<ProxyHandler<C & {}>>(
    edges,
    stateKey,
    allowCyclicalTransitions
  );

  const init = context => {
    if (!context) throw new Error(`You need to provide an initial state.`);
    if (!check(context)) throw new Error(`Invalid initial state of: ${context[stateKey]}`);

    const ctx = guardSetter<C>(Object.assign({}, context), stateKey);
    const setter = createSetter(ctx, stateKey, map);

    const fsm = transit.reduce<DefaultMethods>(
      (acc, name) => (
        (acc[name] = () => {
          const transition = edges[name].find(([from]) => from === ctx[stateKey]);
          if (!transition) throw new Error('Invalid transition');
          return setter(transition[1], name);
        }),
        acc
      ),
      createDefaultMethods(ctx)
    );

    return Object.assign(ctx, fsm);
  };

  init[_states] = states;
  init[_edges] = edges;

  return init as InitFn<C, T>;
};

export default createMachineFactory;
