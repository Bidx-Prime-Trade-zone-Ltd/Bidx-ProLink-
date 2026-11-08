import React, { useMemo, useState } from 'react';
import AuthModal from './AuthModal.jsx';
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
  const startRequest = (person) => { setSelected(person); setRequestSent(false); setShowRequest(true); };

  return <div className="app-shell">
    <header className="topbar">
      <div className="topbar-inner">
        <button className="icon-button mobile-only" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open menu"><Menu size={21}/></button>
        <button className="brand-button" onClick={() => {setTab('Explore');setSelected(null);}}><Brand /></button>
        <nav className={`desktop-nav ${mobileMenu ? 'nav-open' : ''}`}>
          {['Explore', 'How it works', 'For professionals'].map(item => <button key={item} className={tab === item ? 'nav-link active' : 'nav-link'} onClick={() => {setTab(item);setSelected(null);setMobileMenu(false); if(item==='For professionals')setShowJoin(true);}}>{item}</button>)}
        </nav>
        <div className="top-actions">
          <button className="icon-button notification-button" aria-label="Notifications" onClick={() => notify('You are all caught up.')}><Bell size={19}/><i/></button>
          <button className="sign-in-button" onClick={() => openAuth()}>Sign in</button>
          <button className="join-button" onClick={() => setShowJoin(true)}>Join as a professional <ArrowUpRight size={16}/></button>
        </div>
      </div>
    </header>

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
    </main> : tab === 'How it works' ? <main className="content-wrap info-page"><div className="eyebrow">SIMPLE. DIRECT. LOCAL.</div><h1>Good work starts with the right connection.</h1><p className="lead">Bidx ProLink helps customers discover skilled professionals and helps technicians present their work to more people.</p><div className="steps-grid">{[['01','Find a professional','Search by trade, skill or location and compare professional profiles.'],['02','Discuss your job','Contact the professional, explain what you need and agree on the scope.'],['03','Confirm the details','Record the agreed work, cost and timeline before work begins.'],['04','Get the work done','Stay in touch and share feedback after the job is complete.']].map(([n,t,d])=><div className="step-card" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></div>)}</div><button className="primary-button" onClick={()=>setTab('Explore')}>Explore professionals <ArrowUpRight size={16}/></button></main> : <main>
      <section className="hero">
        <div className="hero-content">
          <div className="hero-kicker"><Sparkles size={15}/> NIGERIA'S SKILLED PROFESSIONAL NETWORK</div>
          <h1>Find the right hands<br/><em>for every job.</em></h1>
          <p>Discover skilled electricians, plumbers, builders and trusted technicians around you.</p>
          <div className="search-panel">
            <label className="search-field"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="What service do you need?"/></label>
            <span className="search-divider"/>
            <label className="search-field location-field"><MapPin size={19}/><input value={location} onChange={e=>setLocation(e.target.value)} placeholder="City or area"/></label>
            <button className="search-submit" onClick={()=>{setTab('Explore');document.getElementById('professionals')?.scrollIntoView({behavior:'smooth'});}}>Search professionals</button>
          </div>
          <div className="hero-foot"><span><ShieldCheck size={15}/> Profiles with verification information</span><span><MapPin size={15}/> Discover professionals across Nigeria</span></div>
        </div>
        <div className="hero-art"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-person-card"><div className="hero-avatar">SO</div><div><b>Skilled professionals</b><small>Ready to help with your next project</small></div><span className="online-dot"/></div><div className="hero-tool tool-one"><Wrench size={25}/></div><div className="hero-tool tool-two"><Zap size={25}/></div><div className="hero-tool tool-three"><Hammer size={25}/></div><div className="hero-sticker"><Star size={15} fill="currentColor"/> Quality connections</div></div>
      </section>

      <section className="content-wrap category-section"><div className="section-heading"><div><span className="eyebrow">BROWSE BY TRADE</span><h2>What do you need done?</h2></div><button className="text-link" onClick={()=>setActiveCategory('All')}>View all services <ChevronRight size={16}/></button></div><div className="category-grid">{categories.map(({name,icon:Icon,count})=><button className={activeCategory===name ? 'category-card category-active':'category-card'} key={name} onClick={()=>{setActiveCategory(name==='More services'?'All':name);document.getElementById('professionals')?.scrollIntoView({behavior:'smooth'});}}><span className="category-icon"><Icon size={21}/></span><span className="category-name">{name}</span><small>{count}</small></button>)}</div></section>

      <section className="content-wrap professionals-section" id="professionals"><div className="section-heading"><div><span className="eyebrow">MEET THE EXPERTS</span><h2>Professionals near you</h2><p>Browse profiles, skills and completed work.</p></div><button className="filter-button" onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16}/> Filters <ChevronDown size={15}/></button></div>
        {filtersOpen && <div className="filter-panel"><label>Trade<select value={activeCategory} onChange={e=>setActiveCategory(e.target.value)}><option>All</option>{categories.slice(0,7).map(c=><option key={c.name}>{c.name}</option>)}</select></label><label>Location<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Enter city or area"/></label><button className="text-link" onClick={()=>{setActiveCategory('All');setLocation('');setQuery('');}}>Clear filters</button></div>}
        <div className="results-caption"><span>{filtered.length} professionals shown</span><button onClick={()=>notify('Sorting options will be available with live directory data.')}>Recommended <ChevronDown size={14}/></button></div>
        <div className="professional-grid">{filtered.map(person=><article className="professional-card" key={person.id}><div className="card-top"><Avatar person={person}/><button className={saved.includes(person.id)?'save-button saved':'save-button'} onClick={()=>toggleSave(person.id)} aria-label="Save professional"><Heart size={18} fill={saved.includes(person.id)?'currentColor':'none'}/></button></div><div className="person-name-row"><h3>{person.name}</h3>{person.verified&&<BadgeCheck className="verified-icon" size={16}/>}</div><p className="person-trade">{person.trade}</p><div className="person-location"><MapPin size={14}/>{person.city}</div><div className="card-rating"><Star size={14} fill="currentColor"/><b>{person.rating}</b><span>({person.reviews} reviews)</span><i/> <span>{person.jobs} jobs</span></div><div className="card-bottom"><span className="starting-price">{person.price}</span><button className="view-profile" onClick={()=>setSelected(person)}>View profile <ChevronRight size={15}/></button></div></article>)}</div>
        {filtered.length===0&&<div className="empty-state"><Search size={28}/><h3>No matching professionals found</h3><p>Try another trade or location.</p><button className="outline-button" onClick={()=>{setQuery('');setLocation('');setActiveCategory('All');}}>Clear search</button></div>}
        <div className="directory-note"><ShieldCheck size={17}/><span>Profile information and verification badges should be confirmed through Bidx ProLink review before launch.</span></div>
      </section>

      <section className="join-banner content-wrap"><div><span className="eyebrow">ARE YOU A SKILLED PROFESSIONAL?</span><h2>Let your work speak for you.</h2><p>Create a profile, showcase your skills and connect with customers looking for your services.</p></div><button className="light-button" onClick={()=>setShowJoin(true)}>Create your professional profile <ArrowUpRight size={16}/></button></section>
    </main>}

    <footer className="footer"><div className="content-wrap footer-inner"><div><Brand/><p className="footer-copy">Connecting skilled professionals with people who need quality work.</p></div><div className="footer-links"><div><b>Explore</b><button onClick={()=>setTab('Explore')}>Find professionals</button><button onClick={()=>setTab('How it works')}>How it works</button></div><div><b>Professionals</b><button onClick={()=>setShowJoin(true)}>Join ProLink</button><button onClick={()=>openAuth()}>Sign in</button></div><div><b>Contact</b><a href="mailto:Support@bidxpro.online">Support@bidxpro.online</a><a href="mailto:Info@bidxpro.online">Info@bidxpro.online</a></div></div><div className="footer-bottom"><span>© 2026 Bidx ProLink</span><span>A product of BIDX PRIME TRADE ZONE LTD</span><span>Payments are arranged directly between customers and professionals.</span></div></div></footer>

    <nav className="mobile-bottom-nav"><button className={tab==='Explore'?'selected':''} onClick={()=>{setTab('Explore');setSelected(null);}}><Home size={19}/><span>Explore</span></button><button onClick={()=>{document.getElementById('professionals')?.scrollIntoView({behavior:'smooth'});}}><Compass size={19}/><span>Discover</span></button><button onClick={()=>openAuth()}><ClipboardList size={19}/><span>Requests</span></button><button onClick={()=>openAuth()}><UserRound size={19}/><span>Account</span></button></nav>

    {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} />}

    {showJoin&&<div className="modal-backdrop" onClick={()=>setShowJoin(false)}><div className="modal join-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowJoin(false)}><X/></button><div className="modal-step">STEP {joinStep} OF 3</div><div className="progress-track"><span style={{width:`${joinStep/3*100}%`}}/></div><h2>Create your professional profile</h2><p>Introduce your trade and experience to customers across Nigeria.</p>{joinStep===1?<><label className="form-label">Full legal name<input placeholder="Enter your full name"/></label><label className="form-label">Email address<input type="email" placeholder="you@example.com"/></label><label className="form-label">Phone number<input type="tel" placeholder="+234 800 000 0000"/></label><label className="form-label">I am registering as<select><option>Individual professional</option><option>CAC-registered business</option></select></label></>:joinStep===2?<><label className="form-label">Main profession<select><option>Select your trade</option>{categories.slice(0,7).map(c=><option key={c.name}>{c.name}</option>)}</select></label><label className="form-label">Years of experience<select><option>Select experience</option><option>Less than 2 years</option><option>2–5 years</option><option>6–10 years</option><option>More than 10 years</option></select></label><label className="form-label">Skills and services<textarea placeholder="List the services you offer" rows="3"/></label><label className="form-label">Work location<input placeholder="City, state and area"/></label></>:<><div className="upload-box"><Camera/><b>Profile photo</b><span>Add a clear portrait photo</span><button onClick={()=>notify('Photo upload will be connected to secure storage.')}>Choose photo <Upload size={14}/></button></div><div className="upload-box compact-upload"><FileText/><div><b>Certificates and work photos</b><span>Upload qualifications and 1–5 examples of your work.</span></div><button onClick={()=>notify('Document and gallery uploads will be connected to secure storage.')}>Add files <Plus size={14}/></button></div><div className="upload-box compact-upload"><ShieldCheck/><div><b>Identity verification</b><span>NIN verification and CAC documents (for registered businesses) are handled securely during verification.</span></div></div></> }<div className="modal-actions">{joinStep>1&&<button className="outline-button" onClick={()=>setJoinStep(joinStep-1)}>Back</button>}<button className="primary-button" onClick={()=>joinStep<3?setJoinStep(joinStep+1):(setShowJoin(false),openAuth('Create account'),notify('Profile setup will be saved after account and backend connection.'))}>{joinStep===3?'Create account':'Continue'} <ChevronRight size={16}/></button></div><small className="legal-copy">Your information and uploaded documents must be protected and reviewed before a verification badge is displayed.</small></div></div>}

    {showRequest&&<div className="modal-backdrop" onClick={()=>setShowRequest(false)}><div className="modal request-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowRequest(false)}><X/></button>{requestSent?<div className="success-state"><span><Check/></span><h2>Request prepared</h2><p>Your service request is ready. Sign in will be required to send and track it.</p><button className="primary-button full" onClick={()=>{setShowRequest(false);openAuth();}}>Continue to sign in</button></div>:<><span className="eyebrow">SERVICE REQUEST</span><h2>Tell {selected?.name.split(' ')[0]} what you need</h2><p>Share a few details so the professional can understand your job.</p><label className="form-label">What do you need done?<textarea rows="4" placeholder="Describe the job, location and any important details..."/></label><label className="form-label">Preferred date<input type="date"/></label><label className="form-label">Job location<input placeholder="Enter the job address or area"/></label><button className="primary-button full" onClick={()=>setRequestSent(true)}>Review request <ArrowUpRight size={16}/></button><small className="legal-copy">No payment is collected in Bidx ProLink. Agree on price and terms directly with the professional.</small></>}</div></div>}

    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}

export default App;
