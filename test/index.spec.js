const test = require('tape');
const sinon = require('sinon');
const createFSM = require('../');

test('[ factory ] - simple state machine', async t => {

  const transitions = {
    init: { from: [ 'A', 'B' ], to: 'C' },
    reset: { from: [ 'B', 'C' ], to: 'A' },
  };

  const onEnterA = ctx => (ctx.foo = 'bar');
  const onLeaveA = sinon.spy();
  const onEnterC = sinon.spy();

  const handlers = { onEnterA, onLeaveA, onEnterC };

  const fsm = createFSM({ transitions, handlers });

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

test('[ factory ] - thru mechanisms', async t => {

  const transitions = {
    init: { from: 'A', to: 'B' },
    effect: { from: [ 'A', 'B', 'D' ], to: 'C' },
    dispute: { from: 'C', to: 'D' },
  };

  const onInit = sinon.spy();
  const onEffect = sinon.spy();
  const onDispute = sinon.spy();

  const fsm = createFSM({ transitions, handlers: { onInit, onEffect, onDispute } });
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

  t.end();

});

test('[ factory ] - other args', async t => {

  const transitions = {
    init: { from: [ 'A', 'B' ], to: 'C' },
    reset: { from: [ 'B', 'C' ], to: 'A' },
  };

  t.throws(() => createFSM(), /No transitions supplied/, 'should error as no transitions are supplied to factory');

  const fsm = createFSM({ transitions, stateKey: 'beam' });

  t.throws(() => fsm({ state: 'A' }), /Invalid initial state/, 'should error as not state is supplied on the stateKey');

  const machine = fsm({ beam: 'A' });

  await machine.to('C');

  t.equals(machine.beam, 'C', 'should set the correct stateKey on the machine');

  t.end();

});
