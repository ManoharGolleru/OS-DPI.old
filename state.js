import merge from "mergerino";
import ABase from "./components/a-base";
import { html, render } from "uhtml";
import { designerRender } from "./designer";

const LSKEY = "4.state";

var State = {};
/* a map from elements to state variables they are observing */
/** @type {Map<ABase|Function, String[]>} */
const Listeners = new Map();

/** unified interface to state
 * @param {string} [name] - possibly dotted path to a value
 * @param {any} defaultValue
 * @returns {any} if name is defined, null otherwise
 */
export function state(name, defaultValue = null) {
  if (name && name.length) {
    return name.split(".").reduce((o, p) => (o ? o[p] : defaultValue), State);
  } else {
    return { ...State };
  }
}

/**
 * update the state with a patch and invoke any listeners
 *
 * @param {Object} patch - the changes to make to the state
 * @return {void}
 */
state.update = (patch) => {
  const oldState = State;
  State = merge(oldState, patch);
  const changed = new Set();
  for (const key in State) {
    if (State[key] !== oldState[key]) {
      changed.add(key);
    }
  }
  for (const key in oldState) {
    if (!(key in State)) {
      changed.add(key);
    }
  }
  for (const [element, names] of Listeners) {
    if (
      element instanceof ABase &&
      element.isConnected &&
      names.some((name) => changed.has(name))
    ) {
      element.render();
    } else if (
      element instanceof Function &&
      names.some((name) => changed.has(name))
    ) {
      element(...names.map((name) => state(name)));
    }
  }
  designerRender();

  const persist = JSON.stringify(State);
  window.localStorage.setItem(LSKEY, persist);
};

state.render = () => {
  for (const [element, _] of Listeners) {
    if (element instanceof ABase && element.isConnected) {
      element.render();
    }
  }
  designerRender();
};

/** state.observe - link this element to the state
 * @param {ABase|Function} element
 * @param {String[]} names - state names to observe
 */
state.observe = (element, ...names) => {
  Listeners.set(
    element,
    names.map((name) => name.split(".")[0])
  );
};

/** state.define - add a named state to the global system state
 * @param {String} name - name of the state
 * @param {any} default_value - value if not already defined
 */
state.define = (name, default_value) => {
  State = merge(State, {
    [name]: (/** @type {any} */ current_value) =>
      current_value || default_value,
  });
};

/** state.interpolate
 * @param {string} input
   @returns input with $name replaced by values from the state
*/
state.interpolate = (input) => {
  let result = input.replace(/(\$[a-zA-Z0-9_.]+)/, (_, name) => state(name));
  result = result.replace(/\$\{([a-zA-Z0-9_.]+)}/, (_, name) =>
    state("$" + name)
  );
  return result;
};

/** state.parseAction
 * @param {string} input
 * @param {Object} context
 */
state.parseAction = (input, context) => {
  return () => {
    const action = {};
    for (const match of input.matchAll(/(\$\w+)\s*=\s*(\$?\w+)/g)) {
      if (match[2].startsWith("$")) {
        action[match[1]] = state.interpolate(match[2]);
      } else {
        action[match[1]] = context[match[2]];
      }
    }
    state.update(action);
  };
};

/* persistence */
const persist = window.localStorage.getItem(LSKEY);
if (persist) {
  State = JSON.parse(persist);
}
