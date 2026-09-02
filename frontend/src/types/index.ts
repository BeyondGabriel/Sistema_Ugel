// ===========================================================
// Tipos globales del sistema SIGPER
// Reflejan las respuestas del backend (Prisma + Express)
// ===========================================================

export type Rol =
  | 'VIGILANTE'
  | 'ESPECIALISTA'
  | 'JEFE'
  | 'DIRECTORA'
  | 'RRHH'
  | 'ADMIN';

export type TipoMovimiento = 'ENTRADA' | 'SALIDA';
export type TipoTiempo = 'DIAS' | 'HORAS';
export type EstadoPapeleta =
  | 'PENDIENTE'
  | 'EN_REVISION'
  | 'OBSERVADO'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'CANCELADO'
  | 'ANULADO'
  | 'ANULACION_SOLICITADA';
export type EstadoPresencia = 'PRESENTE' | 'AUSENTE';

export interface Jefatura {
  id: number;
  nombre: string;
  descripcion?: string | null;
}

export interface UsuarioBasico {
  id: number;
  nombres: string;
  apellidos: string;
}

export interface Usuario extends UsuarioBasico {
  email: string;
  rol: Rol;
  activo: boolean;
  cambioPassword: boolean;
  foto?: string | null;
  jefaturaId?: number | null;
  jefeId?: number | null;
  fechaCreacion: string;
  jefatura?: Jefatura | null;
  jefe?: UsuarioBasico | null;
}

/** Respuesta del POST /api/auth/login */
export interface LoginResponse {
  requiereCambioPassword: boolean;
  token: string;
  usuario: {
    id: number;
    email: string;
    rol: Rol;
    nombres: string;
    cambioPassword: boolean;
  };
}

/** Respuesta del GET /api/auth/mi-perfil */
export interface PerfilResponse {
  usuario: Usuario;
}

export interface Movimiento {
  id: number;
  usuarioId: number;
  tipo: TipoMovimiento;
  timestamp: string;
  bloqueado: boolean;
  usuario?: UsuarioBasico & { jefatura?: Jefatura | null };
}

export interface PresenciaItem {
  usuarioId: number;
  nombres: string;
  apellidos: string;
  jefatura?: Jefatura | null;   // ahora opcional
  estado: EstadoPresencia;
  ultimoMovimiento: string | null;
}

export interface Papeleta {
  id: number;
  numero: string;
  solicitanteId: number;
  aprobadorId?: number | null;
  tipoTiempo: TipoTiempo;
  fechaInicio: string;
  fechaFin: string;
  horaSalida?: string | null;
  horaRetorno?: string | null;
  motivo: string;
  motivoOtros?: string | null;
  estado: EstadoPapeleta;
  token?: string | null;
  motivoRechazo?: string | null;
  motivoAnulacion?: string | null;
  anuladoPorAdmin: boolean;
  fechaAnulacion?: string | null;
  // fechaAprobacion eliminado: el backend no devuelve ese campo
  firmaExternaSvg?: string | null;
  fechaCreacion: string;
  solicitante?: UsuarioBasico;
  aprobador?: UsuarioBasico | null;
}

export interface Visita {
  id: number;
  visitanteNombre: string;
  visitanteDni: string;
  trabajadorVisitadoId: number;
  registradorId: number;
  horaEntrada: string;
  horaSalida?: string | null;
  gafeteEntregado: boolean;
  trabajadorVisitado?: UsuarioBasico & { jefatura?: Jefatura | null };
  registrador?: UsuarioBasico;
}

export interface Notificacion {
  id: number;
  usuarioId: number;
  mensaje: string;
  leida: boolean;
  fecha: string;
}

/** Error genérico del API */
export interface ApiError {
  mensaje: string;
}