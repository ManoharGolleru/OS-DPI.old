import { fromEvent, merge } from 'rxjs';

const over = fromEvent(document, 'pointerover');
const out = fromEvent(document, 'pointerout');
const down = fromEvent(document, 'pointerdown');
down.subscribe(x => x.preventDefault());
fromEvent(document, 'contextmenu').subscribe(x => x.preventDefault());
const pointer = merge(over, out, down);
pointer.subscribe(x => x.target instanceof HTMLButtonElement && !x.target.disabled && console.log(x.type, x.target.tagName, x.target.disabled));