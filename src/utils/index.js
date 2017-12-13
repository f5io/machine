const unique = arr => [ ...new Set(arr) ];

const toArray = arr => Array.isArray(arr) ? arr : [ arr ];

const sentenceCase = (string) =>
  string.charAt(0).toUpperCase() + string.slice(1);

const first = x => x[0];
const last = x => x[x.length - 1];

const map = fn => x => x.map(fn);

const compose = (...fns) =>
  fns.reduce((f, g) => (...args) => f(g(...args)));

const sequence = (...fns) =>
  fns.reduce((acc, fn) => acc.then(fn), Promise.resolve());

const getPairs = (items) =>
  items.reduce((acc, item, i, arr) =>
    arr[ i + 1 ] != null
      ? acc.concat([ [ item, arr[ i + 1 ] ] ])
      : acc, []);

const getJoins = (edges) =>
  [ ...edges.reduce((acc, [ from, to ]) =>
    acc.set(from, acc.has(from)
      ? acc.get(from).concat(to)
      : [ to ]), new Map()).entries() ];

const getSequence = paths =>
  paths.reduce((acc, p) => acc.concat(p.slice(1)), paths[0].slice(0, 1));

const getStates = transitions =>
  Object.values(transitions).reduce((acc, { from, to }) =>
    unique(acc.concat(...toArray(from), ...toArray(to))), []);

const getEdges = transitions =>
  Object.entries(transitions).reduce((acc, [ name,  { from, to } ]) =>
    (acc[name] = unique([].concat(...toArray(from).map(x => toArray(to).map(y => [ x, y ])))), acc), {});

const getAllEdges = edges =>
  Object.values(edges).reduce((acc, arr) => unique(acc.concat(arr)), []);

const enforceUppercase = any => sentenceCase(any.toString());

exports.first = first;
exports.last = last;
exports.map = map;
exports.compose = compose;
exports.sequence = sequence;
exports.getPairs = getPairs;
exports.getJoins = getJoins;
exports.getSequence = getSequence;
exports.getStates = getStates;
exports.getEdges = getEdges;
exports.getAllEdges = getAllEdges;
exports.enforceUppercase = enforceUppercase;

module.exports = {
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
  enforceUppercase,
};

