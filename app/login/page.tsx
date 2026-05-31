'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Shield, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const [mode, setMode]               = useState<Mode>('login');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [info, setInfo]               = useState('');
  const router = useRouter();

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setInfo('');
    setPassword('');
    setConfirm('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Pogrešan e-mail ili lozinka. Pokušajte ponovo.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Lozinka mora imati najmanje 8 znakova.');
      return;
    }
    if (password !== confirm) {
      setError('Lozinke se ne podudaraju.');
      return;
    }
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Redirect to onboarding — middleware will enforce this for users without a club,
    // but we push explicitly so there's no delay waiting for a JWT refresh.
    router.push('/onboarding');
    router.refresh();
  };

  const isLogin = mode === 'login';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-900/30 mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-50">Digitalni tajnik</h1>
          <p className="text-sm text-slate-500 mt-1">Upravljanje karate klubom</p>
        </div>

        {/* Tab toggle */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-all',
              isLogin
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <LogIn className="w-3.5 h-3.5" /> Prijava
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-all',
              !isLogin
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <UserPlus className="w-3.5 h-3.5" /> Registracija
          </button>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-base font-bold text-slate-100 mb-5">
            {isLogin ? 'Prijava u sustav' : 'Kreirajte novi račun'}
          </h2>

          <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vas@email.hr"
                required
                autoComplete="email"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Lozinka {!isLogin && <span className="normal-case font-normal text-slate-600">(min. 8 znakova)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password — signup only */}
            {!isLogin && (
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Potvrda lozinke
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}

            {info && (
              <div className="text-xs text-green-400 bg-green-900/20 border border-green-800/40 rounded-xl px-3.5 py-2.5">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl transition-all mt-2',
                loading
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : isLogin
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30'
                    : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30'
              )}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-500 border-t-slate-300 rounded-full animate-spin" />
              ) : isLogin ? (
                <LogIn className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {loading
                ? (isLogin ? 'Prijavljivanje…' : 'Kreiranje računa…')
                : (isLogin ? 'Prijavi se' : 'Kreiraj račun')}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">
          Digitalni tajnik · Platforma za karate klubove
        </p>
      </div>
    </div>
  );
}
