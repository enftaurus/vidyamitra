import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import InterviewPage from './pages/InterviewPage';
import InterviewHubPage from './pages/InterviewHubPage';
import CodingRoundPage from './pages/CodingRoundPage';
import ProfilePage from './pages/ProfilePage';
import DomainSwitchPage from './pages/DomainSwitchPage';
import ResumeUploadPage from './pages/ResumeUploadPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/domain-switch" element={<DomainSwitchPage />} />
        <Route path="/resume-upload" element={<ResumeUploadPage />} />
        <Route path="/interview" element={<InterviewHubPage />} />
        <Route path="/interview/coding" element={<CodingRoundPage />} />
        <Route
          path="/interview/technical"
          element={<InterviewPage title="Technical Round" basePath="/interview" roundKey="technical" />}
        />
        <Route
          path="/interview/manager"
          element={<InterviewPage title="Manager Round" basePath="/manager_round" roundKey="manager" />}
        />
        <Route
          path="/interview/hr"
          element={<InterviewPage title="HR Round" basePath="/hr_round" roundKey="hr" />}
        />
      </Routes>
    </Layout>
  );
}
