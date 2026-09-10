import { useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { findBestMove } from './engine.js';

/**
 * Asks the engine for a move, in a worker when the browser allows one and on
 * the main thread otherwise. Requests are keyed by id so a reply that arrives
 * after a new game (or an undo) is ignored rather than played.
 */
export function useEngine() {
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const nextIdRef = useRef(1);
  const disposedRef = useRef(false);

  useEffect(() => {
    const pending = pendingRef.current;
    const disposed = disposedRef;
    disposed.current = false;
    try {
      const worker = new Worker(new URL('./engine.worker.js', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event) => {
        const { id, result, error } = event.data ?? {};
        const pending = pendingRef.current.get(id);
        if (!pending) return; // stale request, the position has moved on
        pendingRef.current.delete(id);
        if (error) pending.reject(new Error(error));
        else pending.resolve(result);
      };
      worker.onerror = () => {
        // Fall back to the main thread for the rest of the session.
        workerRef.current = null;
      };
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
    }

    return () => {
      disposed.current = true;
      pending.clear();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  /** Discards replies to requests made before now, e.g. after an undo. */
  const cancelPending = useCallback(() => {
    pendingRef.current.clear();
  }, []);

  const requestMove = useCallback((fen, options) => {
    const worker = workerRef.current;
    if (!worker) {
      // Synchronous fallback: yield to the browser first so the UI can paint
      // the player's own move before the tab locks up thinking.
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            resolve(findBestMove(new Chess(fen), options));
          } catch (error) {
            reject(error);
          }
        }, 30);
      });
    }
    const id = nextIdRef.current++;
    return new Promise((resolve, reject) => {
      if (disposedRef.current) return;
      pendingRef.current.set(id, { resolve, reject });
      worker.postMessage({ id, fen, options });
    });
  }, []);

  return { requestMove, cancelPending };
}
