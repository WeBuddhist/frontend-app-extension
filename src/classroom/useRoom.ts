/**
 * The socket client: a live connection to one class.
 *
 * Who you are, and whether you are the teacher, come from the Academy login and nothing
 * this hook says about itself. The server accepts the socket only with a valid login,
 * lets it into a class only if the account is a member, and lets it move the class only
 * if the account is the teacher. `state.role` says which of those this account is, and
 * is what decides what the interface offers; the server checks again on every message.
 */

import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { io, type Socket } from 'socket.io-client';

import { apiBase, me } from './api';
import type { ClientToServerEvents, RoomState, ServerToClientEvents } from './types';

// Note the reversed order: what the server sends is what this client listens for.
type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Why a live class stopped being one for this person. */
export type Ended =
  /** The teacher ended today's session (shown to the teacher only; students stay in the class). */
  | 'session'
  /** The class was archived. */
  | 'archived'
  /** The teacher removed this account. */
  | 'removed'
  /** This account left the class itself (from another tab, or this one). */
  | 'left';

export interface Room {
  connected: boolean;
  state: RoomState | null;
  error: string | null;
  /** Set when the class stopped being live for this person, and why. Terminal. */
  ended: Ended | null;
  /**
   * Set when the server refused the join outright: a wrong code, a class that was
   * archived, or one this account is not in. Terminal, unlike `error`: there is no class to
   * be in, so the caller should offer a way out rather than the classroom.
   */
  joinRejected: boolean;
  /** Ask the server to move the class. Refused unless this account is the teacher. */
  goto: (segmentId: string) => void;
  /** End today's session for everyone. The class stays. Teacher only; the server checks. */
  endSession: () => void;
}

/**
 * Where to open the socket, given the service's address.
 *
 * `io('https://host/classroom-api')` does **not** mean "the service under /classroom-api": the
 * client reads a path in the address as a Socket.IO *namespace* and still knocks on
 * `https://host/socket.io/` at the root, where in production nothing answers it (the MFE's catch-all
 * does, with a web page, and the connection fails). So the address is split: the origin goes to
 * `io`, and the path becomes the engine `path` option, which is where the socket is really served.
 *
 * In development the address has no path, and this gives the default `/socket.io`.
 */
export const socketAddress = (base: string): { origin: string; path: string } => {
  const url = new URL(base);
  return { origin: url.origin, path: `${url.pathname.replace(/\/+$/, '')}/socket.io` };
};

export function useRoom(code: string): Room {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState<Ended | null>(null);
  const [joinRejected, setJoinRejected] = useState(false);
  const socketRef = useRef<ClientSocket | null>(null);
  const roleRef = useRef<'teacher' | 'student' | null>(null);
  // The code as it is now, read when joining. The effect below does not depend on it: a teacher
  // changing the code changes it in place (the room is the same room, and a socket is keyed by
  // the room's id), so reconnecting would only blank the screen and drop the Manage dialog.
  const codeRef = useRef(code);
  codeRef.current = code;
  // The line the server last said the class is on: what to go back to if a move is refused.
  const confirmedRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: ClientSocket | null = null;

    const open = async () => {
      // apiBase() throws when the service is unconfigured in production, and `me()`
      // fails when the login has lapsed. Inside an effect either would escape React
      // rather than reach anyone's catch, so both become the error state a failed
      // connection produces.
      let base: string;
      try {
        base = apiBase();
        // A socket cannot refresh the login cookie, but an ordinary request can, so one
        // is made first. It is also the cheapest place to find out the login has gone.
        await me();
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'The classroom is not configured.');
        }
        return;
      }
      if (cancelled) { return; }

      const { origin, path } = socketAddress(base);
      socket = io(origin, {
        // Where the service listens for sockets, below whatever path it is reached by. In
        // production that is `/classroom-api/socket.io`, which Caddy sends to the service.
        path,
        // The login rides the handshake as cookies, which a browser sends to a different
        // origin only when told to.
        withCredentials: true,
        // A real WebSocket first. Polling stays as a fallback for restrictive networks,
        // where the teacher would see the highlight lag behind their own voice.
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;

      // Fires on first connect and again after every reconnect, so re-joining here is
      // all the resume logic this needs: the ack carries the class's authoritative state,
      // including the line it is on now.
      const join = () => {
        socket!.emit('room:join', { code: codeRef.current }, (result) => {
          if (!result.ok) {
            setError(result.error);
            setJoinRejected(true);
            return;
          }
          setError(null);
          setJoinRejected(false);
          roleRef.current = result.state.role;
          confirmedRef.current = result.state.currentSegmentId;
          setState(result.state);
        });
      };

      socket.on('connect', () => {
        setConnected(true);
        join();
      });
      socket.on('disconnect', () => setConnected(false));
      socket.on('connect_error', (cause) => {
        // The server's reason when it refused (a lapsed login), else the transport's.
        setError(cause?.message && cause.message !== 'xhr poll error'
          ? cause.message
          : 'Cannot reach the classroom server.');
      });

      socket.on('teach:goto', ({ segmentId }) => {
        confirmedRef.current = segmentId;
        setState((previous) => (
          previous ? { ...previous, currentSegmentId: segmentId } : previous
        ));
      });
      socket.on('presence', ({ count, teacherHere }) => {
        setState((previous) => (
          previous
            ? { ...previous, participantCount: count ?? previous.participantCount, teacherHere }
            : previous
        ));
      });
      // The session ending does not send anyone away: the class stays open to read and to make
      // notes in, so this only marks it. (A teacher is the exception, and is shown the notice:
      // see the return below.)
      socket.on('session:ended', () => {
        setState((previous) => (
          previous ? { ...previous, sessionEnded: true } : previous
        ));
        // The teacher who ended it is done: leave the class for good, so a reconnect cannot
        // re-join and, by being the teacher, start the session again. Coming back is opening
        // the class afresh.
        if (roleRef.current === 'teacher') { socket?.disconnect(); }
      });
      // The login ran out. Asking the service who we are refreshes the login cookie, after
      // which the connection can be made again.
      socket.on('auth:expired', () => {
        me().then(() => socket?.connect()).catch((cause) => {
          if (!cancelled) {
            setError(cause instanceof Error ? cause.message : 'Your login has expired.');
          }
        });
      });
      socket.on('session:started', () => setState((previous) => (
        previous ? { ...previous, sessionEnded: false } : previous
      )));
      socket.on('room:closed', () => setEnded('archived'));
      socket.on('member:removed', () => setEnded('removed'));
      socket.on('member:left', () => setEnded('left'));
    };

    open();

    // Closing the tab says goodbye at once, so a teacher who leaves stops showing as live to
    // everyone straight away. A connection that just vanishes (a closed laptop, no network) is
    // only noticed when it misses the server's keep-alive, which is left at the defaults: short
    // timers would drop every phone that is locked for a few seconds.
    const sayGoodbye = (event: PageTransitionEvent) => {
      if (!event.persisted) { socket?.disconnect(); }
    };
    window.addEventListener('pagehide', sayGoodbye);

    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', sayGoodbye);
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const goto = useCallback((segmentId: string) => {
    // The line is marked as soon as it is pressed, not when the server's answer comes back, so
    // the teacher sees the class move the moment they press. The server's broadcast then
    // confirms it; if it refuses, the error below says so and the next broadcast corrects it.
    setState((previous) => (
      previous ? { ...previous, currentSegmentId: segmentId } : previous
    ));
    socketRef.current?.emit('teach:goto', { segmentId }, (result) => {
      if (result.ok) { return; }
      setError(result.error);
      // Refused, so nothing was broadcast and nothing will correct the line marked above: put
      // back the one the class is really on.
      setState((previous) => (
        previous ? { ...previous, currentSegmentId: confirmedRef.current } : previous
      ));
    });
  }, []);

  const endSession = useCallback(() => {
    socketRef.current?.emit('session:end', {}, (result) => {
      if (!result.ok) { setError(result.error); }
    });
  }, []);

  // A teacher who ends the session is done and goes back to their list, so for them it is the
  // end of the class screen. A student is not: they stay (see `state.sessionEnded`).
  const teacherEnded: Ended | null = state?.role === 'teacher' && state.sessionEnded ? 'session' : null;

  return {
    connected, state, error, ended: ended ?? teacherEnded, joinRejected, goto, endSession,
  };
}
