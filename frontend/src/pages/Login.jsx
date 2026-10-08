import { useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api.js';
import BrandMark from '../components/BrandMark.jsx';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const existingToken = localStorage.getItem('usar-sarthi-token');
  const existingUser = JSON.parse(localStorage.getItem('usar-sarthi-user') || 'null');

  if (existingToken && existingUser?.role === 'admin') return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.user.role !== 'admin') throw new Error('This account does not have admin access.');
      localStorage.setItem('usar-sarthi-token', data.token);
      localStorage.setItem('usar-sarthi-user', JSON.stringify(data.user));
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-art" aria-label="USAR Sarthi">
        <div className="login-art-top"><BrandMark size={32} /><span>USAR Sarthi</span></div>
        <div className="login-art-copy">
          <span className="eyebrow light-eyebrow">UNIVERSITY SCHOOL OF AUTOMATION &amp; ROBOTICS</span>
          <h1>Ask USAR.<br />Get <em>grounded</em> answers.</h1>
          <p>The admin console behind USAR Sarthi — a RAG-powered knowledge base that keeps campus notices, policies and schedules always within reach.</p>
        </div>
        <div className="art-index" aria-hidden="true"><span>01</span><i /><span>03</span><i /><span>08</span></div>
        <div className="login-art-foot"><span>USAR · GGSIPU</span><span>ADMIN CONSOLE</span></div>
      </section>
      <section className="login-panel">
        <div className="login-mobile-brand"><BrandMark size={31} />USAR Sarthi</div>
        <div className="login-box">
          <span className="eyebrow">ADMINISTRATOR ACCESS</span>
          <h2>Welcome back</h2>
          <p className="login-intro">Sign in to manage the USAR Sarthi knowledge base.</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@usar.ac.in" required />
            <label htmlFor="password">Password</label>
            <div className="password-wrap"><LockKeyhole size={16} /><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button login-submit" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'} {!loading && <ArrowRight size={17} />}
            </button>
          </form>
          <div className="login-note"><span className="status-dot" /> Secured administrator workspace</div>
        </div>
        <footer className="login-footer">USAR SARTHI <span>·</span> KNOWLEDGE BASE</footer>
      </section>
    </main>
  );
}
