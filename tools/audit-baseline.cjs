/* Auditoría reproducible del prototipo original. No sustituye un navegador.
 * Ejecutar desde la raíz: node tools/audit-baseline.cjs
 * El DOM y Canvas son dobles mínimos; solo se comprueba lógica y comandos.
 */
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const html = fs.readFileSync('cine_shot_visualizer_3d_pro.html', 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(source);
let commands = [];
const gradient = { addColorStop(...args) { commands.push(['stop', ...args]); } };
const context = new Proxy({}, {
  get(_, key) {
    if (key === 'measureText') return text => ({ width: text.length * 6 });
    if (key === 'createLinearGradient' || key === 'createRadialGradient') {
      return (...args) => { commands.push([key, ...args]); return gradient; };
    }
    return (...args) => commands.push([key, ...args]);
  },
  set(_, key, value) { commands.push(['set', key, typeof value === 'object' ? 'gradient' : value]); return true; }
});
const nodes = new Map();
function makeNode() {
  const classes = new Set();
  return {
    value: '', textContent: '', innerHTML: '', dataset: {}, children: [], events: {},
    classList: {
      add(x) { classes.add(x); }, remove(x) { classes.delete(x); },
      contains(x) { return classes.has(x); },
      toggle(x, force) { const yes = force ?? !classes.has(x); yes ? classes.add(x) : classes.delete(x); }
    },
    addEventListener(type, fn) { this.events[type] = fn; },
    appendChild(child) { this.children.push(child); },
    getContext() { return context; },
    getBoundingClientRect() { return {left:0, top:0, width:1000, height:700}; },
    toDataURL() { return 'data:image/jpeg;base64,AUDIT_STUB'; },
    click() {}, parentElement: { getBoundingClientRect() { return {width:1000,height:700}; } }
  };
}
const document = {
  getElementById(id) { if (!nodes.has(id)) nodes.set(id, makeNode()); return nodes.get(id); },
  querySelectorAll() { return []; }, createElement: makeNode
};
const sandbox = vm.createContext({ document, window: {devicePixelRatio:1, addEventListener() {}}, requestAnimationFrame() {}, Blob, URL });
vm.runInContext(source, sandbox);
const run = code => vm.runInContext(code, sandbox);
const baseline = run('JSON.stringify(state)');
const reset = () => run(`Object.assign(state, ${baseline})`);
const observations = [];
function record(id, observed) { observations.push({id, observed}); }

record('syntax', 'El script completo compila en Node. Esto no verifica APIs del navegador.');
reset();
run('state.focusTarget="actor_1"; state.selectedActorIdx=1;');
document.getElementById('btn-delete-actor').events.click();
record('focus_after_delete', run('({actors:state.actors.length, focusTarget:state.focusTarget, targetExists:!!state.actors[Number(state.focusTarget.split("_")[1])]})'));

reset();
run('state.location="forest"; state.sensorKey="s16"; state.sensorW=12.52; state.sensorH=7.41; state.grain=55;');
document.getElementById('btn-reset-all').events.click();
record('partial_reset', run('({location:state.location,sensorKey:state.sensorKey,grain:state.grain})'));

reset();
document.getElementById('sel-sensor').value = 'ff';
run('state.sensorKey="s16"; syncUI();');
record('stale_sensor_control', {state:run('state.sensorKey'),select:document.getElementById('sel-sensor').value,readout:document.getElementById('qb-sensor').textContent});

reset();
run('state.actors[0].name="<b>Nombre de prueba</b>"; renderActorListUI();');
record('name_interpolated_as_html', document.getElementById('char-list-box').children.at(-2).innerHTML.includes('<b>Nombre de prueba</b>'));

reset();
function render() { commands=[]; run('renderCameraView(mainCtx,1000,700,1)'); return JSON.stringify(commands); }
const originalRender = render();
run('state.ndSteps=7; state.shutterAngle=45; state.grain=60;');
record('nd_shutter_grain_no_render_effect', originalRender === render());

reset();
run('state.actors=[state.actors[0]]; state.camYaw=0;');
render();
const atZero = run('actorScreenBounds.length');
run('state.camYaw=90;');
render();
record('orbit_loses_origin_actor', {yaw0:atZero,yaw90:run('actorScreenBounds.length')});

reset();
run('state.camPanX=1;');
record('focus_distance_vs_render_depth', run('({autofocus:getActorActualDistance(state.actors[0]),renderDepthForYawPitchZero:state.camDist})'));

reset();
run('state.actors[0].x=1; state.actors[0].z=2; state.actors=[state.actors[0]];');
render();
const normalWidth = run('actorScreenBounds[0].x2-actorScreenBounds[0].x1');
run('state.squeeze=2;');
render();
record('actor_width_ignores_squeeze', {squeeze1:normalWidth,squeeze2:run('actorScreenBounds[0].x2-actorScreenBounds[0].x1')});

const report = {
  date:'2026-10-13', source:'cine_shot_visualizer_3d_pro.html',
  sha256:crypto.createHash('sha256').update(html).digest('hex'),
  method:'Node VM; DOM y Canvas simulados. Sin validación visual, CSS, rendimiento ni eventos nativos.',
  observations
};
console.log(JSON.stringify(report,null,2));
