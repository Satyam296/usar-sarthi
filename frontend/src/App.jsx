import { Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';

function ProtectedRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('usar-sarthi-user') || 'null');
  const token = localStorage.getItem('usar-sarthi-token');
  return token && user?.role === 'admin' ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}