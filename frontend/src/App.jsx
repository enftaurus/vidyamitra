import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import InterviewPage from './pages/InterviewPage';
import InterviewHubPage from './pages/InterviewHubPage';
import MockHubPage from './pages/MockHubPage';
import CodingRoundPage from './pages/CodingRoundPage';
import ProfilePage from './pages/ProfilePage';
import DomainSwitchPage from './pages/DomainSwitchPage';
import ResumeUploadPage from './pages/ResumeUploadPage';
import JobsPage from './pages/JobsPage';
import JobMarketPage from './pages/JobMarketPage';
import LandingPage from './pages/LandingPage';
import AdminPortalPage from './pages/AdminPortalPage';
import SkillQuizPage from './pages/SkillQuizPage';
import RoadmapPage from './pages/RoadmapPage';
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/domain-switch" element={<DomainSwitchPage />} />
        <Route path="/resume-upload" element={<ResumeUploadPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/job-market" element={<JobMarketPage />} />
        <Route path="/admin" element={<AdminPortalPage />} />
        <Route path="/skill-quiz" element={<SkillQuizPage />} />
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
        {/* Mock Interview Routes */}
        <Route path="/mock" element={<MockHubPage />} />
        <Route path="/mock/coding" element={<CodingRoundPage mockMode={true} />} />
        <Route
          path="/mock/technical"
          element={<InterviewPage title="Mock Technical Round" basePath="/mock/technical" roundKey="technical" mockMode={true} />}
        />
        <Route
          path="/mock/manager"
          element={<InterviewPage title="Mock Manager Round" basePath="/mock/manager" roundKey="manager" mockMode={true} />}
        />
        <Route
          path="/mock/hr"
          element={<InterviewPage title="Mock HR Round" basePath="/mock/hr" roundKey="hr" mockMode={true} />}
        />
        <Route path="/roadmap" element={<RoadmapPage />} />
      </Routes>
    </Layout>
  );
}
