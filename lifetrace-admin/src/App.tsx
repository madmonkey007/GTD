import { Navigate, Route, HashRouter as Router, Routes } from 'react-router-dom';
import { AdminLayout } from './pages/AdminLayout';
import { Dashboard } from './pages/Dashboard';
import { DataManage } from './pages/DataManage';
import { Login } from './pages/Login';
import { Ops } from './pages/Ops';
import { Safety } from './pages/Safety';
import { Users } from './pages/Users';
import { getToken } from './api/client';

function RequireAuth({ children }: { children: React.ReactElement }) {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="data" element={<DataManage />} />
          <Route path="data/:resource" element={<DataManage />} />
          <Route path="ops" element={<Ops />} />
          <Route path="safety" element={<Safety />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
