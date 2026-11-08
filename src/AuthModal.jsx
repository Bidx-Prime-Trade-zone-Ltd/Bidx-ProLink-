import React, { useEffect, useState } from 'react';
import { supabase, supabaseConfigError } from './lib/supabase.js';
import { X, Mail, Lock, LoaderCircle, CheckCircle2 } from 'lucide-react';

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('Sign in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) setError(sessionError.message);
      setSession(data?.session ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
        setMode('Reset password');
        setMessage('Choose a new password for your account.');
      } else if (event === 'SIGNED_IN') {
        setMessage('You are signed in successfully.');
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const run = async (operation) => {
    setBusy(true); setError(''); setMessage('');
    try { await operation(); }
    catch (e) { setError(e?.message || 'Authentication failed. Please try again.'); }
    finally { setBusy(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) { setError(supabaseConfigError); return; }
    if (mode === 'Create account' && password !== confirmPassword) {
      setError('Your passwords do not match.'); return;
    }
    if (mode !== 'Forgot password' && password.length < 8) {
      setError('Use a password with at least 8 characters.'); return;
    }
    await run(async () => {
      if (mode === 'Create account') {
        const { data, error: e } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (e) throw e;
        if (data.session) setMessage('Your account has been created and you are signed in.');
        else setMessage('Registration received. Check your inbox and spam folder for the confirmation link.');
      } else if (mode === 'Sign in') {
        const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (e) throw e;
        setMessage('Signed in successfully.');
      } else if (mode === 'Forgot password') {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin
        });
        if (e) throw e;
        setMessage('If this email is registered, a password-reset link has been sent.');
      } else if (mode === 'Reset password') {
        const { error: e } = await supabase.auth.updateUser({ password });
        if (e) throw e;
        setRecovery(false);
        setMessage('Password updated successfully. You can now sign in with your new password.');
        setMode('Sign in'); setPassword(''); setConfirmPassword('');
      }
    });
  };

  const google = () => run(async () => {
    if (!supabase) throw new Error(supabaseConfigError);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { access_type: 'offline', prompt: 'select_account' } }
    });
    if (e) throw e;
  });

  const signedIn = Boolean(session?.user);
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal auth-modal" onClick={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X/></button>
      <div className="brand-mark"><span className="brand-symbol">B</span><span>Bidx <b>ProLink</b><small>SKILLED PEOPLE. QUALITY WORK.</small></span></div>
      <h2>{signedIn ? 'Your account' : recovery ? 'Reset your password' : mode + ' to Bidx ProLink'}</h2>
      <p>{signedIn ? 'You are authenticated with Bidx ProLink.' : 'Sign in or create an account to access your profile and service requests.'}</p>
      {signedIn ? <><p className="auth-feedback success"><CheckCircle2 size={16}/> Signed in as {session.user.email}</p><button className="outline-button full" disabled={busy} onClick={()=>run(async()=>{const {error:e}=await supabase.auth.signOut();if(e)throw e;setMessage('You have signed out.');})}>Sign out</button></> :
      <>
        {mode !== 'Forgot password' && mode !== 'Reset password' && <button className="google-button" type="button" onClick={google} disabled={busy}><span className="google-g">G</span> Continue with Google</button>}
        {mode !== 'Forgot password' && mode !== 'Reset password' && <div className="or-divider"><span>or continue with email</span></div>}
        <form onSubmit={submit}>
          <label className="form-label">Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
          {mode !== 'Forgot password' && <label className="form-label">Password<input type="password" required minLength={8} autoComplete={mode==='Sign in'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>}
          {(mode==='Create account'||mode==='Reset password') && <label className="form-label">Confirm password<input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirm your password"/></label>}
          {mode==='Sign in' && <p className="auth-switch"><button type="button" onClick={()=>{setMode('Forgot password');setError('');setMessage('');}}>Forgot password?</button></p>}
          {error && <p className="auth-feedback error" role="alert">{error}</p>}
          {message && <p className="auth-feedback success" role="status">{message}</p>}
          {supabaseConfigError && <p className="auth-feedback error">{supabaseConfigError}</p>}
          <button className="primary-button full" type="submit" disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Please wait…</>:mode}</button>
        </form>
        {mode!=='Forgot password' && mode!=='Reset password' && <p className="auth-switch">{mode==='Sign in'?'New to ProLink?':'Already have an account?'} <button type="button" onClick={()=>{setMode(mode==='Sign in'?'Create account':'Sign in');setError('');setMessage('');}}> {mode==='Sign in'?'Create account':'Sign in'}</button></p>}
        {mode==='Forgot password' && <p className="auth-switch"><button type="button" onClick={()=>{setMode('Sign in');setError('');setMessage('');}}>Back to sign in</button></p>}
      </>}
      <small className="legal-copy">By continuing, you agree to our Terms of Service and Privacy Policy.</small>
    </div>
  </div>;
}
