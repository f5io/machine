# @paybase/machine

An asynchronous finite state machine library.

### Installation

This library requires `async/await` and `Proxy` support in your environment, so ideally `node>=7.4`.

```
$ npm install --save @paybase/machine
```

or

```
$ yarn add @paybase/machine
```
### Concepts
---

#### State machine

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
onBefore{T} -> onLeave{SA} -> onEnter{SB} -> on{SB} -> on{T} -> onAfter{T} 
```

Where `T` is equal to a `transition` name, `SA` is equal to the current state and `SB` is equal to the new target state.

For example, on a machines' transition from state `A` to state `B` over a tranition `foo`, the `handlers` order would fire like so:

```
onBeforeFoo -> onLeaveA -> onEnterB -> onB -> onFoo -> onAfterFoo
```

These `handlers` are supplied the context that is used at initialisation of the machine. In contrast to lots of other state machine implementations, a state machine created by this library can be initialised in any state without it transitioning. This allows state machines to be wrapped over data structures at any time in their life-cycle.

#### CLI

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

### Example Usage
---

Below is a simple state machine implementation and how it could be used.

#### Constructing the machine

Using the `createFSM` function, you can create a function that expects a `context`. Without a `context` the machine is not running.

```javascript
const initMachine = createFSM({
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

#### Using the machine

Once you have created the `initMachine` function, you need to supply a `context`. This `context` must contain a valid state derived from the supplied `transitions` which lives on the `stateKey` within the `context`.

```javascript
const machine = initMachine({
  stateId: 'A',
  anything: 'canBeSupplied',
  functionality: () => 'foo',
  etc: [ 1, 2, 3 ],
});

/**
 * The machine is now constructed and has some default methods,
 * plus methods that are derived from your `transition` names.
 */
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

#### Shortest path

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
   * The following `will` call is equivalent to `machine.will('B', 'C')`.
   */ 
  if (machine.will('D')) { // the machine has found a path to `D` thru `C` from `A`
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

### API
---

### Contributions
---

Contributions are welcomed and appreciated!

1. Fork this repository.
1. Make your changes, documenting your new code with comments.
1. Submit a pull request with a sane commit message.

Feel free to get in touch if you have any questions.

### License

Please see the `LICENSE` file for more information.
