import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ui/Toast';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { CambiarPasswordPage } from './pages/auth/CambiarPasswordPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { UsuariosPage } from './pages/admin/UsuariosPage';
import { UsuarioFormPage } from './pages/admin/UsuarioFormPage';
import { JefaturasPage } from './pages/admin/JefaturasPage';
import { AsistenciasPage } from './pages/asistencias/AsistenciasPage';
import { MisAsistenciasPage } from './pages/asistencias/MisAsistenciasPage';
import { RegistroAsistenciaPage } from './pages/asistencias/RegistroAsistenciaPage';
import { PapeletasPage } from './pages/papeletas/PapeletasPage';
import { CrearPapeletaPage } from './pages/papeletas/CrearPapeletaPage';
import { DetallePapeletaPage } from './pages/papeletas/DetallePapeletaPage';
import { VerificarTokenPage } from './pages/papeletas/VerificarTokenPage';
import { VisitasPage } from './pages/visitas/VisitasPage';
import { RegistroVisitaPage } from './pages/visitas/RegistroVisitaPage';
import { NotificacionesPage } from './pages/notificaciones/NotificacionesPage';
import { SocketProvider } from './contexts/SocketContext';
import { NotFoundPage } from './pages/dashboard/NotFoundPage';

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
          <Routes>
            {/* ── Rutas públicas ────────────────────────── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cambiar-password" element={<CambiarPasswordPage />} />

            {/* ── Rutas protegidas con sidebar ──────────── */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/asistencias/registro" element={<RegistroAsistenciaPage />} />
              <Route path="/asistencias" element={<AsistenciasPage />} />
              <Route path="/mis-asistencias" element={<MisAsistenciasPage />} />
              <Route path="/papeletas/nueva" element={<CrearPapeletaPage />} />
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
            </Route>

            {/* ── Redirecciones y 404 ───────────────────── */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>

          {/* Toast superpuesto a todo el árbol */}
          <ToastContainer />
          </SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
