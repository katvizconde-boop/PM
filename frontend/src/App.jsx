import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import MyTasks from './pages/MyTasks.jsx';
import Calendar from './pages/Calendar.jsx';
import AllTasks from './pages/AllTasks.jsx';
import Audit from './pages/Audit.jsx';
import Workload from './pages/Workload.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="tasks" element={<MyTasks />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="all-tasks" element={<AllTasks />} />
            <Route path="workload"  element={<Workload  />} />
            <Route path="audit"     element={<Audit     />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
