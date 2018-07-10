# @paybase/machine

An asynchronous finite state machine library for Node.js and the browser.

[![npm version](https://badge.fury.io/js/%40paybase%2Fmachine.svg)](https://badge.fury.io/js/%40paybase%2Fmachine)

## Installation

This library requires `async/await` and `Proxy` support in your Node.js runtime, so ideally `node>=7.4`.

```
$ npm install --save @paybase/machine
```

or

```
$ yarn add @paybase/machine
```

## Concepts

With this library, a finite state machine is defined with an object containing a list of transitions, in the format:

```javascript
{
  [transitionName]: { from: [...states], to: [...states] },
  ...more transitions
}
```

A named `transition` defines an edge on a graph that allows a transition between the `from` and `to` states. The supplied `from` and `to` properties can either be a singular state string or an array of state strings.

Further to this, a state machine can be supplied with `handlers` which hook into the life-cycle of the machine. A state transition would flow through `handlers` in a particular order:

```
onBefore{T} -> onLeave{CS} -> on{T} -> onEnter{TS} -> on{TS} -> onAfter{T}
```

Where `T` is equal to a `transition` name, `CS` is equal to the current state and `TS` is equal to the new target state.

For example, on a machines' transition from state `A` to state `B` over a transition `foo`, the `handlers` order would fire like so:

```
onBeforeFoo -> onLeaveA -> onFoo -> onEnterB -> onB -> onAfterFoo
```

These `handlers` are supplied the context that is used at initialisation of the machine. In contrast to many other state machine implementations, a state machine created by this library can be initialised in any state without forced transitioning. This allows state machines to be wrapped over data structures at any time in their life-cycle.

## API

The library exposes one function which is used to create a machine factory.

#### `createMachineFactory({ stateKey = 'state', allowCyclicalTransitions = false, handlers = {}, transitions })` -> `MachineFactory`

The machine factory creator takes an options object containing 3 properties:

- `stateKey` - defaults to `'state'`, determines the key on which the state will be defined on the context
- `allowCyclicalTransitions` - defaults to `false`, determines whether the machine should allow cyclical transitions
- `handlers` - defaults to `{}`, defines optional life-cycle hooks for the machine
- `transitions` - required, defines transitions keyed by name containing `from`/`to` attributes of the type `string|number|array<string|number>`

A machine factory is returned which is used to initialise a machine. 

#### `machineFactory(context)` -> `Machine`

This function requires a `context` object to be passed in. It will check whether a valid state is defined at `context[stateKey]` (see above).

The returned `Machine` will contain the following default methods:

- `Machine.can(to)` -> `Boolean` - The `can` method takes a state to transition to and will return a `Boolean` as to whether the machine can transition directly to that state
- `Machine.to(to)` -> `Promise` - The `to` method will attempt to transition the machine to the supplied state, otherwise will throw an error if unavailable
- `Machine.edge(to)` -> `string` - The `edge` method will return the name of the transition that fulfils the transtion to the supplied state, otherwise will throw an error if none is available
- `Machine.will(...to)` -> `Boolean` - The `will` method takes any number of states and attempts to find a shortest path between the current state and each state supplied, eventually ending at the last supplied state, returning a `Boolean`
- `Machine.thru(...to)` -> `Promise` - The `thru` method, similarly to the `will` method, takes any number of states and attempts to find a shortest path between the current state and each state supplied, eventually ending at the last supplied state, then enacts the change to the machine by transitioning through all the states
- `Machine.path(...to)` -> `Boolean|Array<Array<String>>` - The `path` method, similarly to the `will` method takes any number of states and returns either `false` denoting an invalid transition, or an `Array` of pair tuples, ie. `[ ['A', 'B'], ['B', 'C'] ]` denoting the state changes it would take to achieve the transition, without effecting any change
- `Machine.transitions` -> `array<string>` - The `transitions` methods will return an array of all available transition names from the current state

The `Machine` also will contain methods that are derived from the `transitions` object passed to the `createMachineFactory` function. For example, given the transitions object:

```
{
  foo: { from: 'A', to: 'B' },
  bar: { from: 'B', to: 'C' },
}
```

The `Machine` will have both a `foo` and a `bar` method which both return a `Promise` and, once called, enact that transition on the machine.

## Example Usage

Below is a simple state machine example and how it could be used.

### Constructing the machine

The `createMachineFactory` function expects a configuration object that contains the parameters for the state machine including transitions and life-cycle behaviour. This function will return a factory method (`machineFactory` below) that, when called, will create an instantiated instance of the defined state machine with a given context.

```javascript
const machineFactory = createMachineFactory({
  /**
   * The transitions describe all the states the machines can be in
   * and the transitions available between those states.
   */
  transitions: {
    init: { from: 'A', to: 'B' },
    effect: { from: [ 'A', 'B', 'D' ], to: 'C' },
    dispute: { from: 'C', to: 'D' }
  },
  /**
   * Handlers can be optionally supplied for any life-cycle
   * event available on the machine. All handlers are run
   * asynchronously.
   */
  handlers: {
    onInit: (ctx) => {
      /**
       * you can mutate the context, however you will not
       * be able to directly mutate the `ctx[stateKey]`.
       */
      ctx.hasInitialised = true;
    },
    onEffect: async (ctx) => {
      /**
       * all handlers are run asynchronously.
       */
      await timeout(200);
    }
  },
  /**
   * The state key option defines the key of the state within
   * the context object that will be supplied to the `initMachine`
   * function.
   */
  stateKey: 'stateId',
});
```

### Using the `machineFactory`

Once you have created your `machineFactory` function, you can instantiate instances of your machine with a given `context` object. This `context` object must contain the attribute defined by `stateKey` in the `createMachineFactory` method, and the value of this key must be a valid state (as derived from the supplied `transitions`).

```javascript
const machine = machineFactory({
  stateId: 'A',
  anything: 'canBeSupplied',
  functionality: () => 'foo',
  etc: [ 1, 2, 3 ],
});
```

### Transitioning states

The machine is now constructed and has some default methods, plus methods that are derived from your `transition` names.

```javascript
(async () => {
  /**
   * `can` is a default method which takes a state and will
   * will return a boolean as to whether the machine can
   * directly transition to the supplied state.
   */
  if (machine.can('B')) { // returns true as there is an edge from `A` to `B`
    /**
     * `edge` is a default method which takes a state to transition
     * to and will return the name of a transition if available.
     */
    const edge = machine.edge('B'); // returns `init`
    /**
     * `to` is a default method which takes a state to attempt
     * to transition to. If it is in an invalid transition it will
     * throw an error.
     */
    await machine.to('B');
    /**
     * The machine is now in state `B` and according to the `onInit` handler
     * `machine.hasInitialised` should exist and be equal to `true`. As described
     * above, the machine also exposes methods derived from the supplied `transition`
     * names.
     */
    await machine.effect();
    /**
     * The machine has taken around 200ms to transition into state `C` as defined
     * by the `timeout` in the `onEffect` handler.
     */
  }
})();
```

### Shortest path transitions

The library also contains a mechanism for transitioning along a shortest path to a desired state.

```javascript
const machine = initMachine({
  stateId: 'A',
});

(async () => {
  /**
   * `will` is a default method that takes a variadic number of states to pass thru
   * on it's way to the target state, and will return a boolean as to whether the transition can be
   * achieved ie. from the current state to the last in the arguments via the rest of the arguments.
   * The following `will` call is equivalent to `machine.will('C', 'D')`.
   */ 
  if (machine.will('D')) { // the machine has found a path to `D` thru `C` from `A`
    /**
     * `path` is a default method which will return an array of tuples denoting the changes in state
     * that will be made to enact change. In this case it will return `[ ['A', 'C'], ['C', 'D'] ]`.
     * If `path` is  passed states that make up an invalid transition, it will simply return `false`.
     */
    const pairs = machine.path('D'); 
    /**
     * `thru` is a default method that will enact a chain of state changes to reach the supplied
     * target state. It works in the same way as the `will` method.
     */
    await machine.thru('D');
    /**
     * The machine is now in state `D` having transitioned through every state on the way, in the
     * shortest possible path and passing through each of the handlers.
     */
  }
})();
```

## CLI

A command-line application is included within the package for creating svg diagrams of a defined state machine.

```
$ `npm bin`/visualise --help

  Usage: visualise [options]

  a tool for outputting svgs from finite state machines

  Options:

    -V, --version         output the version number
    -i, --input <value>   input to be visualised in the format .json, .js or .dot
    -g, --graph <value>   supply a name for the graph
    -f, --format <value>  output format, either .svg or .dot, defaults to .svg
    -o, --output <value>  output to file, if none supplied will output to stdout
    -s, --styles <value>  supply a css file of .dot styles
    -h, --help            output usage information
```

Supported input types include:

- `.js` files, which default export is a machine initialiser, ie. [see here](/test/test.fsm.js).
- `.json` files, which define transitions for a machine, ie. [see here](/test/test.fsm.json).
- `.dot` files, which define a graphviz representation of a graph, ie. [see here](/test/test.fsm.dot).

Output can be either `.dot` or `.svg` and can be styled with a CSS-like syntax, [shown here](/test/test.fsm.css). Below is an example of the svg output of using the following command with examples from this repo.

```
$ `npm bin`/visualise -i ./test/test.fsm.js -s ./test/test.fsm.css > ./test/test.fsm.svg
```

![state machine](/test/test.fsm.svg)

## Contributions

Contributions are welcomed and appreciated!

1. Fork this repository.
1. Make your changes, documenting your new code with comments.
1. Submit a pull request with a sane commit message.

Feel free to get in touch if you have any questions.

## License

Please see the `LICENSE` file for more information.
