#!/usr/bin/env node

const {
  program,
  getDotFromInput,
  parseInput, parseFormat, parseStyles,
  formatDot,
  writeOut
} = require('./utils');
const pkg = require('../package.json');
const { compose } = require('../src/utils');

program
  .name('visualise')
  .description('a tool for outputting svgs from finite state machines')
  .version(pkg.version)
  .option('-i, --input <value>', 'input to be visualised in the format .json, .js or .dot', parseInput)
  .option('-g, --graph <value>', 'supply a name for the graph')
  .option('-f, --format <value>', 'output format, either .svg or .dot, defaults to .svg', parseFormat, 'svg')
  .option('-o, --output <value>', 'output to file, if none supplied will output to stdout')
  .option('-s, --styles <value>', 'supply a css file of .dot styles', parseStyles)
  .parse(process.argv);

const run = compose(
  out => writeOut(program, out),
  dot => formatDot(program, dot),
  () => getDotFromInput(program),
  () => parseInput(program.input)
);

run();

