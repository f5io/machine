const createMachineFactory = require('../');
const transitions = require('./test.fsm.json');

module.exports = createMachineFactory({ transitions });
