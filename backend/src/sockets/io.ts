// ===========================================================
// Registro de la instancia de Socket.IO compartida.
//
// Por qué existe este módulo:
// server.ts crea io, pero los servicios (notificacion, papeleta, etc.)
// también necesitan emitir eventos. Importar server.ts desde los servicios
// crearía una dependencia circular. Este módulo rompe el ciclo: server.ts
// lo inicializa una vez al arrancar y los servicios lo leen cuando
// necesitan emitir, sin saber nada de server.ts.
// ===========================================================

import { Server } from 'socket.io';

let _io: Server | null = null;

/** Llamar una vez al iniciar el servidor, pasando la instancia de Socket.IO. */
export function inicializarSocket(io: Server): void {
  _io = io;
  console.log('Socket.IO inicializado y listo para emitir eventos');
}

/**
 * Devuelve la instancia de Socket.IO activa, o null si todavía no se
 * inicializó. Los servicios que llamen a esto antes de que el servidor
 * arranque simplemente no emitirán eventos de socket (lo cual no ocurre
 * en producción normal, donde server.ts llama a inicializarSocket() antes
 * de que cualquier petición o job llegue a los servicios).
 */
export function getIO(): Server | null {
  return _io;
}
