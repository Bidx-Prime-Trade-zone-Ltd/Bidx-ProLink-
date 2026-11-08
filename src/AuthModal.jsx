import React, { useEffect, useState } from 'react';
import { supabase, supabaseConfigError } from './lib/supabase.js';
import { LoaderCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function AuthModal({ onClose }) {
  const [mode,setMode]=useState('Sign in');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [acceptedTerms,setAcceptedTerms]=useState(false);
  const [busy,setBusy]=useState(false);
  const [busyLabel,setBusyLabel]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [recovery,setRecovery]=useState(false);
  const [session,setSession]=useState(null);

  useEffect(()=>{
    if(!supabase)return;
    let alive=true;
    supabase.auth.getSession().then(({data,error:e})=>{if(!alive)return;if(e)setError(e.message);setSession(data?.session||null);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{
      if(!alive)return;
      setSession(next);
      if(event==='PASSWORD_RECOVERY'){setRecovery(true);setMode('Reset password');setMessage('Choose a new password.');}
      if(event==='SIGNED_IN'){setBusy(false);setBusyLabel('');setMessage('Sign-in complete. Opening ProLink…');}
    });
    return ()=>{alive=false;subscription.unsubscribe();};
  },[]);

  const run=async(label,operation)=>{setBusy(true);setBusyLabel(label);setError('');setMessage('');
    try{await operation();}catch(e){setError(e?.message||'Authentication failed. Please try again.');setBusy(false);setBusyLabel('');}
  };
  const submit=async e=>{
    e.preventDefault();
    if(!supabase){setError(supabaseConfigError);return;}
    if(mode==='Create account'&&!acceptedTerms){setError('Please accept the Terms and Conditions and Privacy Policy.');return;}
    if(mode==='Reset password'&&!recovery){setError('Open the password-reset link from your email first.');return;}
    if(mode==='Reset password'&&password!==confirmPassword){setError('The passwords do not match.');return;}
    if(mode!=='Forgot password'&&password.length<8){setError('Use a password with at least 8 characters.');return;}
    await run(mode==='Sign in'?'Signing in…':mode==='Create account'?'Creating account…':mode==='Forgot password'?'Sending reset link…':'Updating password…',async()=>{
      if(mode==='Create account'){
        const {data,error:e}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin}});
        if(e)throw e;
        if(data.session){setMessage('Account created. Opening ProLink…');}
        else{setMessage('Confirmation email sent. Confirm your email, then return here to sign in.');setBusy(false);setBusyLabel('');}
      }else if(mode==='Sign in'){
        const {error:e}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(e)throw e;
        // Parent app listens for SIGNED_IN and replaces this screen with the app.
      }else if(mode==='Forgot password'){
        const {error:e}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});if(e)throw e;
        setMessage('If this email is registered, a reset link has been sent.');setBusy(false);setBusyLabel('');
      }else{
        const {error:e}=await supabase.auth.updateUser({password});if(e)throw e;
        setRecovery(false);const {error:se}=await supabase.auth.signOut({scope:'global'});if(se)throw se;
        setMode('Sign in');setPassword('');setConfirmPassword('');setMessage('Password updated. Sign in with your new password.');setBusy(false);setBusyLabel('');
      }
    });
  };
  const google=()=>run('Connecting to Google…',async()=>{
    if(!supabase)throw new Error(supabaseConfigError);
    const {error:e}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin,queryParams:{prompt:'select_account'}}});
    if(e)throw e;
    // OAuth redirects the browser. Do not clear the progress state before navigation.
  });
  const signedIn=Boolean(session?.user);
  return <div className="modal-backdrop auth-progress-backdrop">
    <div className="modal auth-modal" onClick={e=>e.stopPropagation()}>
      <div className="brand-mark"><span className="brand-symbol">B</span><span>Bidx <b>ProLink</b><small>SKILLED PEOPLE. QUALITY WORK.</small></span></div>
      <h2>{signedIn?'Opening your account…':recovery?'Reset your password':mode+' to Bidx ProLink'}</h2>
      <p>{signedIn?'Your sign-in is complete. Taking you into ProLink now.':'Sign in or create an account to continue.'}</p>
      {(busy||signedIn)&&<div className="auth-progress" role="status"><span className="auth-progress-track"><i/></span><b>{signedIn?'Loading your account…':busyLabel}</b></div>}
      {!signedIn&&!busy&&<>
        {mode!=='Forgot password'&&mode!=='Reset password'&&<button className="google-button" type="button" onClick={google}><span className="google-g">G</span> Continue with Google</button>}
        {mode!=='Forgot password'&&mode!=='Reset password'&&<div className="or-divider"><span>or continue with email</span></div>}
        <form onSubmit={submit}>
          <label className="form-label">Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
          {mode!=='Forgot password'&&<label className="form-label">Password<div className="password-input-wrap"><input type={showPassword?'text':'password'} required minLength={8} autoComplete={mode==='Sign in'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/><button className="password-visibility" type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>}
          {mode==='Reset password'&&<label className="form-label">Confirm new password<input type="password" required minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>}
          {mode==='Create account'&&<label className="auth-terms-check"><input type="checkbox" checked={acceptedTerms} onChange={e=>setAcceptedTerms(e.target.checked)}/><span>I confirm I am at least 18 and agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span></label>}
          {mode==='Sign in'&&<p className="auth-switch"><button type="button" onClick={()=>{setMode('Forgot password');setError('');setMessage('');}}>Forgot password?</button></p>}
          {error&&<p className="auth-feedback error" role="alert">{error}</p>}
          {message&&<p className="auth-feedback success" role="status">{message}</p>}
          {supabaseConfigError&&<p className="auth-feedback error">{supabaseConfigError}</p>}
          <button className="primary-button full" type="submit">{mode}</button>
        </form>
        {mode!=='Forgot password'&&mode!=='Reset password'&&<p className="auth-switch">{mode==='Sign in'?'New to ProLink?':'Already have an account?'} <button type="button" onClick={()=>{setMode(mode==='Sign in'?'Create account':'Sign in');setError('');setMessage('');setPassword('');setAcceptedTerms(false);}}> {mode==='Sign in'?'Create account':'Sign in'}</button></p>}
        {mode==='Forgot password'&&<p className="auth-switch"><button type="button" onClick={()=>{setMode('Sign in');setError('');setMessage('');}}>Back to sign in</button></p>}
      </>}
      {error&&signedIn===false&&busy&&<p className="auth-feedback error" role="alert">{error}</p>}
      <small className="legal-copy">By continuing, you agree to our Terms of Service and Privacy Policy.</small>
    </div>
  </div>;
}
