import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiError } from '../api';
import DynamicHeadline from '../components/DynamicHeadline';
import MarqueeText from '../components/MarqueeText';

const initialRegister = { name: '', email: '', password: '' };
const initialLogin = { email: '', password: '' };

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [registerForm, setRegisterForm] = useState(initialRegister);
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/register/', registerForm);
      setMessage(data.message || 'Registration successful. Please login.');
      setMode('login');
      setRegisterForm(initialRegister);
    } catch (err) {
      setError(apiError(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const onLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await api.post('/login/', loginForm);
      navigate('/dashboard');
    } catch (err) {
      setError(apiError(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-shell">
      <article className="auth-visual">
        <DynamicHeadline
          prefix="AI Powered"
          words={['Interview Practice', 'Coding Rounds', 'Communication Prep', 'Proctoring Flow']}
        />
        <p>Skill checks, strict flow control, and proctored rounds with clear progress tracking.</p>
        <MarqueeText
          items={[
            'AI Interview Practice',
            'Coding Challenge',
            'Technical Round',
            'Manager Round',
            'HR Round',
            'Instant Feedback',
          ]}
        />
      </article>

      <article className="panel auth-panel">
        <div className="panel-header">
          <h2>Candidate Access</h2>
        </div>

        <div className="tabs">
          <button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => setMode('login')}>
            Login
          </button>
          <button className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => setMode('register')}>
            Register
          </button>
        </div>

        {mode === 'login' ? (
          <form className="form" onSubmit={onLogin}>
            <label>Email</label>
            <input
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />

            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        ) : (
          <form className="form" onSubmit={onRegister}>
            <label>Name</label>
            <input
              type="text"
              value={registerForm.name}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />

            <label>Email</label>
            <input
              type="email"
              value={registerForm.email}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />

            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>
        )}

        {message && <div className="success-box">{message}</div>}
        {error && <div className="error-box">{error}</div>}
      </article>
    </section>
  );
}
