import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ui/Toast';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { SocketProvider } from './contexts/SocketContext';

// ── Páginas cargadas bajo demanda (code splitting) ──────────
// Cada página se descarga en su propio chunk: el bundle inicial solo
// contiene el shell de la aplicación (router, contextos y layout).
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const CambiarPasswordPage = lazy(() =>
  import('./pages/auth/CambiarPasswordPage').then((m) => ({ default: m.CambiarPasswordPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const UsuariosPage = lazy(() =>
  import('./pages/admin/UsuariosPage').then((m) => ({ default: m.UsuariosPage })),
);
const UsuarioFormPage = lazy(() =>
  import('./pages/admin/UsuarioFormPage').then((m) => ({ default: m.UsuarioFormPage })),
);
const JefaturasPage = lazy(() =>
  import('./pages/admin/JefaturasPage').then((m) => ({ default: m.JefaturasPage })),
);
const DelegacionesPage = lazy(() =>
  import('./pages/admin/DelegacionesPage').then((m) => ({ default: m.DelegacionesPage })),
);
const AsistenciasPage = lazy(() =>
  import('./pages/asistencias/AsistenciasPage').then((m) => ({ default: m.AsistenciasPage })),
);
const MisAsistenciasPage = lazy(() =>
  import('./pages/asistencias/MisAsistenciasPage').then((m) => ({ default: m.MisAsistenciasPage })),
);
const RegistroAsistenciaPage = lazy(() =>
  import('./pages/asistencias/RegistroAsistenciaPage').then((m) => ({ default: m.RegistroAsistenciaPage })),
);
const PapeletasPage = lazy(() =>
  import('./pages/papeletas/PapeletasPage').then((m) => ({ default: m.PapeletasPage })),
);
const CrearPapeletaPage = lazy(() =>
  import('./pages/papeletas/CrearPapeletaPage').then((m) => ({ default: m.CrearPapeletaPage })),
);
const DetallePapeletaPage = lazy(() =>
  import('./pages/papeletas/DetallePapeletaPage').then((m) => ({ default: m.DetallePapeletaPage })),
);
const VerificarTokenPage = lazy(() =>
  import('./pages/papeletas/VerificarTokenPage').then((m) => ({ default: m.VerificarTokenPage })),
);
const VisitasPage = lazy(() =>
  import('./pages/visitas/VisitasPage').then((m) => ({ default: m.VisitasPage })),
);
const RegistroVisitaPage = lazy(() =>
  import('./pages/visitas/RegistroVisitaPage').then((m) => ({ default: m.RegistroVisitaPage })),
);
const NotificacionesPage = lazy(() =>
  import('./pages/notificaciones/NotificacionesPage').then((m) => ({ default: m.NotificacionesPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/dashboard/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const DesignSystemPage = lazy(() =>
  import('./pages/demo/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })),
);

/** Fallback mostrado mientras se descarga el chunk de la página. */
function CargandoPagina() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-bg">
      <div className="animate-spin h-10 w-10 border-4 border-brand-blue border-t-transparent rounded-full" />
    </div>
  );
}

// Páginas de módulos (stubs — se implementarán en fases posteriores)
function ProximamentePage({ titulo }: { titulo: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-3 text-center">
      <p className="text-lg font-semibold text-gray-200">{titulo}</p>
      <p className="text-sm text-gray-500">Este módulo se implementará en la siguiente fase.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SocketProvider>
            {/* Mientras se descarga el chunk de una página se muestra un spinner */}
            <Suspense fallback={<CargandoPagina />}>
              <Routes>
                {/* ── Rutas públicas ────────────────────────── */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
                <Route path="/design-system" element={<DesignSystemPage />} />

                {/* ── Rutas protegidas con sidebar ──────────── */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/asistencias/registro" element={<RegistroAsistenciaPage />} />
                  <Route path="/asistencias" element={<AsistenciasPage />} />
                  <Route path="/mis-asistencias" element={<MisAsistenciasPage />} />
                  <Route path="/papeletas/nueva" element={<CrearPapeletaPage />} />
                  <Route path="/papeletas/:id/reenviar" element={<CrearPapeletaPage />} />
                  <Route path="/papeletas/:id" element={<DetallePapeletaPage />} />
                  <Route path="/papeletas" element={<PapeletasPage />} />
                  <Route path="/visitas/registro" element={<RegistroVisitaPage />} />
                  <Route path="/visitas" element={<VisitasPage />} />
                  <Route path="/notificaciones" element={<NotificacionesPage />} />
                  <Route path="/verificar-token" element={<VerificarTokenPage />} />
                  {/* Solo ADMIN */}
                  <Route path="/usuarios" element={<UsuariosPage />} />
                  <Route path="/usuarios/nuevo" element={<UsuarioFormPage />} />
                  <Route path="/usuarios/:id/editar" element={<UsuarioFormPage />} />
                  <Route path="/jefaturas" element={<JefaturasPage />} />
                  <Route path="/delegaciones" element={<DelegacionesPage />} />
                </Route>

                {/* ── Redirecciones y 404 ───────────────────── */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>

            {/* Toast superpuesto a todo el árbol */}
            <ToastContainer />
          </SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
