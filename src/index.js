const {
  compose, sequence, map,
  getJoins, getPairs, getSequence,
  getStates, getEdges, getAllEdges,
  enforceUppercase, first, last,
} = require('./utils');

const lock = Symbol('lock');
const _edges = Symbol.for('@@fsm/edges');
const _states = Symbol.for('@@fsm/states');

const createSetter = (ctx, stateKey, map) =>
  (val, transition) => {
    const newState = enforceUppercase(val);
    const oldState = enforceUppercase(ctx[stateKey]);
    const transitionName = enforceUppercase(transition);
    return sequence(
      () => map[`onBefore${transitionName}`](ctx),
      () => map[`onLeave${oldState}`](ctx),
      () => map[`on${transitionName}`](ctx),
      () => ctx[stateKey] = [ lock, val ],
      () => map[`onEnter${newState}`](ctx),
      () => map[`on${newState}`](ctx),
      () => map[`onAfter${transitionName}`](ctx)
    );
  };

const createMap = handlers =>
  new Proxy(handlers, {
    get: (target, name) => target[name] || (() => {})
  });

const guardSetter = (ctx, stateKey) =>
  new Proxy(ctx, {
    set: (target, name, value) => {
      if (name !== stateKey) return target[name] = value;
      if (!Array.isArray(value) || value[0] !== lock)
        throw new Error('Missing lock');
      return target[name] = value[1];
    }
  });

const shortestPath = (joins) => {
  function recurse(from, to, visited = [], arr = [ to ]) {
    return !visited.includes(to)
      ? joins
        .filter(([ , v ]) => v.includes(to))
        .reduce((acc, [ k ]) => {
          console.log(acc, from, arr);
          return k !== from
            ? acc.concat(recurse(from, k, [ to, ...visited ], [ k ].concat(arr)))
            : acc.concat([ [ k ].concat(arr) ]);
        }, [])
        .map(x => (console.log(x), x))
        .sort((a, b) => (console.log(a, b, a.length, b.length), a.length - b.length))
      : [];
  }
  return (...x) => {
    const res = recurse(...x);
    console.log(res);
    console.log([ 1, 2 ].shift());
    return res.shift();
  };
};

const createFinder = (edges) => ([ from, to ]) =>
  Object.keys(edges)
    .filter(k => edges[k].find(([ x, y ]) => x === from && y === to));

const prepareThru = (finder, allEdges, stateKey, allowCyclicalTransitions) => {
  const joins = getJoins(allEdges);
  const recurse = shortestPath(joins);

  // if a path is found, get pairs of the sequence, ie. [ [ A, B ], [ B, C ] ]
  const getPathPairs = x => !x.some(y => y === undefined)
    ? getPairs(getSequence(x))
    : false;

  const getPaths = compose(getPathPairs, x => (console.log('shortest', x), x), map(x => recurse(...x)), getPairs);
  const getNames = map(x => finder(x).shift());

  // taking into account the current state and supplied thru states, get pairs for the sequence
  const statesToPairs = ctx => (...states) => {
    const s = [ ctx[stateKey], ...states ];
    if (
      !allowCyclicalTransitions
      && first(s) === last(s)
      && s.length === 2
    ) return false;
    return getPaths(s);
  };

  return (ctx) => {
    const stp = statesToPairs(ctx);
    const thru = compose(x => x && getNames(x), stp);
    thru.path = stp;
    return thru;
  };
};

const prepareDefaultMethods = (edges, stateKey, allowCyclicalTransitions) => {
  const finder = createFinder(edges);
  const allEdges = getAllEdges(edges);
  const createThru = prepareThru(finder, allEdges, stateKey, allowCyclicalTransitions);
  return (ctx) => {
    const thru = createThru(ctx);
    return {
      can: (to) => !!allEdges.find(([ x, y ]) => x === ctx[stateKey] && y === to),
      to(to) {
        const name = finder([ ctx[stateKey], to ]).pop();
        if (!name) throw new Error('Invalid transition');
        return this[name]();
      },
      edge: (to) => {
        const name = finder([ ctx[stateKey], to ]).pop();
        if (!name) throw new Error('Invalid edge');
        return name;
      },
      will: (...to) => !!thru(...to),
      thru(...to) {
        const s = [ ctx[stateKey], ...to ];
        if (
          !allowCyclicalTransitions
          && first(s) === last(s)
          && s.length === 2
        ) throw new Error('Potential cyclic transition');

        const names = thru(...to);
        if (!names) throw new Error('Invalid transition');
        return sequence(...names.map(x => this[x]));
      },
      path: (...to) => thru.path(...to),
      transitions: () => Object.keys(edges).filter(k => edges[k].find(([ x ]) => x === ctx[stateKey])),
    };
  };
};

const checkInitialState = (states, stateKey) =>
  ctx => states.includes(ctx[stateKey]);

const createMachineFactory = ({
  transitions,
  handlers = {},
  stateKey = 'state',
  allowCyclicalTransitions = false
} = {}) => {
  if (!transitions)
    throw new Error('No transitions supplied');

  const map = createMap(handlers);
  const states = getStates(transitions);
  const edges = getEdges(transitions);
  const transit = Object.keys(edges);
  const check = checkInitialState(states, stateKey);
  const createDefaultMethods = prepareDefaultMethods(edges, stateKey, allowCyclicalTransitions);

  const init = (context = {}) => {
    if (!check(context))
      throw new Error(`Invalid initial state of: ${context[stateKey]}`);

    const ctx = guardSetter(Object.assign({}, context), stateKey);
    const setter = createSetter(ctx, stateKey, map);

    const fsm = transit.reduce((acc, name) =>
      (acc[name] = () => {
        const transition = edges[name].find(([ from ]) => from === ctx[stateKey]);
        if (!transition)
          throw new Error('Invalid transition');
        return setter(transition[1], name);
      }, acc), createDefaultMethods(ctx));

    return Object.assign(ctx, fsm);
  };

  init[_states] = states;
  init[_edges] = edges;

  return init;
};

module.exports = createMachineFactory;
