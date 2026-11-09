// Satsooma Sign-off app
// Keep APP_VERSION in step with VERSION in sw.js.
'use strict';

const APP_VERSION = '0.5.1';
const JOB_REF_RE = /^(ASHP|SERV)-\d{4}-\d{2}-\d{3}$/;
const MAX_PHOTOS = 8;

/* ---------- small helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ukDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const ukDateTime = d => `${ukDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const isoToUk = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const ANSWER_LABEL = { yes: 'Yes', no: 'No', na: 'N/A' };
const answerOptions = it => it.choices || ['yes', 'no', 'na'].map(key => ({ key, label: ANSWER_LABEL[key] }));
const answerLabel = (it, key) => (answerOptions(it).find(o => o.key === key) || {}).label;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
};

function getChecklist(id) { return CHECKLISTS.find(c => c.id === id); }
function allItems(cl) { return cl.sections.flatMap(s => s.items.map(it => ({ ...it, section: s.title }))); }

let toastTimer;
function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/* ---------- storage (IndexedDB: reports + the unfinished draft) ---------- */
let dbPromise;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open('satsooma-signoff', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('reports', { keyPath: 'id' });
        d.createObjectStore('drafts');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbPromise;
}
async function tx(name, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(name, mode);
    let out;
    const req = fn(t.objectStore(name));
    if (req) req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const putReport = rec => tx('reports', 'readwrite', s => s.put(rec));
const getReport = id => tx('reports', 'readonly', s => s.get(id));
const allReports = () => tx('reports', 'readonly', s => s.getAll());
const deleteReport = id => tx('reports', 'readwrite', s => s.delete(id));
const saveDraft = d => tx('drafts', 'readwrite', s => s.put(d, 'current'));
const loadDraft = () => tx('drafts', 'readonly', s => s.get('current'));
const clearDraft = () => tx('drafts', 'readwrite', s => s.delete('current'));

/* ---------- app state ---------- */
const app = $('#app');
let form = null;        // the report being filled in
let openRec = null;     // the saved report on screen (kept in memory so Send works on first tap)
let draftTimer = null;

function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => { if (form) saveDraft(form).catch(() => {}); }, 400);
}

function statusChip(r) {
  if (r.status === 'sent') return `<span class="chip sent">✓ Sent ${esc(ukDateTime(new Date(r.sentAt)))}</span>`;
  return `<span class="chip unsent">Not sent · saved ${esc(ukDate(new Date(r.createdAt)))}</span>`;
}

/* Two-tap confirm for destructive buttons (no pop-up dialogs). */
function armed(btn, label) {
  if (btn.dataset.armed === '1') return true;
  btn.dataset.armed = '1';
  btn.dataset.label = btn.textContent;
  btn.textContent = label;
  btn.classList.add('armed');
  setTimeout(() => {
    if (btn.isConnected && btn.dataset.armed === '1') {
      btn.dataset.armed = ''; btn.textContent = btn.dataset.label; btn.classList.remove('armed');
    }
  }, 4000);
  return false;
}

/* ---------- HOME ---------- */
async function showHome() {
  form = null; openRec = null;
  const [reports, draft] = await Promise.all([allReports(), loadDraft()]);
  reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const unsent = reports.filter(r => r.status !== 'sent').length;

  app.innerHTML = `
    ${standalone ? '' : `<section class="card hint small">
      <strong>Tip:</strong> add this app to your Home Screen and always open it from the icon.
      Reports saved in the browser don't show up in the Home Screen app.</section>`}
    ${draft ? `<section class="card">
      <p class="kicker">Unfinished report</p>
      <h2>${esc(draft.jobRef || 'No job reference yet')}</h2>
      <p class="muted">${esc(getChecklist(draft.checklistId)?.name || '')}${draft.surname ? ' · ' + esc(draft.surname) : ''} · started ${esc(ukDateTime(new Date(draft.startedAt)))}</p>
      <div class="row">
        <button class="btn primary" data-act="resume">Carry on</button>
        <button class="btn danger" data-act="discard">Discard</button>
      </div></section>` : ''}
    <section class="card">
      <h1>New report</h1>
      <div class="stack">
        ${CHECKLISTS.map(c => `<button class="btn big" data-act="new" data-id="${esc(c.id)}">
          <span>${esc(c.name)}${c.draft ? ' (trial)' : ''}</span><small>${esc(c.blurb)}</small></button>`).join('')}
      </div>
    </section>
    <section class="card">
      <h2>Saved reports</h2>
      ${unsent ? `<p class="small"><strong>${unsent} not sent.</strong> Open a report to send it.</p>` : ''}
      ${reports.length ? `<ul class="reports">${reports.map(r => `<li><button data-act="open" data-id="${esc(r.id)}">
          <span class="ref">${esc(r.jobRef)}</span>
          <span class="sub">${esc(r.checklistName)} · ${esc(r.surname)} · ${esc(isoToUk(r.visitDate))}</span>
          ${statusChip(r)}</button></li>`).join('')}</ul>`
        : '<p class="muted small">No reports yet. Finished reports stay here so you can send them again if needed.</p>'}
    </section>
    <p class="foot">App version ${APP_VERSION}</p>`;
  window.scrollTo(0, 0);
}

/* ---------- FORM ---------- */
function blankForm(checklistId) {
  return {
    draftId: uid(), checklistId, startedAt: new Date().toISOString(),
    jobRef: '', surname: '', engineer: store.get('engineerName') || '', visitDate: todayIso(),
    answers: {}, notes: {}, values: {}, units: {}, itemPhotos: {}, texts: {}, extra: {}, snags: '', photos: [],
    engineerSig: null, engineerSigAt: null,
    customerNotPresent: false, customerName: '', customerSig: null, customerSigAt: null
  };
}

function unitFor(it, f) {
  const key = it.id + '.' + f.id;
  if (!f.units) return f.unit || '';
  const u = form.units[key] || store.get('unit.' + key);
  return f.units.includes(u) ? u : f.units[0];
}

function fieldsHtml(it) {
  if (!it.fields) return '';
  return `<div class="readings">${it.fields.map(f => {
    const key = it.id + '.' + f.id;
    const fid = 'v-' + key.replace(/[^a-z0-9-]/gi, '-');
    const unit = unitFor(it, f);
    const unitHtml = f.units
      ? `<select data-unit="${esc(key)}" aria-label="${esc(f.label)} units">${f.units.map(u => `<option value="${esc(u)}"${u === unit ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select>`
      : (unit ? `<span class="unit">${esc(unit)}</span>` : '');
    const mode = f.text || f.signed ? 'text' : 'decimal';
    return `<div class="reading">
      <label for="${fid}">${esc(f.label)}</label>
      <div class="rinput"><input type="text" id="${fid}" data-val="${esc(key)}" value="${esc(form.values[key] || '')}" inputmode="${mode}" autocomplete="off"${f.text ? '' : ' autocorrect="off" spellcheck="false"'}>${unitHtml}</div>
    </div>`;
  }).join('')}</div>`;
}

function itemPhotoHtml(it) {
  if (!it.photo) return '';
  const p = form.itemPhotos[it.id];
  return `<div class="itemphoto" data-photo-for="${esc(it.id)}">${p
    ? `<div class="photo"><img src="${p}" alt="${esc(it.photo)}"><button type="button" data-act="rmitemphoto" data-id="${esc(it.id)}" aria-label="Remove photo">×</button></div>`
    : `<label class="btn block filebtn"><input type="file" accept="image/*" capture="environment" data-itemphoto="${esc(it.id)}">📷 Take photo</label>`}</div>`;
}

function itemHtml(it) {
  const a = form.answers[it.id];
  const note = form.notes[it.id] || '';
  const showNote = a === 'no' || note;
  return `<div class="item" id="item-${esc(it.id)}" data-item="${esc(it.id)}">
    <p class="q">${esc(it.text)}</p>
    <div class="seg${it.choices ? ' choices' : ''}" role="group" aria-label="${esc(it.text)}">
      ${answerOptions(it).map(o => `<button type="button" data-ans="${esc(o.key)}" aria-pressed="${a === o.key}">${esc(o.label)}</button>`).join('')}
    </div>
    ${fieldsHtml(it)}
    ${itemPhotoHtml(it)}
    ${showNote ? '' : '<button type="button" class="notelink" data-act="addnote">+ Add a note</button>'}
    <textarea data-note="${esc(it.id)}" placeholder="${a === 'no' ? 'What is outstanding, and what happens next?' : 'Note'}" ${showNote ? '' : 'hidden'}>${esc(note)}</textarea>
  </div>`;
}

function photosHtml() {
  return form.photos.map((p, i) => `<div class="photo"><img src="${p}" alt="Photo ${i + 1}"><button type="button" data-act="rmphoto" data-i="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`).join('');
}

function sigHtml(who, title, declaration, nameHtml) {
  return `<div class="sig" id="sig-${who}">
    <p class="label">${title}</p>
    <p class="declaration">${esc(declaration)}</p>
    ${nameHtml}
    <div class="sigwrap"><canvas class="sigpad" data-sig="${who}"></canvas><div class="placeholder" data-ph="${who}">Sign here with your finger</div></div>
    <div class="sigmeta"><span data-sigtime="${who}"></span><button type="button" class="btn small" data-act="clearsig" data-who="${who}">Clear</button></div>
  </div>`;
}

// Per-checklist rules for the job reference. Install: strict ASHP/SERV format.
// Service: optional, any format (service jobs don't have a fixed structure yet).
function refRules(cl) {
  const r = cl.jobRef || {};
  return {
    required: r.required !== false,
    strict: r.strict !== false,
    label: r.label || 'Job reference',
    placeholder: r.placeholder || 'ASHP-2026-09-104',
    help: r.help || 'As it appears on the job sheet: ASHP-YYYY-MM-NNN or SERV-YYYY-MM-NNN'
  };
}
// The "notes" card. onPdf: false keeps it off the PDF (it still goes in the data file).
function officeNotes(cl) {
  const o = cl.officeNotes || {};
  return {
    title: o.title || 'Outstanding or follow-up',
    label: o.label || 'Anything left to do, snags, or notes for the office',
    placeholder: o.placeholder || 'Leave blank if nothing is outstanding',
    onPdf: o.onPdf !== false
  };
}

function showForm() {
  const cl = getChecklist(form.checklistId);
  form.values = form.values || {};   // drafts started on an older version
  form.units = form.units || {};
  form.itemPhotos = form.itemPhotos || {};
  form.texts = form.texts || {};
  form.extra = form.extra || {};
  const ref = refRules(cl);
  const office = officeNotes(cl);
  app.innerHTML = `
    <button class="back" data-act="home">‹ Home (your progress is kept)</button>
    ${cl.draft ? `<div class="draftnote"><strong>Trial version.</strong> We're still fine-tuning this checklist, so questions may be added, removed or reworded. If anything is missing or unclear, let Martin know.</div>` : ''}
    <section class="card">
      <h1>${esc(cl.name)}</h1>
      <div class="field" id="f-jobRef">
        <label for="jobRef">${esc(ref.label)}</label>
        <input type="text" id="jobRef" data-field="jobRef" value="${esc(form.jobRef)}" placeholder="${esc(ref.placeholder)}" autocapitalize="characters" autocomplete="off" spellcheck="false" inputmode="text">
        <p class="help">${esc(ref.help)}</p>
      </div>
      <div class="field" id="f-surname">
        <label for="surname">Customer surname</label>
        <input type="text" id="surname" data-field="surname" value="${esc(form.surname)}" autocomplete="off">
      </div>
      ${(cl.headerFields || []).map(h => `<div class="field" id="f-x-${esc(h.id)}">
        <label for="x-${esc(h.id)}">${esc(h.label)}</label>
        <input type="text" id="x-${esc(h.id)}" data-extra="${esc(h.id)}" value="${esc(form.extra[h.id] || '')}" autocomplete="off">
        ${h.help ? `<p class="help">${esc(h.help)}</p>` : ''}
      </div>`).join('')}
      <div class="field" id="f-engineer">
        <label for="engineer">Engineer name</label>
        <input type="text" id="engineer" data-field="engineer" value="${esc(form.engineer)}" autocomplete="name">
      </div>
      <div class="field" id="f-visitDate">
        <label for="visitDate">Visit date</label>
        <input type="date" id="visitDate" data-field="visitDate" value="${esc(form.visitDate)}">
      </div>
    </section>
    ${cl.sections.map(sec => `<section class="card"><h2>${esc(sec.title)}</h2>${sec.items.map(itemHtml).join('')}</section>`).join('')}
    ${(cl.textBlocks || []).map(b => `<section class="card" id="t-${esc(b.id)}">
      <h2>${esc(b.title)}</h2>
      <div class="field">
        <label for="tx-${esc(b.id)}">${esc(b.label)}</label>
        <textarea id="tx-${esc(b.id)}" data-text="${esc(b.id)}" placeholder="${esc(b.placeholder || '')}">${esc(form.texts[b.id] || '')}</textarea>
      </div></section>`).join('')}
    <section class="card">
      <h2>Photos</h2>
      <p class="muted small">Optional. Up to ${MAX_PHOTOS}. They go into the PDF.</p>
      <div class="photos" id="photos">${photosHtml()}</div>
      <label class="btn block filebtn" id="addPhotoBtn"><input type="file" id="photoInput" accept="image/*" multiple>+ Add photos</label>
    </section>
    <section class="card">
      <h2>${esc(office.title)}</h2>
      <div class="field">
        <label for="snags">${esc(office.label)}</label>
        <textarea id="snags" data-field="snags" placeholder="${esc(office.placeholder)}">${esc(form.snags)}</textarea>
      </div>
    </section>
    <section class="card">
      <h2>${esc(cl.signOffTitle || 'Installer sign-off')}</h2>
      ${sigHtml('engineer', 'Engineer', cl.engineerDeclaration, '')}
    </section>
    <section class="card customercard">
      <h2>For the customer</h2>
      <label class="check"><input type="checkbox" id="customerNotPresent" ${form.customerNotPresent ? 'checked' : ''}> Customer not signing (not present, or prefers not to)</label>
      <div id="customerBlock" ${form.customerNotPresent ? 'hidden' : ''}>
        <p class="muted small">Hand the phone to the customer for this part.</p>
        <ul class="acks">${(cl.customerAcknowledgements || []).map(a => `<li>${esc(a)}</li>`).join('')}</ul>
        ${sigHtml('customer', 'Customer', cl.customerDeclaration, `<div class="field" id="f-customerName"><label for="customerName">Your name</label><input type="text" id="customerName" data-field="customerName" value="${esc(form.customerName)}" autocomplete="off"></div>`)}
        ${cl.customerNote ? `<p class="muted small">${esc(cl.customerNote)}</p>` : ''}
      </div>
    </section>
    <div class="errors" id="errors" hidden></div>
    <button class="btn primary onpeel block" id="finishBtn" data-act="finish">Finish and save report</button>
    <p class="foot">The report is saved on this phone first. You send it on the next screen.</p>`;
  window.scrollTo(0, 0);
  initSigPad('engineer');
  initSigPad('customer');
  updatePhotoButton();
}

function updatePhotoButton() {
  const b = $('#addPhotoBtn');
  if (b) b.hidden = form.photos.length >= MAX_PHOTOS;
}

/* ---------- signature pads ---------- */
const pads = {};
function initSigPad(who) {
  const canvas = $(`canvas[data-sig="${who}"]`);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const key = who + 'Sig';
  let drawing = false, last = null, ink = false;

  function setup() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.width, r.height);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1A1A1A';
    if (form && form[key]) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, r.width, r.height); };
      img.src = form[key];
    }
    refresh();
  }
  function refresh() {
    const has = !!(form && form[key]);
    const ph = $(`[data-ph="${who}"]`); if (ph) ph.hidden = has || ink;
    const t = $(`[data-sigtime="${who}"]`);
    if (t) t.textContent = has && form[who + 'SigAt'] ? 'Signed ' + ukDateTime(new Date(form[who + 'SigAt'])) : '';
  }
  function pos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    drawing = true; ink = true; last = pos(e);
    ctx.beginPath(); ctx.arc(last.x, last.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#1A1A1A'; ctx.fill();
    refresh();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p;
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    form[key] = canvas.toDataURL('image/png');
    form[who + 'SigAt'] = new Date().toISOString();
    $(`#sig-${who}`)?.classList.remove('invalid');
    refresh(); scheduleDraftSave(); refreshErrors();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  pads[who] = {
    setup,
    clear() { form[key] = null; form[who + 'SigAt'] = null; ink = false; setup(); scheduleDraftSave(); }
  };
  setup();
}
window.addEventListener('resize', () => { Object.values(pads).forEach(p => p.setup()); });

/* ---------- photos ---------- */
async function downscale(file, max = 1600, quality = 0.72) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url;
    });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
    cx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- validation ---------- */
// Once the error list is showing, keep it up to date as things get fixed.
let errorsTimer;
function refreshErrors() {
  const box = $('#errors');
  if (!box || box.hidden) return;
  clearTimeout(errorsTimer);
  errorsTimer = setTimeout(() => {
    const errs = validate();
    if (!errs.length) { box.hidden = true; return; }
    box.innerHTML = errorListHtml(errs);
  }, 250);
}
function errorListHtml(errs) {
  return `<p>Almost there. Please sort these:</p><ul>${errs.map(e => `<li><a href="#${esc(e.id)}" data-goto="${esc(e.id)}">${esc(e.msg)}</a></li>`).join('')}</ul>`;
}

function validate() {
  const cl = getChecklist(form.checklistId);
  const errs = [];
  $$('.invalid', app).forEach(el => el.classList.remove('invalid'));
  const bad = (id, msg) => { errs.push({ id, msg }); $('#' + id)?.classList.add('invalid'); };

  const ref = refRules(cl);
  const jobRef = form.jobRef.trim();
  if (!jobRef) { if (ref.required) bad('f-jobRef', 'Add the job reference'); }
  else if (ref.strict && !JOB_REF_RE.test(jobRef)) bad('f-jobRef', 'Job reference should look like ASHP-2026-09-104 or SERV-2026-09-104');
  (cl.headerFields || []).forEach(h => { if (h.required && !(form.extra[h.id] || '').trim()) bad('f-x-' + h.id, 'Add the ' + h.label.toLowerCase()); });
  (cl.textBlocks || []).forEach(b => { if (b.required && !(form.texts[b.id] || '').trim()) bad('t-' + b.id, 'Fill in: ' + b.title); });
  if (!form.surname.trim()) bad('f-surname', 'Add the customer surname');
  if (!form.engineer.trim()) bad('f-engineer', 'Add your name');
  if (!form.visitDate) bad('f-visitDate', 'Add the visit date');

  const unanswered = allItems(cl).filter(it => !form.answers[it.id]);
  unanswered.forEach(it => $('#item-' + it.id)?.classList.add('invalid'));
  if (unanswered.length) errs.push({ id: 'item-' + unanswered[0].id, msg: `Answer every check (${unanswered.length} left)` });

  const noNote = allItems(cl).filter(it => form.answers[it.id] === 'no' && !(form.notes[it.id] || '').trim());
  noNote.forEach(it => $('#item-' + it.id)?.classList.add('invalid'));
  if (noNote.length) errs.push({ id: 'item-' + noNote[0].id, msg: `Add a note to every check answered No (${noNote.length})` });

  const noPhoto = allItems(cl).filter(it => it.photo && form.answers[it.id] === 'yes' && !(form.itemPhotos || {})[it.id]);
  noPhoto.forEach(it => $('#item-' + it.id)?.classList.add('invalid'));
  noPhoto.forEach(it => errs.push({ id: 'item-' + it.id, msg: `Take the photo: ${it.photo}` }));

  if (!form.engineerSig) bad('sig-engineer', 'Engineer signature needed');
  if (!form.customerNotPresent) {
    if (!form.customerName.trim()) bad('f-customerName', 'Add the customer name, or tick "Customer not signing"');
    if (!form.customerSig) bad('sig-customer', 'Customer signature needed, or tick "Customer not signing"');
  }
  return errs;
}

/* ---------- report data + PDF ---------- */
function buildData(cl, id, createdAt, pdfName) {
  const items = allItems(cl).map(it => ({
    section: it.section, id: it.id, question: it.text,
    answer: answerLabel(it, form.answers[it.id]), ...(it.choices ? { choice: true } : {}), note: (form.notes[it.id] || '').trim(),
    readings: (it.fields || []).map(f => {
      const value = ((form.values || {})[it.id + '.' + f.id] || '').trim();
      return value ? { id: f.id, label: f.label, value, unit: unitFor(it, f) } : null;
    }).filter(Boolean),
    ...(it.photo ? { photo: !!(form.itemPhotos || {})[it.id] } : {})
  }));
  const count = k => items.filter(i => !i.choice && i.answer === ANSWER_LABEL[k]).length;
  return {
    schema: 'satsooma.signoff.report',
    schema_version: 1,
    app_version: APP_VERSION,
    report_id: id,
    checklist: { id: cl.id, name: cl.name, version: cl.version, draft: !!cl.draft },
    job_reference: form.jobRef.trim(),
    header: Object.fromEntries((cl.headerFields || []).map(h => [h.id, ((form.extra || {})[h.id] || '').trim()])),
    text_sections: (cl.textBlocks || []).map(b => ({ id: b.id, title: b.title, text: ((form.texts || {})[b.id] || '').trim() })),
    customer_surname: form.surname.trim(),
    engineer: form.engineer.trim(),
    visit_date: isoToUk(form.visitDate),
    created_at: ukDateTime(createdAt),
    created_at_iso: createdAt.toISOString(),
    summary: { checks: items.filter(i => !i.choice).length, yes: count('yes'), no: count('no'), na: count('na') },
    items,
    outstanding: form.snags.trim(),
    outstanding_on_pdf: officeNotes(cl).onPdf,
    photos: form.photos.length + Object.values(form.itemPhotos || {}).filter(Boolean).length,
    sign_off: {
      engineer: { name: form.engineer.trim(), signed_at: form.engineerSigAt ? ukDateTime(new Date(form.engineerSigAt)) : '' },
      customer: form.customerNotPresent
        ? { present: false }
        : { present: true, name: form.customerName.trim(), signed_at: form.customerSigAt ? ukDateTime(new Date(form.customerSigAt)) : '', acknowledged: cl.customerAcknowledgements || [] }
    },
    pdf_file: pdfName
  };
}

// Logos used on the PDF: [file, height in points]. Order as on the website.
const PDF_ACCREDS = [['mcs.png', 34], ['recc.jpg', 25], ['tm.png', 23], ['hg.png', 27], ['rw.png', 25]];
let pdfAssetCache = null;
async function loadPdfAssets() {
  if (pdfAssetCache) return pdfAssetCache;
  const out = {};
  await Promise.all(['logo-white.png', ...PDF_ACCREDS.map(a => a[0])].map(async name => {
    try { const r = await fetch(name); if (r.ok) out[name] = new Uint8Array(await r.arrayBuffer()); } catch (e) { /* skip */ }
  }));
  pdfAssetCache = out;
  return out;
}

// The PDF's built-in fonts only cover Western European characters; swap anything else for "?".
const NOT_WINANSI = /[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g;
const pdfText = s => String(s ?? '').replace(/\t/g, ' ').replace(NOT_WINANSI, '?');
function dataUrlBytes(u) {
  const b = atob(u.split(',')[1]);
  const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}

async function buildPdf(cl, data) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  const refShown = data.job_reference || data.customer_surname;
  doc.setTitle(`${cl.name} - ${refShown}`);
  doc.setAuthor('Satsooma');
  doc.setCreator(`Satsooma Sign-off app ${APP_VERSION}`);
  const F = await doc.embedFont(StandardFonts.Helvetica);
  const FB = await doc.embedFont(StandardFonts.HelveticaBold);
  const FI = await doc.embedFont(StandardFonts.HelveticaOblique);
  const hex = h => rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
  const C = { peel: hex('F26531'), leaf: hex('257A47'), no: hex('B3261E'), ink: hex('1A1A1A'), grey: hex('625B55'), line: hex('E6DCD1'), cream: hex('FBF6F2'), pith: hex('F0DCBF'), white: rgb(1, 1, 1) };
  const W = 595.28, H = 841.89, M = 42, CW = W - 2 * M, BOTTOM = 56;
  let page, y;

  const wrap = (text, font, size, width) => {
    const out = [];
    String(text ?? '').split(/\r?\n/).forEach(para => {
      const words = pdfText(para).split(/ +/);
      let line = '';
      words.forEach(w => {
        // break very long words
        while (font.widthOfTextAtSize(w, size) > width) {
          let k = w.length; while (k > 1 && font.widthOfTextAtSize(w.slice(0, k), size) > width) k--;
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, k)); w = w.slice(k);
        }
        const t = line ? line + ' ' + w : w;
        if (font.widthOfTextAtSize(t, size) <= width) line = t; else { out.push(line); line = w; }
      });
      out.push(line);
    });
    return out;
  };
  const text = (t, x, yy, size, font, color = C.ink) => page.drawText(pdfText(t), { x, y: yy, size, font, color });
  const rightText = (t, xr, yy, size, font, color = C.ink) => text(t, xr - font.widthOfTextAtSize(pdfText(t), size), yy, size, font, color);

  // Brand assets (cached on the phone with the app). If one can't load, the PDF still builds without it.
  const assets = await loadPdfAssets();
  const embed = async (name) => {
    const bytes = assets[name];
    if (!bytes) return null;
    try { return name.endsWith('.jpg') ? await doc.embedJpg(bytes) : await doc.embedPng(bytes); } catch (e) { return null; }
  };
  const logo = await embed('logo-white.png');
  const accreds = [];
  for (const [name, h] of PDF_ACCREDS) { const img = await embed(name); if (img) accreds.push({ img, h }); }

  function newPage(first) {
    page = doc.addPage([W, H]);
    if (first) {
      page.drawRectangle({ x: 0, y: H - 96, width: W, height: 96, color: C.peel });
      if (logo) { const lh = 24; page.drawImage(logo, { x: M, y: H - 54, width: logo.width * lh / logo.height, height: lh }); }
      else text('SATSOOMA', M, H - 50, 24, FB, C.white);
      text(cl.name.toUpperCase(), M, H - 76, 11, FB, C.white);
      rightText(refShown, W - M, H - 50, 15, FB, C.white);
      rightText(`Visit ${data.visit_date}`, W - M, H - 76, 10, F, C.white);
      y = H - 96 - 22;
      if (cl.draft) {
        page.drawRectangle({ x: M, y: y - 18, width: CW, height: 24, color: C.pith });
        text('TRIAL VERSION - checklist questions may still be adjusted', M + 10, y - 10, 9.5, FB, C.ink);
        y -= 36;
      }
    } else {
      page.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color: C.peel });
      let tx = M;
      if (logo) { const lh = 11; const lw = logo.width * lh / logo.height; page.drawImage(logo, { x: M, y: H - 20.5, width: lw, height: lh }); tx = M + lw + 12; }
      else { text('SATSOOMA', M, H - 20, 9, FB, C.white); tx = M + 70; }
      text(`${cl.name}  |  ${refShown}`, tx, H - 19, 9, FB, C.white);
      y = H - 30 - 24;
    }
  }
  const need = h => { if (y - h < BOTTOM) newPage(false); };
  function heading(t, keepWith = 40) {
    need(keepWith + 33);
    y -= 6;
    text(t.toUpperCase(), M, y - 11, 11.5, FB, C.peel);
    y -= 17;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: C.peel });
    y -= 10;
  }

  newPage(true);

  // Job details box
  const rows = [
    ['Job reference', data.job_reference || 'Not given'], ['Customer', data.customer_surname],
    ...(cl.headerFields || []).filter(h => data.header[h.id]).map(h => [h.pdfLabel || h.label, data.header[h.id]]),
    ['Engineer', data.engineer],
    ['Visit date', data.visit_date], ['Report created', data.created_at], ['Report ID', data.report_id]
  ];
  const boxH = rows.length * 17 + 14;
  page.drawRectangle({ x: M, y: y - boxH, width: CW, height: boxH, color: C.cream });
  let ry = y - 18;
  rows.forEach(([k, v]) => { text(k, M + 12, ry, 9.5, FB, C.grey); text(v, M + 120, ry, 10, F); ry -= 17; });
  y -= boxH + 14;

  if (cl.showSummary !== false) {   // the "N checks: Yes | No | N/A" line
    const s = data.summary;
    text(`${s.checks} checks:  ${s.yes} Yes  |  ${s.no} No  |  ${s.na} N/A`, M, y - 10, 11, FB, s.no ? C.no : C.leaf);
    y -= 24;
  }

  // Free-text sections (e.g. work carried out, recommendations): the customer reads these first
  (data.text_sections || []).forEach(t => {
    heading(t.title);
    const b = (cl.textBlocks || []).find(x => x.id === t.id) || {};
    const body = t.text || b.emptyText || 'Nothing recorded';
    const f = t.text ? F : FI, col = t.text ? C.ink : C.grey;
    wrap(body, f, 10, CW).forEach(l => { need(14); text(l, M, y - 10, 10, f, col); y -= 14; });
    y -= 8;
  });

  // Checklist
  const qW = CW - 70;
  cl.sections.forEach(sec => {
    heading(sec.title);
    sec.items.forEach(it => {
      const item = data.items.find(i => i.id === it.id);
      const qLines = wrap(item.question, F, 10, qW);
      const rText = (item.readings || []).map(r => `${r.label}: ${r.value}${r.unit ? ' ' + r.unit : ''}`).join('   |   ');
      const rLines = rText ? wrap(rText, FB, 9.5, qW) : [];
      const nLines = item.note ? wrap('Note: ' + item.note, FI, 9, qW) : [];
      const h = qLines.length * 13 + rLines.length * 13 + nLines.length * 12 + 10;
      need(h);
      const top = y;
      qLines.forEach((l, i) => text(l, M, top - 10 - i * 13, 10, F));
      const col = item.choice ? C.ink : item.answer === 'Yes' ? C.leaf : item.answer === 'No' ? C.no : C.grey;
      rightText(item.answer, W - M, top - 10, 10.5, FB, col);
      rLines.forEach((l, i) => text(l, M, top - 11 - qLines.length * 13 - i * 13, 9.5, FB, C.peel));
      nLines.forEach((l, i) => text(l, M, top - 10 - qLines.length * 13 - rLines.length * 13 - i * 12, 9, FI, C.grey));
      y = top - h;
      page.drawLine({ start: { x: M, y: y + 3 }, end: { x: W - M, y: y + 3 }, thickness: 0.5, color: C.line });
    });
  });

  // Outstanding (left off the PDF when the checklist says these notes are for the office only)
  if (data.outstanding_on_pdf) {
    heading(officeNotes(cl).title);
    wrap(data.outstanding || 'Nothing recorded', data.outstanding ? F : FI, 10, CW).forEach(l => { need(14); text(l, M, y - 10, 10, data.outstanding ? F : FI, data.outstanding ? C.ink : C.grey); y -= 14; });
    y -= 6;
  }

  // Sign-off
  heading(cl.signOffTitle || 'Installer sign-off', wrap(cl.engineerDeclaration, FI, 9, CW).length * 12 + 130);   // keep the heading with the signature
  async function sigBlock(label, declaration, name, at, sigUrl) {
    const dLines = wrap(declaration, FI, 9, CW);
    need(dLines.length * 12 + 130);
    text(label.toUpperCase(), M, y - 10, 10, FB);
    y -= 16;
    dLines.forEach(l => { text(l, M, y - 9, 9, FI, C.grey); y -= 12; });
    y -= 4;
    const bw = 220, bh = 80;
    page.drawRectangle({ x: M, y: y - bh, width: bw, height: bh, borderColor: C.line, borderWidth: 1, color: C.white });
    if (sigUrl) {
      const img = await doc.embedPng(dataUrlBytes(sigUrl));
      const sc = Math.min((bw - 8) / img.width, (bh - 8) / img.height);
      page.drawImage(img, { x: M + (bw - img.width * sc) / 2, y: y - bh + (bh - img.height * sc) / 2, width: img.width * sc, height: img.height * sc });
    }
    text(`Name: ${name}`, M + bw + 16, y - 20, 10, F);
    text(`Signed: ${at}`, M + bw + 16, y - 36, 10, F);
    y -= bh + 16;
  }
  await sigBlock('Engineer', cl.engineerDeclaration, data.sign_off.engineer.name, data.sign_off.engineer.signed_at, form.engineerSig);
  const ackH = data.sign_off.customer.present
    ? (cl.customerAcknowledgements || []).reduce((h, a) => h + wrap(a, F, 10, CW - 14).length * 13 + 4, 0) + 6 + wrap(cl.customerDeclaration, FI, 9, CW).length * 12 + 130
    : 30;
  heading('Customer acknowledgement', ackH);   // keep the points and the signature on one page
  if (data.sign_off.customer.present) {
    (cl.customerAcknowledgements || []).forEach(a => {
      const lines = wrap(a, F, 10, CW - 14);
      need(lines.length * 13 + 4);
      text('•', M + 2, y - 10, 10, FB, C.peel);
      lines.forEach((l, i) => text(l, M + 14, y - 10 - i * 13, 10, F));
      y -= lines.length * 13 + 4;
    });
    y -= 6;
    await sigBlock('Customer', cl.customerDeclaration, data.sign_off.customer.name, data.sign_off.customer.signed_at, form.customerSig);
    if (cl.customerNote) { wrap(cl.customerNote, FI, 9, CW).forEach(l => { need(12); text(l, M, y - 9, 9, FI, C.grey); y -= 12; }); y -= 8; }
  } else {
    need(20); text('The customer did not sign (not present, or preferred not to).', M, y - 10, 10, FI, C.grey); y -= 22;
  }

  // Accreditation strip
  if (accreds.length) {
    const sized = accreds.map(a => ({ ...a, w: a.img.width * a.h / a.img.height }));
    const total = sized.reduce((s, a) => s + a.w, 0);
    const gap = Math.max(10, (CW - 24 - total) / Math.max(1, sized.length - 1));
    const boxH = 72;
    need(boxH + 10);
    y -= 4;
    page.drawRectangle({ x: M, y: y - boxH, width: CW, height: boxH, color: C.white, borderColor: C.line, borderWidth: 1 });
    text('CERTIFIED AND ACCREDITED', M + 12, y - 16, 8, FB, C.grey);
    let x = M + 12;
    const mid = y - 18 - (boxH - 18) / 2;
    sized.forEach(a => { page.drawImage(a.img, { x, y: mid - a.h / 2, width: a.w, height: a.h }); x += a.w + gap; });
    y -= boxH + 14;
  }

  // Photos
  const shots = [
    ...allItems(cl).filter(it => it.photo && (form.itemPhotos || {})[it.id]).map(it => ({ url: form.itemPhotos[it.id], caption: it.photo })),
    ...form.photos.map((url, i) => ({ url, caption: `Photo ${i + 1} of ${form.photos.length}` }))
  ];
  if (shots.length) {
    const imgs = [];
    for (const s of shots) imgs.push(await doc.embedJpg(dataUrlBytes(s.url)));
    const firstH = Math.min(CW / imgs[0].width, 290 / imgs[0].height) * imgs[0].height;
    heading(`Photos (${shots.length})`, firstH + 22);
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      const sc = Math.min(CW / img.width, 290 / img.height);
      const w = img.width * sc, h = img.height * sc;
      need(h + 22);
      page.drawImage(img, { x: M + (CW - w) / 2, y: y - h, width: w, height: h });
      y -= h + 4;
      text(shots[i].caption, M, y - 9, 9, FI, C.grey);
      y -= 20;
    }
  }

  // Footers
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 38 }, end: { x: W - M, y: 38 }, thickness: 0.5, color: C.line });
    p.drawText('satsooma.co.uk', { x: M, y: 24, size: 8.5, font: F, color: C.grey });
    const mid = `Satsooma Sign-off app v${APP_VERSION}  |  ${data.report_id}`;
    p.drawText(mid, { x: (W - F.widthOfTextAtSize(mid, 8)) / 2, y: 24, size: 8, font: F, color: C.grey });
    const pg = `Page ${i + 1} of ${pages.length}`;
    p.drawText(pg, { x: W - M - F.widthOfTextAtSize(pg, 8.5), y: 24, size: 8.5, font: F, color: C.grey });
  });

  return await doc.save();
}

async function finish(btn) {
  const errs = validate();
  const box = $('#errors');
  if (errs.length) {
    box.innerHTML = errorListHtml(errs);
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  box.hidden = true;
  btn.disabled = true; btn.textContent = 'Making the report…';
  try {
    const cl = getChecklist(form.checklistId);
    const createdAt = new Date();
    const id = 'R-' + createdAt.getFullYear() + pad(createdAt.getMonth() + 1) + pad(createdAt.getDate()) + '-' + pad(createdAt.getHours()) + pad(createdAt.getMinutes()) + pad(createdAt.getSeconds()) + '-' + uid().slice(0, 4).toUpperCase();
    const safe = v => String(v || '').trim().replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    const baseName = `${safe(form.jobRef) || safe(form.surname) || 'NoRef'}_${cl.fileLabel}_${form.visitDate}_${pad(createdAt.getHours())}${pad(createdAt.getMinutes())}`;
    const pdfName = baseName + '.pdf';
    const data = buildData(cl, id, createdAt, pdfName);
    const pdf = await buildPdf(cl, data);
    const rec = {
      id, baseName, pdfName, pdf, json: JSON.stringify(data, null, 2),
      jobRef: form.jobRef.trim() || '(no reference)', surname: form.surname.trim(), visitDate: form.visitDate,
      checklistId: cl.id, checklistName: cl.name,
      createdAt: createdAt.toISOString(), status: 'not-sent', sentAt: null, history: []
    };
    await putReport(rec);
    store.set('engineerName', form.engineer.trim());
    clearTimeout(draftTimer);
    await clearDraft();
    form = null;
    await showReport(id, true);
  } catch (e) {
    console.error(e);
    btn.disabled = false; btn.textContent = 'Finish and save report';
    toast('Something went wrong making the report. Your answers are still here. Please try again.', 6000);
  }
}

/* ---------- SAVED REPORT ---------- */
async function showReport(id, fresh = false) {
  openRec = await getReport(id);
  if (!openRec) { await showHome(); return; }
  renderReport(fresh);
}

function renderReport(fresh) {
  const r = openRec;
  app.innerHTML = `
    <button class="back" data-act="home">‹ Home</button>
    <section class="card">
      <p class="kicker">${fresh ? 'Report saved on this phone' : 'Saved report'}</p>
      <h1>${esc(r.jobRef)}</h1>
      <p class="muted">${esc(r.checklistName)} · ${esc(r.surname)} · ${esc(isoToUk(r.visitDate))}</p>
      <p>${statusChip(r)}</p>
      <div class="stack">
        <button class="btn primary block" data-act="send">${r.status === 'sent' ? 'Send again' : 'Send report'}</button>
        <p class="muted small">Choose <strong>Mail</strong>, type or pick the email address, then tap Send. The PDF and the data file are already attached.</p>
        <button class="btn block" data-act="viewpdf">View PDF</button>
      </div>
      ${sendTrouble === r.id ? `<div class="stack sendtrouble">
        <p><strong>This phone wouldn't pass the report to Mail.</strong> Try one of these:</p>
        <button class="btn block" data-act="sendpdf">Try sending the PDF only</button>
        <button class="btn block" data-act="savefiles">Save the files to the phone</button>
        <p class="muted small">If you save them, open your email app, start a new email to the office and attach both files from Downloads. If this keeps happening, open the app in Chrome rather than another browser.</p>
      </div>` : ''}
    </section>
    <section class="card">
      <h2>Send history</h2>
      ${r.history.length ? `<ul class="history">${r.history.slice().reverse().map(h => `<li>${esc(ukDateTime(new Date(h.at)))}: ${esc(h.result)}</li>`).join('')}</ul>` : '<p class="muted small">Not sent yet.</p>'}
      <p class="muted small">"Sent" means the report was handed to Mail or another app on this phone. If the office says it hasn't arrived, open it here and send it again.</p>
    </section>
    <button class="btn block danger" data-act="delete">Delete this report from the phone</button>
    <p class="foot">${esc(r.pdfName)}</p>`;
  window.scrollTo(0, 0);
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// Set to a report's id when sharing failed on it, to show the fallback options.
let sendTrouble = null;

async function sendReport(pdfOnly = false) {
  const r = openRec;
  const pdfFile = new File([r.pdf], r.pdfName, { type: 'application/pdf' });
  let files = pdfOnly ? [pdfFile] : [pdfFile, new File([r.json], r.baseName + '_data.json', { type: 'application/json' })];
  const can = f => !navigator.canShare || navigator.canShare({ files: f });
  if (navigator.share && !pdfOnly && !can(files)) {
    // Some Android phones won't share .json files; the same data as .txt is fine for Claude.
    files = [pdfFile, new File([r.json], r.baseName + '_data.txt', { type: 'text/plain' })];
    if (!can(files)) files = [pdfFile];
  }
  const record = async (result, sent) => {
    const now = new Date().toISOString();
    r.history.push({ at: now, result });
    if (sent) { r.status = 'sent'; r.sentAt = now; }
    await putReport(r);
    renderReport(false);
  };

  if (navigator.share && can(files)) {
    try {
      // No title or text: passing them makes iPhones attach an extra text file.
      await navigator.share({ files });
      sendTrouble = null;
      await record(files.length === 1 ? 'Sent (PDF only: this phone would not attach the data file)' : 'Sent', true);
      toast('Report handed to the app you chose.');
    } catch (e) {
      if (e && e.name === 'AbortError') await record('Not sent (cancelled)', false);
      else {
        // e.g. Edge on Android says it can share files, then refuses ("Permission denied").
        sendTrouble = r.id;
        await record('Not sent (' + (e && e.message ? e.message : 'sharing failed') + ')', false);
        toast('Couldn\'t open the share sheet. See the options below.', 5000);
        $('.sendtrouble')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  } else {
    downloadBlob(new Blob([r.pdf], { type: 'application/pdf' }), r.pdfName);
    downloadBlob(new Blob([r.json], { type: 'application/json' }), r.baseName + '_data.json');
    await record('Downloaded (this browser can\'t share files; not emailed)', false);
    toast('This browser can\'t share files, so both files were downloaded instead.', 5000);
  }
}

/* ---------- events ---------- */
app.addEventListener('click', async e => {
  const goto = e.target.closest('[data-goto]');
  if (goto) { e.preventDefault(); $('#' + goto.dataset.goto)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }

  const ansBtn = e.target.closest('[data-ans]');
  if (ansBtn && form) {
    const itemEl = ansBtn.closest('[data-item]');
    const id = itemEl.dataset.item;
    form.answers[id] = ansBtn.dataset.ans;
    $$('[data-ans]', itemEl).forEach(b => b.setAttribute('aria-pressed', String(b === ansBtn)));
    itemEl.classList.remove('invalid');
    const ta = $('textarea', itemEl);
    if (ansBtn.dataset.ans === 'no') {
      ta.hidden = false; ta.placeholder = 'What is outstanding, and what happens next?';
      $('.notelink', itemEl)?.remove();
    }
    scheduleDraftSave(); refreshErrors();
    return;
  }

  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === 'home') { if (form) { clearTimeout(draftTimer); await saveDraft(form); } await showHome(); }
  else if (act === 'new') {
    const existing = await loadDraft();
    if (existing && !armed(btn, 'Tap again: this replaces your unfinished report')) return;
    form = blankForm(btn.dataset.id); await saveDraft(form); showForm();
  }
  else if (act === 'resume') { form = await loadDraft(); if (form) showForm(); else showHome(); }
  else if (act === 'discard') { if (!armed(btn, 'Tap again to discard')) return; await clearDraft(); showHome(); }
  else if (act === 'open') { await showReport(btn.dataset.id); }
  else if (act === 'addnote') { const ta = $('textarea', btn.closest('[data-item]')); ta.hidden = false; ta.focus(); btn.remove(); }
  else if (act === 'rmitemphoto') {
    const id = btn.dataset.id;
    delete form.itemPhotos[id];
    const wrapEl = btn.closest('[data-photo-for]');
    wrapEl.outerHTML = itemPhotoHtml(getChecklist(form.checklistId).sections.flatMap(s => s.items).find(i => i.id === id));
    scheduleDraftSave(); refreshErrors();
  }
  else if (act === 'rmphoto') { form.photos.splice(Number(btn.dataset.i), 1); $('#photos').innerHTML = photosHtml(); updatePhotoButton(); scheduleDraftSave(); }
  else if (act === 'clearsig') { pads[btn.dataset.who]?.clear(); }
  else if (act === 'finish') { await finish(btn); }
  else if (act === 'send') { await sendReport(); }
  else if (act === 'sendpdf') { await sendReport(true); }
  else if (act === 'savefiles') {
    downloadBlob(new Blob([openRec.pdf], { type: 'application/pdf' }), openRec.pdfName);
    downloadBlob(new Blob([openRec.json], { type: 'application/json' }), openRec.baseName + '_data.json');
    openRec.history.push({ at: new Date().toISOString(), result: 'Files saved to the phone (attach them to an email yourself)' });
    await putReport(openRec); renderReport(false);
    toast('Saved to Downloads. Attach both files to an email to the office.', 6000);
  }
  else if (act === 'viewpdf') {
    const url = URL.createObjectURL(new Blob([openRec.pdf], { type: 'application/pdf' }));
    const w = window.open(url, '_blank');
    if (!w) downloadBlob(new Blob([openRec.pdf], { type: 'application/pdf' }), openRec.pdfName);
  }
  else if (act === 'delete') {
    if (!armed(btn, openRec.status === 'sent' ? 'Tap again to delete' : 'Not sent yet! Tap again to delete anyway')) return;
    await deleteReport(openRec.id); toast('Report deleted from this phone.'); showHome();
  }
});

app.addEventListener('input', e => {
  if (!form) return;
  const f = e.target.dataset.field;
  if (f) {
    let v = e.target.value;
    if (f === 'jobRef' && refRules(getChecklist(form.checklistId)).strict) {
      const up = v.toUpperCase().replace(/\s+/g, '');
      if (up !== v) { const p = e.target.selectionStart; e.target.value = up; try { e.target.setSelectionRange(p, p); } catch (_) {} }
      v = up;
    }
    form[f] = v;
    e.target.closest('.invalid')?.classList.remove('invalid');
    scheduleDraftSave(); refreshErrors();
    return;
  }
  const t = e.target.dataset.text;
  if (t) { form.texts[t] = e.target.value; e.target.closest('.invalid')?.classList.remove('invalid'); scheduleDraftSave(); refreshErrors(); return; }
  const x = e.target.dataset.extra;
  if (x) { form.extra[x] = e.target.value; e.target.closest('.invalid')?.classList.remove('invalid'); scheduleDraftSave(); refreshErrors(); return; }
  const v = e.target.dataset.val;
  if (v) { form.values[v] = e.target.value; scheduleDraftSave(); return; }
  const n = e.target.dataset.note;
  if (n) { form.notes[n] = e.target.value; e.target.closest('.item')?.classList.remove('invalid'); scheduleDraftSave(); refreshErrors(); }
});

app.addEventListener('change', async e => {
  if (!form) return;
  if (e.target.dataset.unit) {
    form.units[e.target.dataset.unit] = e.target.value;
    store.set('unit.' + e.target.dataset.unit, e.target.value);
    scheduleDraftSave();
  } else if (e.target.dataset.itemphoto) {
    const id = e.target.dataset.itemphoto;
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try { form.itemPhotos[id] = await downscale(file); }
    catch (err) { toast('That photo couldn\'t be read. Please try again.'); return; }
    const it = getChecklist(form.checklistId).sections.flatMap(s => s.items).find(i => i.id === id);
    e.target.closest('[data-photo-for]').outerHTML = itemPhotoHtml(it);
    $('#item-' + id)?.classList.remove('invalid');
    scheduleDraftSave(); refreshErrors();
  } else if (e.target.id === 'customerNotPresent') {
    form.customerNotPresent = e.target.checked;
    $('#customerBlock').hidden = e.target.checked;
    if (!e.target.checked) pads.customer?.setup();
    scheduleDraftSave(); refreshErrors();
  } else if (e.target.id === 'photoInput') {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const room = MAX_PHOTOS - form.photos.length;
    if (files.length > room) toast(`Only ${MAX_PHOTOS} photos per report. Added the first ${room}.`);
    for (const f of files.slice(0, room)) {
      try { form.photos.push(await downscale(f)); } catch (err) { toast('One photo couldn\'t be read and was skipped.'); }
    }
    $('#photos').innerHTML = photosHtml();
    updatePhotoButton();
    scheduleDraftSave();
  }
});

$('.topbar').addEventListener('click', async e => {
  if (!e.target.closest('[data-act="home"]')) return;
  if (form) { clearTimeout(draftTimer); await saveDraft(form); }
  showHome();
});

// Save the draft straight away if the app is sent to the background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && form) { clearTimeout(draftTimer); saveDraft(form).catch(() => {}); }
});

/* ---------- offline + updates ---------- */
if ('serviceWorker' in navigator) {
  let userAskedUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (userAskedUpdate) location.reload(); });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      const offer = () => {
        if (!reg.waiting || !navigator.serviceWorker.controller) return;
        $('#update').hidden = false;
        $('#updateBtn').onclick = async () => {
          userAskedUpdate = true;
          if (form) { clearTimeout(draftTimer); await saveDraft(form); }
          reg.waiting.postMessage('skipWaiting');
        };
      };
      offer();
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') offer(); });
      });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    } catch (e) { /* offline copy unavailable; the app still works online */ }
  });
}

// Ask the phone not to clear saved reports to free up space.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

showHome().catch(err => {
  console.error(err);
  app.innerHTML = '<section class="card"><h2>Storage unavailable</h2><p>This browser is blocking storage, so reports can\'t be saved. If you\'re in a private window, open the app normally from the Home Screen icon.</p></section>';
});
