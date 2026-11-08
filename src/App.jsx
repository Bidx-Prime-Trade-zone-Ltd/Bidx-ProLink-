import React, { useEffect, useMemo, useState } from 'react';
import AuthModal from './AuthModal.jsx';
import { supabase } from './lib/supabase.js';
import {
  Search, MapPin, SlidersHorizontal, ChevronDown, ChevronRight, ArrowLeft,
  Menu, Bell, UserRound, BriefcaseBusiness, ShieldCheck, Star, Phone,
  MessageCircle, CalendarDays, FileText, Plus, Check, X, Camera, Upload,
  Wrench, Zap, Paintbrush, Hammer, Droplets, Snowflake, Car, Scissors,
  Heart, Home, Compass, ClipboardList, Settings, LogOut, BadgeCheck,
  Clock3, Award, Building2, Mail, Lock, ArrowUpRight, Filter, Sparkles
} from 'lucide-react';

const categories = [
  { name: 'Electrician', icon: Zap, count: '1.2k+' },
  { name: 'Plumber', icon: Droplets, count: '980+' },
  { name: 'Bricklayer', icon: Hammer, count: '760+' },
  { name: 'Carpenter', icon: Wrench, count: '840+' },
  { name: 'Painter', icon: Paintbrush, count: '690+' },
  { name: 'AC technician', icon: Snowflake, count: '530+' },
  { name: 'Mechanic', icon: Car, count: '610+' },
  { name: 'More services', icon: BriefcaseBusiness, count: 'Explore' }
];

const professionals = [
  { id: 1, name: 'Samuel Okafor', trade: 'Electrical technician', city: 'Lekki, Lagos', rating: '4.9', reviews: 84, jobs: 126, verified: true, price: '₦8,000', initials: 'SO', color: 'avatar-green', skills: ['House wiring', 'Inverter installation', 'Fault tracing'], about: 'Experienced electrical technician for homes, offices and small businesses. I focus on safe installations, neat finishing and clear communication.', years: '8 years' },
  { id: 2, name: 'Ibrahim Musa', trade: 'Professional plumber', city: 'Wuse 2, Abuja', rating: '4.8', reviews: 62, jobs: 91, verified: true, price: '₦6,500', initials: 'IM', color: 'avatar-blue', skills: ['Pipe repairs', 'Bathroom fittings', 'Water systems'], about: 'Residential and commercial plumbing, from quick repairs to complete bathroom and water-system installations.', years: '7 years' },
  { id: 3, name: 'Chinedu Eze', trade: 'Bricklayer & mason', city: 'Ikeja, Lagos', rating: '4.9', reviews: 47, jobs: 73, verified: true, price: 'Request quote', initials: 'CE', color: 'avatar-orange', skills: ['Block work', 'Plastering', 'Concrete work'], about: 'Reliable masonry services for renovations, extensions and new builds. Site assessment and quotations available.', years: '11 years' },
  { id: 4, name: 'Daniel Adebayo', trade: 'Carpenter', city: 'Ibadan, Oyo', rating: '4.7', reviews: 38, jobs: 58, verified: false, price: '₦10,000', initials: 'DA', color: 'avatar-purple', skills: ['Doors', 'Kitchen cabinets', 'Furniture repairs'], about: 'Custom woodwork, furniture installation and repairs with attention to detail.', years: '6 years' },
  { id: 5, name: 'Grace Nwosu', trade: 'Painter & decorator', city: 'Port Harcourt, Rivers', rating: '5.0', reviews: 29, jobs: 42, verified: true, price: 'Request quote', initials: 'GN', color: 'avatar-pink', skills: ['Interior painting', 'Exterior painting', 'Wall finishes'], about: 'Professional painting and decorative finishes for homes and commercial spaces.', years: '5 years' },
  { id: 6, name: 'Tunde Bello', trade: 'AC & cooling technician', city: 'Yaba, Lagos', rating: '4.8', reviews: 56, jobs: 79, verified: true, price: '₦7,500', initials: 'TB', color: 'avatar-teal', skills: ['AC installation', 'Servicing', 'Refrigeration'], about: 'Air-conditioning installation, maintenance and fault diagnosis for domestic and office systems.', years: '9 years' }
];

function Brand() {
  return <div className="brand-mark"><span className="brand-symbol">B</span><span>Bidx <b>ProLink</b><small>SKILLED PEOPLE. QUALITY WORK.</small></span></div>;
}

function Avatar({ person, large = false }) {
  return <div className={`avatar ${person.color} ${large ? 'avatar-large' : ''}`}>{person.initials}</div>;
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState({full_name:'',date_of_birth:'',phone:'',whatsapp:'',state:'',lga:'',address:'',profession:'',bio:''});
  const [menuOpen, setMenuOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setProfile(p=>({...p,...(data.session?.user?.user_metadata||{})})); setAuthReady(true); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next) => { setSession(next); setProfile(p=>({...p,...(next?.user?.user_metadata||{})})); setAuthReady(true); });
    return () => subscription.unsubscribe();
  }, []);
  const [tab, setTab] = useState('Explore');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('Lagos, Nigeria');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('Sign in');
  const [showJoin, setShowJoin] = useState(false);
  const [joinStep, setJoinStep] = useState(1);
  const [showRequest, setShowRequest] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => professionals.filter(p => {
    const text = `${p.name} ${p.trade} ${p.city} ${p.skills.join(' ')}`.toLowerCase();
    const matchesText = text.includes(query.toLowerCase());
    const matchesCategory = activeCategory === 'All' || p.trade.toLowerCase().includes(activeCategory.toLowerCase()) || p.skills.join(' ').toLowerCase().includes(activeCategory.toLowerCase());
    const matchesCity = location.trim() === '' || p.city.toLowerCase().includes(location.split(',')[0].trim().toLowerCase()) || location.toLowerCase().includes('nigeria') || p.city.toLowerCase().includes(location.toLowerCase());
    return matchesText && matchesCategory && matchesCity;
  }), [query, activeCategory, location]);

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };
  const toggleSave = (id) => setSaved(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const openAuth = (mode = 'Sign in') => { setAuthMode(mode); setShowAuth(true); setMobileMenu(false); };
  const saveProfile = async () => { setSavingProfile(true); const {error}=await supabase.auth.updateUser({data:profile}); setSavingProfile(false); notify(error ? error.message : 'Profile saved.'); };
  const signOut = async () => { const {error}=await supabase.auth.signOut(); if(error) notify(error.message); };
  const startRequest = (person) => { setSelected(person); setRequestSent(false); setShowRequest(true); };

  if (!authReady) return <div className="app-loading">Loading Bidx ProLink…</div>;
  if (!session) return <div className="auth-entry"><AuthModal onClose={()=>{}} /></div>;
  return <div className="app-shell">
    <header className="topbar prolink-mobile-topbar">
      <div className="topbar-inner">
        <button className="icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu"><Menu size={24}/></button>
        <button className="brand-button" onClick={() => {setTab('Explore');setSelected(null);}}><Brand /></button>
        <span className="topbar-spacer"/>
      </div>
    </header>
        {menuOpen && <div className="menu-scrim" onClick={()=>setMenuOpen(false)}><aside className="app-menu prolink-drawer" onClick={e=>e.stopPropagation()}><div className="drawer-brand"><Brand/><button className="drawer-close" onClick={()=>setMenuOpen(false)} aria-label="Close menu"><X/></button></div><button onClick={()=>{setTab('Profile');setMenuOpen(false)}}>My profile</button><button onClick={()=>{setTab('Messages');setMenuOpen(false)}}>Messages</button><button onClick={()=>{setTab('Settings');setMenuOpen(false)}}>Settings & account</button><button onClick={()=>{setTab('Terms and Conditions');setMenuOpen(false)}}>Terms and Conditions</button><button onClick={()=>{setTab('Privacy Policy');setMenuOpen(false)}}>Privacy Policy</button><button onClick={()=>{setTab('Contact');setMenuOpen(false)}}>Contact and support</button><div className="drawer-contact"><a href="mailto:Support@bidxpro.online">Support@bidxpro.online</a><a href="mailto:Info@bidxpro.online">Info@bidxpro.online</a><span>bidxpro.online</span></div><button className="drawer-signout" onClick={signOut}>Sign out</button></aside></div>}

    {selected ? <main className="content-wrap detail-wrap">
      <button className="back-link" onClick={() => setSelected(null)}><ArrowLeft size={17}/> Back to professionals</button>
      <section className="profile-layout">
        <div className="profile-main">
          <div className="profile-hero-card">
            <div className="profile-top"><Avatar person={selected} large/><div className="profile-heading"><div className="name-line"><h1>{selected.name}</h1>{selected.verified && <span className="verified-pill"><BadgeCheck size={14}/> Verified</span>}</div><p>{selected.trade}</p><div className="meta-row"><span><MapPin size={15}/>{selected.city}</span><span><Star size={15} fill="currentColor"/>{selected.rating} ({selected.reviews} reviews)</span></div></div><button className={saved.includes(selected.id) ? 'save-button saved' : 'save-button'} onClick={() => toggleSave(selected.id)}><Heart size={18} fill={saved.includes(selected.id) ? 'currentColor' : 'none'}/></button></div>
            <div className="profile-stats"><div><b>{selected.jobs}+</b><span>Jobs completed</span></div><div><b>{selected.years}</b><span>Experience</span></div><div><b>{selected.rating}/5</b><span>Customer rating</span></div></div>
          </div>
          <section className="panel"><h2>About this professional</h2><p className="body-copy">{selected.about}</p><h3>Skills & services</h3><div className="skill-tags">{selected.skills.map(s=><span key={s}>{s}</span>)}</div></section>
          <section className="panel"><div className="section-heading"><div><h2>Work gallery</h2><p>Examples of completed work</p></div><span className="muted-small">Portfolio photos</span></div><div className="gallery-grid"><div className="gallery-placeholder"><Wrench/><span>Project photo</span></div><div className="gallery-placeholder gallery-alt"><Building2/><span>Installation</span></div><div className="gallery-placeholder gallery-third"><Camera/><span>Work sample</span></div></div></section>
          <section className="panel"><h2>Qualifications & verification</h2><div className="verification-list"><div><ShieldCheck/><span><b>Identity review</b><small>Verification status is shown when confirmed by Bidx ProLink.</small></span><em className={selected.verified ? 'status-ok' : 'status-pending'}>{selected.verified ? 'Verified' : 'Not verified'}</em></div><div><Award/><span><b>Certificates & qualifications</b><small>Professional credentials can be reviewed on the profile.</small></span><em className="status-pending">On request</em></div></div></section>
        </div>
        <aside className="profile-sidebar"><div className="contact-card"><span className="eyebrow">START A CONVERSATION</span><h2>Need help with a job?</h2><p>Contact {selected.name.split(' ')[0]} to discuss your project and agree on the next step.</p><div className="price-label">Indicative starting price</div><strong className="price">{selected.price}</strong><button className="primary-button full" onClick={() => startRequest(selected)}><MessageCircle size={17}/> Request a service</button><button className="outline-button full" onClick={() => notify('Phone contact will be available after account setup.')}><Phone size={17}/> Contact by phone</button><small className="safe-note"><ShieldCheck size={14}/> Keep your agreement clear before work begins.</small></div><div className="help-card"><ShieldCheck/><b>Book with confidence</b><p>Check profile details, discuss the scope and agree on price and timing before work starts.</p></div></aside>
      </section>
    </main> : tab === 'Profile' ? <main className="content-wrap info-page"><h1>My profile</h1><p>{session.user.email}</p><section className="panel"><div className="form-grid"><label>Full legal name<input value={profile.full_name} onChange={e=>setProfile(p=>({...p,full_name:e.target.value}))}/></label><label>Email<input value={session.user.email||''} readOnly/></label><label>Date of birth<input type="date" value={profile.date_of_birth} onChange={e=>setProfile(p=>({...p,date_of_birth:e.target.value}))}/></label><label>Phone<input value={profile.phone} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))}/></label><label>WhatsApp<input value={profile.whatsapp} onChange={e=>setProfile(p=>({...p,whatsapp:e.target.value}))}/></label><label>State<input value={profile.state} onChange={e=>setProfile(p=>({...p,state:e.target.value}))}/></label><label>LGA<input value={profile.lga} onChange={e=>setProfile(p=>({...p,lga:e.target.value}))}/></label><label>Address<input value={profile.address} onChange={e=>setProfile(p=>({...p,address:e.target.value}))}/></label><label>Profession<input value={profile.profession} onChange={e=>setProfile(p=>({...p,profession:e.target.value}))}/></label><label>About you<textarea value={profile.bio} onChange={e=>setProfile(p=>({...p,bio:e.target.value}))}/></label></div><button className="primary-button" onClick={saveProfile} disabled={savingProfile}>{savingProfile?'Saving…':'Save profile'}</button><button className="outline-button" onClick={signOut}>Sign out</button></section></main> : tab === 'Settings' ? <main className="content-wrap info-page settings-page"><span className="eyebrow">ACCOUNT</span><h1>Settings</h1><p>Manage your personal information, privacy and account access.</p><section className="settings-list"><button onClick={()=>setTab('Profile')}><b>Personal information</b><small>Update your name, date of birth and contact details</small></button><button onClick={()=>notify('Password changes are managed securely through the sign-in recovery process.')}><b>Password & security</b><small>Manage sign-in and account security</small></button><button onClick={()=>setTab('Privacy Policy')}><b>Privacy settings</b><small>Review how your information is handled</small></button><button onClick={()=>setTab('Contact')}><b>Help and support</b><small>Contact the Bidx ProLink support team</small></button></section><section className="danger-zone"><h2>Delete account</h2><p>To protect your account, submit a verified deletion request to our support team. Your request will be reviewed before account data is deleted.</p><a className="danger-button" href="mailto:Support@bidxpro.online?subject= Bidx%20ProLink%20Account%20Deletion%20Request">Request account deletion</a></section></main> : tab === 'Messages' ? <main className="content-wrap info-page"><h1>Messages</h1><p>Your conversations with professionals will appear here.</p></main> : tab === 'Requests' ? <main className="content-wrap info-page"><h1>My requests</h1><p>Your service requests will appear here.</p></main> : tab === 'Contact' ? <main className="content-wrap info-page"><h1>Contact and support</h1><p>Support: <a href="mailto:Support@bidxpro.online">Support@bidxpro.online</a></p><p>General: <a href="mailto:Info@bidxpro.online">Info@bidxpro.online</a></p><p><a href="https://bidxpro.online">bidxpro.online</a></p></main> : tab === 'Terms and Conditions' || tab === 'Privacy Policy' ? <main className="content-wrap info-page"><h1>{tab}</h1><p>Use Bidx ProLink responsibly. Your account and profile information is used to provide the service. Contact Support@bidxpro.online for questions.</p></main> : tab === 'How it works' ? <main className="content-wrap info-page"><div className="eyebrow">SIMPLE. DIRECT. LOCAL.</div><h1>Good work starts with the right connection.</h1><p className="lead">Bidx ProLink helps customers discover skilled professionals and helps technicians present their work to more people.</p><div className="steps-grid">{[['01','Find a professional','Search by trade, skill or location and compare professional profiles.'],['02','Discuss your job','Contact the professional, explain what you need and agree on the scope.'],['03','Confirm the details','Record the agreed work, cost and timeline before work begins.'],['04','Get the work done','Stay in touch and share feedback after the job is complete.']].map(([n,t,d])=><div className="step-card" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></div>)}</div><button className="primary-button" onClick={()=>setTab('Explore')}>Explore professionals <ArrowUpRight size={16}/></button></main> : <main className="prolink-home-screen">
      <section className="prolink-search-header">
        <div className="prolink-search-inner">
          <div className="prolink-search-title">Find the right professional</div>
          <div className="prolink-search-row">
            <label className="prolink-location-select"><MapPin size={18}/><select aria-label="Country"><option>Nigeria</option></select><ChevronDown size={16}/></label>
            <label className="prolink-search-input"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="What service are you looking for?"/></label>
          </div>
          <label className="prolink-area-input"><MapPin size={17}/><input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Your location, state or city"/></label>
          <button className="prolink-search-button" onClick={()=>notify(query.trim() ? 'Search is ready. Professional listings will appear here as they become available.' : 'Enter a service to search.')}>Search</button>
        </div>
      </section>
      <section className="prolink-home-empty" aria-label="Home"></section>
    </main>}

    <footer className="footer"><div className="content-wrap footer-inner"><div><Brand/><p className="footer-copy">Connecting skilled professionals with people who need quality work.</p></div><div className="footer-links"><div><b>Explore</b><button onClick={()=>setTab('Explore')}>Find professionals</button><button onClick={()=>setTab('How it works')}>How it works</button></div><div><b>Professionals</b><button onClick={()=>setShowJoin(true)}>Join ProLink</button><button onClick={()=>openAuth()}>Sign in</button></div><div><b>Contact</b><a href="mailto:Support@bidxpro.online">Support@bidxpro.online</a><a href="mailto:Info@bidxpro.online">Info@bidxpro.online</a></div></div><div className="footer-bottom"><span>© 2026 Bidx ProLink</span><span>A product of BIDX PRIME TRADE ZONE LTD</span><span>Payments are arranged directly between customers and professionals.</span></div></div></footer>

    <nav className="mobile-bottom-nav prolink-bottom-nav"><button className={tab==='Explore'?'selected':''} onClick={()=>{setTab('Explore');setSelected(null);}}><Home size={21}/><span>Home</span></button><button className={tab==='Messages'?'selected':''} onClick={()=>setTab('Messages')}><MessageCircle size={21}/><span>Messages</span></button><button className={tab==='Profile'?'selected':''} onClick={()=>setTab('Profile')}><UserRound size={21}/><span>Profile</span></button></nav>

    {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} />}

    {showJoin&&<div className="modal-backdrop" onClick={()=>setShowJoin(false)}><div className="modal join-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowJoin(false)}><X/></button><div className="modal-step">STEP {joinStep} OF 3</div><div className="progress-track"><span style={{width:`${joinStep/3*100}%`}}/></div><h2>Create your professional profile</h2><p>Introduce your trade and experience to customers across Nigeria.</p>{joinStep===1?<><label className="form-label">Full legal name<input placeholder="Enter your full name"/></label><label className="form-label">Email address<input type="email" placeholder="you@example.com"/></label><label className="form-label">Phone number<input type="tel" placeholder="+234 800 000 0000"/></label><label className="form-label">I am registering as<select><option>Individual professional</option><option>CAC-registered business</option></select></label></>:joinStep===2?<><label className="form-label">Main profession<select><option>Select your trade</option>{categories.slice(0,7).map(c=><option key={c.name}>{c.name}</option>)}</select></label><label className="form-label">Years of experience<select><option>Select experience</option><option>Less than 2 years</option><option>2–5 years</option><option>6–10 years</option><option>More than 10 years</option></select></label><label className="form-label">Skills and services<textarea placeholder="List the services you offer" rows="3"/></label><label className="form-label">Work location<input placeholder="City, state and area"/></label></>:<><div className="upload-box"><Camera/><b>Profile photo</b><span>Add a clear portrait photo</span><button onClick={()=>notify('Photo upload will be connected to secure storage.')}>Choose photo <Upload size={14}/></button></div><div className="upload-box compact-upload"><FileText/><div><b>Certificates and work photos</b><span>Upload qualifications and 1–5 examples of your work.</span></div><button onClick={()=>notify('Document and gallery uploads will be connected to secure storage.')}>Add files <Plus size={14}/></button></div><div className="upload-box compact-upload"><ShieldCheck/><div><b>Identity verification</b><span>NIN verification and CAC documents (for registered businesses) are handled securely during verification.</span></div></div></> }<div className="modal-actions">{joinStep>1&&<button className="outline-button" onClick={()=>setJoinStep(joinStep-1)}>Back</button>}<button className="primary-button" onClick={()=>joinStep<3?setJoinStep(joinStep+1):(setShowJoin(false),openAuth('Create account'),notify('Profile setup will be saved after account and backend connection.'))}>{joinStep===3?'Create account':'Continue'} <ChevronRight size={16}/></button></div><small className="legal-copy">Your information and uploaded documents must be protected and reviewed before a verification badge is displayed.</small></div></div>}

    {showRequest&&<div className="modal-backdrop" onClick={()=>setShowRequest(false)}><div className="modal request-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowRequest(false)}><X/></button>{requestSent?<div className="success-state"><span><Check/></span><h2>Request prepared</h2><p>Your service request is ready. Sign in will be required to send and track it.</p><button className="primary-button full" onClick={()=>{setShowRequest(false);openAuth();}}>Continue to sign in</button></div>:<><span className="eyebrow">SERVICE REQUEST</span><h2>Tell {selected?.name.split(' ')[0]} what you need</h2><p>Share a few details so the professional can understand your job.</p><label className="form-label">What do you need done?<textarea rows="4" placeholder="Describe the job, location and any important details..."/></label><label className="form-label">Preferred date<input type="date"/></label><label className="form-label">Job location<input placeholder="Enter the job address or area"/></label><button className="primary-button full" onClick={()=>setRequestSent(true)}>Review request <ArrowUpRight size={16}/></button><small className="legal-copy">No payment is collected in Bidx ProLink. Agree on price and terms directly with the professional.</small></>}</div></div>}

    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}

export default App;
