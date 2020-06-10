const viz = require('viz.js');
const css = require('css-to-object');
const program = require('commander');
const { resolve, extname } = require('path');
const { readFileSync, writeFileSync, statSync } = require('fs');
const { getStates, getEdges, compose, map } = require('../../utils');

const _edges = Symbol.for('@@fsm/edges');
const _states = Symbol.for('@@fsm/states');

const objectToString = obj =>
  Object.entries(obj).reduce((acc, [ k, v ]) => acc += ` ${k} = "${v.replace(/"|'/g, '')}" `, '');

const statesToString = (states, styles) =>
  map(compose(
    ([ x, styles ]) => `  "${x}" [${styles}];`,
    ([ x, styles ]) => [ x, objectToString(styles) ], 
    x => [ x, Object.assign({ label: ` ${x} ` }, styles[`.node`], styles[`.node ${x}`]) ]
  ))(states).join('\n');

const edgeToString = (edge, name, styles, base) =>
  map(compose(
    ([ a, b, styles ]) => `  "${a}" -> "${b}" [${styles}];`,
    ([ a, b, styles ]) => [ a, b, objectToString(styles) ],
    ([ a, b ]) => [ a, b, Object.assign({}, base, styles[`.edge[${a}->${b}]`], styles[`.edge ${name}[${a}->${b}]`]) ]
  ))(edge).join('\n');

const edgesToString = (edges, styles) =>
  Object.entries(edges)
    .reduce((acc, [ name, x ]) => {
      const style = Object.assign({ label: ` ${name} ` }, styles[`.edge`], styles[`.edge ${name}`]);
      return acc += edgeToString(x, name, styles, style) + '\n';
    }, '')
    .slice(0, -1);

const graphStyles = (styles) =>
  Object.entries(styles[`.graph`] || {}).reduce((acc, [ k, v ]) => `  ${k}=${v};\n`, '');

const required = (input) => {
  throw new Error(`Could not find required ${input}, your input may be malformed`);
};

const fsmToDot = ({
  edges = required('edges'),
  states = required('states'),
  styles = {},
  name,
}) => {
  const stateStr = statesToString(states, styles);
  const edgeStr = edgesToString(edges, styles);
  const graphStr = graphStyles(styles);
  return `digraph "${name}" {\n${graphStr}\n${stateStr}\n${edgeStr}\n}`;
};

const exitOnError = (fn) => (...x) => {
  try {
    return fn(...x);
  } catch(e) {
    process.stderr.write(`
  \u001b[31mError: ${e.message}\u001b[39m
    `);
    program.outputHelp();
    process.stdout.write('\n');
    process.exit(1);
  }
};

const validateJSON = json => {
  const values = Object.values(json);
  const check = [ 'from', 'to' ];
  if (!values.every(x => {
    if (typeof x !== 'object') return false;
    const keys = Object.keys(x);
    if (keys.length !== 2) return false;
    return keys.every(k => check.includes(k));
  })) {
    throw new Error('Invalid JSON format state machine');
  }
};

const getDotFromInput = exitOnError(({ input, styles, graph = 'fsm' }) => {
  const ext = extname(input);
  switch (ext) {
    case '.js':
      const fjs = require(resolve(process.cwd(), input));
      if (fjs[_edges] && fjs[_states]) {
        return fsmToDot({ edges: fjs[_edges], states: fjs[_states], styles, name: graph });
      } else {
        validateJSON(fjs);
        return fsmToDot({ edges: getEdges(fjs), states: getStates(fjs), styles, name: graph });
      }
    case '.json':
      const fjson = require(resolve(process.cwd(), input));
      validateJSON(fjson); 
      return fsmToDot({ edges: getEdges(fjson), states: getStates(fjson), styles, name: graph });
    default:
      return readFileSync(resolve(process.cwd(), input), 'utf8');
  }
});

const parseInput = exitOnError((value) => {
  if (/\.(js|json|dot)$/.test(value)) {
    statSync(resolve(process.cwd(), value));
    return value;
  } else {
    throw new Error('Unsupported input type, please supply .json, .js or .dot');
  }
});

const parseFormat = exitOnError((value) => {
  if (/^\.?(svg|dot)$/.test(value)) {
    return value.replace(/\./g, '');
  } else {
    throw new Error('Unsupported output type, please specify either .dot or .svg');
  }
});

const parseStyles = exitOnError((value) => {
  if (/\.css$/.test(value)) {
    const path = resolve(process.cwd(), value);
    statSync(path);
    return css(readFileSync(path, 'utf8'));
  } else {
    throw new Error('Unsupported style type, please supply a .css file');
  }
});

const writeOut = exitOnError(({ output }, out) =>
  output
    ? writeFileSync(resolve(process.cwd(), output), out, 'utf8')
    : process.stdout.write(out));

const formatDot = exitOnError(({ format }, dot) =>
  format === 'svg' ? viz(dot) : dot);

exports.program = program;
exports.getDotFromInput = getDotFromInput;
exports.parseInput = parseInput;
exports.parseFormat = parseFormat;
exports.parseStyles = parseStyles;
exports.formatDot = formatDot;
exports.writeOut = writeOut;
