const createMachineFactory = require('../dist/');
const transitions = require('./test.fsm.json');

module.exports = createMachineFactory({ transitions });
