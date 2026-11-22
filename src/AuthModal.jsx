import React, { useEffect, useState } from 'react';
import { supabase, supabaseConfigError } from './lib/supabase.js';
import { LoaderCircle, CheckCircle2, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function AuthModal({ onClose }) {
  const [mode,setMode]=useState('Sign in');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [showConfirmPassword,setShowConfirmPassword]=useState(false);
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

  const isNativeAndroid=()=>/BidxProLinkAndroid/.test(navigator.userAgent);
  const authRedirectUrl=()=>isNativeAndroid()?'com.bidxpro.prolink://auth/callback':window.location.origin;

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
        const {data,error:e}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:authRedirectUrl(),data:{preferred_language:'en'}}});
        if(e)throw e;
        if(data.session){setMessage('Account created. Opening ProLink…');}
        else{setMessage('Confirmation email sent. Confirm your email, then return here to sign in.');setBusy(false);setBusyLabel('');}
      }else if(mode==='Sign in'){
        const {error:e}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(e)throw e;
        // Parent app listens for SIGNED_IN and replaces this screen with the app.
      }else if(mode==='Forgot password'){
        const {error:e}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:authRedirectUrl()});if(e)throw e;
        setMessage('If this email is registered, a reset link has been sent.');setBusy(false);setBusyLabel('');
      }else{
        const {error:e}=await supabase.auth.updateUser({password});if(e)throw e;
        setRecovery(false);const {error:se}=await supabase.auth.signOut({scope:'global'});if(se)throw se;
        setMode('Sign in');setPassword('');setConfirmPassword('');setMessage('Password updated. Sign in with your new password.');setBusy(false);setBusyLabel('');
      }
    });
  };
  const randomNonce=()=>{
    const bytes=new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
  };
  const sha256Hex=async value=>{
    const digest=await window.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  };
  const nativeGoogleSignIn=async()=>{
    const bridge=window.BidxNativeGoogle;
    if(!bridge||typeof bridge.postMessage!=='function'){
      throw new Error('The native Google sign-in service is unavailable. Please update ProLink and try again, or use email and password.');
    }
    if(!window.crypto?.subtle||!window.crypto?.getRandomValues){
      throw new Error('Secure Google sign-in is unavailable on this device. Please use email and password.');
    }
    const rawNonce=randomNonce();
    const id=randomNonce().slice(0,16);
    const hashedNonce=await sha256Hex(rawNonce);
    const reply=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Google sign-in timed out. Please try again.')),5*60*1000);
      bridge.onmessage=event=>{
        let result;
        try{result=JSON.parse(event?.data||'{}');}catch(_){return;}
        if(result?.id!==id)return;
        clearTimeout(timer);
        resolve(result);
      };
      try{bridge.postMessage(JSON.stringify({type:'googleSignIn',id,nonce:hashedNonce}));}
      catch(e){clearTimeout(timer);reject(e);}
    });
    if(reply.status==='cancelled')throw new Error('Google sign-in was cancelled.');
    if(reply.status!=='success'||!reply.idToken){
      const messages={
        no_credential:'Google could not find an eligible sign-in credential. This can happen when the Android app signing certificate or Google OAuth configuration does not match. Please try email and password while we verify the configuration.',
        network:'Check your internet connection and try again.',
        config:'Google sign-in configuration needs attention. Please use email and password for now.',
        no_token:'Google did not return a sign-in token. Please try again.',
        busy:'Google sign-in is already open. Finish or close it, then try again.',
        authorization:'Google could not complete authorization after you selected your account. Please try again. If the problem continues, contact ProLink support.'
      };
      throw new Error(messages[reply.code]||'Google sign-in could not be completed. Please try again.');
    }
    const {error:e}=await supabase.auth.signInWithIdToken({provider:'google',token:reply.idToken,nonce:rawNonce});
    if(e)throw e;
  };
  // Android uses the same native Credential Manager flow as Marketplace02.
  // The account picker appears over ProLink; no Chrome/browser OAuth redirect.
  // Ordinary web users retain Supabase's hosted OAuth flow.
  const google=async()=>{
    if(!supabase){setError(supabaseConfigError);return;}
    setBusy(true);setBusyLabel('Connecting to Google…');setError('');setMessage('');
    try{
      // Use the same Supabase Google OAuth flow that is already proven
      // to work in the PWABuilder release. Do not force the GitHub Android
      // package through the separate Credential Manager native authorization
      // path, which was failing after account selection.
      const {error:e}=await supabase.auth.signInWithOAuth({
        provider:'google',
        options:{redirectTo:window.location.origin,queryParams:{prompt:'select_account'}}
      });
      if(e)throw e;
    }catch(e){
      console.error('[BidxGoogleAuth] Google sign-in failed:',e);
      setError(e?.message||'Google sign-in could not start. Please try again.');
      setBusy(false);setBusyLabel('');
    }
  };

  const signedIn=Boolean(session?.user);
  return <div className="modal-backdrop auth-progress-backdrop">
    <div className="modal auth-modal" onClick={e=>e.stopPropagation()}>
      <button type="button" className="modal-back-arrow" onClick={onClose} aria-label="Go back one step"><ArrowLeft/></button>
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
          {mode==='Reset password'&&<label className="form-label">Confirm new password<div className="password-input-wrap"><input type={showConfirmPassword?'text':'password'} required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Enter your new password again"/><button className="password-visibility" type="button" onClick={()=>setShowConfirmPassword(v=>!v)} aria-label={showConfirmPassword?'Hide password':'Show password'} title={showConfirmPassword?'Hide password':'Show password'}>{showConfirmPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>}
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
      <small className="legal-copy">By continuing, you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.</small>
    </div>
  </div>;
}
