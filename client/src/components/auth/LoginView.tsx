import React, { useState } from 'react';
import { Sparkles, KeyRound, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginView: React.FC = () => {
  const { login, verify2FA } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await login(identifier, password);
      if (res.requires2FA && res.challengeToken) {
        setChallengeToken(res.challengeToken);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;

    setError(null);
    setIsLoading(true);

    try {
      await verify2FA(challengeToken, totpCode);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-canvas-dark flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-accent-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-accent-purple/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-surface-dark/90 border border-border-subtle rounded-2xl p-8 shadow-2xl backdrop-blur-xl relative z-10 animate-fade-in">
        {/* Brand Logo & Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-purple flex items-center justify-center shadow-xl shadow-accent-primary/25 mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Gatekeeper</h1>
          <p className="text-xs text-text-secondary mt-1">
            Nginx Proxy Manager Discovered Portal
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-status-critical/15 border border-status-critical/30 rounded-xl text-xs text-status-critical flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Username & Password */}
        {!challengeToken ? (
          <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">
                Username or Email
              </label>
              <input
                type="text"
                required
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-4 py-2.5 bg-card-dark border border-border-subtle rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 bg-card-dark border border-border-subtle rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full py-3 bg-gradient-to-r from-accent-primary to-accent-purple hover:opacity-90 text-white text-sm font-bold rounded-xl shadow-lg shadow-accent-primary/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Docker admin credentials notice */}
            <div className="mt-4 p-3 bg-card-dark/60 border border-border-subtle/50 rounded-xl text-[11px] text-text-muted text-center leading-relaxed">
              Default Docker Credentials:<br />
              <strong className="text-white">admin@example.com</strong> / <strong className="text-white">adminpassword</strong>
            </div>
          </form>
        ) : (
          /* Step 2: Two-Factor Challenge */
          <form onSubmit={handle2faSubmit} className="flex flex-col gap-5">
            <div className="flex items-center gap-3 p-3.5 bg-card-dark rounded-xl border border-border-subtle text-xs text-text-secondary">
              <ShieldCheck className="w-6 h-6 text-status-healthy shrink-0" />
              <span>Two-Factor Authentication challenge required. Check your authenticator app.</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-primary block mb-1.5">
                Enter 6-Digit Authenticator Code
              </label>
              <input
                type="text"
                required
                autoFocus
                maxLength={8}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="123456"
                className="w-full px-4 py-3 bg-card-dark border border-border-subtle rounded-xl text-center text-xl font-mono font-bold tracking-widest text-text-primary focus:outline-none focus:border-border-focus transition-colors"
              />
              <span className="text-[10px] text-text-muted block text-center mt-1">
                (or enter an 8-character backup recovery code)
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading || !totpCode}
              className="w-full py-3 bg-accent-primary hover:bg-accent-hover text-white text-sm font-bold rounded-xl shadow-lg shadow-accent-primary/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <span>{isLoading ? 'Verifying...' : 'Verify Code'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setChallengeToken(null)}
              className="text-xs text-text-muted hover:text-white text-center transition-colors"
            >
              ← Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
