'use strict';
// Room reservation using single-document atomic updates ($inc guarded by a $gt:0 filter),
// so two simultaneous applicants can never both take the last room.
const Landlord = require('../models/Landlord');
const logger = require('./logger');

const FIELDS = {
    Single: { count: 'singleRoomsAvailable', flag: 'isSingleRoomFull' },
    Sharing: { count: 'sharedRoomsAvailable', flag: 'isSharedRoomFull' },
};

// -> { ok:true, reservation|null } | { ok:false, reason:'full' }
async function reserveRoom(accommodationName, roomType) {
    const f = FIELDS[roomType];
    if (!f || !accommodationName) return { ok: true, reservation: null };
    const l = await Landlord.findOne({ accommodationName }).select(`_id ${f.count} ${f.flag}`).lean();
    if (!l) return { ok: true, reservation: null };          // unknown/legacy accommodation: do not block applications
    if (l[f.flag]) return { ok: false, reason: 'full' };      // manually marked full by an admin
    if (typeof l[f.count] !== 'number') return { ok: true, reservation: null };   // no hard capacity configured

    const updated = await Landlord.findOneAndUpdate(
        { _id: l._id, [f.count]: { $gt: 0 } },
        { $inc: { [f.count]: -1 } },
        { new: true }
    ).select(`${f.count}`).lean();
    if (!updated) return { ok: false, reason: 'full' };
    if (updated[f.count] === 0) {
        Landlord.updateOne({ _id: l._id }, { [f.flag]: true }).catch(e => logger.warn('could not set room-full flag', logger.errMeta(e)));
    }
    return { ok: true, reservation: { landlord: l._id, field: f.count } };
}

async function releaseRoom(reservation) {
    if (!reservation || !reservation.landlord || !reservation.field) return;
    const flag = Object.values(FIELDS).find(f => f.count === reservation.field);
    if (!flag) return;
    try {
        await Landlord.updateOne({ _id: reservation.landlord }, { $inc: { [reservation.field]: 1 }, [flag.flag]: false });
    } catch (e) {
        logger.error('failed to release room reservation', { ...logger.errMeta(e), landlord: String(reservation.landlord), field: reservation.field });
    }
}

module.exports = { reserveRoom, releaseRoom };
