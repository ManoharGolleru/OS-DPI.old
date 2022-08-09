import { render, html } from "uhtml";
import { assemble } from "./components/index";
import { Rules } from "./rules";
import { Data } from "./data";
import { State } from "./state";
import { Designer } from "./components/designer";
import { Monitor } from "./components/monitor";
import { ToolBar } from "./components/toolbar";
import db from "./db";
import pleaseWait from "./components/wait";
import { fileOpen } from "browser-fs-access";
import css from "ustyler";
import { ButtonWrap } from "./components/access";
import Globals from "./globals";
import { TreeBase } from "./components/treebase";
import { PatternManager } from "./components/access/pattern";
import { MethodChooser } from "./components/access/method";

const safe = true;

/** @param {Element} where
 * @param {Hole} what
 */
function safeRender(where, what) {
  let r;
  if (safe) {
    try {
      r = render(where, what);
    } catch (error) {
      console.log("crash", error);
      window.location.reload();
      return;
    }
  } else {
    r = render(where, what);
  }
  return r;
}

/** let me wait for the page to load */
const pageLoaded = new Promise((resolve) => {
  window.addEventListener("load", () => {
    document.body.classList.add("loaded");
    resolve(true);
  });
});

/** welcome screen
 */
async function welcome() {
  // clear any values left over
  sessionStorage.clear();
  const names = await db.names();
  const saved = await db.saved();
  // setup data for the table
  names.sort();
  render(
    document.body,
    html`
      <div id="welcome">
        <div id="head)">
          <img class="icon" src="./icon.png" />
          <div>
            <h1>Welcome to the Project Open AAC OS-DPI</h1>
            <p>
              With this tool you can create experimental AAC interfaces. Start
              by loading a design from an ".osdpi" file or by creating a new
              one. Switch between the IDE and the User Interface with the "d"
              key.
            </p>
          </div>
        </div>
        <button
          onclick=${() =>
            fileOpen({
              mimeTypes: ["application/octet-stream"],
              extensions: [".osdpi", ".zip"],
              description: "OS-DPI designs",
              id: "os-dpi",
            })
              .then((file) => pleaseWait(db.readDesignFromFile(file)))
              .then(() => (window.location.hash = db.designName))}
        >
          Import
        </button>
        <button
          onclick=${async () =>
            (window.location.hash = await db.uniqueName("new"))}
        >
          New
        </button>
        <h2>Loaded designs:</h2>
        ${names.map((name) => {
          const isSaved = saved.indexOf(name) >= 0;
          const ref = {};
          return html`<ul>
            <li>
              <a href=${"#" + name}>${name}</a>
              ${isSaved ? "Saved" : "Not saved"}

              <button
                ?disabled=${!isSaved}
                onclick=${async () => {
                  await db.unload(name);
                  welcome();
                }}
                ref=${ref}
              >
                Unload
              </button>
              ${!isSaved
                ? html`<label for=${name}>Enable unload without saving: </label>
                    <input
                      id=${name}
                      type="checkbox"
                      onchange=${({ currentTarget }) => {
                        if (ref.current)
                          ref.current.disabled =
                            !currentTarget.checked && !isSaved;
                      }}
                    />`
                : html``}
            </li>
          </ul> `;
        })}
      </div>
    `
  );
}

css`
  #welcome {
    padding: 1em;
  }
  #welcome #head {
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
  }
  #welcome #head div {
    padding-left: 1em;
  }
  #welcome #head div p {
    max-width: 40em;
  }
`;

/** Load page and data then go
 */
export async function start() {
  if (window.location.search && !window.location.hash.slice(1)) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("fetch")) {
      await pleaseWait(db.readDesignFromURL(params.get("fetch")));
      window.history.replaceState(
        {},
        document.title,
        window.location.origin + window.location.pathname + "#" + db.designName
      );
    }
  }
  const name = window.location.hash.slice(1);
  if (!name) {
    return welcome();
  }
  db.setDesignName(name);
  const emptyPage = {
    type: "page",
    props: {},
    children: [
      {
        type: "speech",
        props: {},
        children: [],
      },
    ],
  };
  const layout = await db.read("layout", emptyPage);
  const rulesArray = await db.read("actions", []);
  const dataArray = await db.read("content", []);
  await pageLoaded;

  Globals.tree = assemble(layout);
  Globals.state = new State(`UIState`);
  Globals.rules = new Rules(rulesArray);
  Globals.data = new Data(dataArray);
  Globals.pattern = await PatternManager.load();
  Globals.method = await MethodChooser.load();
  Globals.restart = start;

  /** @param {() => void} f */
  function debounce(f) {
    let timeout = null;
    return () => {
      if (timeout) window.cancelAnimationFrame(timeout);
      timeout = window.requestAnimationFrame(f);
    };
  }

  /* Designer */
  Globals.state.define("editing", layout === emptyPage);
  const designer = new Designer({}, null);

  /* ToolBar */
  const toolbar = new ToolBar({}, null);

  /* Monitor */
  const monitor = new Monitor({}, null);

  function renderUI() {
    let IDE = html``;
    if (Globals.state.get("editing")) {
      IDE = html`
        <div
          id="designer"
          onclick=${(/** @type {InputEventWithTarget} */ event) => {
            const button = ButtonWrap(event.target);
            if (button.access && "onClick" in button.access) {
              button.access.onClick(event);
            }
          }}
        >
          ${designer.template()}
        </div>
        <div id="monitor">${monitor.template()}</div>
        <div id="toolbar">${toolbar.template()}</div>
      `;
    }
    document.body.classList.toggle("designing", Globals.state.get("editing"));
    safeRender(
      document.body,
      html`<div id="UI">${Globals.tree.template()}</div>
        ${IDE}`
    );
    Globals.pattern.refresh();
  }
  Globals.state.observe(debounce(renderUI));
  renderUI();
}

/* Watch for updates happening in other tabs */
const channel = new BroadcastChannel("os-dpi");
/** @param {MessageEvent} event */
channel.onmessage = (event) => {
  const message = /** @type {UpdateNotification} */ (event.data);
  if (db.designName == message.name) {
    if (message.action == "update") {
      start();
    } else if (message.action == "rename") {
      window.location.hash = message.newName;
    }
  }
};
db.addUpdateListener((message) => {
  channel.postMessage(message);
});

// open and close the ide with the d key
/** @param {KeyboardEvent} event */
document.addEventListener("keydown", (event) => {
  if (event.key == "d") {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target && target.tagName != "INPUT" && target.tagName != "TEXTAREA") {
      event.preventDefault();
      event.stopPropagation();
      if (Globals.state) {
        document.body.classList.toggle("designing");
        Globals.state.update({ editing: !Globals.state.get("editing") });
      }
    }
  }
});

// watch for changes to the hash such as using the browser back button
window.addEventListener("hashchange", () => {
  sessionStorage.clear();
  start();
});

/** @typedef {PointerEvent & { target: HTMLElement }} ClickEvent */
// I think this code mapped clicks back to the tree but no longer...
// document.addEventListener("click", (/** @type {ClickEvent} */ event) => {
//   const target = event.target;
//   let text = "";
//   for (let n = target; n.parentElement && !text; n = n.parentElement) {
//     text = n.textContent || "";
//   }
//   let id = "none";
//   if (target instanceof HTMLButtonElement && target.dataset.id) {
//     id = target.dataset.id;
//   } else {
//     const div = target.closest('div[id^="osdpi"]');
//     if (div) {
//       id = div.id;
//     }
//   }
// });

start();
