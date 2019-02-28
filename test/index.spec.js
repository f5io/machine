const test = require('tape');
const sinon = require('sinon');
const createMachineFactory = require('../');

test('[ factory ] - simple state machine', async t => {

  const transitions = {
    init: { from: [ 'A', 'B' ], to: 'C' },
    reset: { from: [ 'B', 'C' ], to: 'A' },
  };

  const onEnterA = ctx => (ctx.foo = 'bar');
  const onLeaveA = sinon.spy();
  const onEnterC = sinon.spy();

  const handlers = { onEnterA, onLeaveA, onEnterC };

  const fsm = createMachineFactory({ transitions, handlers });

  t.throws(() => fsm({ state: 'D' }), /Invalid initial state/, 'should throw an error when initializing with an invalid state');
  t.throws(() => fsm(), /Invalid initial state/, 'should throw an error when initializing with an invalid state');

  const machine = fsm({ state: 'A' });

  t.ok(machine.can('C'), 'should return true for a transition that it can perform');
  t.notOk(machine.can('D'), 'should return false for a transition that it cannot perform');

  t.throws(() => machine.state = 'C', /Missing lock/, 'should not be able to set the machines state directly');

  t.deepEquals(machine.transitions(), [ 'init' ], 'should return a list of available transitions from the current state');

  await machine.to('C');

  t.equals(machine.state, 'C', 'should have the new state correctly set on the machine');
  t.ok(onLeaveA.calledOnce, 'should have called the supplied handler once');
  t.ok(onEnterC.calledOnce, 'should have called the supplied handler once');

  await machine.to('A');

  t.equals(machine.state, 'A', 'should have the new state correctly set on the machine');
  t.equals(machine.foo, 'bar', 'should have the correctly applied mutations to the context');

  t.equals(machine.edge('C'), 'init', 'should return the correct transition name');
  t.throws(() => machine.edge('B'), /Invalid edge/, 'should error on and invalid edge request');

  try {
    await machine.reset();
    t.fail('should not allow the reset transition');
  } catch(e) {
    t.equals(e.message, 'Invalid transition', 'should throw an error not allowing the transition');
  }

  const machine2 = fsm({ state: 'B' });
  t.deepEquals(machine2.transitions(), [ 'init', 'reset' ], 'should contain all available transitions');

  t.end();

});

test('[ factory ] - handler order', async t => {

  const transitions = {
    init: { from: 'A', to: 'B' },
    effect: { from: [ 'A', 'B', 'D' ], to: 'C' },
    dispute: { from: 'C', to: 'D' },
  };

  const append = val => ctx => ctx.order.push(val);
  const handlers = {
    onBeforeInit: append('onBeforeInit'),
    onLeaveA: append('onLeaveA'),
    onInit: append('onInit'),
    onEnterB: append('onEnterB'),
    onB: append('onB'),
    onAfterInit: append('onAfterInit'),
  };

  const fsm = createMachineFactory({ transitions, handlers });
  const machine = fsm({ state: 'A', order: [] });

  const expectedOrder = [
    'onBeforeInit',
    'onLeaveA',
    'onInit',
    'onEnterB',
    'onB',
    'onAfterInit',
  ];

  await machine.to('B');

  t.deepEquals(machine.order, expectedOrder, 'life-cycle hooks should happen in the correct order');

  t.end();

});

test('[ factory ] - thru mechanisms', async t => {

  const transitions = {
    init: { from: 'A', to: 'B' },
    effect: { from: [ 'A', 'B', 'D' ], to: 'C' },
    dispute: { from: 'C', to: 'D' },
  };

  const onInit = sinon.spy();
  const onEffect = sinon.spy();
  const onDispute = sinon.spy();

  const fsm = createMachineFactory({ transitions, handlers: { onInit, onEffect, onDispute } });
  const machine = fsm({ state: 'A' });

  t.ok(machine.will('D'), 'should be able to transition thru to D');

  await machine.thru('D');

  t.equals(machine.state, 'D', 'should have the correct state');
  t.notOk(onInit.calledOnce, 'should have skipped the init handler');
  t.ok(onEffect.calledOnce, 'should have called the effect handler');
  t.ok(onDispute.calledOnce, 'shou;d have called the dispute handler');

  const machine2 = fsm({ state: 'A' });
  t.ok(machine2.will('B', 'D'), 'should be able to transition thru B to D');

  await machine2.thru('B', 'D');

  t.equals(machine2.state, 'D', 'should have the correct state');
  t.ok(onInit.calledOnce, 'should have called the init handler');
  t.ok(onEffect.calledTwice, 'should have called the effect handler');
  t.ok(onDispute.calledTwice, 'should have called the dispute handler');

  t.notOk(machine2.will('A'), 'should not be able to transition back');

  t.throws(() => machine2.thru('A'), /Invalid transition/, 'should throw invalid transition');
  t.throws(() => machine2.to('A'), /Invalid transition/, 'should throw invalid transition');

  const machine3 = fsm({ state: 'C' });
  t.notOk(machine3.will('C'), 'should not allow a potential cyclic transition');
  t.throws(() => machine3.thru('C'), /Potential cyclic transition/, 'should throw a potential cyclic transition');
  t.ok(machine3.will('D', 'C'), 'should be able to do a cyclic transition if an extra node is supplied');
  t.notOk(machine3.path('C'), 'should not return path pairs for a potentially cyclical transition');
  t.deepEquals(machine3.path('D', 'C'), [ [ 'C', 'D' ], [ 'D', 'C' ] ], 'should return path pairs for a valid transition');

  t.end();

});

test('[ factory ] - allow cyclical transitions', async t => {

  const transitions = {
    cycle: { from: 'A', to: 'A' },
  };

  const onEnterA = sinon.spy();

  const fsm = createMachineFactory({ transitions, handlers: { onEnterA }, allowCyclicalTransitions: true });
  const machine = fsm({ state: 'A' });
  t.ok(machine.will('A'), 'should allow cyclic transitions if allowed by the machine factory');
  t.deepEquals(machine.path('A'), [ [ 'A', 'A' ] ], 'should return path pairs for a valid transition');

  await machine.thru('A');

  t.ok(onEnterA.calledOnce, 'should call the on enter A handler once');

  t.end();

});

test('[ factory ] - other args', async t => {

  const transitions = {
    init: { from: [ 'A', 'B' ], to: 'C' },
    reset: { from: [ 'B', 'C' ], to: 'A' },
  };

  t.throws(() => createMachineFactory(), /No transitions supplied/, 'should error as no transitions are supplied to factory');

  const fsm = createMachineFactory({ transitions, stateKey: 'beam' });

  t.throws(() => fsm({ state: 'A' }), /Invalid initial state/, 'should error as not state is supplied on the stateKey');

  const machine = fsm({ beam: 'A' });

  await machine.to('C');

  t.equals(machine.beam, 'C', 'should set the correct stateKey on the machine');

  t.end();

});


test.only('[ factory ] - shortest path', async t => {

  const transitions = {
    process: {
      from: [ 'PENDING', 'ERRORED' ],
      to: 'PROCESSING',
    },
    fail: { from: 'IN_REVIEW', to: 'FAILED' },
    pass: {
      from: [ 'PROCESSING', 'IN_REVIEW' ],
      to: 'PASSED',
    },
    review: { from: 'PROCESSING', to: 'IN_REVIEW' },
    error: { from: 'PROCESSING', to: 'ERRORED' },
  };

  const fsm = createMachineFactory({ transitions, stateKey: 'beam' });

  const machine = fsm({ beam: 'PENDING' });

  const path = await machine.path('PASSED');

  console.log(path);

  t.deepEquals(path, [ [ 'PENDING', 'PROCESSING' ], [ 'PROCESSING', 'PASSED' ] ], 'should find shortest path');

  await machine.thru('PASSED');

  t.equals(machine.beam, 'PASSED', 'should set the correct stateKey on the machine');

  t.end();

});
