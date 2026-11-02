'use strict';
// In-memory stand-in for the data layer. It lets the REAL routes, middleware and Mongoose schemas
// (validation + pre-save hooks) run without a MongoDB server. It does NOT prove MongoDB-level behaviour
// (index enforcement, TTL, multi-document atomicity) - see loadtest/README.md for the real-database run.
const mongoose = require('mongoose');

const stores = new Map();           // modelName -> array of plain objects
const control = { failWrites: false, writeDelayMs: 0 };

const norm = (v) => (v && typeof v === 'object' && v._bsontype ? String(v) : v);
function matches(doc, filter) {
    return Object.entries(filter || {}).every(([k, cond]) => {
        const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), doc);
        if (cond && typeof cond === 'object' && !cond._bsontype && !(cond instanceof Date) && !Array.isArray(cond)) {
            return Object.entries(cond).every(([op, x]) => {
                if (op === '$gt') return v != null && v > x;
                if (op === '$gte') return v != null && v >= x;
                if (op === '$lt') return v != null && v < x;
                if (op === '$in') return x.map(String).includes(String(v));
                if (op === '$ne') return String(v) !== String(x);
                throw new Error('fakeDb: unsupported operator ' + op);
            });
        }
        if (cond === null) return v == null;
        return String(norm(v)) === String(norm(cond));
    });
}
function applyUpdate(doc, upd) {
    const u = upd.$set ? upd.$set : Object.fromEntries(Object.entries(upd).filter(([k]) => !k.startsWith('$')));
    Object.assign(doc, u);
    for (const [k, n] of Object.entries(upd.$inc || {})) doc[k] = (doc[k] || 0) + n;
}
const q = (get) => {
    const p = { _p: null };
    const run = () => (p._p || (p._p = Promise.resolve().then(get)));
    const api = {
        select() { return api; }, lean() { return api; }, sort() { return api; }, limit() { return api; },
        then(a, b) { return run().then(a, b); }, catch(b) { return run().catch(b); },
    };
    return api;
};
function clone(o) {
    if (o == null || typeof o !== 'object') return o;
    if (o instanceof Date) return new Date(o);
    if (o._bsontype) return o;
    if (Array.isArray(o)) return o.map(clone);
    const r = {};
    for (const k of Object.keys(o)) r[k] = clone(o[k]);
    return r;
}

function install(models) {
    const hydrated = [];
    for (const Model of models) {
        const name = Model.modelName;
        stores.set(name, []);
        const S = () => stores.get(name);
        const wrap = (o) => (o ? Model.hydrate(clone(o)) : o);
        const chooseOut = (o, asLean) => (asLean ? clone(o) : wrap(o));

        Model.find = (f) => { let lean = false; const a = q(() => S().filter(d => matches(d, f)).map(d => chooseOut(d, lean))); const l = a.lean; a.lean = () => { lean = true; return a; }; return a; };
        Model.findOne = (f) => { let lean = false; const a = q(() => { const d = S().find(d => matches(d, f)); return d ? chooseOut(d, lean) : null; }); a.lean = () => { lean = true; return a; }; return a; };
        Model.findById = (id) => Model.findOne({ _id: id });
        Model.create = async (doc) => { const m = new Model(doc); await m.save(); return m; };
        Model.updateOne = (f, u) => q(() => { const d = S().find(d => matches(d, f)); if (d) applyUpdate(d, u); return { matchedCount: d ? 1 : 0, modifiedCount: d ? 1 : 0 }; });
        Model.updateMany = (f, u) => q(() => { const ds = S().filter(d => matches(d, f)); ds.forEach(d => applyUpdate(d, u)); return { matchedCount: ds.length, modifiedCount: ds.length }; });
        Model.deleteOne = (f) => q(() => { const i = S().findIndex(d => matches(d, f)); if (i >= 0) S().splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; });
        Model.findOneAndUpdate = (f, u, o = {}) => { let lean = false; const a = q(() => { const d = S().find(d => matches(d, f)); if (!d) return null; applyUpdate(d, u); return chooseOut(d, lean); }); a.lean = () => { lean = true; return a; }; return a; };
        Model.findByIdAndUpdate = (id, u, o) => Model.findOneAndUpdate({ _id: id }, u, o);
        Model.findByIdAndDelete = (id) => q(() => { const i = S().findIndex(d => matches(d, { _id: id })); if (i < 0) return null; return wrap(S().splice(i, 1)[0]); });

        Model.prototype.save = async function save() {
            if (control.writeDelayMs) await new Promise(r => setTimeout(r, control.writeDelayMs));
            if (control.failWrites) { const e = new Error('simulated MongoDB write failure'); e.name = 'MongoNetworkError'; throw e; }
            await new Promise((res, rej) => Model.schema.s.hooks.execPre('save', this, [], (err) => (err ? rej(err) : res())));   // real pre-save hooks (password hashing)
            await this.validate();                                                                                                   // real schema validation
            const obj = this.toObject({ depopulate: true });
            // emulate unique + sparse-unique indexes used by the application
            for (const [fields, opts] of Model.schema.indexes()) {
                if (!opts.unique) continue;
                const key = Object.keys(fields)[0];
                if (obj[key] == null) continue;
                if (S().some(d => String(d._id) !== String(obj._id) && String(d[key]) === String(obj[key]))) { const e = new Error('E11000 duplicate key'); e.code = 11000; throw e; }
            }
            const i = S().findIndex(d => String(d._id) === String(obj._id));
            if (i >= 0) S()[i] = obj; else S().push(obj);
            this.isNew = false;
            return this;
        };
        Model.prototype.deleteOne = async function () { const i = S().findIndex(d => String(d._id) === String(this._id)); if (i >= 0) S().splice(i, 1); return { deletedCount: 1 }; };
        hydrated.push(Model);
    }
    return { stores, control, seed: (Model, doc) => { const m = new Model(doc); const obj = m.toObject(); stores.get(Model.modelName).push(obj); return obj; }, all: (Model) => stores.get(Model.modelName), reset: () => { for (const k of stores.keys()) stores.set(k, []); control.failWrites = false; control.writeDelayMs = 0; } };
}

module.exports = { install };
