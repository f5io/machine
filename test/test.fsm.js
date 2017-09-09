const createFSM = require('../');
const transitions = require('./test.fsm.json');

module.exports = createFSM({ transitions });
