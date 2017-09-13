const {
  compose, sequence, map,
  getJoins, getPairs,
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
  function recurse(from, to, visited = new Set(), arr = [ to ]) {
    return !visited.has(to)
      ? joins
        .filter(([ , v ]) => v.includes(to))
        .reduce((acc, [ k ]) => {
          visited.add(to);
          return k !== from
            ? acc.concat(recurse(from, k, visited, [ k ].concat(arr)))
            : acc.concat([ [ k ].concat(arr) ]);
        }, [])
        .sort((a, b) => a.length > b.length)
      : [];
  }
  return (...x) => recurse(...x).shift();
};

const createFinder = (edges) => ([ from, to ]) =>
  Object.keys(edges)
    .filter(k => edges[k].find(([ x, y ]) => x === from && y === to));

const prepareThru = (finder, allEdges, stateKey) => {
  const joins = getJoins(allEdges);
  const recurse = shortestPath(joins);
  const getPaths = compose(map(x => recurse(...x)), getPairs);
  const getNames = compose(map(x => finder(x).shift()), getPairs);

  return (ctx) => (...states) => {
    const s = [ ctx[stateKey], ...states ];

    if (first(s) === last(s) && s.length === 2)
      return false;

    const paths = getPaths(s);
    if (paths.some(x => x === undefined))
      return false;

    return getNames(
      paths.reduce((acc, p) =>
        acc.concat(p.slice(1)), s.slice(0, 1))
    );
  };
};

const prepareDefaultMethods = (edges, stateKey) => {
  const finder = createFinder(edges);
  const allEdges = getAllEdges(edges);
  const createThru = prepareThru(finder, allEdges, stateKey);
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
        if (first(s) === last(s) && s.length === 2)
          throw new Error('Potential cyclic transition');

        const names = thru(...to);
        if (!names) throw new Error('Invalid transition');
        return sequence(...names.map(x => this[x]));
      },
      transitions: () => Object.keys(edges).filter(k => edges[k].find(([ x ]) => x === ctx[stateKey])),
    };
  };
};

const checkInitialState = (states, stateKey) =>
  ctx => states.includes(ctx[stateKey]);

const createMachineFactory = ({ transitions, handlers = {}, stateKey = 'state' } = {}) => {
  if (!transitions)
    throw new Error('No transitions supplied');

  const map = createMap(handlers);
  const states = getStates(transitions);
  const edges = getEdges(transitions);
  const transit = Object.keys(edges);
  const check = checkInitialState(states, stateKey);
  const createDefaultMethods = prepareDefaultMethods(edges, stateKey);

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
