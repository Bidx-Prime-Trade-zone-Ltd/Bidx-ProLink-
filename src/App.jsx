import React, { useEffect, useMemo, useRef, useState } from 'react';


const PROFESSIONAL_CREDENTIAL_GUIDANCE = {
  NGA:"Nigeria: Trade Test Certificate (Grade I, II or III), recognised technical-college or apprenticeship certificate, National Skills Qualification (NSQ) or relevant competence certificate.",
  GHA:"Ghana: NVTI Trade Test Certificate, CTVET National Proficiency or National Certificate, or another recognised trade/TVET qualification.",
  KEN:"Kenya: NITA Trade Test Certificate, recognised TVET/CBET qualification or artisan certificate relevant to your trade.",
  UGA:"Uganda: DIT Uganda Vocational Qualification (UVQF), recognised vocational/trade-test award or relevant technical certificate.",
  TZA:"Tanzania: VETA vocational award/National Vocational Award (NVA), trade assessment certificate or relevant technical qualification.",
  RWA:"Rwanda: RTB/TVET occupational qualification, recognised vocational competence certificate or relevant trade certificate.",
  ZAF:"South Africa: QCTO occupational qualification or trade certificate, recognised apprenticeship completion or relevant professional certificate.",
  ZMB:"Zambia: TEVETA-accredited craft, technician or vocational qualification, trade certificate or competence award.",
  ZWE:"Zimbabwe: HEXCO National Certificate, recognised apprenticeship/trade-test certificate or relevant technical qualification.",
  BWA:"Botswana: BQA-registered vocational qualification, recognised trade-test certificate or relevant technical award.",
  NAM:"Namibia: NTA-accredited vocational qualification, recognised trade-test certificate or relevant technical award.",
  MWI:"Malawi: TEVETA-recognised vocational qualification, trade-test certificate or relevant technical/competence certificate.",
  SLE:"Sierra Leone: recognised NCTVA/TVET vocational award, trade-test certificate or relevant technical qualification.",
  LBR:"Liberia: recognised TVET or apprenticeship completion certificate, trade-test/competence award or relevant technical qualification.",
  GMB:"The Gambia: recognised TVET or apprenticeship certificate, trade-test/competence award or relevant technical qualification.",
  LSO:"Lesotho: recognised vocational/technical qualification, trade-test certificate or apprenticeship completion award.",
  SWZ:"Eswatini: recognised vocational qualification, trade-test certificate or relevant technical/competence award.",
  MUS:"Mauritius: MITD vocational qualification, recognised trade certificate or relevant professional competence award.",
  SYC:"Seychelles: Seychelles Institute of Technology or other recognised TVET qualification, trade certificate or competence award.",
  CMR:"Cameroon: relevant vocational/professional qualification such as DQP or CQP, recognised trade certificate or technical diploma.",
  SSD:"South Sudan: recognised vocational training, apprenticeship completion or trade/competence certificate.",
  GBR:"United Kingdom: relevant NVQ/SVQ, apprenticeship certificate, recognised trade qualification or current industry registration/licence where applicable.",
  IRL:"Ireland: relevant QQI award, SOLAS/apprenticeship qualification, recognised trade certificate or industry registration where applicable.",
  MLT:"Malta: MCAST or other recognised vocational qualification, trade certificate or relevant occupational award.",
  USA:"United States: relevant state/provincial occupational licence where required, apprenticeship completion, recognised trade certificate or industry certification.",
  CAN:"Canada: provincial/territorial Certificate of Qualification, Red Seal endorsement where applicable, apprenticeship completion or relevant trade certification.",
  JAM:"Jamaica: NCTVET NVQ-J/CVQ, recognised HEART/NSTA Trust qualification or relevant trade certificate.",
  TTO:"Trinidad and Tobago: National Training Agency CVQ/NVQ, recognised apprenticeship or relevant trade qualification.",
  BRB:"Barbados: TVET Council NVQ/CVQ, recognised apprenticeship completion or relevant occupational certificate.",
  AUS:"Australia: relevant AQF Certificate III/IV, trade qualification, apprenticeship completion or state/territory licence where required.",
  NZL:"New Zealand: NZQA-recognised qualification, New Zealand Certificate in a relevant trade, apprenticeship completion or occupational registration where required.",
  SGP:"Singapore: relevant WSQ qualification, recognised trade/technical certificate or occupational licence where applicable.",
  PHL:"Philippines: TESDA National Certificate (NC I–IV), Certificate of Competency (COC) or relevant professional licence where required.",
  IND:"India: NCVT/SCVT ITI certificate, NSQF-aligned skill qualification, apprenticeship certificate or relevant professional registration.",
  PAK:"Pakistan: NAVTTC or provincial TEVTA vocational qualification, trade-test certificate or recognised apprenticeship award.",
  BGD:"Bangladesh: BTEB/NSDA-recognised skills qualification, National Skills Certificate or relevant trade certificate.",
  FJI:"Fiji: recognised TVET qualification, Fiji National University trade certificate or relevant occupational competence award.",
  PNG:"Papua New Guinea: National Training Council-recognised TVET qualification, trade-test certificate or apprenticeship award."
};
const getProfessionalCredentialGuidance = iso3 => PROFESSIONAL_CREDENTIAL_GUIDANCE[iso3] || "Upload a recognised qualification or competence certificate issued by an accredited training provider, trade-testing body, professional association, employer apprenticeship programme or relevant authority in your country. If your trade has no formal certificate, provide the strongest available evidence of training and practical competence for manual review.";
import AuthModal from './AuthModal.jsx';
import { TermsContent, PrivacyContent, ProfessionalPolicyContent } from './LegalPages.jsx';
import { PROFESSION_GROUPS, ALL_PROFESSIONS } from './professions.js';
import { INITIAL_COUNTRIES, COUNTRY_BY_CODE } from './globalCountries.js';
import { loadCountryAdministrativeHierarchy } from './lib/countryAdministrativeHierarchy.js';
import { supabase } from './lib/supabase.js';
import AdminPortal from './AdminPortal.jsx';
import SupportChat from './SupportChat.jsx';
import WorkRequestWorkspace from './WorkRequestWorkspace.jsx';
import './admin.css';
import {
  Search, MapPin, SlidersHorizontal, ChevronDown, ChevronRight, ArrowLeft, Image as ImageIcon, Eye, EyeOff,
  Menu, Bell, UserRound, BriefcaseBusiness, ShieldCheck, Star, Phone,
  MessageCircle, CalendarDays, FileText, Plus, Check, X, Camera, Upload,
  Wrench, Zap, Paintbrush, Hammer, Droplets, Snowflake, Car, Scissors,
  Heart, Home, Compass, ClipboardList, Settings, LogOut, BadgeCheck,
  Clock3, Award, Building2, Mail, Lock, ArrowUpRight, Filter, Sparkles
} from 'lucide-react';

// Home-screen shortcuts are intentionally curated for high-frequency services.
// Keep display labels separate from the underlying profession-group names so existing
// category records (for example "Cleaning & Domestic") remain compatible.
const categories = [
  {name:'Electrical & Power',group:'Electrical & Power'},
  {name:'Plumbing & Water',group:'Plumbing & Water'},
  {name:'Driving & Delivery',group:'Driving & Delivery'},
  {name:'Automotive & Transport',group:'Automotive & Transport'},
  {name:'Building & Masonry',group:'Building & Masonry'},
  {name:'Carpentry & Furniture',group:'Carpentry & Furniture'},
  {name:'Cooling & Refrigeration',group:'Cooling & Refrigeration'},
  {name:'Cleaning & Home Care',group:'Cleaning & Domestic'},
  {name:'More categories',more:true}
];

function Brand() {
  return <div className="brand-mark"><img className="brand-symbol brand-logo-image" src="/icon.svg" alt="BK Bidx ProLink"/><span>Bidx <b>ProLink</b><small>SKILLED PEOPLE. QUALITY WORK.</small></span></div>;
}

function Avatar({ person, large = false }) {
  return <div className={`avatar ${person.color} ${large ? 'avatar-large' : ''}`}>{person.initials}</div>;
}

function PasswordInput({ value, onChange, visible, onToggle, autoComplete, placeholder, minLength=8 }) {
  return <div className="password-input-wrap"><input type={visible?'text':'password'} autoComplete={autoComplete} minLength={minLength} required value={value} onChange={onChange} placeholder={placeholder}/><button className="password-visibility" type="button" onClick={onToggle} aria-label={visible?'Hide password':'Show password'} title={visible?'Hide password':'Show password'}>{visible?<EyeOff size={16}/>:<Eye size={16}/>}</button></div>;
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountCountry,setAccountCountry] = useState(null);
  const [accountCountryLoading,setAccountCountryLoading] = useState(false);
  useEffect(()=>{
    if(accountCountry?.preferred_language)document.documentElement.lang=accountCountry.preferred_language;
  },[accountCountry?.preferred_language]);
  const [countryGateChoice,setCountryGateChoice] = useState('');
  const [countryGateError,setCountryGateError] = useState('');
  const [profile, setProfile] = useState({full_name:'',date_of_birth:'',phone:'',whatsapp:'',state:'',lga:'',address:'',profession:'',bio:''});
  const [dobDay,setDobDay]=useState('');
  const [dobMonth,setDobMonth]=useState('');
  const [dobYear,setDobYear]=useState('');
  useEffect(()=>{
    const [year='',month='',day='']=String(profile.date_of_birth||'').split('-');
    if(year&&month&&day){setDobDay(day);setDobMonth(month);setDobYear(year);}
  },[profile.date_of_birth]);
  const [professionals,setProfessionals] = useState([]);
  const [directoryLoading,setDirectoryLoading] = useState(true);
  const [directoryError,setDirectoryError] = useState('');
  const [directoryHasMore,setDirectoryHasMore] = useState(false);
  const [selectedGallery,setSelectedGallery] = useState([]);
  const [galleryLoading,setGalleryLoading] = useState(false);
  const [galleryViewerOpen,setGalleryViewerOpen] = useState(false);
  const [activeGalleryIndex,setActiveGalleryIndex] = useState(0);
  const galleryViewerOpenRef=useRef(false);
  galleryViewerOpenRef.current=galleryViewerOpen;
  const galleryTouchStartX=useRef(null);
  const openGalleryViewer=index=>{
    if(!selectedGallery.length)return;
    setActiveGalleryIndex(Math.max(0,Math.min(index,selectedGallery.length-1)));
    if(!galleryViewerOpenRef.current){
      const url=window.location.pathname+window.location.search+'#portfolio-gallery';
      window.history.pushState({...window.history.state,prolinkGallery:true},'',url);
      try { window.BidxNativeUI?.setCanGoBack?.(true); } catch {}
    }
    setGalleryViewerOpen(true);
  };
  const closeGalleryViewer=()=>{
    if(window.history.state?.prolinkGallery)window.history.back();
    else setGalleryViewerOpen(false);
  };
  const showGalleryPhoto=direction=>setActiveGalleryIndex(index=>(index+direction+selectedGallery.length)%selectedGallery.length);
  useEffect(()=>{
    const onPopState=()=>{if(galleryViewerOpenRef.current)setGalleryViewerOpen(false);};
    const onKeyDown=event=>{
      if(!galleryViewerOpenRef.current)return;
      if(event.key==='Escape'||event.key==='Backspace'){event.preventDefault();closeGalleryViewer();}
      else if(event.key==='ArrowLeft')setActiveGalleryIndex(index=>(index-1+selectedGallery.length)%selectedGallery.length);
      else if(event.key==='ArrowRight')setActiveGalleryIndex(index=>(index+1)%selectedGallery.length);
    };
    window.addEventListener('popstate',onPopState);
    window.addEventListener('keydown',onKeyDown);
    return()=>{window.removeEventListener('popstate',onPopState);window.removeEventListener('keydown',onKeyDown);};
  },[selectedGallery.length]);
  useEffect(()=>{
    if(!galleryViewerOpen)return;
    const body=document.body;
    const previous={overflow:body.style.overflow,touchAction:body.style.touchAction};
    body.style.overflow='hidden';
    body.style.touchAction='none';
    return()=>{body.style.overflow=previous.overflow;body.style.touchAction=previous.touchAction;};
  },[galleryViewerOpen]);

  const [myGallery,setMyGallery] = useState([]);
  const [galleryFiles,setGalleryFiles] = useState([]);
  const [galleryOptionsOpen,setGalleryOptionsOpen] = useState(false);
  const [galleryPreviews,setGalleryPreviews] = useState([]);
  useEffect(()=>{const urls=galleryFiles.map(file=>URL.createObjectURL(file));setGalleryPreviews(urls);return()=>urls.forEach(url=>URL.revokeObjectURL(url));},[galleryFiles]);
  const [galleryCaption,setGalleryCaption] = useState('');
  const [gallerySaving,setGallerySaving] = useState(false);
  const [portraitFile,setPortraitFile] = useState(null);
  const [portraitPreview,setPortraitPreview] = useState('');
  const [portraitUrl,setPortraitUrl] = useState('');
  const [portraitSaving,setPortraitSaving] = useState(false);
  const [portraitOptionsOpen,setPortraitOptionsOpen] = useState(false);
  const [portraitUrls,setPortraitUrls] = useState({});
  useEffect(()=>{if(!portraitFile){setPortraitPreview('');return;}const url=URL.createObjectURL(portraitFile);setPortraitPreview(url);return()=>URL.revokeObjectURL(url);},[portraitFile]);
  const [menuOpen, setMenuOpen] = useState(false);
  // Notify Android when the navigation drawer takes over touch interaction.
  useEffect(() => {
    try { window.BidxNativeUI?.setMenuOpen?.(Boolean(menuOpen)); } catch {}
  }, [menuOpen]);

  useEffect(()=>{
    if(!menuOpen)return;
    const scrollY=window.scrollY;
    const body=document.body;
    const previous={position:body.style.position,top:body.style.top,width:body.style.width,overflow:body.style.overflow};
    body.classList.add('prolink-menu-locked');
    body.style.position='fixed';
    body.style.top=`-${scrollY}px`;
    body.style.width='100%';
    body.style.overflow='hidden';
    return()=>{
      body.classList.remove('prolink-menu-locked');
      body.style.position=previous.position;
      body.style.top=previous.top;
      body.style.width=previous.width;
      body.style.overflow=previous.overflow;
      // Choosing a different destination starts that page at its own top;
      // simply dismissing the drawer restores the exact previous scroll spot.
      window.scrollTo(0,activeTabRef.current!==tab?0:scrollY);
    };
  },[menuOpen]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileLock,setProfileLock] = useState({approvedAt:null,unlockAt:null,locked:false,requests:[]});
  const [membership,setMembership]=useState({loading:false,data:null,error:''});
  useEffect(() => {
    const params=new URLSearchParams(window.location.search);
    const passwordResult=params.get('password_change');
    if(passwordResult){
      window.history.replaceState({},'',window.location.pathname+window.location.hash);
      if(passwordResult==='success'){
        supabase?.auth.signOut().finally(()=>{setSession(null);setAuthReady(true);setAuthMode('Sign in');setShowAuth(true);});
      } else {setPasswordFeedback(passwordResult==='expired'?'That confirmation link has expired. Start the password change again.':passwordResult==='invalid'?'That confirmation link is invalid. Start the password change again.':'We could not complete the password change. Please try again.');setPasswordFeedbackError(true);}
    }
  },[]);
  useEffect(()=>{let active=true;if(!session?.access_token){setProfileLock({approvedAt:null,unlockAt:null,locked:false,requests:[]});return()=>{active=false;};}fetch('/api/profile/change-status',{headers:{authorization:'Bearer '+session.access_token}}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'');if(active)setProfileLock(data);}).catch(()=>{if(active)setProfileLock({approvedAt:null,unlockAt:null,locked:false,requests:[]});});return()=>{active=false;};},[session?.access_token]);
  useEffect(()=>{
    let active=true;
    if(!session?.user?.id){setMembership({loading:false,data:null,error:''});return()=>{active=false;};}
    setMembership({loading:true,data:null,error:''});
    supabase.from('prolink_memberships').select('starts_at,expires_at').eq('user_id',session.user.id).maybeSingle()
      .then(({data,error})=>{
        if(!active)return;
        if(error){setMembership({loading:false,data:null,error:'Membership status is temporarily unavailable.'});return;}
        setMembership({loading:false,data:data||null,error:''});
      }).catch(()=>{if(active)setMembership({loading:false,data:null,error:'Membership status is temporarily unavailable.'});});
    return()=>{active=false;};
  },[session?.user?.id]);
  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setProfile(p=>({...p,...(data.session?.user?.user_metadata||{})})); setAuthReady(true); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event,next) => {
      // Supabase sign-out alone does not clear Android Credential Manager's
      // provider-side Google session. Clear it on every local or remote sign-out
      // so the next Google login does not get stuck in AccountReauth ([16]).
      if (event === 'SIGNED_OUT' && window.BidxNativeGoogle?.postMessage) {
        try {
          window.BidxNativeGoogle.postMessage(JSON.stringify({type:'googleSignOut',id:'signout'}));
        } catch (error) {
          console.warn('[BidxGoogleAuth] Could not request native credential-state cleanup:', error);
        }
      }
      setSession(next);
      setProfile(p=>({...p,...(next?.user?.user_metadata||{})}));
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(()=>{
    let active=true;
    if(!session?.user?.id){setAccountCountry(null);setAccountCountryLoading(false);return()=>{active=false;};}
    setAccountCountry(null);setAccountCountryLoading(true);setCountryGateError('');
    (async()=>{
      let {data,error}=await supabase.from('prolink_account_settings')
        .select('user_id,home_country_code,home_country_iso3,home_country_name,preferred_language')
        .eq('user_id',session.user.id).maybeSingle();
      if(error)throw error;
      if(!data){
        let pending=null;
        try{pending=JSON.parse(localStorage.getItem('prolink-pending-home-country')||'null');}catch{}
        if(pending?.home_country_code&&pending?.home_country_iso3&&pending?.home_country_name){
          const {error:insertError}=await supabase.from('prolink_account_settings').insert({
            user_id:session.user.id,
            home_country_code:pending.home_country_code,
            home_country_iso3:pending.home_country_iso3,
            home_country_name:pending.home_country_name,
            preferred_language:pending.preferred_language||'en'
          });
          if(insertError&&insertError.code!=='23505')throw insertError;
          const refreshed=await supabase.from('prolink_account_settings')
            .select('user_id,home_country_code,home_country_iso3,home_country_name,preferred_language')
            .eq('user_id',session.user.id).maybeSingle();
          if(refreshed.error)throw refreshed.error;
          data=refreshed.data;
        }
      }
      if(!active)return;
      if(data){
        setAccountCountry(data);
        setProfile(p=>({...p,country_code:data.home_country_code,country_iso3:data.home_country_iso3,country_name:data.home_country_name,preferred_language:data.preferred_language}));
        setJoinData(p=>({...p,country_code:data.home_country_code,country_iso3:data.home_country_iso3,country_name:data.home_country_name}));
        localStorage.removeItem('prolink-pending-home-country');
      }
    })().catch(error=>{
      console.error('[ProLinkCountry] Could not load locked home country:',error);
      if(active)setCountryGateError('We could not load your account country. Please retry. Your country cannot be changed from this screen.');
    }).finally(()=>{if(active)setAccountCountryLoading(false);});
    return()=>{active=false;};
  },[session?.user?.id]);
  const saveInitialCountry = async () => {
    const selectedCountry=INITIAL_COUNTRIES.find(country=>country.code===countryGateChoice);
    if(!selectedCountry||!session?.user?.id)return;
    setAccountCountryLoading(true);setCountryGateError('');
    const {error}=await supabase.from('prolink_account_settings').insert({
      user_id:session.user.id,home_country_code:selectedCountry.code,home_country_iso3:selectedCountry.iso3,
      home_country_name:selectedCountry.name,preferred_language:selectedCountry.language||'en'
    });
    if(error){
      if(error.code==='23505'){
        const existing=await supabase.from('prolink_account_settings').select('*').eq('user_id',session.user.id).maybeSingle();
        if(!existing.error&&existing.data){setAccountCountry(existing.data);setAccountCountryLoading(false);return;}
      }
      setCountryGateError(error.message||'Your country could not be saved. Please try again.');
      setAccountCountryLoading(false);return;
    }
    const record={user_id:session.user.id,home_country_code:selectedCountry.code,home_country_iso3:selectedCountry.iso3,home_country_name:selectedCountry.name,preferred_language:selectedCountry.language||'en'};
    setAccountCountry(record);
    setProfile(p=>({...p,country_code:record.home_country_code,country_iso3:record.home_country_iso3,country_name:record.home_country_name,preferred_language:record.preferred_language}));
    setJoinData(p=>({...p,country_code:record.home_country_code,country_iso3:record.home_country_iso3,country_name:record.home_country_name}));
    localStorage.removeItem('prolink-pending-home-country');
    setAccountCountryLoading(false);
  };
  const loadProfessionals = async (append = false) => {
    if(!supabase){setProfessionals([]);setDirectoryHasMore(false);setDirectoryLoading(false);return;}
    setDirectoryLoading(true);
    if(!append)setDirectoryError('');
    const from=append?professionals.length:0;
    const {data,error}=await supabase.from('prolink_professional_profiles')
      .select('user_id,full_name,professional_name,category,subcategory,experience,skills,about,country_code,country_name,region,district,city,local_area,business_phone,whatsapp,is_published,approved_at')
      .eq('is_published',true).eq('country_code',accountCountry?.home_country_code||'').order('approved_at',{ascending:false}).range(from,from+49);
    if(error){
      setDirectoryError('The professional directory is temporarily unavailable. Please try again.');
      if(!append)setProfessionals([]);
    } else {
      const rows=(data||[]).filter(row=>row.is_published===true).map(row=>{
        const name=row.professional_name||row.full_name||'Prolink professional';
        const initials=name.split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase()||'P';
        const city=[row.local_area,row.city,row.district,row.region,row.country_name].filter(Boolean).join(', ');
        return {...row,id:row.user_id,name,city_name:row.city||'',trade:row.subcategory||row.category||'Skilled professional',city:city||row.country_name||'Location not provided',rating:'New',reviews:0,jobs:0,verified:true,price:'Request quote',initials,color:'avatar-green',skills:Array.isArray(row.skills)?row.skills:[],about:row.about||'Contact this professional to learn more about their services.',years:row.experience||'Experience not specified',phone:row.business_phone||'',whatsapp:row.whatsapp||''};
      });
      const {data:portraitRows}=await supabase.from('prolink_profile_media').select('user_id,portrait_path').in('user_id',rows.map(row=>row.id));
      const portraitEntries=await Promise.all((portraitRows||[]).map(async item=>{const {data:signed}=await supabase.storage.from('prolink-profile-portraits').createSignedUrl(item.portrait_path,3600);return [item.user_id,signed?.signedUrl||''];}));
      const publicPortraits=Object.fromEntries(portraitEntries.filter(entry=>entry[1]));
      const viewerCountry=String(accountCountry?.home_country_code||profile.country_code||'').toUpperCase();
      const viewerRegion=String(session?.user?.user_metadata?.region||profile.region||'').toLowerCase();
      const viewerCity=String(session?.user?.user_metadata?.city||profile.city||'').toLowerCase();
      const ranked=rows.map((row,index)=>({row:{...row,portraitUrl:publicPortraits[row.id]||''},index,score:(viewerCountry&&String(row.country_code||'').toUpperCase()===viewerCountry?100:0)+(viewerRegion&&String(row.region||'').toLowerCase()===viewerRegion?25:0)+(viewerCity&&String(row.city||'').toLowerCase()===viewerCity?35:0)})).sort((x,y)=>y.score-x.score||x.index-y.index).map(x=>x.row);
      setProfessionals(previous=>append?[...previous,...ranked]:ranked);
      setDirectoryHasMore((data||[]).length===50);
    }
    setDirectoryLoading(false);
  };
  useEffect(()=>{if(authReady&&accountCountry?.home_country_code)loadProfessionals();},[authReady,session?.user?.id,accountCountry?.home_country_code]);
  useEffect(()=>{let active=true;const ids=professionals.map(p=>p.id).filter(Boolean);if(!ids.length){setPortraitUrls({});return()=>{active=false;};}supabase.from('prolink_profile_media').select('user_id,portrait_path').in('user_id',ids).then(async({data,error})=>{if(!active||error)return;const pairs=await Promise.all((data||[]).map(async row=>{const {data:signed}=await supabase.storage.from('prolink-profile-portraits').createSignedUrl(row.portrait_path,3600);return [row.user_id,signed?.signedUrl||''];}));if(active)setPortraitUrls(Object.fromEntries(pairs.filter(x=>x[1])));});return()=>{active=false;};},[professionals]);
  useEffect(()=>{let active=true;if(!session?.user?.id){setPortraitUrl('');return()=>{active=false;};}supabase.from('prolink_profile_media').select('portrait_path').eq('user_id',session.user.id).maybeSingle().then(async({data})=>{if(!active||!data?.portrait_path)return;const {data:signed}=await supabase.storage.from('prolink-profile-portraits').createSignedUrl(data.portrait_path,3600);if(active)setPortraitUrl(signed?.signedUrl||'');});return()=>{active=false;};},[session?.user?.id]);
  const [tab, setTab] = useState('Explore');
  const activeTabRef=useRef(tab);
  activeTabRef.current=tab;
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [detectedLocation, setDetectedLocation] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const detectMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Location is not supported on this device. Enter your city manually.");
      return;
    }
    setLocationBusy(true);
    setLocationStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const params = new URLSearchParams({
          lat: String(position.coords.latitude),
          lon: String(position.coords.longitude)
        });
        const response = await fetch("/api/location/reverse?" + params.toString());
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "We could not identify your location.");
        setDetectedLocation(result);
        setLocation(result.displayName);
        setLocationStatus("Your current location");
      } catch (error) {
        setLocationStatus(error.message || "Location lookup failed. Enter your city manually.");
      } finally {
        setLocationBusy(false);
      }
    }, error => {
      const message = error.code === 1
        ? "Location permission was denied. Enter your city or allow location access in your browser settings."
        : error.code === 3
          ? "Location request timed out. Try again or enter your city manually."
          : "Your location is unavailable. Enter your city manually.";
      setLocationStatus(message);
      setLocationBusy(false);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  };
  // GPS is opt-in: users can choose “Use my location” or enter an area manually.

  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('Sign in');
  const [showJoin, setShowJoin] = useState(false);
  const [joinStep, setJoinStep] = useState(1);
  const [joinData, setJoinData] = useState(() => { const empty={title:'',full_name:'',email:'',phone:'',whatsapp:'',dob_day:'',dob_month:'',dob_year:'',country_code:'',country_iso3:'',country_name:'',region:'',district:'',city:'',local_area:'',postal_code:'',address:'',category:'',subcategory:'',experience:'',skills:'',business_name:'',about:''}; try{return {...empty,...JSON.parse(localStorage.getItem('prolink-onboarding-draft')||'{}')};}catch{return empty;} });
  const [adminHierarchy,setAdminHierarchy] = useState([]);
  const [adminAreasLoading,setAdminAreasLoading] = useState(false);
  const [profileHierarchy,setProfileHierarchy] = useState([]);
  const [profileAreasLoading,setProfileAreasLoading] = useState(false);
  const [workingIdFile,setWorkingIdFile] = useState(null);
  const [competencyFile,setCompetencyFile] = useState(null);
  const [extraSkillFile,setExtraSkillFile] = useState(null);
  const [joinSaving, setJoinSaving] = useState(false);
  // Discover only country-specific, structurally checked levels; the first unavailable level remains manual.
  const onboardingSelectedNames = [
    joinData.region,joinData.district,joinData.city,joinData.local_area,
    ...(Array.isArray(joinData.administrative_levels)?joinData.administrative_levels.map(item=>item?.value):[])
  ];
  const profileSelectedNames = [
    profile.region,profile.district,profile.city,profile.local_area,
    ...(Array.isArray(profile.administrative_levels)?profile.administrative_levels.map(item=>item?.value):[])
  ];
  useEffect(() => {
    let active=true;
    setAdminHierarchy([]);
    if(!showJoin||!joinData.country_iso3){setAdminAreasLoading(false);return()=>{active=false;};}
    setAdminAreasLoading(true);
    loadCountryAdministrativeHierarchy(joinData.country_iso3,onboardingSelectedNames,5)
      .then(result=>{if(active)setAdminHierarchy(result.levels||[]);})
      .catch(()=>{if(active)setAdminHierarchy([]);})
      .finally(()=>{if(active)setAdminAreasLoading(false);});
    return()=>{active=false;};
  },[joinData.country_iso3,JSON.stringify(onboardingSelectedNames),showJoin]);
  useEffect(() => {
    let active=true;
    const country=COUNTRY_BY_CODE[String(profile.country_code||'').toUpperCase()];
    setProfileHierarchy([]);
    if(!country?.iso3){setProfileAreasLoading(false);return()=>{active=false;};}
    setProfileAreasLoading(true);
    loadCountryAdministrativeHierarchy(country.iso3,profileSelectedNames,5)
      .then(result=>{if(active)setProfileHierarchy(result.levels||[]);})
      .catch(()=>{if(active)setProfileHierarchy([]);})
      .finally(()=>{if(active)setProfileAreasLoading(false);});
    return()=>{active=false;};
  },[profile.country_code,JSON.stringify(profileSelectedNames)]);
  const [showCategories, setShowCategories] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryGroup, setCategoryGroup] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [workRequestDescription,setWorkRequestDescription]=useState('');
  const [workRequestDate,setWorkRequestDate]=useState('');
  const [workRequestLocation,setWorkRequestLocation]=useState('');
  const [workRequestSaving,setWorkRequestSaving]=useState(false);
  const [workRequests,setWorkRequests]=useState([]);
  const [workRequestsLoading,setWorkRequestsLoading]=useState(false);
  const [unreadNotificationCount,setUnreadNotificationCount]=useState(0);

  // Pull-to-refresh is allowed only on the unobstructed Explore landing page.
  // Category selection and professional registration are overlays on the
  // Explore tab, so tab-only detection incorrectly left refresh enabled there.
  const isExploreHome = tab === 'Explore' && !menuOpen && !showCategories &&
    !showJoin && !showAuth && !showRequest && !selected;
  useEffect(() => {
    try { window.BidxNativeUI?.setHomeScreen?.(isExploreHome); } catch {}
  }, [isExploreHome]);
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordRequestOpen,setPasswordRequestOpen] = useState(false);
  const [passwordRequestBusy,setPasswordRequestBusy] = useState(false);
  const [passwordCurrent,setPasswordCurrent] = useState('');
  const [passwordNew,setPasswordNew] = useState('');
  const [passwordConfirm,setPasswordConfirm] = useState('');
  const [passwordFeedback,setPasswordFeedback] = useState('');
  const [passwordFeedbackError,setPasswordFeedbackError] = useState(false);
  const [createPasswordNew,setCreatePasswordNew] = useState('');
  const [createPasswordConfirm,setCreatePasswordConfirm] = useState('');
  const [createPasswordBusy,setCreatePasswordBusy] = useState(false);
  const [createPasswordFeedback,setCreatePasswordFeedback] = useState('');
  const [createPasswordFeedbackError,setCreatePasswordFeedbackError] = useState(false);
  const [showCreatePassword,setShowCreatePassword] = useState(false);
  const [showCreatePasswordConfirm,setShowCreatePasswordConfirm] = useState(false);
  const [showCurrentPassword,setShowCurrentPassword] = useState(false);
  const [showNewPassword,setShowNewPassword] = useState(false);
  const [showPasswordConfirm,setShowPasswordConfirm] = useState(false);
  const [deleteRequestEmail, setDeleteRequestEmail] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  // Keep a ProLink-owned navigation history so browser history entries from
  // outside the app can never force the user back to the Explore screen.
  const [navStack, setNavStack] = useState([{tab:'Explore',menu:false,overlay:null,selected:null,index:0}]);
  const pushView = (view={}) => {
    const current=window.history.state?.prolink
      ? window.history.state
      : {tab,menu:menuOpen,overlay:null,selected:null,index:0};
    // Save the current screen's scroll position before moving forward.
    const currentWithScroll={...current,scrollY:window.scrollY};
    window.history.replaceState(currentWithScroll,'',window.location.href);
    const next={
      prolink:true,
      index:(Number.isInteger(current.index)?current.index:0)+1,
      tab:current.tab||tab,
      menu:Boolean(current.menu),
      overlay:current.overlay||null,
      selected:current.selected||null,
      scrollY:0,
      ...view
    };
    window.history.pushState(next,'',view.overlay?'#'+view.overlay:view.menu?'#menu':'#'+encodeURIComponent((view.tab||tab).toLowerCase().replaceAll(' ','-')));
    try { window.BidxNativeUI?.setCanGoBack?.(true); } catch {}
    setNavStack(prev=>[...prev,next]);
  };
  useEffect(()=>{
    if(!window.history.state?.prolink){
      const initial={prolink:true,index:0,tab:'Explore',menu:false,overlay:null,selected:null};
      window.history.replaceState(initial,'',window.location.pathname+window.location.search+window.location.hash);
    }
    try {
      const state=window.history.state;
      window.BidxNativeUI?.setCanGoBack?.(Boolean(state?.prolinkGallery || (state?.prolink && Number.isInteger(state.index) && state.index>0)));
    } catch {}
    window.BidxHandleBack=()=>{
      const state=window.history.state;
      if(state?.prolinkGallery || (state?.prolink && Number.isInteger(state.index) && state.index>0)){
        window.history.back();
        return true;
      }
      return false;
    };
    return()=>{try{delete window.BidxHandleBack;}catch{}};
  },[]);
  const navigateTab = (next) => {
    if(next===tab&&!menuOpen&&!showCategories&&!showJoin&&!showAuth&&!showRequest&&!selected)return;
    // Disable refresh during every navigation transition. The home-screen
    // effect re-enables it only after all overlays and menus have closed.
    try { window.BidxNativeUI?.setHomeScreen?.(false); } catch {}
    pushView({tab:next,menu:false,overlay:null,selected:null});
    setTab(next);setSelected(null);setMenuOpen(false);setShowCategories(false);setShowJoin(false);setShowAuth(false);setShowRequest(false);
  };
  const openDrawer = () => { if(menuOpen)return;pushView({tab,menu:true,overlay:null,selected:null});setMenuOpen(true); };
  const back = () => {
    const state=window.history.state;
    if(state?.prolink && Number.isInteger(state.index) && state.index>0){
      window.history.back();
      return;
    }
    // At the first app entry, close an active surface without changing the
    // underlying page. Never substitute Explore/Home as a generic fallback.
    if(showRequest)setShowRequest(false);
    else if(showJoin)setShowJoin(false);
    else if(showCategories)setShowCategories(false);
    else if(showAuth)setShowAuth(false);
    else if(menuOpen)setMenuOpen(false);
    else if(selected)setSelected(null);
  };
  useEffect(() => {
    // Do not remove OAuth callback parameters here. Supabase's PKCE client must
    // read the ?code= parameter and exchange it for a session before URL cleanup.
    const onPop=event=>{
      const state=event.state;
      try {
        window.BidxNativeUI?.setCanGoBack?.(Boolean(state?.prolinkGallery || (state?.prolink && Number.isInteger(state.index) && state.index>0)));
      } catch {}
      // Ignore non-ProLink history entries: resetting to Explore here caused
      // unexpected jumps when the browser returned across an app boundary.
      if(!state?.prolink)return;
      setTab(state.tab||'Explore');
      setMenuOpen(Boolean(state.menu));
      setShowCategories(state.overlay==='categories');
      setShowJoin(state.overlay==='join');
      setShowAuth(state.overlay==='auth');
      setShowRequest(state.overlay==='request');
      setSelected(state.selected||null);
      setNavStack(prev=>prev.filter(item=>(item.index??0)<=(state.index??0)));
      try {
        const isHome = (state.tab||'Explore')==='Explore' && !state.menu &&
          !state.overlay && !state.selected;
        window.BidxNativeUI?.setHomeScreen?.(isHome);
      } catch {}
      window.requestAnimationFrame(()=>window.scrollTo(0,Number(state.scrollY)||0));
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
      const gallery=(data||[]).map(item=>({...item,url:'/api/gallery/photo?id='+encodeURIComponent(item.id)}));
      if(active)setSelectedGallery(gallery);
    }).finally(()=>{if(active)setGalleryLoading(false);});
    return()=>{active=false;};
  },[selected?.id]);
  useEffect(()=>{
    let active=true;
    if(tab!=='My Work Portfolio'||!session?.user?.id)return()=>{active=false;};
    supabase.from('prolink_work_gallery').select('id,user_id,object_path,caption,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).then(async ({data,error})=>{
      if(!active||error)return;
      const gallery=await Promise.all((data||[]).map(async item=>{
        try{
          const response=await fetch('/api/gallery/photo?id='+encodeURIComponent(item.id),{headers:{authorization:'Bearer '+session.access_token}});
          if(!response.ok)return null;
          const objectUrl=URL.createObjectURL(await response.blob());
          return {...item,url:objectUrl};
        }catch{return null;}
      }));
      if(active)setMyGallery(gallery.filter(Boolean));
      else gallery.filter(Boolean).forEach(item=>URL.revokeObjectURL(item.url));
    });
    return()=>{active=false;};
  },[tab,session?.user?.id]);
  const filtered = useMemo(() => {
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const detected = detectedLocation || {};
    const typedLocation = normalize(location);
    const targetArea = normalize(detected.localArea || detected.suburb || (typedLocation ? typedLocation.split(' ').slice(0, 3).join(' ') : ''));
    const targetCity = normalize(detected.city);
    const targetDistrict = normalize(detected.district);
    const targetRegion = normalize(detected.region);
    const targetCountry = normalize(detected.country);
    const targetCountryCode = String(detected.countryCode || '').toUpperCase();
    const ranked = professionals.map((professional, index) => {
      const text = `${professional.name} ${professional.trade} ${professional.city} ${professional.skills.join(' ')} ${professional.about}`.toLowerCase();
      const matchesText = text.includes(query.toLowerCase());
      const matchesCategory = activeCategory === 'All' || professional.trade.toLowerCase().includes(activeCategory.toLowerCase()) || professional.skills.join(' ').toLowerCase().includes(activeCategory.toLowerCase()) || (professional.category||'').toLowerCase().includes(activeCategory.toLowerCase());
      const area = normalize(professional.local_area);
      const city = normalize(professional.city_name || professional.city);
      const district = normalize(professional.district);
      const region = normalize(professional.region);
      const country = normalize(professional.country_name);
      const countryCode = String(professional.country_code || '').toUpperCase();
      let proximity = 0;
      if (targetArea && area && (area === targetArea || area.includes(targetArea) || targetArea.includes(area))) proximity = 600;
      else if (targetCity && city && (city === targetCity || city.includes(targetCity) || targetCity.includes(city))) proximity = 500;
      else if (targetDistrict && district && (district === targetDistrict || district.includes(targetDistrict) || targetDistrict.includes(district))) proximity = 400;
      else if (targetRegion && region && (region === targetRegion || region.includes(targetRegion) || targetRegion.includes(region))) proximity = 300;
      else if (targetCountryCode && countryCode === targetCountryCode) proximity = 200;
      else if (targetCountry && country && (country === targetCountry || country.includes(targetCountry) || targetCountry.includes(country))) proximity = 200;
      else if (typedLocation) {
        const locationFields = [professional.local_area, professional.city, professional.district, professional.region, professional.country_name].map(normalize);
        const matchIndex = locationFields.findIndex(value => value && (value === typedLocation || value.includes(typedLocation) || typedLocation.includes(value)));
        proximity = matchIndex < 0 ? 0 : Math.max(100, 550 - matchIndex * 100);
      }
      return { professional, index, proximity, matchesText, matchesCategory };
    });
    return ranked.filter(item => item.matchesText && item.matchesCategory)
      .sort((a, b) => b.proximity - a.proximity || a.index - b.index)
      .map(item => item.professional);
  }, [professionals, query, activeCategory, location, detectedLocation]);

  const administrativeValue = (data, level) => level===1?data.region||'':level===2?data.district||'':level===3?data.city||'':level===4?data.local_area||'':(data.administrative_levels||[]).find(item=>item.level===level)?.value||'';
  const updateAdministrativeValue = (setter, level, value, levelName='') => setter(previous=>{
    const next={...previous};
    const legacyKeys={1:'region',2:'district',3:'city',4:'local_area'};
    const key=legacyKeys[level];
    if(key)next[key]=value;
    if(level<=4){
      const later={1:['district','city','local_area'],2:['city','local_area'],3:['local_area'],4:[]}[level]||[];
      later.forEach(field=>{next[field]='';});
    }
    const extra=(Array.isArray(previous.administrative_levels)?previous.administrative_levels:[])
      .filter(item=>item.level<level);
    if(level>4&&value)extra.push({level,name:levelName||'Administrative level '+level,value});
    next.administrative_levels=extra.sort((a,b)=>a.level-b.level);
    return next;
  });
  const renderAdministrativeFields = (hierarchy, data, setter, prefix) => hierarchy.map(item=>{
    const value=administrativeValue(data,item.level);
    return <label className={prefix==='join'?'form-label':''} key={prefix+'-admin-'+item.level}>{item.name} *
      <select required disabled={prefix==='join'?adminAreasLoading:profileAreasLoading} value={value} onChange={event=>updateAdministrativeValue(setter,item.level,event.target.value,item.name)}>
        <option value="">{'Select '+item.name.toLowerCase()}</option>
        {item.areas.map(area=><option key={String(area.id)} value={area.name}>{area.name}</option>)}
      </select>
    </label>;
  });
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };
  const toggleSave = (id) => setSaved(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const openAuth = (mode = 'Sign in') => { pushView({overlay:'auth',menu:false});setAuthMode(mode);setShowAuth(true);setMenuOpen(false);setMobileMenu(false); };
  const saveProfile = async () => {
    const allowed=['title','full_name','date_of_birth','phone','whatsapp','region','district','city','local_area','administrative_levels','postal_code','address','professional_name','category','subcategory','experience','skills','about','business_phone','business_email','website','business_address'];
    const changes=Object.fromEntries(allowed.filter(key=>profile[key]!==undefined).map(key=>[key,profile[key]]));
    setSavingProfile(true);
    try{
      if(profileLock.approvedAt){
        const response=await fetch('/api/profile/change-request',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({changes})});
        const data=await response.json();if(!response.ok)throw new Error(data.error||'Change request could not be submitted.');
        notify(data.message||'Change request submitted.');
        const statusResponse=await fetch('/api/profile/change-status',{headers:{authorization:'Bearer '+session.access_token}});
        setProfileLock(await statusResponse.json());
      }else{
        const {error}=await supabase.auth.updateUser({data:profile});if(error)throw error;notify('Profile saved.');
      }
    }catch(error){notify(error.message||'Profile could not be saved.');}
    finally{setSavingProfile(false);}
  };
  const signOut = async () => { const {error}=await supabase.auth.signOut(); if(error) notify(error.message); };
  const openProfessional = (person) => { pushView({selected:person,overlay:null,menu:false});setSelected(person);setMenuOpen(false); };
  const startRequest = (person) => { pushView({overlay:'request',selected:person});setSelected(person);setRequestSent(false);setWorkRequestDescription('');setWorkRequestDate('');setWorkRequestLocation('');setShowRequest(true); };
  const refreshWorkRequests = async () => {
    if(!session?.access_token)return;
    setWorkRequestsLoading(true);
    try{const response=await fetch('/api/work-requests',{headers:{authorization:'Bearer '+session.access_token}});const data=await response.json();if(!response.ok)throw new Error(data.error||'Work requests could not be loaded.');setWorkRequests(data.requests||[]);}
    catch(error){notify(error.message||'Work requests could not be loaded.');}
    finally{setWorkRequestsLoading(false);}
  };
  const updateWorkRequest = async (id,status) => {
    try{const response=await fetch('/api/work-requests',{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({id,status})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Work request could not be updated.');await refreshWorkRequests();notify(data.message||'Work request updated.');}
    catch(error){notify(error.message||'Work request could not be updated.');}
  };
  useEffect(()=>{if(tab==='Messages'||tab==='Requests')refreshWorkRequests();},[tab,session?.access_token]);
  const refreshUnreadNotifications=async()=>{
    if(!session?.access_token){setUnreadNotificationCount(0);return;}
    try{
      const response=await fetch('/api/notifications/unread',{headers:{authorization:'Bearer '+session.access_token}});
      if(!response.ok)return;
      const data=await response.json();
      setUnreadNotificationCount(Number(data.total)||0);
    }catch{}
  };
  useEffect(()=>{
    if(!session?.access_token){setUnreadNotificationCount(0);return;}
    refreshUnreadNotifications();
    const timer=setInterval(refreshUnreadNotifications,7000);
    return()=>clearInterval(timer);
  },[session?.access_token]);
  useEffect(()=>{
    if(tab!=='Messages'||!session?.access_token)return;
    fetch('/api/work-requests/read',{method:'POST',headers:{authorization:'Bearer '+session.access_token}})
      .then(()=>Promise.all([refreshWorkRequests(),refreshUnreadNotifications()])).catch(()=>{});
  },[tab,session?.access_token]);
  const startJoin = (category = '', service = '') => { pushView({overlay:'join',menu:false,selected:null});setJoinData(p=>({...p,category:category||p.category,subcategory:service||p.subcategory}));setJoinStep(1);setShowCategories(false);setShowJoin(true); };
  const openCategoryBrowser = (group = '') => { pushView({overlay:'categories',menu:false,selected:null});setCategoryGroup(group);setCategorySearch('');setMenuOpen(false);setShowCategories(true); };

  const publicPath = window.location.pathname.replace(/\/$/, '') || '/';
  if (publicPath === '/terms' || publicPath === '/privacy') {
    const isPrivacyPage = publicPath === '/privacy';
    return <main className="legal-route-page">
      <header className="legal-route-header">
        <a href="/" aria-label="Bidx ProLink home"><Brand /></a>
        <a className="legal-route-back" href="/">Back to sign in</a>
      </header>
      <article className="legal-route-content">
        <span className="eyebrow">BIDX PROLINK · COMPANY & LEGAL</span>
        <h1>{isPrivacyPage ? 'Privacy Policy' : 'Terms of Service'}</h1>
        {isPrivacyPage ? <PrivacyContent /> : <TermsContent />}
        <p className="legal-route-updated">For questions, contact <a href="mailto:Support@bidxpro.online">Support@bidxpro.online</a>.</p>
      </article>
    </main>;
  }

  if (window.location.pathname.replace(/\/$/, '') === '/admin') return <AdminPortal />;
  if (!authReady) return <div className="app-loading">Loading Bidx ProLink…</div>;
  if (!session) return <div className="auth-entry"><AuthModal onClose={()=>{}} /></div>;
  if(accountCountryLoading||!accountCountry){
    return <div className="auth-entry"><div className="modal auth-modal">
      <div className="brand-mark"><span className="brand-symbol">B</span><span>Bidx <b>ProLink</b><small>SKILLED PEOPLE. QUALITY WORK.</small></span></div>
      <h2>{accountCountryLoading?'Preparing your country workspace':'Select your home country'}</h2>
      <p>{accountCountryLoading?'Restoring the country saved to your account…':'Choose your country to finish setting up your ProLink account. This choice will be locked to your account.'}</p>
      {accountCountryLoading?<div className="auth-progress"><span className="auth-progress-track"><i/></span><b>Please wait…</b></div>:<>
        <label className="form-label">Home country *<select value={countryGateChoice} onChange={e=>setCountryGateChoice(e.target.value)}><option value="">Select your country</option>{INITIAL_COUNTRIES.map(country=><option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
        {countryGateError&&<p className="auth-feedback error" role="alert">{countryGateError}</p>}
        <button className="primary-button full" disabled={!countryGateChoice} onClick={saveInitialCountry}>Save my country and continue</button>
      </>}
    </div></div>;
  }
  return <div className="app-shell">
    <header className="topbar prolink-mobile-topbar">
      <div className="topbar-inner">
        {(tab!=='Explore'||selected||showCategories||showJoin||showAuth||showRequest||menuOpen) && <button className="icon-button app-back-button" onClick={back} aria-label="Go back one step"><ArrowLeft size={18}/></button>}
        <button className="brand-button" onClick={() => {navigateTab('Explore');setSelected(null);}}><Brand /></button>
        <span className="topbar-spacer"/>
        <button className="icon-button" onClick={() => menuOpen ? back() : openDrawer()} aria-label="Open menu"><Menu size={24}/></button>
      </div>
    </header>
        {menuOpen && <div className="menu-scrim" onClick={back}><aside className="app-menu prolink-drawer" onClick={e=>e.stopPropagation()}><div className="drawer-brand"><Brand/><button className="drawer-close" onClick={back} aria-label="Close menu"><X/></button></div>
<div className="drawer-section"><strong className="drawer-section-heading">EXPLORE PROFESSIONALS</strong><button onClick={()=>navigateTab('Explore')}><Compass size={19}/><span>Explore Professionals</span><ChevronRight size={17}/></button><button onClick={()=>openCategoryBrowser()}><Search size={19}/><span>Browse Categories</span><ChevronRight size={17}/></button></div>
<div className="drawer-section"><strong className="drawer-section-heading">MY PROFESSIONAL WORKSPACE</strong><button onClick={()=>navigateTab('Professional Profile')}><UserRound size={19}/><span>Professional Profile</span><ChevronRight size={17}/></button><button onClick={()=>navigateTab('My Work Portfolio')}><BriefcaseBusiness size={19}/><span>My Work Portfolio</span><ChevronRight size={17}/></button><button onClick={()=>navigateTab('Plan')}><Award size={19}/><span>Professional Membership</span><ChevronRight size={17}/></button></div>
<div className="drawer-section"><strong className="drawer-section-heading">MY ACTIVITIES</strong><button onClick={()=>navigateTab('Saved Professionals')}><Heart size={19}/><span>Saved Professionals</span><ChevronRight size={17}/></button></div>
<div className="drawer-section"><strong className="drawer-section-heading">ACCOUNT &amp; SECURITY</strong><button onClick={()=>navigateTab('Password & security')}><Lock size={19}/><span>Password &amp; Security</span><ChevronRight size={17}/></button><button onClick={()=>navigateTab('Privacy settings')}><ShieldCheck size={19}/><span>Privacy Settings</span><ChevronRight size={17}/></button><button onClick={()=>navigateTab('Delete account')}><X size={19}/><span>Delete My Account</span><ChevronRight size={17}/></button></div>
<div className="drawer-section"><strong className="drawer-section-heading">HELP &amp; POLICIES</strong><button onClick={()=>navigateTab('Help and support')}><MessageCircle size={19}/><span>Help Centre</span><ChevronRight size={17}/></button><button onClick={()=>navigateTab('Contact')}><Mail size={19}/><span>Contact &amp; Support</span><ChevronRight size={17}/></button><button onClick={()=>navigateTab('Terms and Conditions')}><FileText size={19}/><span>Terms &amp; Conditions</span><ChevronRight size={17}/></button><button onClick={()=>navigateTab('ProLink Policy')}><ShieldCheck size={19}/><span>ProLink Platform Policy</span><ChevronRight size={17}/></button><button onClick={()=>navigateTab('Privacy Policy')}><Lock size={19}/><span>Privacy Policy</span><ChevronRight size={17}/></button></div>
{String(session?.user?.email||'').toLowerCase()==='ojepaamedu@gmail.com'&&<div className="drawer-section admin-drawer-section"><strong className="drawer-section-heading">ADMINISTRATION</strong><button className="admin-menu-entry" onClick={()=>{pushView({tab,menu:false,overlay:null,selected:null});setMenuOpen(false);window.location.href='/admin';}}><Settings size={19}/><span>ProLink Admin</span><em>Restricted</em><ChevronRight size={17}/></button></div>}</aside></div>}

    {selected ? <main className="content-wrap detail-wrap">
      <button className="back-link" onClick={back}><ArrowLeft size={17}/> Back</button>
      <section className="profile-layout">
        <div className="profile-main">
          <div className="profile-hero-card">
            <div className="profile-top">{selected.portraitUrl?<img className="professional-portrait large" src={selected.portraitUrl} alt={`${selected.name} portrait`}/>:<Avatar person={selected} large/>}<div className="profile-heading"><div className="name-line"><h1>{selected.name}</h1>{selected.verified && <span className="verified-pill"><BadgeCheck size={14}/> Verified</span>}</div><p>{selected.trade}</p><div className="meta-row"><span><MapPin size={15}/>{selected.city}</span><span>{selected.rating==='New'?'New profile':<><Star size={15} fill="currentColor"/>{selected.rating} ({selected.reviews} reviews)</>}</span></div></div><button className={saved.includes(selected.id) ? 'save-button saved' : 'save-button'} onClick={() => toggleSave(selected.id)}><Heart size={18} fill={saved.includes(selected.id) ? 'currentColor' : 'none'}/></button></div>
            <div className="profile-stats"><div><b>{selected.jobs||'—'}</b><span>Completed jobs</span></div><div><b>{selected.years}</b><span>Experience</span></div><div><b>{selected.verified?'Approved':'Pending'}</b><span>Prolink review</span></div></div>
          </div>
          <section className="panel"><h2>About this professional</h2><p className="body-copy">{selected.about}</p><h3>Skills & services</h3><div className="skill-tags">{selected.skills.map(s=><span key={s}>{s}</span>)}</div></section>
          <section className="panel"><div className="section-heading"><div><h2>Work gallery</h2><p>Photos shared by this professional</p></div><span className="muted-small">{selectedGallery.length} photos</span></div>{galleryLoading?<p>Loading portfolio photos…</p>:selectedGallery.length?<><div className="gallery-grid public-gallery-grid">{selectedGallery.map((item,index)=><button type="button" key={item.id} className="gallery-photo-link public-gallery-photo" onClick={()=>openGalleryViewer(index)} aria-label={`Open photo ${index+1} of ${selectedGallery.length}`}><img src={item.url} alt={item.caption||'Professional completed work'} loading="lazy"/>{item.caption&&<span>{item.caption}</span>}</button>)}</div><p className="gallery-view-hint">Tap any photo to view the gallery · Swipe to browse</p></>:<p className="body-copy">This professional has not added work photos yet.</p>}</section>
          <section className="panel"><h2>Qualifications & verification</h2><div className="verification-list"><div><ShieldCheck/><span><b>Personal details &amp; working ID</b><small>Manually reviewed by the Prolink Admin team.</small></span><em className={selected.verified ? 'status-ok' : 'status-pending'}>{selected.verified ? 'Verified' : 'Not verified'}</em></div><div><Award/><span><b>Certificates & qualifications</b><small>Professional credentials can be reviewed on the profile.</small></span><em className="status-ok">Reviewed</em></div></div></section>
        </div>
        <aside className="profile-sidebar"><div className="contact-card"><span className="eyebrow">START A CONVERSATION</span><h2>Need help with a job?</h2><p>Contact {selected.name.split(' ')[0]} to discuss your project and agree on the next step.</p><div className="price-label">Indicative starting price</div><strong className="price">{selected.price}</strong><button className="primary-button full" onClick={() => startRequest(selected)}><MessageCircle size={17}/> Request a service</button>{selected.phone?<a className="outline-button full contact-action contact-call" href={`tel:${selected.phone.replace(/[^+0-9]/g,'')}`}><Phone size={23} strokeWidth={3}/> <strong>Call professional</strong></a>:<button className="outline-button full contact-action contact-call" onClick={()=>notify('This professional has not added a phone contact yet.')}><Phone size={23} strokeWidth={3}/> <strong>Phone not provided</strong></button>}{selected.whatsapp&&<button className="outline-button full contact-action contact-whatsapp" onClick={()=>{const number=selected.whatsapp.replace(/\D/g,'');if(number)window.open('https://wa.me/'+number,'_blank','noopener,noreferrer');else notify('WhatsApp number is not valid.');}}><MessageCircle size={23} strokeWidth={3}/> <strong>WhatsApp</strong></button>}<small className="safe-note"><ShieldCheck size={14}/> Keep your agreement clear before work begins.</small></div><div className="help-card"><ShieldCheck/><b>Book with confidence</b><p>Check profile details, discuss the scope and agree on price and timing before work starts.</p></div></aside>
      </section>
    </main> : tab === 'Professional Profile' ? <main className="content-wrap info-page account-page-shell professional-profile-page"><span className="eyebrow">YOUR PROFESSIONAL WORKSPACE</span><h1>Professional Profile</h1><p>Manage the professional information customers see when they discover your services. Your personal account details remain under the Profile tab on the home navigation.</p>{!profile.professional_name&&!profile.category&&!profile.professional_onboarding_status&&<section className="panel"><h2>Become a ProLink professional</h2><p>Complete professional registration before publishing your professional profile.</p><button className="primary-button" onClick={()=>openCategoryBrowser()}>Start professional registration <ChevronRight size={16}/></button></section>}<section className="panel"><h2>Professional identity</h2><div className="form-grid"><label>Professional / business name<input value={profile.professional_name||profile.business_name||''} onChange={e=>setProfile(p=>({...p,professional_name:e.target.value}))} placeholder="Name shown to customers"/></label><label>Profession / category<input value={profile.category||''} onChange={e=>setProfile(p=>({...p,category:e.target.value}))} placeholder="e.g. Electrical services"/></label><label>Speciality / service<input value={profile.subcategory||''} onChange={e=>setProfile(p=>({...p,subcategory:e.target.value}))} placeholder="Your main service"/></label><label>Years of experience<input value={profile.experience||''} onChange={e=>setProfile(p=>({...p,experience:e.target.value}))} placeholder="e.g. 5 years"/></label><label>Skills (comma-separated)<input value={Array.isArray(profile.skills)?profile.skills.join(', '):(profile.skills||'')} onChange={e=>setProfile(p=>({...p,skills:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))} placeholder="List your professional skills"/></label><label>Business phone<input value={profile.business_phone||''} onChange={e=>setProfile(p=>({...p,business_phone:e.target.value}))}/></label><label>Business email<input type="email" value={profile.business_email||''} onChange={e=>setProfile(p=>({...p,business_email:e.target.value}))}/></label><label>Website<input type="url" value={profile.website||''} onChange={e=>setProfile(p=>({...p,website:e.target.value}))} placeholder="https://"/></label><label className="form-label">Business address<input value={profile.business_address||''} onChange={e=>setProfile(p=>({...p,business_address:e.target.value}))}/></label><label className="form-label">Professional introduction<textarea value={profile.about||''} onChange={e=>setProfile(p=>({...p,about:e.target.value}))} rows="5" placeholder="Describe your experience, services and the work you provide."/></label></div><button className="primary-button" onClick={saveProfile} disabled={savingProfile||profileLock.requests?.some(r=>r.status==='pending')}>{savingProfile?'Saving…':profileLock.approvedAt?'Request professional profile changes':'Save professional profile'}</button>{profileLock.approvedAt&&<p className="muted-small">Changes to an approved profile are submitted for Admin review.</p>}</section><section className="panel"><h2>Professional work and membership</h2><p>Keep your portfolio and annual membership together in your professional workspace.</p><div className="button-row"><button className="outline-button" onClick={()=>navigateTab('My Work Portfolio')}>Manage work portfolio</button><button className="outline-button" onClick={()=>navigateTab('Plan')}>Manage membership</button></div></section></main> : (tab === 'Profile' || tab === 'Personal information') ? <main className="content-wrap info-page account-page-shell"><h1>Personal information</h1><p>{session.user.email}</p>{!profileLock.approvedAt&&<button className="primary-button" onClick={()=>openCategoryBrowser()}>Register as a professional <ChevronRight size={15}/></button>}<section className="panel portrait-management"><h2>Profile portrait</h2><p className="body-copy">Add a clear, recent photograph of yourself. This image appears on your public professional listing. You can take a new picture or select one from your gallery, then replace or remove it whenever you wish.</p><div className="portrait-editor portrait-editor-compact">{(portraitPreview||portraitUrl)?<img src={portraitPreview||portraitUrl} alt="Your profile portrait"/>:<div className="portrait-placeholder"><UserRound size={30}/><span>No portrait added</span></div>}</div><div className="portrait-picker-actions"><button type="button" className="portrait-action-trigger" aria-expanded={portraitOptionsOpen} onClick={()=>setPortraitOptionsOpen(open=>!open)}><Camera size={19} strokeWidth={2.8}/><span>Choose / Take Photo</span><ChevronDown size={16} strokeWidth={2.8}/></button>{portraitOptionsOpen&&<div className="portrait-picker-options" role="group" aria-label="Choose how to add your portrait"><label className="portrait-action-icon"><Camera size={23} strokeWidth={2.8}/><span>Take Photo</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="user" hidden onChange={e=>{setPortraitFile(e.target.files?.[0]||null);setPortraitOptionsOpen(false);e.target.value='';}}/></label><label className="portrait-action-icon"><ImageIcon size={23} strokeWidth={2.8}/><span>Choose from Gallery</span><input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{setPortraitFile(e.target.files?.[0]||null);setPortraitOptionsOpen(false);e.target.value='';}}/></label></div>}</div>{portraitFile&&<div className="portrait-selected-name">{portraitFile.name}<button type="button" className="text-button" onClick={()=>setPortraitFile(null)}>Cancel</button></div>}<button className="primary-button portrait-save-button" disabled={!portraitFile||portraitSaving} onClick={async()=>{if(!portraitFile)return;if(!['image/jpeg','image/png','image/webp'].includes(portraitFile.type)||portraitFile.size>5242880){notify('Choose a JPEG, PNG or WebP portrait smaller than 5 MB.');return;}setPortraitSaving(true);const path=session.user.id+'/portrait-'+crypto.randomUUID()+'.'+(portraitFile.type==='image/png'?'png':portraitFile.type==='image/webp'?'webp':'jpg');const {error:up}=await supabase.storage.from('prolink-profile-portraits').upload(path,portraitFile,{upsert:false,contentType:portraitFile.type});if(up){setPortraitSaving(false);notify('Portrait upload failed: '+up.message);return;}const {data:old}=await supabase.from('prolink_profile_media').select('portrait_path').eq('user_id',session.user.id).maybeSingle();const {error:save}=await supabase.from('prolink_profile_media').upsert({user_id:session.user.id,portrait_path:path,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(save){await supabase.storage.from('prolink-profile-portraits').remove([path]);setPortraitSaving(false);notify('Portrait could not be saved: '+save.message);return;}if(old?.portrait_path)await supabase.storage.from('prolink-profile-portraits').remove([old.portrait_path]);const {data:signed}=await supabase.storage.from('prolink-profile-portraits').createSignedUrl(path,3600);setPortraitUrl(signed?.signedUrl||'');setPortraitFile(null);setPortraitSaving(false);notify('Your profile portrait has been updated.');}}>{portraitSaving?'Saving…':portraitUrl?'Save new portrait':'Save portrait'}</button>{portraitUrl&&<button className="outline-button portrait-remove-button" disabled={portraitSaving} onClick={async()=>{if(!window.confirm('Remove your profile portrait? It will no longer appear on your public professional profile.'))return;setPortraitSaving(true);const {data:old}=await supabase.from('prolink_profile_media').select('portrait_path').eq('user_id',session.user.id).maybeSingle();const {error}=await supabase.from('prolink_profile_media').delete().eq('user_id',session.user.id);if(error){setPortraitSaving(false);notify('Portrait could not be removed: '+error.message);return;}if(old?.portrait_path)await supabase.storage.from('prolink-profile-portraits').remove([old.portrait_path]);setPortraitUrl('');setPortraitFile(null);setPortraitSaving(false);notify('Your profile portrait has been removed.');}}>Remove portrait</button>}<small className="legal-copy">JPEG, PNG or WebP · Maximum 5 MB</small></section><section className="panel">{profileLock.approvedAt&&<div className="profile-lock-notice"><b>{profileLock.locked?"Your approved profile is locked":"Profile changes are available"}</b><p>{profileLock.locked?"You can request changes after "+new Date(profileLock.unlockAt).toLocaleDateString()+". Your portrait and work portfolio remain editable at any time.":"Submit your proposed changes below. They will only appear on your approved profile after Admin approval."}</p>{profileLock.requests?.some(r=>r.status==="pending")&&<p>Your change request is awaiting Admin review.</p>}</div>}<fieldset disabled={!!profileLock.approvedAt&&profileLock.locked} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="form-grid"><label>Full legal name<input value={profile.full_name} onChange={e=>setProfile(p=>({...p,full_name:e.target.value}))}/></label><label>Email<input value={session.user.email||''} readOnly/></label><div className="form-label dob-field"><span>Date of birth</span><div className="dob-controls"><input aria-label="Day" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={dobDay} onChange={e=>{const day=e.target.value.replace(/\\D/g,'').slice(0,2);setDobDay(day);if(day.length===2&&dobMonth&&dobYear.length===4)setProfile(p=>({...p,date_of_birth:dobYear+'-'+dobMonth+'-'+day}));}} placeholder="DD"/><select aria-label="Month" value={dobMonth} onChange={e=>{const month=e.target.value;setDobMonth(month);if(dobDay.length===2&&month&&dobYear.length===4)setProfile(p=>({...p,date_of_birth:dobYear+'-'+month+'-'+dobDay}));}}><option value="">Month</option>{['January','February','March','April','May','June','July','August','September','October','November','December'].map((m,i)=><option key={m} value={String(i+1).padStart(2,'0')}>{m}</option>)}</select><input aria-label="Year" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={dobYear} onChange={e=>{const year=e.target.value.replace(/\\D/g,'').slice(0,4);setDobYear(year);if(dobDay.length===2&&dobMonth&&year.length===4)setProfile(p=>({...p,date_of_birth:year+'-'+dobMonth+'-'+dobDay}));}} placeholder="YYYY"/></div></div><label>Phone<input value={profile.phone} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))}/></label><label>WhatsApp<input value={profile.whatsapp} onChange={e=>setProfile(p=>({...p,whatsapp:e.target.value}))}/></label><label>Home country<input value={accountCountry?.home_country_name||profile.country_name||''} readOnly/><small>Your account country is locked. Contact ProLink Admin to apply for a country change.</small></label>{renderAdministrativeFields(profileHierarchy,profile,setProfile,'profile')}{[
{level:1,key:'region',label:'State / province / region',required:false,placeholder:'Enter state, province or region'},
{level:2,key:'district',label:'District / county / local government area',required:false,placeholder:'Enter district, county or local government area'},
{level:3,key:'city',label:'City / town',required:false,placeholder:'Enter city / town'},
{level:4,key:'local_area',label:'Local area / neighbourhood',required:false,placeholder:'Enter local area / neighbourhood'}
].filter(field=>field.level>profileHierarchy.length).map(field=><label key={'profile-manual-'+field.key}>{field.label}<input value={profile[field.key]||''} onChange={e=>setProfile(p=>({...p,[field.key]:e.target.value}))} placeholder={field.placeholder}/></label>)}{profileAreasLoading&&<small>Checking available administrative levels for this country…</small>}<label>Postal / ZIP code<input value={profile.postal_code||''} onChange={e=>setProfile(p=>({...p,postal_code:e.target.value}))}/></label><label>Address<input value={profile.address} onChange={e=>setProfile(p=>({...p,address:e.target.value}))}/></label></div></fieldset>{(!profileLock.approvedAt||!profileLock.locked)&&<button className="primary-button" onClick={saveProfile} disabled={savingProfile||profileLock.requests?.some(r=>r.status==='pending')}>{savingProfile?'Submitting…':profileLock.approvedAt?'Request profile changes':'Save profile'}</button>}<button className="outline-button" onClick={signOut}>Sign out</button></section></main> : tab === 'Settings' ? <main className="content-wrap info-page account-page-shell settings-page"><span className="eyebrow">ACCOUNT</span><h1>Settings</h1><p>Account actions and less frequently used controls.</p><section className="danger-zone"><h2>Delete my account</h2><p>Request permanent deletion of your Bidx ProLink account and associated personal data. We will verify account ownership before processing it.</p><button className="danger-button" onClick={()=>navigateTab('Delete account')}>Open account deletion</button><p><a href="/account-deletion.html" target="_blank" rel="noreferrer">External account deletion page</a></p></section></main> : tab === 'Delete account' ? <main className="content-wrap info-page account-page-shell"><h1>Delete account</h1><p>Request permanent deletion of your Bidx ProLink account and associated data, even if you no longer wish to use the app.</p><section className="panel deletion-form"><label className="form-label">Account email<input type="email" value={deleteRequestEmail||session.user.email||''} onChange={e=>setDeleteRequestEmail(e.target.value)}/></label><label className="form-label">Reason (optional)<textarea rows="3" value={deleteReason} onChange={e=>setDeleteReason(e.target.value)}/></label><label className="auth-terms-check"><input type="checkbox" checked={deleteConfirmed} onChange={e=>setDeleteConfirmed(e.target.checked)}/><span>I request permanent deletion of my account and associated data. I understand limited records may be retained where required by law or for security, fraud prevention or legal claims.</span></label><button className="danger-button" onClick={()=>{if(!deleteConfirmed||!(deleteRequestEmail||session.user.email)){notify('Enter your account email and confirm the request.');return;}const body='Please delete my Bidx ProLink account and associated personal data. Account email: '+(deleteRequestEmail||session.user.email)+'. Reason: '+deleteReason+'. I confirm this request.';window.location.href='mailto:Support@bidxpro.online?subject='+encodeURIComponent('Bidx ProLink account deletion request')+'&body='+encodeURIComponent(body);}}>Email deletion request</button></section></main>: tab === 'Messages' ? <WorkRequestWorkspace session={session} requests={workRequests} loading={workRequestsLoading} onRefresh={refreshWorkRequests} onUpdate={updateWorkRequest} direction="all"/> : tab === 'Requests' ? <WorkRequestWorkspace session={session} requests={workRequests} loading={workRequestsLoading} onRefresh={refreshWorkRequests} onUpdate={updateWorkRequest} direction="outgoing"/> : tab === 'Contact' ? <main className="content-wrap info-page account-page-shell"><h1>Contact and support</h1><p>Support: <a href="mailto:Support@bidxpro.online">Support@bidxpro.online</a></p><p>General: <a href="mailto:Info@bidxpro.online">Info@bidxpro.online</a></p></main> : tab === 'Terms and Conditions' || tab === 'Privacy Policy' || tab === 'ProLink Policy' ? <main className="content-wrap info-page account-page-shell legal-page"><h1>{tab}</h1>{tab === 'Terms and Conditions' ? <TermsContent/> : tab === 'Privacy Policy' ? <PrivacyContent/> : <ProfessionalPolicyContent/>}</main> : tab === 'Personal information' ? <main className="content-wrap info-page account-page-shell"><h1>Personal information</h1><p>Update your personal and contact details.</p><button className="primary-button" onClick={()=>navigateTab('Profile')}>Open profile details</button></main> : tab === 'Password & security' ? <main className="content-wrap info-page account-page-shell"><h1>Password &amp; security</h1><p>Change your password securely. Your current password will remain active until you approve the change using the confirmation email sent to your registered address.</p><section className="panel password-change-panel">
{(session?.user?.app_metadata?.providers||[]).includes('google')&&<div className="password-create-section"><h2>Create a password</h2><p className="muted-small">Your account uses Google sign-in. You can also create a ProLink password to sign in with your email address.</p><form onSubmit={async e=>{e.preventDefault();setCreatePasswordFeedback('');setCreatePasswordFeedbackError(false);if(createPasswordNew.length<8){setCreatePasswordFeedback('Use at least 8 characters.');setCreatePasswordFeedbackError(true);return;}if(createPasswordNew!==createPasswordConfirm){setCreatePasswordFeedback('The passwords do not match.');setCreatePasswordFeedbackError(true);return;}setCreatePasswordBusy(true);try{const {error}=await supabase.auth.updateUser({password:createPasswordNew});if(error)throw error;setCreatePasswordNew('');setCreatePasswordConfirm('');setCreatePasswordFeedback('Password created successfully. You can now sign in with your email and password as well as Google.');}catch(error){setCreatePasswordFeedback(error.message||'Could not create your password. Please try again.');setCreatePasswordFeedbackError(true);}finally{setCreatePasswordBusy(false);}}}><label className="form-label">New password<PasswordInput value={createPasswordNew} onChange={e=>setCreatePasswordNew(e.target.value)} visible={showCreatePassword} onToggle={()=>setShowCreatePassword(v=>!v)} autoComplete="new-password" placeholder="At least 8 characters"/></label><label className="form-label">Confirm password<PasswordInput value={createPasswordConfirm} onChange={e=>setCreatePasswordConfirm(e.target.value)} visible={showCreatePasswordConfirm} onToggle={()=>setShowCreatePasswordConfirm(v=>!v)} autoComplete="new-password" placeholder="Enter the password again"/></label><button className="primary-button" type="submit" disabled={createPasswordBusy}>{createPasswordBusy?'Creating password…':'Create password'}</button>{createPasswordFeedback&&<p className={createPasswordFeedbackError?'auth-feedback error':'auth-feedback success'} role="status">{createPasswordFeedback}</p>}</form></div>}
<div className="password-change-existing"><h2>Change password</h2><p className="muted-small">For accounts that already have a password.</p><form onSubmit={async e=>{e.preventDefault();setPasswordRequestBusy(true);setPasswordFeedback('');setPasswordFeedbackError(false);try{const {data:{session:activeSession}}=await supabase.auth.getSession();const response=await fetch('/api/auth/password-change',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+activeSession.access_token},body:JSON.stringify({currentPassword:passwordCurrent,newPassword:passwordNew,confirmPassword:passwordConfirm})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Password change request failed.');setPasswordFeedback(result.message||'Check your email to confirm the password change.');setPasswordCurrent('');setPasswordNew('');setPasswordConfirm('');}catch(error){setPasswordFeedback(error.message||'Could not request a password change.');setPasswordFeedbackError(true);}finally{setPasswordRequestBusy(false);}}}><label className="form-label">Current password<PasswordInput value={passwordCurrent} onChange={e=>setPasswordCurrent(e.target.value)} visible={showCurrentPassword} onToggle={()=>setShowCurrentPassword(v=>!v)} autoComplete="current-password" placeholder="Enter current password"/></label><label className="form-label">New password<PasswordInput value={passwordNew} onChange={e=>setPasswordNew(e.target.value)} visible={showNewPassword} onToggle={()=>setShowNewPassword(v=>!v)} autoComplete="new-password" placeholder="At least 8 characters"/></label><label className="form-label">Confirm new password<PasswordInput value={passwordConfirm} onChange={e=>setPasswordConfirm(e.target.value)} visible={showPasswordConfirm} onToggle={()=>setShowPasswordConfirm(v=>!v)} autoComplete="new-password" placeholder="Enter your new password again"/></label><button className="primary-button" type="submit" disabled={passwordRequestBusy}>{passwordRequestBusy?'Sending confirmation…':'Confirm password change'}</button>{passwordFeedback&&<p className={passwordFeedbackError?'auth-feedback error':'auth-feedback success'} role="status">{passwordFeedback}</p>}</form><p className="muted-small">A one-time confirmation link will be sent to {session.user.email}. The link expires after 20 minutes. Your password changes only after you approve it by email. Then return here and sign in again with your new password.</p></div></section></main> : tab === 'Privacy settings' ? <main className="content-wrap info-page account-page-shell"><h1>Privacy settings</h1><p>You may request access, correction or deletion of your personal information by contacting support.</p><a href="mailto:Support@bidxpro.online?subject=Privacy%20request">Contact privacy support</a></main> : tab === 'Help and support' ? <main className="content-wrap info-page account-page-shell"><h1>Help and support</h1><p><a href="mailto:Support@bidxpro.online">Support@bidxpro.online</a></p><p><a href="mailto:Info@bidxpro.online">Info@bidxpro.online</a></p></main> : tab === 'Saved Professionals' ? <main className="content-wrap info-page account-page-shell"><h1>Saved Professionals</h1><p>Your saved professionals are shown below.</p>{professionals.filter(p=>saved.includes(p.id)).map(p=><button key={p.id} className="outline-button" onClick={()=>openProfessional(p)}>{p.name} — {p.trade}</button>)}{saved.length===0&&<p>No saved professionals yet.</p>}</main> : tab === 'About Bidx ProLink' ? <main className="content-wrap info-page account-page-shell"><h1>About Bidx ProLink</h1><p>A professional services discovery platform operated by BIDX PRIME TRADE ZONE LTD.</p></main> : tab === 'App Version' ? <main className="content-wrap info-page account-page-shell"><h1>App Version</h1><p>Bidx ProLink</p></main> : tab === 'My Work Portfolio' ? <main className="content-wrap info-page account-page-shell"><span className="eyebrow">YOUR PROFESSIONAL SHOWCASE</span><h1>My Work Portfolio</h1><p>Select up to 15 work photographs together and upload them in one go. You can remove individual photos and add replacements whenever you like.</p><section className="panel"><div className="form-label"><b>Choose work photos *</b><div className="portrait-picker-actions"><button type="button" className="portrait-action-trigger" aria-expanded={galleryOptionsOpen} onClick={()=>setGalleryOptionsOpen(open=>!open)}><ImageIcon size={19} strokeWidth={2.8}/><span>Choose / Take Photos</span><ChevronDown size={16} strokeWidth={2.8}/></button>{galleryOptionsOpen&&<div className="portrait-picker-options" role="group" aria-label="Choose how to add work photos"><label className="portrait-action-icon"><Camera size={23} strokeWidth={2.8}/><span>Take Photo</span><input type="file" accept="image/*" capture="environment" multiple onChange={e=>{const files=Array.from(e.currentTarget.files||[]);const slots=Math.max(0,15-myGallery.length);if(files.length>slots)notify('You can add '+slots+' more photo(s). Your portfolio limit is 15.');const selected=files.slice(0,slots);const invalid=selected.find(file=>!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8388608);if(invalid){notify('Unsupported photo: '+invalid.name+'. Use JPEG, PNG or WebP up to 8 MB.');setGalleryFiles([]);}else{setGalleryFiles(selected);if(selected.length)notify(selected.length+' photo(s) selected. Review them below before uploading.');}setGalleryOptionsOpen(false);e.currentTarget.value='';}}/></div><label className="portrait-action-icon"><ImageIcon size={23} strokeWidth={2.8}/><span>Choose from Gallery</span><input type="file" accept="image/*" multiple onChange={e=>{const files=Array.from(e.currentTarget.files||[]);const slots=Math.max(0,15-myGallery.length);if(files.length>slots)notify('You can add '+slots+' more photo(s). Your portfolio limit is 15.');const selected=files.slice(0,slots);const invalid=selected.find(file=>!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8388608);if(invalid){notify('Unsupported photo: '+invalid.name+'. Use JPEG, PNG or WebP up to 8 MB.');setGalleryFiles([]);}else{setGalleryFiles(selected);if(selected.length)notify(selected.length+' photo(s) selected. Review them below before uploading.');}setGalleryOptionsOpen(false);e.currentTarget.value='';}}/></label></div></div>}</div><small>JPEG, PNG or WebP · Maximum 8 MB per image · Up to 15 photos total · Select multiple photos together</small></div><div className="section-heading"><b>{galleryFiles.length>0?galleryFiles.length+" photo(s) selected":"No photos selected yet"}</b><button type="button" className="text-button" onClick={()=>setGalleryFiles([])} disabled={!galleryFiles.length}>Clear selection</button></div>{galleryFiles.length>0&&<div className="gallery-grid">{galleryFiles.map((file,index)=><article className="gallery-photo-link" key={file.name+'-'+file.lastModified+'-'+index}><img src={galleryPreviews[index]} alt={'Selected work photo '+(index+1)} style={{width:'100%',aspectRatio:'4/3',objectFit:'cover',borderRadius:10}}/><span>{file.name}</span><button type="button" className="text-button" onClick={()=>setGalleryFiles(items=>items.filter((_,i)=>i!==index))}>Remove</button></article>)}</div>}<label className="form-label">Caption for these photos (optional)<input value={galleryCaption} onChange={e=>setGalleryCaption(e.target.value)} maxLength={140} placeholder="Describe the work shown"/></label><button className="primary-button" disabled={gallerySaving||!galleryFiles.length} onClick={async()=>{const files=[...galleryFiles];if(!files.length)return;const slots=15-myGallery.length;if(files.length>slots){notify('Remove some selected photos. You can add only '+slots+' more.');return;}const invalid=files.find(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8388608);if(invalid){notify('Each photo must be JPEG, PNG or WebP and no larger than 8 MB. Check '+invalid.name+'.');return;}setGallerySaving(true);try{const formData=new FormData();files.forEach(file=>formData.append('files',file,file.name));formData.append('caption',galleryCaption.trim());const response=await fetch('/api/gallery/upload',{method:'POST',headers:{authorization:'Bearer '+session.access_token},body:formData});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'The photo upload service is temporarily unavailable.');const savedItems=Array.isArray(result.items)?result.items:[];if(savedItems.length!==files.length)throw new Error('The server did not confirm every photo in this batch. Refresh your portfolio before retrying.');setMyGallery(items=>[...savedItems.map((item,index)=>({...item,url:URL.createObjectURL(files[index])})),...items]);setGalleryFiles([]);setGalleryCaption('');setGallerySaving(false);notify(files.length+' work photo(s) uploaded successfully.');}catch(uploadError){setGallerySaving(false);notify('Photo upload failed: '+(uploadError?.message||'Please check your connection and try again.'));}}}>{gallerySaving?'Uploading '+galleryFiles.length+' photos…':'Upload '+galleryFiles.length+' photo(s)'} <Upload size={16}/></button></section><section className="panel"><div className="section-heading"><div><h2>Your work photos</h2><p>Remove any photo and replace it whenever you need to</p></div><span className="muted-small">{myGallery.length} / 15 photos</span></div>{myGallery.length?<div className="prolink-directory-grid">{myGallery.map(item=><article className="prolink-directory-card" key={item.id}><img src={item.url} alt={item.caption||'My completed work'} loading="lazy" style={{width:'100%',aspectRatio:'4/3',objectFit:'cover',borderRadius:10}}/>{item.caption&&<p>{item.caption}</p>}<button className="outline-button full" onClick={async()=>{try{const response=await fetch('/api/gallery/delete?id='+encodeURIComponent(item.id),{method:'DELETE',headers:{authorization:'Bearer '+session.access_token}});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Could not remove this photo.');if(item.url?.startsWith('blob:'))URL.revokeObjectURL(item.url);setMyGallery(items=>items.filter(x=>x.id!==item.id));notify('Photo removed. You can now add a replacement.');}catch(error){notify(error.message||'Could not remove this photo.');}}}>Remove photo</button></article>)}</div>:<p>You have not uploaded any work photos yet.</p>}</section></main> : ["Featured Professionals","Recently Viewed Professionals","My Services","Manage Availability","My Bookings","My Reviews & Ratings","Transaction History","Notification Settings","Language & Region","Frequently Asked Questions","Report a Problem","Rate the App"].includes(tab) ? <main className="content-wrap info-page account-page-shell"><h1>{tab}</h1><p>Coming Soon — this feature is being developed and is not available yet.</p></main> : tab === 'Plan' ? <main className="content-wrap info-page account-page-shell plan-page"><span className="eyebrow">YOUR PROFESSIONAL ACCOUNT</span><h1>Professional Membership</h1><p className="lead">Manage your ProLink membership, check your status and renew your professional profile for another 12 months.</p><section className="plan-card membership-status-card"><div className="membership-status-heading"><h2>Membership status</h2>{membership.loading?<span className="membership-status-pill is-loading">Checking…</span>:membership.error?<span className="membership-status-pill is-unavailable">Unavailable</span>:membership.data?.expires_at&&new Date(membership.data.expires_at).getTime()>Date.now()?<span className="membership-status-pill is-active">Active</span>:membership.data?<span className="membership-status-pill is-expired">Expired</span>:<span className="membership-status-pill is-inactive">Not subscribed</span>}</div>{membership.loading?<p>Checking your membership details…</p>:membership.error?<p>{membership.error} Please refresh this page to try again.</p>:membership.data?.expires_at?<><p>{new Date(membership.data.expires_at).getTime()>Date.now()?'Your professional membership is active.':'Your professional membership has expired. Renew to restore your membership period.'}</p><div className="membership-dates"><div><small>Membership started</small><strong>{membership.data.starts_at?new Date(membership.data.starts_at).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}):'—'}</strong></div><div><small>{new Date(membership.data.expires_at).getTime()>Date.now()?'Expires on':'Expired on'}</small><strong>{new Date(membership.data.expires_at).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'})}</strong></div></div></>:<p>You do not have an active membership yet. Subscribe to activate your professional profile for 12 months after your payment is verified.</p>}</section><section className="plan-card"><span className="eyebrow">GLOBAL PROFESSIONAL MEMBERSHIP</span><h2>Professional Annual Membership</h2><strong>US$5.00 <small>/ year</small></strong><p>One simple global price. Keeps your professional profile live and visible for 12 months after your payment is verified.</p><ul><li>12 months of professional profile visibility</li><li>One global subscription price in US dollars</li><li>Manual renewal once every year</li><li>No automatic or recurring deductions</li></ul><button className="primary-button full" disabled={membership.loading||Boolean(membership.error)} onClick={async()=>{try{if(!session?.access_token){notify("Sign in to subscribe.");return;}const response=await fetch("/api/subscription/checkout",{method:"POST",headers:{authorization:"Bearer "+session.access_token,"content-type":"application/json"},body:JSON.stringify({})});const result=await response.json();if(!response.ok||!result.checkoutUrl)throw new Error(result.error||"Could not start secure payment.");window.location.assign(result.checkoutUrl);}catch(error){notify(error.message||"Payment could not be started. Please try again.");}}}>{membership.data?.expires_at?'Renew membership':'Subscribe for US$5.00'}</button><small>One-time annual card payment through secure checkout. No automatic or recurring deductions. A successful renewal extends your existing membership; your new 12-month period is confirmed after payment verification.</small></section></main> : tab === 'How it works' ? <main className="content-wrap info-page account-page-shell"><div className="eyebrow">SIMPLE. DIRECT. LOCAL.</div><h1>Good work starts with the right connection.</h1><p className="lead">Bidx ProLink helps customers discover skilled professionals and helps technicians present their work to more people.</p><div className="steps-grid">{[['01','Find a professional','Search by trade, skill or location and compare professional profiles.'],['02','Discuss your job','Contact the professional, explain what you need and agree on the scope.'],['03','Confirm the details','Record the agreed work, cost and timeline before work begins.'],['04','Get the work done','Stay in touch and share feedback after the job is complete.']].map(([n,t,d])=><div className="step-card" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></div>)}</div><button className="primary-button" onClick={()=>navigateTab('Explore')}>Explore professionals <ArrowUpRight size={16}/></button></main> : <main className="prolink-home-screen">
      <section className="prolink-search-header">
        <div className="prolink-search-inner">
          <div className="prolink-search-title">What service do you need?</div>
          <div className="prolink-search-row">
            <label className="prolink-search-input"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search for a service..."/></label>
          </div>
          <label className="prolink-area-input"><MapPin size={16}/><input value={location} onChange={e=>{setLocation(e.target.value);setDetectedLocation(null);setLocationStatus("Location filter");}} placeholder="City or local area"/></label>
          <div className="prolink-location-status" role="status" aria-live="polite">
            <span>{locationBusy ? "Finding your location…" : locationStatus || (location ? "Location filter" : "Use your current location to find professionals nearby")}</span>
            <button type="button" className="text-button" onClick={detectMyLocation} disabled={locationBusy}>{locationBusy ? "Locating…" : detectedLocation ? "Refresh location" : "Use my location"}</button>
          </div>
          <button className="prolink-search-button" onClick={()=>notify(query.trim() ? 'Search is ready.' : 'Enter a service to search.')}>Search</button>
        </div>
      </section>
      <section className="prolink-category-section">
        <div className="prolink-category-intro"><h2>Find skilled professionals. Build your profile. Grow your work.</h2><p>Join Pedes Prolink to showcase your skills and connect with customers around the world.</p><button onClick={()=>openCategoryBrowser()}>Register as a professional <ChevronRight size={14}/></button></div>
        <div className="prolink-category-grid">{categories.map(category=><button key={category.name} className={category.more?'prolink-category-card more-category':'prolink-category-card'} onClick={()=>openCategoryBrowser(category.more?'':category.group)}><span>{category.name}</span>{category.more&&<small>View all services</small>}</button>)}</div>
      </section>
      <section className="prolink-category-section">
        <div className="section-heading"><div><h2>Approved professionals</h2><p>Real professionals who have completed Prolink's manual review</p></div><div style={{display:'flex',alignItems:'center',gap:10}}><span className="muted-small">{filtered.length} listed</span><button className="outline-button" disabled={directoryLoading} onClick={loadProfessionals}>{directoryLoading?'Refreshing…':'Refresh'}</button></div></div>
        {directoryLoading?<p>Loading approved professionals…</p>:directoryError?<div className="panel"><p>{directoryError}</p><button className="outline-button" onClick={loadProfessionals}>Try again</button></div>:filtered.length?<><div className="prolink-directory-grid">{filtered.map(person=><article className="prolink-directory-card" key={person.id}><button className="directory-card-main" onClick={()=>openProfessional(person)}>{person.portraitUrl?<img className="professional-portrait" src={person.portraitUrl} alt={`${person.name} portrait`}/>:<Avatar person={person}/>}<span className="directory-card-copy"><b>{person.name}</b><small>{person.trade}</small><small><MapPin size={13}/>{person.city}</small></span></button><div className="directory-card-status"><span className="verified-pill"><BadgeCheck size={13}/> Approved</span></div><div className="skill-tags">{person.skills.slice(0,3).map(skill=><span key={skill}>{skill}</span>)}</div><button className="outline-button full" onClick={()=>openProfessional(person)}>View professional profile</button></article>)}</div>{directoryHasMore&&<button className="outline-button full" disabled={directoryLoading} onClick={()=>loadProfessionals(true)} style={{marginTop:16}}>{directoryLoading?'Loading more professionals…':'Load more professionals'}</button>}</>:<div className="panel"><p>{professionals.length?'No approved professionals match your search yet.':'No professionals have completed manual approval yet. New approved professionals will appear here automatically.'}</p></div>}
      </section>
    </main>}

    <footer className="footer"><div className="content-wrap footer-inner"><div><Brand/><p className="footer-copy">Connecting skilled professionals with people who need quality work.</p></div><div className="footer-links"><div><b>Explore</b><button onClick={()=>navigateTab('Explore')}>Find professionals</button><button onClick={()=>navigateTab('How it works')}>How it works</button></div><div><b>Professionals</b><button onClick={()=>openCategoryBrowser()}>Join ProLink</button><button onClick={()=>openAuth()}>Sign in</button></div><div><b>Contact</b><a href="mailto:Support@bidxpro.online">Support@bidxpro.online</a><a href="mailto:Info@bidxpro.online">Info@bidxpro.online</a></div></div><div className="footer-bottom"><span>© 2026 Bidx ProLink</span><span>A product of BIDX PRIME TRADE ZONE LTD</span><span>Payments are arranged directly between customers and professionals.</span></div></div></footer>

    <nav className="mobile-bottom-nav prolink-bottom-nav"><button className={tab==='Explore'?'selected':''} onClick={()=>{navigateTab('Explore');setSelected(null);}}><Home size={21}/><span>Home</span></button><button className={tab==='Messages'?'selected':''} onClick={()=>navigateTab('Messages')}><span className="prolink-message-nav-icon"><MessageCircle size={21}/>{unreadNotificationCount>0&&<span className="prolink-unread-badge">{unreadNotificationCount>99?"99+":unreadNotificationCount}</span>}</span><span>Messages</span></button><button className={tab==='Profile'?'selected':''} onClick={()=>navigateTab('Profile')}><UserRound size={21}/><span>Profile</span></button><button className={tab==='Plan'?'selected':''} onClick={()=>navigateTab('Plan')}><BriefcaseBusiness size={21}/><span>Membership</span></button></nav>


    {showAuth&&<AuthModal onClose={back} />}

    {showCategories&&<div className="modal-backdrop" onClick={back}><section className="modal profession-browser" onClick={e=>e.stopPropagation()}><button className="modal-back-arrow" onClick={back} aria-label="Go back one step"><ArrowLeft/></button><button className="modal-close" onClick={back} aria-label="Close"><X/></button><h2>Select your profession</h2><p>Search and choose your service before registration.</p><label className="profession-browser-search"><Search size={17}/><input autoFocus value={categorySearch} onChange={e=>setCategorySearch(e.target.value)} placeholder="Search profession or trade"/></label><select className="profession-group-select" value={categoryGroup} onChange={e=>setCategoryGroup(e.target.value)}><option value="">All professional categories</option>{PROFESSION_GROUPS.map(g=><option key={g.name}>{g.name}</option>)}</select><div className="profession-browser-list">{PROFESSION_GROUPS.filter(g=>!categoryGroup||g.name===categoryGroup).map(group=>{const matches=group.services.filter(service=>!categorySearch||service.toLowerCase().includes(categorySearch.toLowerCase())||group.name.toLowerCase().includes(categorySearch.toLowerCase()));return matches.length?<div className="profession-browser-group" key={group.name}><h3>{group.name}</h3>{matches.map(service=><button key={service} onClick={()=>startJoin(group.name,service)}>{service}<ChevronRight size={14}/></button>)}</div>:null;})}</div><small className="profession-browser-count">{ALL_PROFESSIONS.length} listed professions and specialisations</small></section></div>}
    {showJoin&&<div className="modal-backdrop" onClick={back}><div className="modal join-modal prolink-onboard-modal" onClick={e=>e.stopPropagation()}><button className="modal-back-arrow" onClick={back} aria-label="Go back one step"><ArrowLeft/></button><button className="modal-close" onClick={back}><X/></button><div className="modal-step">PROFESSIONAL REGISTRATION · STEP {joinStep} OF 2</div><div className="progress-track"><span style={{width:`${joinStep/2*100}%`}}/></div><h2>Build your professional profile</h2><p>Complete your details so customers can understand your services and experience.</p>
      {joinStep===1?<div className="onboard-fields">
        <label className="form-label">Full legal name *<input value={joinData.full_name} onChange={e=>setJoinData(p=>({...p,full_name:e.target.value}))} placeholder="Enter your full legal name"/></label>
        <label className="form-label">Login email<input type="email" value={session?.user?.email||''} readOnly aria-readonly="true"/><small>This is the email address you used to sign in.</small></label>
        <label className="form-label">Phone number *<input type="tel" inputMode="numeric" value={joinData.phone} onChange={e=>setJoinData(p=>({...p,phone:e.target.value.replace(/\D/g,'').slice(0,15)}))} placeholder="08012345678"/></label>
        <label className="form-label">WhatsApp number<input type="tel" inputMode="numeric" value={joinData.whatsapp} onChange={e=>setJoinData(p=>({...p,whatsapp:e.target.value.replace(/\D/g,'').slice(0,15)}))} placeholder="WhatsApp number"/></label>
        <div className="form-label dob-field"><span>Date of birth</span><div className="dob-controls"><input aria-label="Day" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={joinData.dob_day} onChange={e=>setJoinData(p=>({...p,dob_day:e.target.value.replace(/\D/g,'').slice(0,2)}))} placeholder="DD"/><select aria-label="Month" value={joinData.dob_month} onChange={e=>setJoinData(p=>({...p,dob_month:e.target.value}))}><option value="">Month</option>{['January','February','March','April','May','June','July','August','September','October','November','December'].map((m,i)=><option key={m} value={String(i+1).padStart(2,'0')}>{m}</option>)}</select><input aria-label="Year" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={joinData.dob_year} onChange={e=>setJoinData(p=>({...p,dob_year:e.target.value.replace(/\D/g,'').slice(0,4)}))} placeholder="YYYY"/></div><small>Date of birth is collected for your profile only and is not used for automated identity checks.</small></div>
        <label className="form-label">Title *<select value={joinData.title} onChange={e=>setJoinData(p=>({...p,title:e.target.value}))}><option value="">Select title</option>{['Mr','Mrs','Ms','Miss','Master','Dr','Prof','Rev','Other'].map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="form-label">Home country<input value={accountCountry?.home_country_name||joinData.country_name||''} readOnly/><small>Your account is permanently registered in this country. Country changes require an approved application.</small></label>
        {renderAdministrativeFields(adminHierarchy,joinData,setJoinData,'join')}
        {[
          {level:1,key:'region',label:'State / province / region',required:true,placeholder:'Enter your state, province or region'},
          {level:2,key:'district',label:'District / county / local government area',required:true,placeholder:'Enter your district, county or local government area'},
          {level:3,key:'city',label:'City / town',required:true,placeholder:'Enter city or town'},
          {level:4,key:'local_area',label:'Local area / neighbourhood',required:false,placeholder:'Enter local area or neighbourhood'}
        ].filter(field=>field.level>adminHierarchy.length).map(field=><label className="form-label" key={'manual-'+field.key}>{field.label}{field.required?' *':''}<input required={field.required} value={joinData[field.key]||''} onChange={e=>setJoinData(p=>({...p,[field.key]:e.target.value}))} placeholder={field.placeholder}/></label>)}
        {adminAreasLoading&&<small className="wide-field">Checking available administrative levels for this country…</small>}
        <label className="form-label">Postal / ZIP code<input value={joinData.postal_code} onChange={e=>setJoinData(p=>({...p,postal_code:e.target.value}))} placeholder="Postal or ZIP code (if applicable)"/></label>
        <label className="form-label wide-field">Residential street address *<input value={joinData.address} onChange={e=>setJoinData(p=>({...p,address:e.target.value}))} placeholder="House number, street and additional address details"/></label>
        <div className="document-required wide-field"><b>Working ID / professional ID card *</b><small>Upload a clear photo or scan of your current work ID, staff ID, professional ID or trade identification card. National identity numbers and government database lookups are not required.</small><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={e=>setWorkingIdFile(e.target.files?.[0]||null)}/>{workingIdFile&&<small>Selected: {workingIdFile.name}</small>}</div>
      </div>:<div className="onboard-fields">
        <div className="document-required wide-field"><b>Professional portrait (recommended)</b><small>Upload a clear photograph of your face. Customers will see this image on your professional profile. You can also add or change it later under Personal Information.</small><input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={e=>setPortraitFile(e.target.files?.[0]||null)}/>{portraitFile&&<small>Selected: {portraitFile.name}</small>}</div>
        <label className="form-label">Professional / business name *<input value={joinData.business_name} onChange={e=>setJoinData(p=>({...p,business_name:e.target.value}))} placeholder="Name customers will see"/></label>
        <label className="form-label">Professional category *<select value={joinData.category} onChange={e=>setJoinData(p=>({...p,category:e.target.value,subcategory:''}))}><option value="">Select category</option>{categories.slice(0,7).map(c=><option key={c.name}>{c.name}</option>)}{PROFESSION_GROUPS.slice(7).map(g=><option key={g.name}>{g.name}</option>)}<option>Other</option></select></label>
        <label className="form-label">Specialisation / subcategory *<select value={joinData.subcategory} onChange={e=>setJoinData(p=>({...p,subcategory:e.target.value}))}><option value="">Select service</option>{(PROFESSION_GROUPS.find(c=>c.name===joinData.category)?.services||[]).map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="form-label">Years of experience *<select value={joinData.experience} onChange={e=>setJoinData(p=>({...p,experience:e.target.value}))}><option value="">Select experience</option><option>Less than 1 year</option><option>1–2 years</option><option>3–5 years</option><option>6–10 years</option><option>More than 10 years</option></select></label>
        <label className="form-label wide-field">Skills and services offered *<textarea rows="3" value={joinData.skills} onChange={e=>setJoinData(p=>({...p,skills:e.target.value}))} placeholder="List the services and skills you provide"/></label>
        <label className="form-label wide-field">About your professional work<textarea rows="3" value={joinData.about} onChange={e=>setJoinData(p=>({...p,about:e.target.value}))} placeholder="Describe your experience and work"/></label>
        <div className="document-required wide-field"><b>Competency / trade-test / skills certificate *</b><small>Upload a certificate of competency, trade-test certificate, apprenticeship completion certificate, professional qualification or another relevant document proving your skills. This is reviewed manually by Prolink Admin.</small><small className="country-document-guidance">{getProfessionalCredentialGuidance(joinData.country_iso3)}</small><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={e=>setCompetencyFile(e.target.files?.[0]||null)}/>{competencyFile&&<small>Selected: {competencyFile.name}</small>}</div>
        <div className="document-required wide-field"><b>Additional skills document (optional)</b><small>Upload another certificate, licence or supporting document if applicable.</small><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={e=>setExtraSkillFile(e.target.files?.[0]||null)}/>{extraSkillFile&&<small>Selected: {extraSkillFile.name}</small>}</div>
        <label className="form-label">Business phone<input type="tel" inputMode="numeric" value={joinData.business_phone||''} onChange={e=>setJoinData(p=>({...p,business_phone:e.target.value.replace(/\D/g,'').slice(0,15)}))} placeholder="Business contact number"/></label>
        <label className="form-label">Business email<input type="email" value={joinData.business_email||''} onChange={e=>setJoinData(p=>({...p,business_email:e.target.value}))} placeholder="Separate business email (optional)"/></label>
        <label className="form-label">Website (optional)<input type="url" value={joinData.website||''} onChange={e=>setJoinData(p=>({...p,website:e.target.value}))} placeholder="https://"/></label>
        <label className="form-label">Business / operating address<input value={joinData.business_address||''} onChange={e=>setJoinData(p=>({...p,business_address:e.target.value}))} placeholder="Where you operate"/></label>

      </div>}
      <div className="modal-actions">{joinStep>1&&<button className="outline-button" onClick={()=>setJoinStep(1)}>Back</button>}<button className="primary-button" disabled={joinSaving} onClick={async()=>{
        if(joinStep===1){
          const day=Number(joinData.dob_day),month=Number(joinData.dob_month),year=Number(joinData.dob_year);const dobValid=joinData.dob_day.length===2&&joinData.dob_month&&joinData.dob_year.length===4&&year>1900&&year<new Date().getFullYear()&&day>=1&&day<=new Date(year,month,0).getDate();if(!joinData.title||!joinData.full_name.trim()||!joinData.phone.trim()||!joinData.country_code||!joinData.region||!joinData.city.trim()||!dobValid||!joinData.address.trim()||!workingIdFile||workingIdFile.size>10485760||!['image/jpeg','image/png','image/webp','application/pdf'].includes(workingIdFile.type)){notify('Complete your title, legal name, valid date of birth, phone, country, location and address, and upload your working or professional ID card.');return;}
          setJoinSaving(true);
          const legalPayload={title:joinData.title,full_name:joinData.full_name.trim(),phone:joinData.phone,whatsapp:joinData.whatsapp,country_code:joinData.country_code,country_iso3:joinData.country_iso3,country_name:joinData.country_name,region:joinData.region,district:joinData.district,city:joinData.city,local_area:joinData.local_area,administrative_levels:joinData.administrative_levels||[],postal_code:joinData.postal_code,address:joinData.address,date_of_birth:joinData.dob_year&&joinData.dob_month&&joinData.dob_day?joinData.dob_year+'-'+joinData.dob_month+'-'+joinData.dob_day:null,personal_details_review_status:'pending',working_id_review_status:'pending',manual_review_required:true};
          const {error:profileError}=await supabase.auth.updateUser({data:{...profile,...legalPayload}});
          if(profileError){setJoinSaving(false);notify('Personal details could not be saved: '+profileError.message);return;}
          const idForm=new FormData();idForm.append('file',workingIdFile);idForm.append('document_type','working_id');idForm.append('country_code',joinData.country_code);
          let idUpload;
          try{const response=await fetch('/api/verification/document',{method:'POST',headers:{authorization:'Bearer '+session.access_token},body:idForm});idUpload=await response.json();if(!response.ok)throw new Error(idUpload.error||'Working ID upload failed.');}
          catch(uploadError){setJoinSaving(false);notify('Working ID upload failed: '+uploadError.message);return;}
          const {error:reviewError}=await supabase.from('prolink_review_records').insert({user_id:session.user.id,section:'legal_identity',status:'pending',submitted_data:legalPayload});
          setJoinSaving(false);
          if(reviewError){notify('Your professional ID was securely uploaded, but the personal-details review record could not be created. Contact support before resubmitting.');return;}
          setProfile(p=>({...p,...legalPayload}));
          notify('Personal details and working ID submitted for manual review.');
          setJoinStep(2);return;
        }
        if(!joinData.business_name.trim()||!joinData.category||!joinData.subcategory||!joinData.experience||!joinData.skills.trim()||!competencyFile||competencyFile.size>10485760||!['image/jpeg','image/png','image/webp','application/pdf'].includes(competencyFile.type)||(extraSkillFile&&(extraSkillFile.size>10485760||!['image/jpeg','image/png','image/webp','application/pdf'].includes(extraSkillFile.type)))){notify('Complete your professional details and upload a competency or trade-test certificate.');return;}
        setJoinSaving(true);
        const businessPayload={title:joinData.title,full_name:joinData.full_name.trim(),administrative_levels:joinData.administrative_levels||[],date_of_birth:`${joinData.dob_year}-${joinData.dob_month}-${joinData.dob_day}`,country_code:joinData.country_code,country_iso3:joinData.country_iso3,country_name:joinData.country_name,region:joinData.region,district:joinData.district,city:joinData.city,local_area:joinData.local_area,phone:joinData.phone,whatsapp:joinData.whatsapp,professional_name:joinData.business_name.trim(),category:joinData.category,subcategory:joinData.subcategory,experience:joinData.experience,skills:joinData.skills,about:joinData.about,business_phone:joinData.business_phone||'',business_email:joinData.business_email||'',website:joinData.website||'',business_address:joinData.business_address||'',professional_onboarding_status:'submitted_for_review',business_review_status:'pending',manual_document_review_required:true,professional_documents_pending_review:true};
        const {error}=await supabase.auth.updateUser({data:{...profile,...businessPayload}});
        if(error){setJoinSaving(false);notify('We could not save your professional information. Please try again.');return;}
        const {error:businessReviewError}=await supabase.from('prolink_review_records').insert({user_id:session.user.id,section:'professional_profile',status:'pending',submitted_data:businessPayload});
        if(businessReviewError){setJoinSaving(false);notify('Your profile details were saved, but the review record could not be created. Please retry.');return;}
        const uploadDocument=async(file,type)=>{
          if(!file)return null;
          const form=new FormData();form.append('file',file);form.append('document_type',type);form.append('country_code',joinData.country_code);
          const response=await fetch('/api/verification/document',{method:'POST',headers:{authorization:'Bearer '+session.access_token},body:form});
          const result=await response.json().catch(()=>({}));
          if(!response.ok)throw new Error(result.error||'Professional document upload failed.');
          return result.path;
        };
        try{await uploadDocument(competencyFile,'competency_certificate');if(extraSkillFile)await uploadDocument(extraSkillFile,'additional_skill_document');if(portraitFile){if(!['image/jpeg','image/png','image/webp'].includes(portraitFile.type)||portraitFile.size>5242880)throw new Error('Portrait must be JPEG, PNG or WebP and no larger than 5 MB.');const pp=session.user.id+'/portrait-'+crypto.randomUUID()+'.'+(portraitFile.type==='image/png'?'png':portraitFile.type==='image/webp'?'webp':'jpg');const {error:pe}=await supabase.storage.from('prolink-profile-portraits').upload(pp,portraitFile,{upsert:false,contentType:portraitFile.type});if(pe)throw pe;const {error:pr}=await supabase.from('prolink_profile_media').upsert({user_id:session.user.id,portrait_path:pp,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(pr)throw pr;}
        }catch(uploadError){setJoinSaving(false);notify('Your profile was saved, but a certificate could not be submitted: '+uploadError.message);return;}
        setJoinSaving(false);
        setProfile(p=>({...p,...businessPayload}));
        setShowJoin(false);setJoinStep(1);setWorkingIdFile(null);setCompetencyFile(null);setExtraSkillFile(null);
        notify('Your professional profile and skill documents have been submitted for manual Admin review.');
      }}>{joinSaving?'Saving…':joinStep===1?'Submit legal details':'Submit professional details'} <ChevronRight size={15}/></button></div>
      <small className="legal-copy">All personal details, working ID cards and skills certificates are reviewed manually by Prolink Admin. No national ID lookup or automated identity verification is used.</small>
    </div></div>}

    {showRequest&&<div className="modal-backdrop" onClick={back}><div className="modal request-modal" onClick={e=>e.stopPropagation()}><button className="modal-back-arrow" onClick={back} aria-label="Go back one step"><ArrowLeft/></button><button className="modal-close" onClick={back}><X/></button>{requestSent?<div className="success-state"><span><Check/></span><h2>Request sent successfully</h2><p>Your request has been delivered directly to {selected?.name||'the selected professional'}. You can track the response in My requests. Admin has retained a private record.</p><button className="primary-button full" onClick={()=>{setShowRequest(false);setTab('Requests');}}>View my requests</button></div>:<><span className="eyebrow">SERVICE REQUEST</span><h2>Tell {selected?.name?.split(' ')[0]||'the professional'} what you need</h2><p>Your request will go only to this professional.</p><label className="form-label">What do you need done?<textarea rows="4" value={workRequestDescription} onChange={e=>setWorkRequestDescription(e.target.value)} maxLength={5000} placeholder="Describe the job and any important details..."/></label><label className="form-label">Preferred date<input type="date" value={workRequestDate} onChange={e=>setWorkRequestDate(e.target.value)}/></label><label className="form-label">Job location<input value={workRequestLocation} onChange={e=>setWorkRequestLocation(e.target.value)} maxLength={500} placeholder="Enter the job address or area"/></label><button className="primary-button full" disabled={workRequestSaving||workRequestDescription.trim().length<10||workRequestLocation.trim().length<2||!selected?.id||!session?.access_token} onClick={async()=>{setWorkRequestSaving(true);try{const response=await fetch('/api/work-requests',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({professionalUserId:selected.id,description:workRequestDescription,preferredDate:workRequestDate,location:workRequestLocation})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Your request could not be sent.');setRequestSent(true);notify('Your request was sent directly to the professional.');}catch(error){notify(error.message||'Your request could not be sent.');}finally{setWorkRequestSaving(false);}}}>{workRequestSaving?'Sending request…':'Send request'} <ArrowUpRight size={16}/></button><small className="legal-copy">No payment is collected in Bidx ProLink. Agree on price and terms directly with the professional.</small></>}</div></div>}


    {galleryViewerOpen&&selectedGallery.length>0&&<div className="prolink-gallery-viewer" role="dialog" aria-modal="true" aria-label="Professional work photo gallery" onClick={closeGalleryViewer}>
      <div className="gallery-viewer-topbar" onClick={event=>event.stopPropagation()}><button type="button" className="gallery-viewer-control gallery-viewer-close" onClick={closeGalleryViewer} aria-label="Close gallery"><X size={25}/></button><span className="gallery-viewer-count">{activeGalleryIndex+1} <i>/</i> {selectedGallery.length}</span><span className="gallery-viewer-top-spacer"/></div>
      <div className="gallery-viewer-stage" onClick={event=>event.stopPropagation()} onTouchStart={event=>{galleryTouchStartX.current=event.touches[0]?.clientX??null;}} onTouchEnd={event=>{if(galleryTouchStartX.current===null)return;const delta=event.changedTouches[0].clientX-galleryTouchStartX.current;galleryTouchStartX.current=null;if(Math.abs(delta)>45)showGalleryPhoto(delta<0?1:-1);}}>
        {selectedGallery.length>1&&<button type="button" className="gallery-viewer-control gallery-viewer-arrow gallery-viewer-prev" onClick={()=>showGalleryPhoto(-1)} aria-label="Previous photo"><ChevronRight size={28}/></button>}
        <img key={selectedGallery[activeGalleryIndex].id} className="gallery-viewer-image" src={selectedGallery[activeGalleryIndex].url} alt={selectedGallery[activeGalleryIndex].caption||`Professional work photo ${activeGalleryIndex+1}`} draggable="false"/>
        {selectedGallery.length>1&&<button type="button" className="gallery-viewer-control gallery-viewer-arrow gallery-viewer-next" onClick={()=>showGalleryPhoto(1)} aria-label="Next photo"><ChevronRight size={28}/></button>}
      </div>
      <div className="gallery-viewer-footer" onClick={event=>event.stopPropagation()}>{selectedGallery[activeGalleryIndex].caption&&<p>{selectedGallery[activeGalleryIndex].caption}</p>}<span>Swipe left or right to explore</span></div>
    </div>}

    <SupportChat session={session} profile={profile}/>

    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}

export default App;
