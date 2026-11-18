import React, { useEffect, useMemo, useState } from 'react';
import AuthModal from './AuthModal.jsx';
import { TermsContent, PrivacyContent } from './LegalPages.jsx';
import { PROFESSION_GROUPS, ALL_PROFESSIONS } from './professions.js';
import { INITIAL_COUNTRIES, COUNTRY_BY_CODE } from './globalCountries.js';
import { getAdministrativeAreas } from './lib/geography.js';
import { supabase } from './lib/supabase.js';
import AdminPortal from './AdminPortal.jsx';
import './admin.css';
import {
  Search, MapPin, SlidersHorizontal, ChevronDown, ChevronRight, ArrowLeft,
  Menu, Bell, UserRound, BriefcaseBusiness, ShieldCheck, Star, Phone,
  MessageCircle, CalendarDays, FileText, Plus, Check, X, Camera, Upload,
  Wrench, Zap, Paintbrush, Hammer, Droplets, Snowflake, Car, Scissors,
  Heart, Home, Compass, ClipboardList, Settings, LogOut, BadgeCheck,
  Clock3, Award, Building2, Mail, Lock, ArrowUpRight, Filter, Sparkles
} from 'lucide-react';

const categories = PROFESSION_GROUPS.slice(0,7).map(g=>({name:g.name,sub:g.services})).concat([{name:'More categories',sub:[]}]);

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
  const [professionals,setProfessionals] = useState([]);
  const [directoryLoading,setDirectoryLoading] = useState(true);
  const [directoryError,setDirectoryError] = useState('');
  const [directoryHasMore,setDirectoryHasMore] = useState(false);
  const [selectedGallery,setSelectedGallery] = useState([]);
  const [galleryLoading,setGalleryLoading] = useState(false);
  const [myGallery,setMyGallery] = useState([]);
  const [galleryFile,setGalleryFile] = useState(null);
  const [galleryPreview,setGalleryPreview] = useState('');
  useEffect(()=>{if(!galleryFile){setGalleryPreview('');return;}const url=URL.createObjectURL(galleryFile);setGalleryPreview(url);return()=>URL.revokeObjectURL(url);},[galleryFile]);
  const [galleryCaption,setGalleryCaption] = useState('');
  const [gallerySaving,setGallerySaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setProfile(p=>({...p,...(data.session?.user?.user_metadata||{})})); setAuthReady(true); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next) => { setSession(next); setProfile(p=>({...p,...(next?.user?.user_metadata||{})})); setAuthReady(true); });
    return () => subscription.unsubscribe();
  }, []);
  const loadProfessionals = async (append = false) => {
    if(!supabase){setProfessionals([]);setDirectoryHasMore(false);setDirectoryLoading(false);return;}
    setDirectoryLoading(true);
    if(!append)setDirectoryError('');
    const from=append?professionals.length:0;
    const {data,error}=await supabase.from('prolink_professional_profiles')
      .select('user_id,full_name,professional_name,category,subcategory,experience,skills,about,country_code,country_name,region,district,city,local_area,business_phone,whatsapp,is_published,approved_at')
      .eq('is_published',true).order('approved_at',{ascending:false}).range(from,from+49);
    if(error){
      setDirectoryError('The professional directory is temporarily unavailable. Please try again.');
      if(!append)setProfessionals([]);
    } else {
      const rows=(data||[]).filter(row=>row.is_published===true).map(row=>{
        const name=row.professional_name||row.full_name||'Prolink professional';
        const initials=name.split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase()||'P';
        const city=[row.local_area,row.city,row.district,row.region,row.country_name].filter(Boolean).join(', ');
        return {...row,id:row.user_id,name,trade:row.subcategory||row.category||'Skilled professional',city:city||row.country_name||'Location not provided',rating:'New',reviews:0,jobs:0,verified:true,price:'Request quote',initials,color:'avatar-green',skills:Array.isArray(row.skills)?row.skills:[],about:row.about||'Contact this professional to learn more about their services.',years:row.experience||'Experience not specified',phone:row.business_phone||'',whatsapp:row.whatsapp||''};
      });
      setProfessionals(previous=>append?[...previous,...rows]:rows);
      setDirectoryHasMore((data||[]).length===50);
    }
    setDirectoryLoading(false);
  };
  useEffect(()=>{if(authReady)loadProfessionals();},[authReady,session?.user?.id]);
  const [tab, setTab] = useState('Explore');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('Sign in');
  const [showJoin, setShowJoin] = useState(false);
  const [joinStep, setJoinStep] = useState(1);
  const [joinData, setJoinData] = useState(() => { const empty={full_name:'',email:'',phone:'',whatsapp:'',dob_day:'',dob_month:'',dob_year:'',country_code:'',country_iso3:'',country_name:'',region:'',district:'',city:'',local_area:'',postal_code:'',address:'',category:'',subcategory:'',experience:'',skills:'',business_name:'',about:''}; try{return {...empty,...JSON.parse(localStorage.getItem('prolink-onboarding-draft')||'{}')};}catch{return empty;} });
  const [adminAreas,setAdminAreas] = useState({level1:[],level2:[],level3:[],level4:[]});
  const [adminAreaLabels,setAdminAreaLabels] = useState({level1:'State / province / region',level2:'County / district',level3:'City / municipality',level4:'Local area'});
  const [adminAreasLoading,setAdminAreasLoading] = useState(false);
  const [workingIdFile,setWorkingIdFile] = useState(null);
  const [competencyFile,setCompetencyFile] = useState(null);
  const [extraSkillFile,setExtraSkillFile] = useState(null);
  const [joinSaving, setJoinSaving] = useState(false);
  useEffect(() => {
    const meta=session?.user?.user_metadata||{};
    if(meta.country_code && !joinData.country_code){
      const country=COUNTRY_BY_CODE[meta.country_code];
      setJoinData(p=>({...p,country_code:meta.country_code,country_iso3:country?.iso3||meta.country_iso3||'',country_name:country?.name||meta.country_name||''}));
    }
  },[session]);
  useEffect(() => {
    let active=true;
    setAdminAreas({level1:[],level2:[],level3:[],level4:[]});
    setAdminAreaLabels({level1:'State / province / region',level2:'County / district',level3:'City / municipality',level4:'Local area'});
    if(!showJoin||!joinData.country_iso3)return;
    setAdminAreasLoading(true);
    Promise.all([1,2,3,4].map(level=>getAdministrativeAreas(joinData.country_iso3,level).catch(()=>null))).then(results=>{
      if(!active)return;
      const keys=['level1','level2','level3','level4'];
      const nextAreas={},nextLabels={};
      results.forEach((data,index)=>{nextAreas[keys[index]]=data?.areas||[];nextLabels[keys[index]]=data?.levelName||['State / province / region','County / district','City / municipality','Local area'][index];});
      setAdminAreas(nextAreas);setAdminAreaLabels(nextLabels);
    }).finally(()=>{if(active)setAdminAreasLoading(false);});
    return()=>{active=false;};
  },[joinData.country_iso3,showJoin]);
  const [showCategories, setShowCategories] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryGroup, setCategoryGroup] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordRequestOpen,setPasswordRequestOpen] = useState(false);
  const [passwordRequestBusy,setPasswordRequestBusy] = useState(false);
  const [deleteRequestEmail, setDeleteRequestEmail] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [navStack, setNavStack] = useState([{tab:'Explore',menu:false}]);
  const navigateTab = (next) => {
    setNavStack(prev=>[...prev,{tab:next,menu:false}]);
    window.history.pushState({prolink:true,tab:next}, '', '#' + encodeURIComponent(next.toLowerCase().replaceAll(' ','-')));
    setTab(next); setSelected(null); setMenuOpen(false);
  };
  const openDrawer = () => { setMenuOpen(true); setNavStack(prev=>[...prev,{tab,menu:true}]); window.history.pushState({prolink:true,tab,menu:true},'','#menu'); };
  const back = () => { if (window.history.state?.prolink) window.history.back(); else {setMenuOpen(false);setTab('Explore');setSelected(null);} };
  useEffect(() => {
    // Do not remove OAuth callback parameters here. Supabase's PKCE client must
    // read the ?code= parameter and exchange it for a session before URL cleanup.
    const onPop=event=>{
      const state=event.state;
      if(state?.prolink){setTab(state.tab||'Explore');setMenuOpen(Boolean(state.menu));}
      else {setTab('Explore');setMenuOpen(false);}
      setSelected(null);
    };
    window.addEventListener('popstate',onPop);
    return ()=>window.removeEventListener('popstate',onPop);
  }, []);
  useEffect(() => { try { localStorage.setItem('prolink-onboarding-draft',JSON.stringify(joinData)); } catch {} }, [joinData]);

  useEffect(()=>{
    let active=true;
    if(!selected?.id){setSelectedGallery([]);return()=>{active=false;};}
    setGalleryLoading(true);
    supabase.from('prolink_work_gallery').select('id,user_id,object_path,caption,created_at').eq('user_id',selected.id).eq('is_public',true).order('created_at',{ascending:false}).then(async ({data,error})=>{
      if(!active)return;
      if(error){setSelectedGallery([]);return;}
      const gallery=await Promise.all((data||[]).map(async item=>{const {data:signed}=await supabase.storage.from('prolink-work-gallery').createSignedUrl(item.object_path,3600);return {...item,url:signed?.signedUrl||''};}));
      if(active)setSelectedGallery(gallery.filter(item=>item.url));
    }).finally(()=>{if(active)setGalleryLoading(false);});
    return()=>{active=false;};
  },[selected?.id]);
  useEffect(()=>{
    let active=true;
    if(tab!=='My Work Portfolio'||!session?.user?.id)return()=>{active=false;};
    supabase.from('prolink_work_gallery').select('id,user_id,object_path,caption,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).then(async ({data,error})=>{
      if(!active)return;
      if(!error){const gallery=await Promise.all((data||[]).map(async item=>{const {data:signed}=await supabase.storage.from('prolink-work-gallery').createSignedUrl(item.object_path,3600);return {...item,url:signed?.signedUrl||''};}));if(active)setMyGallery(gallery.filter(item=>item.url));}
    });
    return()=>{active=false;};
  },[tab,session?.user?.id]);
  const filtered = useMemo(() => professionals.filter(p => {
    const text = `${p.name} ${p.trade} ${p.city} ${p.skills.join(' ')} ${p.about}`.toLowerCase();
    const matchesText = text.includes(query.toLowerCase());
    const matchesCategory = activeCategory === 'All' || p.trade.toLowerCase().includes(activeCategory.toLowerCase()) || p.skills.join(' ').toLowerCase().includes(activeCategory.toLowerCase()) || (p.category||'').toLowerCase().includes(activeCategory.toLowerCase());
    const matchesCity = location.trim() === '' || p.city.toLowerCase().includes(location.toLowerCase());
    return matchesText && matchesCategory && matchesCity;
  }), [professionals,query, activeCategory, location]);

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };
  const toggleSave = (id) => setSaved(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const openAuth = (mode = 'Sign in') => { setAuthMode(mode); setShowAuth(true); setMobileMenu(false); };
  const saveProfile = async () => { setSavingProfile(true); const {error}=await supabase.auth.updateUser({data:profile}); setSavingProfile(false); notify(error ? error.message : 'Profile saved.'); };
  const signOut = async () => { const {error}=await supabase.auth.signOut(); if(error) notify(error.message); };
  const startRequest = (person) => { setSelected(person); setRequestSent(false); setShowRequest(true); };
  const startJoin = (category = '', service = '') => { setJoinData(p=>({...p,category:category||p.category,subcategory:service||p.subcategory})); setJoinStep(1); setShowCategories(false); setShowJoin(true); };
  const openCategoryBrowser = (group = '') => { setCategoryGroup(group); setCategorySearch(''); setShowCategories(true); };

  if (window.location.pathname.replace(/\/$/, '') === '/admin') return <AdminPortal />;
  if (!authReady) return <div className="app-loading">Loading Bidx ProLink…</div>;
  if (!session) return <div className="auth-entry"><AuthModal onClose={()=>{}} /></div>;
  return <div className="app-shell">
    <header className="topbar prolink-mobile-topbar">
      <div className="topbar-inner">
        {(tab!=='Explore'||selected) && <button className="icon-button" onClick={back} aria-label="Go back"><ArrowLeft size={22}/></button>}
        <button className="brand-button" onClick={() => {navigateTab('Explore');setSelected(null);}}><Brand /></button>
        <span className="topbar-spacer"/>
        <button className="icon-button" onClick={() => menuOpen ? back() : openDrawer()} aria-label="Open menu"><Menu size={24}/></button>
      </div>
    </header>
        {menuOpen && <div className="menu-scrim" onClick={back}><aside className="app-menu prolink-drawer" onClick={e=>e.stopPropagation()}><div className="drawer-brand"><Brand/><button className="drawer-close" onClick={back} aria-label="Close menu"><X/></button></div>
<div className="drawer-section"><strong className="drawer-section-heading">DISCOVER</strong><button onClick={()=>navigateTab('Explore')}>Explore Professionals</button><button onClick={()=>{setMenuOpen(false);openCategoryBrowser()}}>Browse Categories</button></div>
<div className="drawer-section"><strong className="drawer-section-heading">PROFESSIONAL SERVICES</strong><button onClick={()=>navigateTab('Profile')}>My Professional Profile</button><button onClick={()=>navigateTab('My Work Portfolio')}>My Work Portfolio</button><button onClick={()=>{setMenuOpen(false);openCategoryBrowser()}}>Become a Professional</button></div>
<div className="drawer-section"><strong className="drawer-section-heading">MY ACTIVITIES</strong><button onClick={()=>navigateTab('Requests')}>My Service Requests</button><button onClick={()=>navigateTab('Saved Professionals')}>Saved Professionals</button></div>
<div className="drawer-section"><strong className="drawer-section-heading">ACCOUNT &amp; SETTINGS</strong><button onClick={()=>navigateTab('Personal information')}>Personal Information</button><button onClick={()=>navigateTab('Password & security')}>Password &amp; Security</button><button onClick={()=>navigateTab('Privacy settings')}>Privacy Settings</button><button onClick={()=>navigateTab('Delete account')}>Delete My Account</button></div>
<div className="drawer-section"><strong className="drawer-section-heading">HELP &amp; INFORMATION</strong><button onClick={()=>navigateTab('Help and support')}>Help Centre</button><button onClick={()=>navigateTab('Contact')}>Contact &amp; Support</button><button onClick={()=>navigateTab('Terms and Conditions')}>Terms &amp; Conditions</button><button onClick={()=>navigateTab('Privacy Policy')}>Privacy Policy</button></div>
<div className="drawer-section"><strong className="drawer-section-heading">MORE</strong><button onClick={()=>navigateTab('App Version')}>App Version</button><button onClick={()=>{navigator.share?.({title:'Bidx ProLink',url:window.location.origin}).catch(()=>{})}}>Share Bidx ProLink</button></div></aside></div>}}

    {selected ? <main className="content-wrap detail-wrap">
      <button className="back-link" onClick={() => setSelected(null)}><ArrowLeft size={17}/> Back to professionals</button>
      <section className="profile-layout">
        <div className="profile-main">
          <div className="profile-hero-card">
            <div className="profile-top"><Avatar person={selected} large/><div className="profile-heading"><div className="name-line"><h1>{selected.name}</h1>{selected.verified && <span className="verified-pill"><BadgeCheck size={14}/> Verified</span>}</div><p>{selected.trade}</p><div className="meta-row"><span><MapPin size={15}/>{selected.city}</span><span>{selected.rating==='New'?'New profile':<><Star size={15} fill="currentColor"/>{selected.rating} ({selected.reviews} reviews)</>}</span></div></div><button className={saved.includes(selected.id) ? 'save-button saved' : 'save-button'} onClick={() => toggleSave(selected.id)}><Heart size={18} fill={saved.includes(selected.id) ? 'currentColor' : 'none'}/></button></div>
            <div className="profile-stats"><div><b>{selected.jobs||'—'}</b><span>Completed jobs</span></div><div><b>{selected.years}</b><span>Experience</span></div><div><b>{selected.verified?'Approved':'Pending'}</b><span>Prolink review</span></div></div>
          </div>
          <section className="panel"><h2>About this professional</h2><p className="body-copy">{selected.about}</p><h3>Skills & services</h3><div className="skill-tags">{selected.skills.map(s=><span key={s}>{s}</span>)}</div></section>
          <section className="panel"><div className="section-heading"><div><h2>Work gallery</h2><p>Photos shared by this professional</p></div><span className="muted-small">{selectedGallery.length} photos</span></div>{galleryLoading?<p>Loading portfolio photos…</p>:selectedGallery.length?<div className="gallery-grid">{selectedGallery.map(item=><a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="gallery-photo-link"><img src={item.url} alt={item.caption||'Professional completed work'} loading="lazy"/>{item.caption&&<span>{item.caption}</span>}</a>)}</div>:<p className="body-copy">This professional has not added work photos yet.</p>}</section>
          <section className="panel"><h2>Qualifications & verification</h2><div className="verification-list"><div><ShieldCheck/><span><b>Personal details &amp; working ID</b><small>Manually reviewed by the Prolink Admin team.</small></span><em className={selected.verified ? 'status-ok' : 'status-pending'}>{selected.verified ? 'Verified' : 'Not verified'}</em></div><div><Award/><span><b>Certificates & qualifications</b><small>Professional credentials can be reviewed on the profile.</small></span><em className="status-ok">Reviewed</em></div></div></section>
        </div>
        <aside className="profile-sidebar"><div className="contact-card"><span className="eyebrow">START A CONVERSATION</span><h2>Need help with a job?</h2><p>Contact {selected.name.split(' ')[0]} to discuss your project and agree on the next step.</p><div className="price-label">Indicative starting price</div><strong className="price">{selected.price}</strong><button className="primary-button full" onClick={() => startRequest(selected)}><MessageCircle size={17}/> Request a service</button>{selected.phone?<a className="outline-button full" href={`tel:${selected.phone.replace(/[^+0-9]/g,'')}`}><Phone size={17}/> Call professional</a>:<button className="outline-button full" onClick={()=>notify('This professional has not added a phone contact yet.')}><Phone size={17}/> Phone not provided</button>}{selected.whatsapp&&<button className="outline-button full" onClick={()=>{const number=selected.whatsapp.replace(/\D/g,'');if(number)window.open('https://wa.me/'+number,'_blank','noopener,noreferrer');else notify('WhatsApp number is not valid.');}}><MessageCircle size={17}/> WhatsApp</button>}<small className="safe-note"><ShieldCheck size={14}/> Keep your agreement clear before work begins.</small></div><div className="help-card"><ShieldCheck/><b>Book with confidence</b><p>Check profile details, discuss the scope and agree on price and timing before work starts.</p></div></aside>
      </section>
    </main> : (tab === 'Profile' || tab === 'Personal information') ? <main className="content-wrap info-page"><h1>Personal information</h1><p>{session.user.email}</p><button className="primary-button" onClick={()=>openCategoryBrowser()}>Register as a professional <ChevronRight size={15}/></button><section className="panel"><div className="form-grid"><label>Full legal name<input value={profile.full_name} onChange={e=>setProfile(p=>({...p,full_name:e.target.value}))}/></label><label>Email<input value={session.user.email||''} readOnly/></label><label>Date of birth<input type="date" value={profile.date_of_birth} onChange={e=>setProfile(p=>({...p,date_of_birth:e.target.value}))}/></label><label>Phone<input value={profile.phone} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))}/></label><label>WhatsApp<input value={profile.whatsapp} onChange={e=>setProfile(p=>({...p,whatsapp:e.target.value}))}/></label><label>Country<input value={profile.country_name||''} readOnly/></label><label>Region / State<input value={profile.region||''} onChange={e=>setProfile(p=>({...p,region:e.target.value}))}/></label><label>District / County<input value={profile.district||''} onChange={e=>setProfile(p=>({...p,district:e.target.value}))}/></label><label>City / Town<input value={profile.city||''} onChange={e=>setProfile(p=>({...p,city:e.target.value}))}/></label><label>Local area<input value={profile.local_area||''} onChange={e=>setProfile(p=>({...p,local_area:e.target.value}))}/></label><label>Postal / ZIP code<input value={profile.postal_code||''} onChange={e=>setProfile(p=>({...p,postal_code:e.target.value}))}/></label><label>Address<input value={profile.address} onChange={e=>setProfile(p=>({...p,address:e.target.value}))}/></label><label>Profession<input value={profile.profession} onChange={e=>setProfile(p=>({...p,profession:e.target.value}))}/></label><label>About you<textarea value={profile.bio} onChange={e=>setProfile(p=>({...p,bio:e.target.value}))}/></label></div><button className="primary-button" onClick={saveProfile} disabled={savingProfile}>{savingProfile?'Saving…':'Save profile'}</button><button className="outline-button" onClick={signOut}>Sign out</button></section></main> : tab === 'Settings' ? <main className="content-wrap info-page settings-page"><span className="eyebrow">ACCOUNT</span><h1>Settings</h1><p>Account actions and less frequently used controls.</p><section className="danger-zone"><h2>Delete my account</h2><p>Request permanent deletion of your Bidx ProLink account and associated personal data. We will verify account ownership before processing it.</p><button className="danger-button" onClick={()=>navigateTab('Delete account')}>Open account deletion</button><p><a href="/account-deletion.html" target="_blank" rel="noreferrer">External account deletion page</a></p></section></main> : tab === 'Delete account' ? <main className="content-wrap info-page"><h1>Delete account</h1><p>Request permanent deletion of your Bidx ProLink account and associated data, even if you no longer wish to use the app.</p><section className="panel deletion-form"><label className="form-label">Account email<input type="email" value={deleteRequestEmail||session.user.email||''} onChange={e=>setDeleteRequestEmail(e.target.value)}/></label><label className="form-label">Reason (optional)<textarea rows="3" value={deleteReason} onChange={e=>setDeleteReason(e.target.value)}/></label><label className="auth-terms-check"><input type="checkbox" checked={deleteConfirmed} onChange={e=>setDeleteConfirmed(e.target.checked)}/><span>I request permanent deletion of my account and associated data. I understand limited records may be retained where required by law or for security, fraud prevention or legal claims.</span></label><button className="danger-button" onClick={()=>{if(!deleteConfirmed||!(deleteRequestEmail||session.user.email)){notify('Enter your account email and confirm the request.');return;}const body='Please delete my Bidx ProLink account and associated personal data. Account email: '+(deleteRequestEmail||session.user.email)+'. Reason: '+deleteReason+'. I confirm this request.';window.location.href='mailto:Support@bidxpro.online?subject='+encodeURIComponent('Bidx ProLink account deletion request')+'&body='+encodeURIComponent(body);}}>Email deletion request</button></section></main>: tab === 'Messages' ? <main className="content-wrap info-page"><h1>Messages</h1><p>Your conversations with professionals will appear here.</p></main> : tab === 'Requests' ? <main className="content-wrap info-page"><h1>My requests</h1><p>Your service requests will appear here.</p></main> : tab === 'Contact' ? <main className="content-wrap info-page"><h1>Contact and support</h1><p>Support: <a href="mailto:Support@bidxpro.online">Support@bidxpro.online</a></p><p>General: <a href="mailto:Info@bidxpro.online">Info@bidxpro.online</a></p></main> : tab === 'Terms and Conditions' || tab === 'Privacy Policy' ? <main className="content-wrap info-page legal-page"><h1>{tab}</h1>{tab === 'Terms and Conditions' ? <TermsContent/> : <PrivacyContent/>}</main> : tab === 'Personal information' ? <main className="content-wrap info-page"><h1>Personal information</h1><p>Update your personal and contact details.</p><button className="primary-button" onClick={()=>navigateTab('Profile')}>Open profile details</button></main> : tab === 'Password & security' ? <main className="content-wrap info-page"><h1>Password &amp; security</h1><p>Use the password recovery process to securely change a forgotten password. Keep your login details private.</p><button className="primary-button" onClick={()=>setPasswordRequestOpen(true)}>Request password reset by email</button></main> : tab === 'Privacy settings' ? <main className="content-wrap info-page"><h1>Privacy settings</h1><p>You may request access, correction or deletion of your personal information by contacting support.</p><a href="mailto:Support@bidxpro.online?subject=Privacy%20request">Contact privacy support</a></main> : tab === 'Help and support' ? <main className="content-wrap info-page"><h1>Help and support</h1><p><a href="mailto:Support@bidxpro.online">Support@bidxpro.online</a></p><p><a href="mailto:Info@bidxpro.online">Info@bidxpro.online</a></p></main> : tab === 'Saved Professionals' ? <main className="content-wrap info-page"><h1>Saved Professionals</h1><p>Your saved professionals are shown below.</p>{professionals.filter(p=>saved.includes(p.id)).map(p=><button key={p.id} className="outline-button" onClick={()=>setSelected(p)}>{p.name} — {p.trade}</button>)}{saved.length===0&&<p>No saved professionals yet.</p>}</main> : tab === 'About Bidx ProLink' ? <main className="content-wrap info-page"><h1>About Bidx ProLink</h1><p>A professional services discovery platform operated by BIDX PRIME TRADE ZONE LTD.</p></main> : tab === 'App Version' ? <main className="content-wrap info-page"><h1>App Version</h1><p>Bidx ProLink</p></main> : tab === 'My Work Portfolio' ? <main className="content-wrap info-page"><span className="eyebrow">YOUR PROFESSIONAL SHOWCASE</span><h1>My Work Portfolio</h1><p>Upload real photographs of completed jobs, installations and recent work. Your gallery is displayed on your public professional profile after your profile is approved.</p><section className="panel"><label className="form-label">Choose a work photo *<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>setGalleryFile(e.target.files?.[0]||null)}/><small>JPEG, PNG or WebP · Maximum 8 MB per image</small></label>{galleryPreview&&<img src={galleryPreview} alt="Preview of selected portfolio work" style={{display:'block',width:'100%',maxHeight:260,objectFit:'contain',borderRadius:10,background:'#f3f6f3',margin:'8px 0'}}/>}<label className="form-label">Photo caption (optional)<input value={galleryCaption} onChange={e=>setGalleryCaption(e.target.value)} maxLength={140} placeholder="Describe the work shown"/></label><button className="primary-button" disabled={gallerySaving||!galleryFile} onClick={async()=>{if(!galleryFile)return;if(!['image/jpeg','image/png','image/webp'].includes(galleryFile.type)||galleryFile.size>8388608){notify('Choose a JPEG, PNG or WebP image smaller than 8 MB.');return;}setGallerySaving(true);const path=`${session.user.id}/${crypto.randomUUID()}-${galleryFile.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error:uploadError}=await supabase.storage.from('prolink-work-gallery').upload(path,galleryFile,{upsert:false,contentType:galleryFile.type});if(uploadError){setGallerySaving(false);notify('Photo upload failed: '+uploadError.message);return;}const {data,error}=await supabase.from('prolink_work_gallery').insert({user_id:session.user.id,object_path:path,caption:galleryCaption.trim()}).select('id,user_id,object_path,caption,created_at').single();if(error){await supabase.storage.from('prolink-work-gallery').remove([path]);setGallerySaving(false);notify('Photo record could not be saved: '+error.message);return;}const {data:signedPhoto}=await supabase.storage.from('prolink-work-gallery').createSignedUrl(path,3600);setMyGallery(items=>[{...data,url:signedPhoto?.signedUrl||''},...items]);setGalleryFile(null);setGalleryCaption('');setGallerySaving(false);notify('Your work photo has been added to your portfolio.');}}> {gallerySaving?'Uploading…':'Upload work photo'} <Upload size={16}/></button></section><section className="panel"><div className="section-heading"><div><h2>Your work photos</h2><p>Manage the photographs displayed in your portfolio</p></div><span className="muted-small">{myGallery.length} photos</span></div>{myGallery.length?<div className="prolink-directory-grid">{myGallery.map(item=><article className="prolink-directory-card" key={item.id}><img src={item.url} alt={item.caption||'My completed work'} loading="lazy" style={{width:'100%',aspectRatio:'4/3',objectFit:'cover',borderRadius:10}}/>{item.caption&&<p>{item.caption}</p>}<button className="outline-button full" onClick={async()=>{const {error:deleteError}=await supabase.from('prolink_work_gallery').delete().eq('id',item.id).eq('user_id',session.user.id);if(deleteError){notify('Could not remove this photo: '+deleteError.message);return;}await supabase.storage.from('prolink-work-gallery').remove([item.object_path]);setMyGallery(items=>items.filter(x=>x.id!==item.id));notify('Photo removed from your portfolio.');}}>Remove photo</button></article>)}</div>:<p>You have not uploaded any work photos yet.</p>}</section></main> : ["Featured Professionals","Recently Viewed Professionals","My Services","Manage Availability","My Bookings","My Reviews & Ratings","Transaction History","Notification Settings","Language & Region","Frequently Asked Questions","Report a Problem","Rate the App"].includes(tab) ? <main className="content-wrap info-page"><h1>{tab}</h1><p>Coming Soon — this feature is being developed and is not available yet.</p></main> : tab === 'Plan' ? <main className="content-wrap info-page plan-page"><span className="eyebrow">PROFESSIONAL MEMBERSHIP</span><h1>Plan</h1><section className="plan-card"><h2>Technician Annual Plan</h2><strong>{profile.country_code==='NG'?'₦9,600':'Local subscription pricing pending'} <small>{profile.country_code==='NG'?'/ year':''}</small></strong><p>Keeps your professional profile live and visible for one year after confirmed payment.</p><ul><li>One year of profile visibility</li><li>Renew annually to keep your profile live</li></ul><button className="primary-button" disabled>International payment setup pending</button><small>Prices and recurring-payment availability will be enabled country by country after Flutterwave coverage and settlement are confirmed.</small></section></main> : tab === 'How it works' ? <main className="content-wrap info-page"><div className="eyebrow">SIMPLE. DIRECT. LOCAL.</div><h1>Good work starts with the right connection.</h1><p className="lead">Bidx ProLink helps customers discover skilled professionals and helps technicians present their work to more people.</p><div className="steps-grid">{[['01','Find a professional','Search by trade, skill or location and compare professional profiles.'],['02','Discuss your job','Contact the professional, explain what you need and agree on the scope.'],['03','Confirm the details','Record the agreed work, cost and timeline before work begins.'],['04','Get the work done','Stay in touch and share feedback after the job is complete.']].map(([n,t,d])=><div className="step-card" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></div>)}</div><button className="primary-button" onClick={()=>navigateTab('Explore')}>Explore professionals <ArrowUpRight size={16}/></button></main> : <main className="prolink-home-screen">
      <section className="prolink-search-header">
        <div className="prolink-search-inner">
          <div className="prolink-search-title">What service do you need?</div>
          <div className="prolink-search-row">
            <label className="prolink-search-input"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search for a service..."/></label>
          </div>
          <label className="prolink-area-input"><MapPin size={16}/><input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Enter a city or local area"/></label>
          <button className="prolink-search-button" onClick={()=>notify(query.trim() ? 'Search is ready.' : 'Enter a service to search.')}>Search</button>
        </div>
      </section>
      <section className="prolink-category-section">
        <div className="prolink-category-intro"><h2>Find skilled professionals. Build your profile. Grow your work.</h2><p>Join Pedes Prolink to showcase your skills and connect with customers around the world.</p><button onClick={()=>openCategoryBrowser()}>Register as a professional <ChevronRight size={14}/></button></div>
        <div className="prolink-category-grid">{categories.map((category,index)=><button key={category.name} className={index===7?'prolink-category-card more-category':'prolink-category-card'} onClick={()=>openCategoryBrowser(index===7?'':category.name)}><span>{category.name}</span>{index===7&&<small>View all services</small>}</button>)}</div>
      </section>
      <section className="prolink-category-section">
        <div className="section-heading"><div><h2>Approved professionals</h2><p>Real professionals who have completed Prolink's manual review</p></div><div style={{display:'flex',alignItems:'center',gap:10}}><span className="muted-small">{filtered.length} listed</span><button className="outline-button" disabled={directoryLoading} onClick={loadProfessionals}>{directoryLoading?'Refreshing…':'Refresh'}</button></div></div>
        {directoryLoading?<p>Loading approved professionals…</p>:directoryError?<div className="panel"><p>{directoryError}</p><button className="outline-button" onClick={loadProfessionals}>Try again</button></div>:filtered.length?<><div className="prolink-directory-grid">{filtered.map(person=><article className="prolink-directory-card" key={person.id}><button className="directory-card-main" onClick={()=>setSelected(person)}><Avatar person={person}/><span className="directory-card-copy"><b>{person.name}</b><small>{person.trade}</small><small><MapPin size={13}/>{person.city}</small></span><span className="verified-pill"><BadgeCheck size={13}/> Approved</span></button><div className="skill-tags">{person.skills.slice(0,3).map(skill=><span key={skill}>{skill}</span>)}</div><button className="outline-button full" onClick={()=>setSelected(person)}>View professional profile</button></article>)}</div>{directoryHasMore&&<button className="outline-button full" disabled={directoryLoading} onClick={()=>loadProfessionals(true)} style={{marginTop:16}}>{directoryLoading?'Loading more professionals…':'Load more professionals'}</button>}</>:<div className="panel"><p>{professionals.length?'No approved professionals match your search yet.':'No professionals have completed manual approval yet. New approved professionals will appear here automatically.'}</p></div>}
      </section>
    </main>}

    <footer className="footer"><div className="content-wrap footer-inner"><div><Brand/><p className="footer-copy">Connecting skilled professionals with people who need quality work.</p></div><div className="footer-links"><div><b>Explore</b><button onClick={()=>navigateTab('Explore')}>Find professionals</button><button onClick={()=>navigateTab('How it works')}>How it works</button></div><div><b>Professionals</b><button onClick={()=>openCategoryBrowser()}>Join ProLink</button><button onClick={()=>openAuth()}>Sign in</button></div><div><b>Contact</b><a href="mailto:Support@bidxpro.online">Support@bidxpro.online</a><a href="mailto:Info@bidxpro.online">Info@bidxpro.online</a></div></div><div className="footer-bottom"><span>© 2026 Bidx ProLink</span><span>A product of BIDX PRIME TRADE ZONE LTD</span><span>Payments are arranged directly between customers and professionals.</span></div></div></footer>

    <nav className="mobile-bottom-nav prolink-bottom-nav"><button className={tab==='Explore'?'selected':''} onClick={()=>{navigateTab('Explore');setSelected(null);}}><Home size={21}/><span>Home</span></button><button className={tab==='Messages'?'selected':''} onClick={()=>navigateTab('Messages')}><MessageCircle size={21}/><span>Messages</span></button><button className={tab==='Profile'?'selected':''} onClick={()=>navigateTab('Profile')}><UserRound size={21}/><span>Profile</span></button><button className={tab==='Plan'?'selected':''} onClick={()=>navigateTab('Plan')}><BriefcaseBusiness size={21}/><span>Plan</span></button></nav>

    {passwordRequestOpen&&<div className="modal-backdrop"><div className="modal auth-modal"><h2>Reset password securely</h2><p>We will send a verification link to {session.user.email}. Open it to set and confirm your new password. After resetting, sign in again.</p><button className="primary-button full" disabled={passwordRequestBusy} onClick={async()=>{setPasswordRequestBusy(true);const {error}=await supabase.auth.resetPasswordForEmail(session.user.email,{redirectTo:window.location.origin});setPasswordRequestBusy(false);notify(error?error.message:'Check your registered email for the secure reset link.');if(!error)setPasswordRequestOpen(false);}}>Send reset link</button><button className="outline-button full" onClick={()=>setPasswordRequestOpen(false)}>Cancel</button></div></div>}
    {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} />}

    {showCategories&&<div className="modal-backdrop" onClick={()=>setShowCategories(false)}><section className="modal profession-browser" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowCategories(false)} aria-label="Close"><X/></button><h2>Select your profession</h2><p>Search and choose your service before registration.</p><label className="profession-browser-search"><Search size={17}/><input autoFocus value={categorySearch} onChange={e=>setCategorySearch(e.target.value)} placeholder="Search profession or trade"/></label><select className="profession-group-select" value={categoryGroup} onChange={e=>setCategoryGroup(e.target.value)}><option value="">All professional categories</option>{PROFESSION_GROUPS.map(g=><option key={g.name}>{g.name}</option>)}</select><div className="profession-browser-list">{PROFESSION_GROUPS.filter(g=>!categoryGroup||g.name===categoryGroup).map(group=>{const matches=group.services.filter(service=>!categorySearch||service.toLowerCase().includes(categorySearch.toLowerCase())||group.name.toLowerCase().includes(categorySearch.toLowerCase()));return matches.length?<div className="profession-browser-group" key={group.name}><h3>{group.name}</h3>{matches.map(service=><button key={service} onClick={()=>startJoin(group.name,service)}>{service}<ChevronRight size={14}/></button>)}</div>:null;})}</div><small className="profession-browser-count">{ALL_PROFESSIONS.length} listed professions and specialisations</small></section></div>}
    {showJoin&&<div className="modal-backdrop" onClick={()=>setShowJoin(false)}><div className="modal join-modal prolink-onboard-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowJoin(false)}><X/></button><div className="modal-step">PROFESSIONAL REGISTRATION · STEP {joinStep} OF 2</div><div className="progress-track"><span style={{width:`${joinStep/2*100}%`}}/></div><h2>Build your professional profile</h2><p>Complete your details so customers can understand your services and experience.</p>
      {joinStep===1?<div className="onboard-fields">
        <label className="form-label">Full legal name *<input value={joinData.full_name} onChange={e=>setJoinData(p=>({...p,full_name:e.target.value}))} placeholder="Enter your full legal name"/></label>
        <label className="form-label">Login email<input type="email" value={session?.user?.email||''} readOnly aria-readonly="true"/><small>This is the email address you used to sign in.</small></label>
        <label className="form-label">Phone number *<input type="tel" inputMode="numeric" value={joinData.phone} onChange={e=>setJoinData(p=>({...p,phone:e.target.value.replace(/\D/g,'').slice(0,15)}))} placeholder="08012345678"/></label>
        <label className="form-label">WhatsApp number<input type="tel" inputMode="numeric" value={joinData.whatsapp} onChange={e=>setJoinData(p=>({...p,whatsapp:e.target.value.replace(/\D/g,'').slice(0,15)}))} placeholder="WhatsApp number"/></label>
        <div className="form-label dob-field"><span>Date of birth</span><div className="dob-controls"><input aria-label="Day" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={joinData.dob_day} onChange={e=>setJoinData(p=>({...p,dob_day:e.target.value.replace(/\D/g,'').slice(0,2)}))} placeholder="DD"/><select aria-label="Month" value={joinData.dob_month} onChange={e=>setJoinData(p=>({...p,dob_month:e.target.value}))}><option value="">Month</option>{['January','February','March','April','May','June','July','August','September','October','November','December'].map((m,i)=><option key={m} value={String(i+1).padStart(2,'0')}>{m}</option>)}</select><input aria-label="Year" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={joinData.dob_year} onChange={e=>setJoinData(p=>({...p,dob_year:e.target.value.replace(/\D/g,'').slice(0,4)}))} placeholder="YYYY"/></div><small>Date of birth is collected for your profile only and is not used for automated identity checks.</small></div>
        {!joinData.country_code && <label className="form-label">Country of residence *<select value={joinData.country_code} onChange={e=>{const c=COUNTRY_BY_CODE[e.target.value];setJoinData(p=>({...p,country_code:c?.code||'',country_iso3:c?.iso3||'',country_name:c?.name||'',region:''}));}}><option value="">Select your country</option>{INITIAL_COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select><small>Your country is a permanent part of your registration profile.</small></label>}
        <label className="form-label">{adminAreaLabels.level1} *<input list="prolink-region-options" value={joinData.region} onChange={e=>setJoinData(p=>({...p,region:e.target.value}))} placeholder={adminAreasLoading?'Loading regions…':'Select or type your region'}/><datalist id="prolink-region-options">{adminAreas.level1.map(a=><option key={a.id} value={a.name}/>)}</datalist><small>{adminAreasLoading?'Loading country administrative areas…':'Choose a suggested region or enter it manually.'}</small></label>
        <label className="form-label">{adminAreaLabels.level2}<input list="prolink-district-options" value={joinData.district} onChange={e=>setJoinData(p=>({...p,district:e.target.value}))} placeholder="Enter county, district or equivalent"/><datalist id="prolink-district-options">{adminAreas.level2.map(a=><option key={a.id} value={a.name}/>)}</datalist></label>
        <label className="form-label">{adminAreaLabels.level3} *<input list="prolink-city-options" value={joinData.city} onChange={e=>setJoinData(p=>({...p,city:e.target.value}))} placeholder="Enter your city or town"/><datalist id="prolink-city-options">{adminAreas.level3.map(a=><option key={a.id} value={a.name}/>)}</datalist></label>
        <label className="form-label">{adminAreaLabels.level4} *<input list="prolink-local-options" value={joinData.local_area} onChange={e=>setJoinData(p=>({...p,local_area:e.target.value}))} placeholder="Enter your local area or neighbourhood"/><datalist id="prolink-local-options">{adminAreas.level4.map(a=><option key={a.id} value={a.name}/>)}</datalist></label>
        <label className="form-label">Postal / ZIP code<input value={joinData.postal_code} onChange={e=>setJoinData(p=>({...p,postal_code:e.target.value}))} placeholder="Postal or ZIP code (if applicable)"/></label>
        <label className="form-label wide-field">Residential street address *<input value={joinData.address} onChange={e=>setJoinData(p=>({...p,address:e.target.value}))} placeholder="House number, street and additional address details"/></label>
        <div className="document-required wide-field"><b>Working ID / professional ID card *</b><small>Upload a clear photo or scan of your current work ID, staff ID, professional ID or trade identification card. National identity numbers and government database lookups are not required.</small><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={e=>setWorkingIdFile(e.target.files?.[0]||null)}/>{workingIdFile&&<small>Selected: {workingIdFile.name}</small>}</div>
      </div>:<div className="onboard-fields">
        <label className="form-label">Professional / business name *<input value={joinData.business_name} onChange={e=>setJoinData(p=>({...p,business_name:e.target.value}))} placeholder="Name customers will see"/></label>
        <label className="form-label">Professional category *<select value={joinData.category} onChange={e=>setJoinData(p=>({...p,category:e.target.value,subcategory:''}))}><option value="">Select category</option>{categories.slice(0,7).map(c=><option key={c.name}>{c.name}</option>)}{PROFESSION_GROUPS.slice(7).map(g=><option key={g.name}>{g.name}</option>)}<option>Other</option></select></label>
        <label className="form-label">Specialisation / subcategory *<select value={joinData.subcategory} onChange={e=>setJoinData(p=>({...p,subcategory:e.target.value}))}><option value="">Select service</option>{(PROFESSION_GROUPS.find(c=>c.name===joinData.category)?.services||[]).map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="form-label">Years of experience *<select value={joinData.experience} onChange={e=>setJoinData(p=>({...p,experience:e.target.value}))}><option value="">Select experience</option><option>Less than 1 year</option><option>1–2 years</option><option>3–5 years</option><option>6–10 years</option><option>More than 10 years</option></select></label>
        <label className="form-label wide-field">Skills and services offered *<textarea rows="3" value={joinData.skills} onChange={e=>setJoinData(p=>({...p,skills:e.target.value}))} placeholder="List the services and skills you provide"/></label>
        <label className="form-label wide-field">About your professional work<textarea rows="3" value={joinData.about} onChange={e=>setJoinData(p=>({...p,about:e.target.value}))} placeholder="Describe your experience and work"/></label>
        <div className="document-required wide-field"><b>Competency / trade-test / skills certificate *</b><small>Upload a certificate of competency, trade-test certificate, apprenticeship completion certificate, professional qualification or another relevant document proving your skills. This is reviewed manually by Prolink Admin.</small><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={e=>setCompetencyFile(e.target.files?.[0]||null)}/>{competencyFile&&<small>Selected: {competencyFile.name}</small>}</div>
        <div className="document-required wide-field"><b>Additional skills document (optional)</b><small>Upload another certificate, licence or supporting document if applicable.</small><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={e=>setExtraSkillFile(e.target.files?.[0]||null)}/>{extraSkillFile&&<small>Selected: {extraSkillFile.name}</small>}</div>
        <label className="form-label">Business phone<input type="tel" inputMode="numeric" value={joinData.business_phone||''} onChange={e=>setJoinData(p=>({...p,business_phone:e.target.value.replace(/\D/g,'').slice(0,15)}))} placeholder="Business contact number"/></label>
        <label className="form-label">Business email<input type="email" value={joinData.business_email||''} onChange={e=>setJoinData(p=>({...p,business_email:e.target.value}))} placeholder="Separate business email (optional)"/></label>
        <label className="form-label">Website (optional)<input type="url" value={joinData.website||''} onChange={e=>setJoinData(p=>({...p,website:e.target.value}))} placeholder="https://"/></label>
        <label className="form-label">Business / operating address<input value={joinData.business_address||''} onChange={e=>setJoinData(p=>({...p,business_address:e.target.value}))} placeholder="Where you operate"/></label>

      </div>}
      <div className="modal-actions">{joinStep>1&&<button className="outline-button" onClick={()=>setJoinStep(1)}>Back</button>}<button className="primary-button" disabled={joinSaving} onClick={async()=>{
        if(joinStep===1){
          if(!joinData.full_name.trim()||!joinData.phone.trim()||!joinData.country_code||!joinData.region||!joinData.city.trim()||!joinData.local_area.trim()||!joinData.address.trim()||!workingIdFile||workingIdFile.size>10485760||!['image/jpeg','image/png','image/webp','application/pdf'].includes(workingIdFile.type)){notify('Complete your personal and address details and upload your working or professional ID card.');return;}
          setJoinSaving(true);
          const legalPayload={full_name:joinData.full_name.trim(),phone:joinData.phone,whatsapp:joinData.whatsapp,country_code:joinData.country_code,country_iso3:joinData.country_iso3,country_name:joinData.country_name,region:joinData.region,district:joinData.district,city:joinData.city,local_area:joinData.local_area,postal_code:joinData.postal_code,address:joinData.address,date_of_birth:joinData.dob_year&&joinData.dob_month&&joinData.dob_day?joinData.dob_year+'-'+joinData.dob_month+'-'+joinData.dob_day:null,personal_details_review_status:'pending',working_id_review_status:'pending',manual_review_required:true};
          const {error:profileError}=await supabase.auth.updateUser({data:{...profile,...legalPayload}});
          if(profileError){setJoinSaving(false);notify('Personal details could not be saved: '+profileError.message);return;}
          const idPath=`${session.user.id}/working-id-${crypto.randomUUID()}-${workingIdFile.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
          const {error:uploadError}=await supabase.storage.from('prolink-verification-documents').upload(idPath,workingIdFile,{upsert:false,contentType:workingIdFile.type});
          if(uploadError){setJoinSaving(false);notify('Working ID upload failed: '+uploadError.message);return;}
          const {error:reviewError}=await supabase.from('prolink_review_records').insert({user_id:session.user.id,section:'legal_identity',status:'pending',submitted_data:legalPayload});
          if(reviewError){setJoinSaving(false);notify('Your personal details were saved, but the review record could not be created.');return;}
          const {error:idReviewError}=await supabase.from('prolink_review_records').insert({user_id:session.user.id,section:'supporting_document',status:'pending',document_path:idPath,submitted_data:{document_type:'working_id',document_name:workingIdFile.name,mime_type:workingIdFile.type}});
          setJoinSaving(false);
          if(idReviewError){notify('Your working ID was uploaded, but its review record could not be created. Contact support before resubmitting.');return;}
          setProfile(p=>({...p,...legalPayload}));
          notify('Personal details and working ID submitted for manual review.');
          setJoinStep(2);return;
        }
        if(!joinData.business_name.trim()||!joinData.category||!joinData.subcategory||!joinData.experience||!joinData.skills.trim()||!competencyFile||competencyFile.size>10485760||!['image/jpeg','image/png','image/webp','application/pdf'].includes(competencyFile.type)||(extraSkillFile&&(extraSkillFile.size>10485760||!['image/jpeg','image/png','image/webp','application/pdf'].includes(extraSkillFile.type)))){notify('Complete your professional details and upload a competency or trade-test certificate.');return;}
        setJoinSaving(true);
        const businessPayload={professional_name:joinData.business_name.trim(),category:joinData.category,subcategory:joinData.subcategory,experience:joinData.experience,skills:joinData.skills,about:joinData.about,business_phone:joinData.business_phone||'',business_email:joinData.business_email||'',website:joinData.website||'',business_address:joinData.business_address||'',professional_onboarding_status:'submitted_for_review',business_review_status:'pending',manual_document_review_required:true,professional_documents_pending_review:true};
        const {error}=await supabase.auth.updateUser({data:{...profile,...businessPayload}});
        if(error){setJoinSaving(false);notify('We could not save your professional information. Please try again.');return;}
        const {error:businessReviewError}=await supabase.from('prolink_review_records').insert({user_id:session.user.id,section:'professional_profile',status:'pending',submitted_data:businessPayload});
        if(businessReviewError){setJoinSaving(false);notify('Your profile details were saved, but the review record could not be created. Please retry.');return;}
        const uploadDocument=async(file,type)=>{
          if(!file)return null;
          const path=`${session.user.id}/${type}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
          const {error:uploadError}=await supabase.storage.from('prolink-verification-documents').upload(path,file,{upsert:false,contentType:file.type});
          if(uploadError)throw uploadError;
          const {error:recordError}=await supabase.from('prolink_review_records').insert({user_id:session.user.id,section:'supporting_document',status:'pending',document_path:path,submitted_data:{document_type:type,document_name:file.name,mime_type:file.type}});
          if(recordError)throw recordError;
          return path;
        };
        try{await uploadDocument(competencyFile,'competency_certificate');if(extraSkillFile)await uploadDocument(extraSkillFile,'additional_skill_document');}
        catch(uploadError){setJoinSaving(false);notify('Your profile was saved, but a certificate could not be submitted: '+uploadError.message);return;}
        setJoinSaving(false);
        setProfile(p=>({...p,...businessPayload}));
        setShowJoin(false);setJoinStep(1);setWorkingIdFile(null);setCompetencyFile(null);setExtraSkillFile(null);
        notify('Your professional profile and skill documents have been submitted for manual Admin review.');
      }}>{joinSaving?'Saving…':joinStep===1?'Submit legal details':'Submit professional details'} <ChevronRight size={15}/></button></div>
      <small className="legal-copy">All personal details, working ID cards and skills certificates are reviewed manually by Prolink Admin. No national ID lookup or automated identity verification is used.</small>
    </div></div>}

    {showRequest&&<div className="modal-backdrop" onClick={()=>setShowRequest(false)}><div className="modal request-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowRequest(false)}><X/></button>{requestSent?<div className="success-state"><span><Check/></span><h2>Request prepared</h2><p>Your service request is ready. Sign in will be required to send and track it.</p><button className="primary-button full" onClick={()=>{setShowRequest(false);openAuth();}}>Continue to sign in</button></div>:<><span className="eyebrow">SERVICE REQUEST</span><h2>Tell {selected?.name.split(' ')[0]} what you need</h2><p>Share a few details so the professional can understand your job.</p><label className="form-label">What do you need done?<textarea rows="4" placeholder="Describe the job, location and any important details..."/></label><label className="form-label">Preferred date<input type="date"/></label><label className="form-label">Job location<input placeholder="Enter the job address or area"/></label><button className="primary-button full" onClick={()=>setRequestSent(true)}>Review request <ArrowUpRight size={16}/></button><small className="legal-copy">No payment is collected in Bidx ProLink. Agree on price and terms directly with the professional.</small></>}</div></div>}

    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}

export default App;
