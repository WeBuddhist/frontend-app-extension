/**
 * The socket client. Ported from the classroom app's `useRoom.ts`.
 *
 * Deliberately does not fetch the text yet — that is the next step. What this proves
 * on its own is the whole chain: a teacher's click reaching a student's screen through
 * the socket, the server and the database. Rendering is the easy part and comes after.
 */

import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { io, type Socket } from 'socket.io-client';

import { apiBase } from './api';
import type { ClientToServerEvents, RoomState, ServerToClientEvents } from './types';

// Note the reversed order: what the server sends is what this client listens for.
type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface Room {
  connected: boolean;
  state: RoomState | null;
  error: string | null;
  /** True once the teacher has ended the class. */
  closed: boolean;
  /**
   * Set when the server refused the join outright — a wrong code, or a class that had
   * already ended. Terminal, unlike `error`: there is no room to be in, so the caller
   * should offer a way out rather than the classroom.
   */
  joinRejected: boolean;
  /** Ask the server to move the room. Refused unless this client holds the host token. */
  goto: (segmentId: string) => void;
  /** End the class for everyone. Host only; the server checks again. */
  endClass: () => void;
}

export function useRoom(code: string, displayName: string, hostToken?: string): Room {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [joinRejected, setJoinRejected] = useState(false);
  const socketRef = useRef<ClientSocket | null>(null);

  useEffect(() => {
    const socket: ClientSocket = io(apiBase(), {
      // A real WebSocket first. Polling stays as a fallback for restrictive networks,
      // where the teacher would see the highlight lag behind their own voice.
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    // Fires on first connect and again after every reconnect, so re-joining here is
    // all the resume logic this needs: the ack carries the room's authoritative state,
    // including the line the class is on now.
    const join = () => {
      socket.emit('room:join', { code, displayName }, (result) => {
        if (!result.ok) {
          setError(result.error);
          setJoinRejected(true);
          return;
        }
        setError(null);
        setJoinRejected(false);
        setState(result.state);
      });
    };

    socket.on('connect', () => {
      setConnected(true);
      join();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setError('Cannot reach the classroom server.'));

    socket.on('teach:goto', ({ segmentId }) => {
      setState((previous) => (
        previous ? { ...previous, currentSegmentId: segmentId } : previous
      ));
    });
    socket.on('presence', ({ count }) => {
      setState((previous) => (
        previous ? { ...previous, participantCount: count } : previous
      ));
    });
    socket.on('room:closed', () => setClosed(true));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, displayName]);

  const goto = useCallback((segmentId: string) => {
    if (!hostToken) { return; }
    socketRef.current?.emit('teach:goto', { segmentId, hostToken }, (result) => {
      if (!result.ok) { setError(result.error); }
    });
  }, [hostToken]);

  const endClass = useCallback(() => {
    if (!hostToken) { return; }
    socketRef.current?.emit('room:close', { hostToken }, (result) => {
      if (!result.ok) { setError(result.error); }
    });
  }, [hostToken]);

  return {
    connected, state, error, closed, joinRejected, goto, endClass,
  };
}
