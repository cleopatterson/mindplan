import { useState, useCallback } from 'react';
import { LogoFull } from '../Logo';
import { Loader2, ArrowLeft } from 'lucide-react';

interface LoginPageProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onBack: () => void;
}

export function LoginPage({ onSignIn, onResetPassword, onBack }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (resetMode) {
        await onResetPassword(email);
        setResetSent(true);
      } else {
        await onSignIn(email, password);
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Invalid email or password');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, resetMode, onSignIn, onResetPassword]);

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center">
      {/* Ambient gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto px-6">
        <div className="flex justify-center mb-8">
          <LogoFull size="lg" />
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white/90 mb-6 text-center">
            {resetMode ? 'Reset password' : 'Sign in'}
          </h2>

          {resetSent ? (
            <div className="text-center">
              <p className="text-sm text-white/60 mb-4">
                Password reset email sent to <span className="text-white/80">{email}</span>.
                Check your inbox.
              </p>
              <button
                onClick={() => { setResetMode(false); setResetSent(false); }}
                className="cursor-pointer text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10
                    text-sm text-white/90 placeholder-white/20
                    focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25
                    transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              {!resetMode && (
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10
                      text-sm text-white/90 placeholder-white/20
                      focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25
                      transition-colors"
                    placeholder="Enter your password"
                  />
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="cursor-pointer w-full py-2.5 rounded-lg text-sm font-medium text-white
                  bg-gradient-to-r from-blue-600 to-purple-600
                  hover:from-blue-500 hover:to-purple-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {resetMode ? 'Send reset email' : 'Sign in'}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={onBack}
                  className="cursor-pointer text-white/30 hover:text-white/50 transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => { setResetMode(!resetMode); setError(null); }}
                  className="cursor-pointer text-white/30 hover:text-white/50 transition-colors"
                >
                  {resetMode ? 'Back to sign in' : 'Forgot password?'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
