/* Darf ich (die aktuelle Person) gerade abstimmen? Freischaltungen, Nachzügler-Link, Teilnehmerliste. */
import { B, S, TODAY, isOwner } from './state.js';
import { allowedWd, inPoll, isParticipant, pollClosed } from '../core/poll.js';

export const myExt = p => {
  const u = B && B.uid();
  const x = p && p.extensions && u ? p.extensions[u] : null;
  return x && x.until > Date.now() ? x : null;
};
export const myPass = () => (S.passInfo && S.passInfo.until > Date.now() ? S.passInfo : null);
/** Für alle geschlossen – außer man ist freigeschaltet, hat einen Nachzügler-Link oder ist Organisator. */
export const closedForMe = p => pollClosed(p) && !myExt(p) && !myPass() && !isOwner();
export const amParticipant = p => isOwner() || !!myPass() || isParticipant(p, B && B.uid());
export const votable = ds =>
  !!S.poll && ds >= TODAY && inPoll(S.poll, ds) && allowedWd(S.poll, ds) && !closedForMe(S.poll);
