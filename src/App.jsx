import { useState, useRef, useEffect, useCallback } from "react";

const USERS   = ["Clément","Maël"];
const ACOLORS = {"Clément":"#1E3A5F","Maël":"#1A3D2B"};
const SECTORS = ["Alimentaire","Automobile","Beauté","Artisanat","Restauration","BTP","Commerce","Santé","Services","Transport","Autre"];
const MONTHS  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS    = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const DAYS_S  = ["L","M","M","J","V","S","D"];
const EMPTY   = {name:"",phone:"",city:"",sector:"BTP",address:"",note:""};

function getMonday(d){const dt=new Date(d);const day=dt.getDay();dt.setDate(dt.getDate()+(day===0?-6:1-day));dt.setHours(0,0,0,0);return dt;}
function addDays(d,n){const dt=new Date(d);dt.setDate(dt.getDate()+n);return dt;}
function fmt(d){return d.toLocaleDateString("fr-FR");}
function sameDay(a,b){return a.getDate()===b.getDate()&&a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear();}
function ini(n){return n.slice(0,2).toUpperCase();}
function isMobile(){return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||window.innerWidth<640;}
function playSound(){try{const c=new(window.AudioContext||window.webkitAudioContext)();const o=c.createOscillator();const g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.setValueAtTime(880,c.currentTime);o.frequency.setValueAtTime(1100,c.currentTime+0.1);g.gain.setValueAtTime(0.12,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.3);o.start(c.currentTime);o.stop(c.currentTime+0.3);}catch{}}

export default function App() {
  const [M] = useState(() => isMobile());
  const [user, setUser]           = useState(null);
  const [screen, setScreen]       = useState("home");
  const [prospects, setProspects] = useState([]);
  const [pipeline, setPipeline]   = useState([]);
  const [sessions, setSessions]   = useState([]);
  const [wins, setWins]           = useState([]);

  // Session — "idle" | "active" | "done"
  const [sessionStatus, setSessionStatus] = useState("idle");
  const [sessionQueue, setSessionQueue]   = useState([]);
  const [sessionIdx, setSessionIdx]       = useState(0);
  const [sessionLog, setSessionLog]       = useState([]);
  const sessionStartRef = useRef(null);

  const [showAdd, setShowAdd]         = useState(false);
  const [form, setForm]               = useState(EMPTY);
  const [callModal, setCallModal]     = useState(null);
  const [rdvModal, setRdvModal]       = useState(null);
  const [rdvDate, setRdvDate]         = useState("");
  const [rdvTime, setRdvTime]         = useState("09:00");
  const [winModal, setWinModal]       = useState(null);
  const [winAmount, setWinAmount]     = useState("");
  const [deleteModal, setDeleteModal] = useState(null);
  const [toast, setToast]             = useState(null);
  const [notifs, setNotifs]           = useState([]);
  const [showNotifs, setShowNotifs]   = useState(false);
  const [banner, setBanner]           = useState(null);
  const [bannerPct, setBannerPct]     = useState(100);
  const [activeUsers, setActiveUsers] = useState([]);
  const [lastSeen, setLastSeen]         = useState({});
  const [showProfile, setShowProfile]   = useState(null);
  const [weekStart, setWeekStart]     = useState(getMonday(new Date()));
  const [selDay, setSelDay]           = useState(null);
  const [expandedRdv, setExpandedRdv] = useState(null);
  const [showSessions, setShowSessions] = useState(false);
  const [showReset, setShowReset]         = useState(false);
  const [loaded, setLoaded]           = useState(false);
  const [dragX, setDragX]             = useState(0);
  const [dragging, setDragging]       = useState(false);

  const dragRef     = useRef(null);
  const lastWrite   = useRef(0);
  const syncRef     = useRef(null);
  const bannerTimer = useRef(null);
  const bannerAnim  = useRef(null);
  const seenPipeRef = useRef(new Set());
  const seenSessRef = useRef(new Set());

  const today      = new Date();
  const pending    = prospects.filter(p => !p.called && (!p.assignedTo || p.assignedTo === user));
  const allPending = prospects.filter(p => !p.called);
  const noAnswerList = pipeline.filter(p => p.result === "no_answer");
  const curP       = sessionQueue.length > 0 ? prospects.find(p => p.id === sessionQueue[sessionIdx]) : null;
  const rdvList    = pipeline.filter(p => p.result === "rdv");
  const realCalls  = pipeline.length;
  const taux       = realCalls > 0 ? Math.round(rdvList.length / realCalls * 100) : 0;
  const converted  = pipeline.filter(p => p.status === "good").length;
  const tauxConv   = rdvList.length > 0 ? Math.round(converted / rdvList.length * 100) : 0;
  const weekDays   = Array.from({length:7}, (_,i) => addDays(weekStart, i));

  const toast$ = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const addNotif = useCallback((msg) => {
    setNotifs(n => [{id:Date.now(),msg,ts:new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})},...n.slice(0,9)]);
    setBanner(msg); setBannerPct(100); playSound();
    clearInterval(bannerAnim.current); clearTimeout(bannerTimer.current);
    const start=Date.now(); const dur=4000;
    bannerAnim.current = setInterval(() => { const p=Math.max(0,100-(Date.now()-start)/dur*100); setBannerPct(p); if(p<=0) clearInterval(bannerAnim.current); }, 50);
    bannerTimer.current = setTimeout(() => { setBanner(null); setBannerPct(100); }, dur);
  }, []);

  const SUPA_URL = "https://chhmnkpcejrcdxtdwlsb.supabase.co";
  const SUPA_KEY = "sb_publishable_li-0nK8JLEBknJKh9XVXnQ_YJ9fSJXI";

  const supaFetch = useCallback(async (method, body=null) => {
    const opts = { method, headers: { "apikey": SUPA_KEY, "Authorization": "Bearer "+SUPA_KEY, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(SUPA_URL+"/rest/v1/cmpro_data?id=eq.1", opts);
    if (!r.ok) throw new Error(await r.text());
    return r;
  }, []);

  const saveData = useCallback(async (p,pl,s,w) => {
    try {
      await supaFetch("POST", {id:1, data:JSON.stringify({prospects:p,pipeline:pl,sessions:s,wins:w||[]}) });
      lastWrite.current = Date.now();
    } catch {}
  }, [supaFetch]);

  const loadData = useCallback(async () => {
    try {
      const r = await fetch(SUPA_URL+"/rest/v1/cmpro_data?id=eq.1", { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer "+SUPA_KEY } });
      const arr = await r.json();
      if (arr && arr[0] && arr[0].data) return JSON.parse(arr[0].data);
    } catch {}
    return null;
  }, []);

  useEffect(() => {
    loadData().then(d => {
      if (d) { setProspects(d.prospects||[]); setPipeline(d.pipeline||[]); setSessions(d.sessions||[]); setWins(d.wins||[]); }
      setLoaded(true);
    });
  }, []);

  useEffect(() => { if (!loaded) return; saveData(prospects,pipeline,sessions,wins); }, [prospects,pipeline,sessions,wins,loaded]);

  useEffect(() => {
    if (!user) return;
    const hb = async () => {
      try {
        await fetch(SUPA_URL+"/rest/v1/cmpro_presence?id=eq."+user, { method:"POST", headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":"application/json","Prefer":"resolution=merge-duplicates"}, body:JSON.stringify({id:user,ts:Date.now()}) });
        const pr = await fetch(SUPA_URL+"/rest/v1/cmpro_presence", { headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY} });
        const rows = await pr.json();
        const now = Date.now();
        const active = (rows||[]).filter(r=>now-r.ts<30000).map(r=>r.id);
        setActiveUsers(active);
        const seen = {};
        (rows||[]).forEach(r => seen[r.id] = r.ts);
        setLastSeen(seen);
      } catch {}
    };
    const poll = async () => {
      const d = await loadData();
      if (!d) return;
      const newPl=d.pipeline||[]; const newSe=d.sessions||[];

      // Always check for notifs — no guard
      newPl.forEach(e => {
        const key=e.id+"-"+(e.calledAt||e.date)+"-"+e.result;
        if (!seenPipeRef.current.has(key) && e.calledBy && e.calledBy!==user) {
          if (e.result==="rdv") addNotif(e.calledBy+" — RDV avec "+e.name);
          else if (e.result==="no_answer") addNotif(e.calledBy+" — pas de réponse chez "+e.name);
          else if (e.result==="refused") addNotif(e.calledBy+" — refus de "+e.name);
        }
        seenPipeRef.current.add(key);
      });
      newSe.forEach(s => {
        if (!seenSessRef.current.has(s.id) && s.user && s.user!==user) {
          addNotif(s.user+" — session terminée · "+s.calls+" appels · "+s.rdv+" RDV");
        }
        seenSessRef.current.add(s.id);
      });

      // Only merge data if we haven't written recently
      if (Date.now()-lastWrite.current > 8000) {
        setProspects(local => {
          const lm={}; local.forEach(p=>lm[p.id]=p);
          const merged=[...local];
          (d.prospects||[]).forEach(rp => { if(!lm[rp.id]) merged.push(rp); });
          return merged;
        });
        setPipeline(local => {
          const ids=new Set(local.map(p=>p.id+"-"+p.date));
          const remote=newPl.filter(p=>!ids.has(p.id+"-"+p.date));
          return remote.length>0 ? [...remote,...local] : local;
        });
        setSessions(local => {
          const ids=new Set(local.map(s=>s.id));
          const remote=newSe.filter(s=>!ids.has(s.id));
          return remote.length>0 ? [...remote,...local] : local;
        });
        setWins(local => {
          const ids=new Set(local.map(w=>w.id));
          const remote=(d.wins||[]).filter(w=>!ids.has(w.id));
          return remote.length>0 ? [...remote,...local] : local;
        });
      }
    };
    // Heartbeat every 5s independently
    hb();
    const hbInterval = setInterval(hb, 5000);
    // Data sync every 8s
    syncRef.current = setInterval(poll, 8000);
    return () => { clearInterval(syncRef.current); clearInterval(hbInterval); };
  }, [user, pipeline.length, sessions.length]);

  const startSession = () => {
    const toCall = prospects.filter(p => !p.called && (!p.assignedTo || p.assignedTo === user));
    if (toCall.length===0) { toast$("Ajoute des prospects d'abord"); setScreen("prospects"); return; }
    sessionStartRef.current = new Date();
    setSessionQueue(toCall.map(p=>p.id)); setSessionIdx(0); setSessionLog([]);
    setSessionStatus("active"); setScreen("call");
  };

  const recordCall = (prospectId, result) => {
    lastWrite.current = Date.now();
    setProspects(pr => pr.map(x => x.id===prospectId ? {...x,called:true,result,calledAt:fmt(new Date())} : x));
    const entry = {prospectId, result, calledAt:fmt(new Date()), calledBy:user};
    setSessionLog(prev => {
      const newLog=[...prev,entry]; const next=sessionIdx+1;
      if (next>=sessionQueue.length) setSessionStatus("done");
      setSessionIdx(next); return newLog;
    });
  };

  const callResult = (result) => {
    const p=callModal; setCallModal(null);
    if (result==="rdv") { setRdvModal(p); return; }
    setPipeline(pr => [{...p,result,date:fmt(new Date()),status:result,calledBy:user},...pr]);
    recordCall(p.id, result);
    toast$(result==="no_answer" ? "Sans réponse" : "Refus enregistré");
  };

  const confirmRdv = () => {
    if (!rdvDate) return;
    const p=rdvModal; const rdvId="rdv_"+Date.now();
    const entry={...p,result:"rdv",date:fmt(new Date()),rdvDate:new Date(rdvDate).toLocaleDateString("fr-FR"),rdvTime,rdvId,status:"pending",calledBy:user};
    setPipeline(pr => [entry,...pr]); recordCall(p.id,"rdv");
    setRdvModal(null); setRdvDate(""); setRdvTime("09:00");
    toast$("RDV confirmé");
  };

  const stopSession = () => {
    if (sessionStartRef.current && sessionLog.length>0) {
      const rdv=sessionLog.filter(c=>c.result==="rdv").length;
      const noAnswer=sessionLog.filter(c=>c.result==="no_answer").length;
      const refused=sessionLog.filter(c=>c.result==="refused").length;
      const total=sessionLog.length;
      setSessions(s => [{id:Date.now(),user,date:fmt(new Date()),time:new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}),calls:total,rdv,noAnswer,refused,taux:total>0?Math.round(rdv/total*100):0},...s]);
    }
    const calledIds = new Set(sessionLog.map(l=>l.prospectId));
    setProspects(pr => pr.map(p => sessionQueue.includes(p.id)&&!calledIds.has(p.id) ? {...p,called:false,result:undefined,calledAt:undefined} : p));
    sessionStartRef.current=null;
    setSessionStatus("idle"); setSessionQueue([]); setSessionIdx(0); setSessionLog([]);
    setScreen("stats");
  };

  const addProspect = () => {
    if (!form.name.trim()) return;
    lastWrite.current = Date.now();
    setProspects(pr => [...pr, {...form,id:Date.now(),called:false,addedAt:fmt(new Date()),addedBy:user,assignedTo:user}]);
    setForm(EMPTY); setShowAdd(false); toast$("Prospect ajouté");
  };

  const confirmWin = () => {
    const e=winModal;
    setPipeline(pr => pr.map(x => (x.rdvId&&x.rdvId===e.rdvId)||(!x.rdvId&&x.id===e.id&&x.rdvDate===e.rdvDate) ? {...x,status:"good"} : x));
    setWins(w => [{id:Date.now(),name:e.name,amount:parseFloat(winAmount)||0,signedBy:user,date:fmt(new Date())},...w]);
    setWinModal(null); setWinAmount(""); toast$("Win enregistré");
  };

  const deleteEntry = () => {
    setPipeline(pr => pr.filter(p => p !== deleteModal));
    setDeleteModal(null); toast$("Supprimé");
  };

  const resetAll = async () => {
    setProspects([]); setPipeline([]); setSessions([]); setWins([]);
    setSessionStatus("idle"); setSessionQueue([]); setSessionIdx(0); setSessionLog([]);
    sessionStartRef.current=null; setScreen("home");
    try { await supaFetch("POST", {id:1, data:JSON.stringify({prospects:[],pipeline:[],sessions:[],wins:[]})}); } catch {}
    toast$("Réinitialisé");
  };

  const rdvOnDay = (day) => rdvList.filter(r => {
    if (!r.rdvDate||r.status==="good"||r.status==="bad") return false;
    const pts=r.rdvDate.split("/"); if(pts.length!==3) return false;
    return sameDay(new Date(parseInt(pts[2]),parseInt(pts[1])-1,parseInt(pts[0])),day);
  });

  const pd=(e)=>{dragRef.current=e.clientX??e.touches?.[0]?.clientX;setDragging(true);};
  const pm=(e)=>{if(!dragging||dragRef.current==null)return;setDragX((e.clientX??e.touches?.[0]?.clientX)-dragRef.current);};
  const pu=()=>{setDragging(false);if(dragX>60&&curP)setCallModal(curP);setDragX(0);dragRef.current=null;};

  // Shared styles
  const inp = {width:"100%",background:"#FFFFFF",border:"1px solid #E8E4DC",borderRadius:10,padding:"13px 14px",color:"#1C1917",fontSize:16,fontFamily:"inherit",boxSizing:"border-box"};
  const lbl = {fontSize:11,fontWeight:600,color:"#A8A29E",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6,display:"block"};
  const MODAL = {position:"fixed",inset:0,background:"rgba(28,25,23,.4)",zIndex:200,display:"flex",alignItems:"flex-end",backdropFilter:"blur(8px)"};
  const MBOX  = {background:"#FAF9F6",borderRadius:"20px 20px 0 0",padding:"28px 24px 52px",width:"100%",maxHeight:"92vh",overflowY:"auto",borderTop:"2px solid #C4B49A"};

  // ── Profile picker ──────────────────────────────────────────────────────
  if (!user) return (
    <div style={{minHeight:"100vh",background:"#FAF9F6",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 28px",fontFamily:"'DM Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{width:0}@keyframes fu{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.fu{animation:fu .5s cubic-bezier(.16,1,.3,1) both}button{cursor:pointer;font-family:'DM Sans',sans-serif;transition:transform .12s}`}</style>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#C4B49A,transparent)"}}/>
      <div className="fu" style={{textAlign:"center",marginBottom:48,width:"100%"}}>
        <div style={{fontSize:10,letterSpacing:".2em",color:"#C4B49A",fontWeight:500,textTransform:"uppercase",marginBottom:16}}>CM Prospecting</div>
        <div style={{fontSize:M?42:50,fontWeight:300,letterSpacing:-2,color:"#1C1917",lineHeight:1,fontFamily:"'Cormorant Garamond',serif"}}>CM<em style={{fontStyle:"italic",color:"#C4B49A"}}>Pro</em></div>
      </div>
      <div className="fu" style={{width:"100%",maxWidth:360,animationDelay:".12s"}}>
        <div style={{fontSize:12,color:"#A8A29E",textAlign:"center",marginBottom:20,letterSpacing:".06em",textTransform:"uppercase"}}>Choisir un profil</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {USERS.map(u => (
            <button key={u} onClick={()=>setUser(u)}
              style={{background:"#FFFFFF",border:"1px solid #EDE9E3",borderRadius:16,padding:"28px 16px",textAlign:"center"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#C4B49A";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="#EDE9E3";}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:ACOLORS[u],display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
                <span style={{fontSize:20,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#FAF9F6",fontStyle:"italic"}}>{ini(u)}</span>
              </div>
              <div style={{fontSize:16,fontWeight:500,color:"#1C1917",letterSpacing:-.3}}>{u}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Main ────────────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#FAF9F6",minHeight:"100vh",color:"#1C1917",paddingBottom:M?80:0}}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        input,textarea,select{outline:none;font-family:'DM Sans',sans-serif;font-size:16px}
        ::-webkit-scrollbar{width:0}
        @keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes su{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes ti{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .fu{animation:fu .3s cubic-bezier(.16,1,.3,1) both}
        .su{animation:su .3s cubic-bezier(.16,1,.3,1) both}
        .ti{animation:ti .25s ease both}
        input:focus,textarea:focus,select:focus{border-color:#C4B49A !important}
        button{cursor:pointer;transition:all .12s;font-family:'DM Sans',sans-serif;-webkit-tap-highlight-color:transparent}
        button:active{opacity:.8}
        .card{background:#FFFFFF;border:1px solid #EDE9E3;border-radius:16px}
        .nb{background:none;border:none;padding:13px 18px;border-bottom:2px solid transparent;margin-bottom:-1px;color:#A8A29E;font-size:13px;font-weight:400;letter-spacing:-.1px;transition:all .15s}
        .nb:hover{background:#F9F8F6;color:#1C1917}
        .nb.on{color:#1C1917;font-weight:600;border-bottom:2px solid #1C1917}
      `}</style>

      {/* Toast */}
      {toast && <div className="ti" style={{position:"fixed",top:18,left:"50%",zIndex:9999,background:"#1C1917",borderRadius:40,padding:"9px 20px",fontSize:13,fontWeight:500,color:"#FAF9F6",whiteSpace:"nowrap",pointerEvents:"none",boxShadow:"0 4px 20px rgba(0,0,0,.15)"}}>{toast}</div>}

      {/* Banner */}
      {banner && (
        <div className="ti" style={{position:"fixed",top:18,left:"50%",zIndex:9998,pointerEvents:"none",maxWidth:M?"88vw":"400px"}}>
          <div style={{background:"rgba(28,25,23,.9)",backdropFilter:"blur(12px)",borderRadius:40,padding:"10px 20px 7px",boxShadow:"0 4px 20px rgba(28,25,23,.2)"}}>
            <div style={{fontSize:13,fontWeight:500,color:"#FAF9F6",marginBottom:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{banner}</div>
            <div style={{height:2,borderRadius:1,background:"rgba(250,249,246,.12)"}}>
              <div style={{height:"100%",borderRadius:1,background:"#C4B49A",width:bannerPct+"%",transition:"width .05s linear"}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}

      {/* Add */}
      {showAdd && (
        <div style={MODAL}>
          <div className="su" style={MBOX}>
            <div style={{width:32,height:3,background:"#E8E4DC",borderRadius:2,margin:"0 auto 22px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
              <div style={{fontSize:18,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",letterSpacing:-.3}}>Nouveau prospect</div>
              <button onClick={()=>{setShowAdd(false);setForm(EMPTY);}} style={{background:"#F5F2EE",border:"none",borderRadius:8,width:32,height:32,fontSize:16,color:"#78716C"}}>×</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[["name","Entreprise","text"],["phone","Téléphone","tel"],["city","Ville","text"],["address","Adresse","text"]].map(([k,ph,t]) => (
                <div key={k}><label style={lbl}>{ph}{k==="name"&&<span style={{color:"#C4B49A"}}> *</span>}</label>
                <input type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} style={inp}/></div>
              ))}
              <div><label style={lbl}>Secteur</label>
                <select value={form.sector} onChange={e=>setForm(f=>({...f,sector:e.target.value}))} style={inp}>
                  {SECTORS.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Note</label>
                <textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Info utile…" rows={2} style={{...inp,resize:"none"}}/>
              </div>
              <button onClick={addProspect} style={{background:form.name.trim()?"#1C1917":"#E8E4DC",color:form.name.trim()?"#FAF9F6":"#A8A29E",border:"none",borderRadius:12,padding:"15px",fontSize:15,fontWeight:600,marginTop:4}}>Ajouter →</button>
            </div>
          </div>
        </div>
      )}

      {/* Call result */}
      {callModal && (
        <div style={MODAL}>
          <div className="su" style={MBOX}>
            <div style={{width:32,height:3,background:"#E8E4DC",borderRadius:2,margin:"0 auto 22px"}}/>
            <div style={{fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"#C4B49A",fontWeight:500,marginBottom:12}}>{callModal.sector}</div>
            <div style={{fontSize:26,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",letterSpacing:-.5,marginBottom:4}}>{callModal.name}</div>
            {callModal.city && <div style={{fontSize:13,color:"#A8A29E",marginBottom:callModal.note?6:20}}>{callModal.city}</div>}
            {callModal.note && <div style={{fontSize:13,color:"#78716C",marginBottom:20,fontStyle:"italic",paddingBottom:16,borderBottom:"1px solid #F0EDE8"}}>"{callModal.note}"</div>}
            {callModal.phone
              ? <a href={"tel:"+callModal.phone.replace(/[\s.\-()]/g,"")} style={{display:"flex",alignItems:"center",justifyContent:"center",background:"#C4B49A",color:"#1C1917",textDecoration:"none",borderRadius:14,padding:"17px",marginBottom:14,fontWeight:600,fontSize:17,letterSpacing:"-.2px"}}>{callModal.phone}</a>
              : <div style={{background:"#F5F2EE",borderRadius:14,padding:16,textAlign:"center",fontSize:13,color:"#A8A29E",marginBottom:14}}>Pas de numéro enregistré</div>
            }
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
              <button onClick={()=>callResult("rdv")} style={{background:"#1C1917",color:"#FAF9F6",border:"none",borderRadius:12,padding:"14px 4px",fontSize:13,fontWeight:600}}>RDV</button>
              <button onClick={()=>callResult("no_answer")} style={{background:"#FFFFFF",color:"#1C1917",border:"1px solid #E8E4DC",borderRadius:12,padding:"14px 4px",fontSize:13,fontWeight:500}}>Pas rép.</button>
              <button onClick={()=>callResult("refused")} style={{background:"#FFFFFF",color:"#1C1917",border:"1px solid #E8E4DC",borderRadius:12,padding:"14px 4px",fontSize:13,fontWeight:500}}>Refus</button>
            </div>
            <button onClick={()=>setCallModal(null)} style={{width:"100%",background:"transparent",color:"#A8A29E",border:"none",fontSize:13,padding:8}}>Fermer</button>
          </div>
        </div>
      )}

      {/* RDV */}
      {rdvModal && (
        <div style={MODAL}>
          <div className="su" style={MBOX}>
            <div style={{width:32,height:3,background:"#E8E4DC",borderRadius:2,margin:"0 auto 22px"}}/>
            <div style={{fontSize:18,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",marginBottom:4}}>Fixer le RDV</div>
            <div style={{fontSize:13,color:"#A8A29E",marginBottom:22}}>{rdvModal.name}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8}}>
              <div><label style={lbl}>Date <span style={{color:"#C4B49A"}}>*</span></label><input type="date" value={rdvDate} onChange={e=>setRdvDate(e.target.value)} style={inp}/></div>
              <div><label style={lbl}>Heure</label><input type="time" value={rdvTime} onChange={e=>setRdvTime(e.target.value)} style={inp}/></div>
            </div>
            {!rdvDate && <div style={{fontSize:12,color:"#C4B49A",marginBottom:10,textAlign:"center"}}>Date requise</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button onClick={()=>{setRdvModal(null);setRdvDate("");setRdvTime("09:00");}} style={{background:"#F5F2EE",color:"#78716C",border:"none",borderRadius:12,padding:"14px",fontSize:14,fontWeight:500}}>Annuler</button>
              <button onClick={rdvDate?confirmRdv:undefined} style={{background:rdvDate?"#1C1917":"#E8E4DC",color:rdvDate?"#FAF9F6":"#A8A29E",border:"none",borderRadius:12,padding:"14px",fontSize:14,fontWeight:600,cursor:rdvDate?"pointer":"not-allowed"}}>Confirmer →</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset confirm */}
      {showReset && (
        <div style={{position:"fixed",inset:0,background:"rgba(28,25,23,.4)",zIndex:200,display:"flex",alignItems:"flex-end",backdropFilter:"blur(8px)"}}>
          <div className="su" style={{background:"#FAF9F6",borderRadius:"20px 20px 0 0",padding:"28px 24px 52px",width:"100%",borderTop:"2px solid #C4B49A"}}>
            <div style={{width:32,height:3,background:"#E8E4DC",borderRadius:2,margin:"0 auto 22px"}}/>
            <div style={{fontSize:18,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",marginBottom:8,textAlign:"center"}}>Réinitialiser ?</div>
            <div style={{fontSize:12,color:"#A8A29E",textAlign:"center",marginBottom:28,lineHeight:1.6}}>Toutes les données seront supprimées.<br/>Cette action est irréversible.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button onClick={()=>setShowReset(false)} style={{background:"#F5F2EE",color:"#78716C",border:"none",borderRadius:12,padding:"14px",fontSize:14,fontWeight:500}}>Annuler</button>
              <button onClick={()=>{setShowReset(false);resetAll();}} style={{background:"#1C1917",color:"#FAF9F6",border:"none",borderRadius:12,padding:"14px",fontSize:14,fontWeight:600}}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Win */}
      {winModal && (
        <div style={MODAL}>
          <div className="su" style={MBOX}>
            <div style={{width:32,height:3,background:"#E8E4DC",borderRadius:2,margin:"0 auto 22px"}}/>
            <div style={{fontSize:22,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",marginBottom:4,textAlign:"center"}}>Win confirmé</div>
            <div style={{fontSize:13,color:"#A8A29E",textAlign:"center",marginBottom:24}}>{winModal.name}</div>
            <div style={{marginBottom:20}}>
              <label style={{...lbl,marginBottom:8}}>Montant du contrat</label>
              <div style={{display:"flex",alignItems:"center",border:"1px solid #E8E4DC",borderRadius:12,overflow:"hidden",background:"#FFFFFF"}}>
                <input type="number" value={winAmount} onChange={e=>setWinAmount(e.target.value)} onKeyDown={e=>e.key==="Enter"&&confirmWin()} placeholder="0" autoFocus style={{flex:1,border:"none",background:"transparent",padding:"14px 16px",fontSize:22,fontWeight:300,color:"#1C1917",outline:"none"}}/>
                <span style={{padding:"0 16px",fontSize:16,color:"#A8A29E",fontWeight:400}}>€</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button onClick={()=>{setWinModal(null);setWinAmount("");}} style={{background:"#F5F2EE",color:"#78716C",border:"none",borderRadius:12,padding:"14px",fontSize:14,fontWeight:500}}>Annuler</button>
              <button onClick={confirmWin} style={{background:"#1C1917",color:"#FAF9F6",border:"none",borderRadius:12,padding:"14px",fontSize:14,fontWeight:600}}>Enregistrer →</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete */}
      {deleteModal && (
        <div style={MODAL}>
          <div className="su" style={MBOX}>
            <div style={{width:32,height:3,background:"#E8E4DC",borderRadius:2,margin:"0 auto 22px"}}/>
            <div style={{fontSize:18,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",marginBottom:8,textAlign:"center"}}>Supprimer ?</div>
            <div style={{fontSize:13,color:"#A8A29E",textAlign:"center",marginBottom:6}}>{deleteModal.name}</div>
            <div style={{fontSize:11,color:"#C4B49A",textAlign:"center",marginBottom:28,letterSpacing:".04em"}}>Cette action est irréversible.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button onClick={()=>setDeleteModal(null)} style={{background:"#F5F2EE",color:"#78716C",border:"none",borderRadius:12,padding:"14px",fontSize:14,fontWeight:500}}>Annuler</button>
              <button onClick={deleteEntry} style={{background:"#1C1917",color:"#FAF9F6",border:"none",borderRadius:12,padding:"14px",fontSize:14,fontWeight:600}}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Notifs */}
      {(showNotifs||showProfile) && (
        <div style={{position:"fixed",inset:0,zIndex:149}} onClick={()=>{setShowNotifs(false);setShowProfile(null);}}/>
      )}
      {showNotifs && (
        <div style={{position:"fixed",inset:0,zIndex:150}} onClick={()=>setShowNotifs(false)}>
          <div style={{position:"absolute",top:M?68:56,right:M?16:24,width:M?"calc(100% - 32px)":"280px",background:"#FFFFFF",border:"1px solid #EDE9E3",borderRadius:16,boxShadow:"0 8px 32px rgba(28,25,23,.12)",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #F5F2EE",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,fontWeight:600,color:"#1C1917",letterSpacing:".04em",textTransform:"uppercase"}}>Notifications</span>
              {notifs.length>0 && <button onClick={()=>setNotifs([])} style={{fontSize:11,color:"#A8A29E",background:"none",border:"none",textDecoration:"underline"}}>Effacer</button>}
            </div>
            <div style={{maxHeight:280,overflowY:"auto"}}>
              {notifs.length===0
                ? <div style={{padding:"20px",textAlign:"center",fontSize:12,color:"#D6D3D1"}}>Aucune notification</div>
                : notifs.map(n => (
                  <div key={n.id} style={{padding:"11px 16px",borderBottom:"1px solid #FAF9F6"}}>
                    <div style={{fontSize:12,color:"#1C1917",lineHeight:1.4,marginBottom:2}}>{n.msg}</div>
                    <div style={{fontSize:10,color:"#C4B49A"}}>{n.ts}</div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:"#FFFFFF",borderBottom:"1px solid #EDE9E3",padding:M?"15px 20px":"16px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:M?"sticky":"static",top:0,zIndex:100}}>
        <div>
          <div style={{fontSize:9,color:"#C4B49A",fontWeight:600,letterSpacing:".14em",textTransform:"uppercase",marginBottom:2}}>CM Prospecting</div>
          <div style={{fontSize:M?18:20,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",letterSpacing:-.5,lineHeight:1}}>CM<em style={{fontStyle:"italic",color:"#C4B49A"}}>Pro</em></div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button onClick={e=>{e.stopPropagation();setShowNotifs(n=>!n);}} style={{background:"#F9F8F6",border:"1px solid #EDE9E3",borderRadius:8,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,position:"relative",color:"#78716C"}}>
            ◎{notifs.length>0 && <span style={{position:"absolute",top:5,right:5,width:6,height:6,borderRadius:"50%",background:"#C4B49A",display:"block"}}/>}
          </button>
          {USERS.map(u => {
            const isActive=activeUsers.includes(u); const isMe=u===user;
            const ts=lastSeen[u];
            const lastSeenStr=ts?new Date(ts).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}):"jamais";
            const isToday=ts&&new Date(ts).toDateString()===new Date().toDateString();
            return (
              <div key={u} style={{position:"relative"}}>
                <div onClick={e=>{e.stopPropagation();setShowProfile(showProfile===u?null:u);}} style={{width:32,height:32,borderRadius:"50%",background:isActive?ACOLORS[u]:"#F0EDE8",border:isMe?"2px solid #C4B49A":"2px solid transparent",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:isActive?"0 2px 8px "+ACOLORS[u]+"33":"none",cursor:"pointer"}}>
                  <span style={{fontSize:11,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:isActive?"#FAF9F6":"#C4B49A",fontStyle:"italic"}}>{ini(u)}</span>
                </div>
                {isActive && <span style={{position:"absolute",bottom:0,right:0,width:8,height:8,borderRadius:"50%",background:"#22C55E",border:"1.5px solid #FFFFFF",display:"block"}}/>}
                {showProfile===u && (
                  <div style={{position:"absolute",top:42,right:0,background:"#FFFFFF",border:"1px solid #EDE9E3",borderRadius:12,padding:"12px 16px",boxShadow:"0 8px 24px rgba(28,25,23,.12)",zIndex:200,minWidth:160,whiteSpace:"nowrap"}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#1C1917",marginBottom:4}}>{u}</div>
                    <div style={{fontSize:11,color:isActive?"#22C55E":"#A8A29E",marginBottom:6}}>{isActive?"En ligne":"Hors ligne"}</div>
                    <div style={{fontSize:10,color:"#A8A29E",letterSpacing:".04em"}}>
                      {ts?(isToday?"Vu à "+lastSeenStr:"Vu le "+new Date(ts).toLocaleDateString("fr-FR")+" à "+lastSeenStr):"Jamais connecté"}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        </div>
      </div>

      {/* Desktop nav */}
      {!M && (
        <div style={{background:"#FFFFFF",borderBottom:"1px solid #EDE9E3",display:"flex",padding:"0 20px"}}>
          {[["home","Accueil"],["prospects","Prospects"],["agenda","Agenda"],["stats","Stats"]].map(([id,label]) => (
            <button key={id} className={"nb"+(screen===id?" on":"")} onClick={()=>setScreen(id)}>{label}</button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{maxWidth:M?undefined:860,margin:M?undefined:"0 auto",padding:M?"20px 16px 0":"28px 28px 0"}}>

        {/* HOME */}
        {screen==="home" && (
          <div style={M?{}:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
            <div>
              {/* Session button */}
              {sessionStatus==="idle" && (
                <button onClick={startSession} style={{width:"100%",background:"#1C1917",color:"#FAF9F6",border:"none",borderRadius:16,padding:"22px 24px",marginBottom:16,textAlign:"left",position:"relative"}}>
                  <div style={{fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"#C4B49A",marginBottom:6}}>Session</div>
                  <div style={{fontSize:M?22:20,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",letterSpacing:-.5}}>Lancer la session</div>
                  {pending.length>0 && <div style={{fontSize:11,color:"rgba(250,249,246,.35)",marginTop:5}}>{pending.length} prospect{pending.length>1?"s":""} en attente</div>}
                  <div style={{position:"absolute",right:22,top:"50%",transform:"translateY(-50%)",fontSize:18,color:"#C4B49A",fontFamily:"'Cormorant Garamond',serif"}}>→</div>
                </button>
              )}

              {sessionStatus==="active" && (
                <div style={{marginBottom:16}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                    <button onClick={()=>setScreen("call")} style={{background:"#1C1917",color:"#FAF9F6",border:"none",borderRadius:14,padding:"15px",fontSize:14,fontWeight:600,textAlign:"center"}}>Reprendre</button>
                    <button onClick={stopSession} style={{background:"#FAF9F6",color:"#1C1917",border:"1px solid #EDE9E3",borderRadius:14,padding:"15px",fontSize:14,fontWeight:500,textAlign:"center"}}>Terminer</button>
                  </div>
                  <div style={{background:"#FFFFFF",border:"1px solid #EDE9E3",borderRadius:12,padding:"10px 14px",fontSize:12,color:"#78716C"}}>
                    Session en cours · <strong style={{color:"#1C1917"}}>{sessionLog.filter(l=>l.result==="rdv").length} RDV</strong> · {sessionLog.length} appels
                  </div>
                </div>
              )}

              {sessionStatus==="done" && (
                <button onClick={stopSession} style={{width:"100%",background:"#FAF9F6",color:"#1C1917",border:"1px solid #EDE9E3",borderRadius:16,padding:"17px",fontSize:14,fontWeight:500,marginBottom:16}}>
                  Terminer la session →
                </button>
              )}

              {/* Stats */}
              {realCalls>0 && (
                <div className="card" style={{padding:"18px",marginBottom:16}}>
                  <div style={{fontSize:9,color:"#A8A29E",fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>Performances</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
                    {[["Appels",realCalls],["RDV",rdvList.length],["Taux",taux+"%"],["Conv.",tauxConv+"%"]].map(([l,v]) => (
                      <div key={l} style={{textAlign:"center"}}>
                        <div style={{fontSize:M?22:20,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#1C1917",letterSpacing:-.5,lineHeight:1,marginBottom:3}}>{v}</div>
                        <div style={{fontSize:9,color:"#A8A29E",fontWeight:600,letterSpacing:".08em",textTransform:"uppercase"}}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{height:1,background:"#F0EDE8",borderRadius:1,overflow:"hidden",display:"flex"}}>
                    {rdvList.length>0 && <div style={{flex:rdvList.length,background:"#1C1917"}}/>}
                    {pipeline.filter(p=>p.result==="no_answer").length>0 && <div style={{flex:pipeline.filter(p=>p.result==="no_answer").length,background:"#C4B49A"}}/>}
                    {pipeline.filter(p=>p.result==="refused").length>0 && <div style={{flex:pipeline.filter(p=>p.result==="refused").length,background:"#E8E4DC"}}/>}
                  </div>
                </div>
              )}
            </div>

            <div>
              {/* RDV */}
              {rdvList.filter(r=>r.status==="pending").length>0 && (
                <div style={{marginBottom:M?16:0}}>
                  <div style={{fontSize:9,color:"#A8A29E",fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>Prochains RDV</div>
                  {rdvList.filter(r=>r.status==="pending").slice(0,M?4:5).map((p,i) => (
                    <div key={i} className="card" style={{padding:"13px 16px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontWeight:500,fontSize:13,marginBottom:2}}>{p.name}</div>
                        <div style={{fontSize:11,color:"#A8A29E"}}>{p.rdvDate}{p.rdvTime?" · "+p.rdvTime:""}{p.calledBy?" · "+p.calledBy:""}</div>
                      </div>
                      <div style={{fontSize:9,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"#C4B49A",padding:"4px 10px",border:"1px solid #E8E4DC",borderRadius:6}}>RDV</div>
                    </div>
                  ))}
                </div>
              )}

              {/* À rappeler */}
              {noAnswerList.length>0 && (
                <div>
                  <div style={{fontSize:9,color:"#A8A29E",fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12,marginTop:M&&rdvList.filter(r=>r.status==="pending").length>0?16:0}}>
                    À rappeler <span style={{color:"#1C1917"}}>· {noAnswerList.length}</span>
                  </div>
                  {noAnswerList.map((p,i) => (
                    <div key={i} className="card" style={{padding:"13px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:500,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{p.name}</div>
                        <div style={{fontSize:11,color:"#A8A29E"}}>{p.city||p.sector}{p.calledBy?" · "+p.calledBy:""}</div>
                      </div>
                      <button onClick={()=>setCallModal(p)} style={{background:"#1C1917",color:"#FAF9F6",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,flexShrink:0,whiteSpace:"nowrap"}}>Rappeler</button>
                      <button onClick={()=>setDeleteModal(p)} style={{background:"#F9F8F6",border:"1px solid #EDE9E3",color:"#A8A29E",borderRadius:6,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,padding:0}}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROSPECTS */}
        {screen==="prospects" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{fontSize:12,color:"#A8A29E",letterSpacing:".04em"}}>{pending.length} pour moi · {allPending.length} total</div>
              <button onClick={()=>setShowAdd(true)} style={{background:"#1C1917",color:"#FAF9F6",border:"none",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:600,letterSpacing:"-.1px"}}>Ajouter</button>
            </div>
            {allPending.length===0
              ? <div style={{textAlign:"center",paddingTop:60}}>
                  <div style={{width:32,height:1,background:"#C4B49A",margin:"0 auto 20px"}}/>
                  <div style={{fontSize:16,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#A8A29E"}}>Aucun prospect</div>
                </div>
              : <div style={M?{}:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {allPending.map(p => (
                    <div key={p.id} className="card" style={{padding:"14px 16px",marginBottom:M?8:0,display:"flex",alignItems:"center",gap:12,opacity:p.assignedTo&&p.assignedTo!==user?.45:1}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:500,fontSize:M?14:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:3}}>{p.name}</div>
                        <div style={{fontSize:11,color:"#A8A29E"}}>{p.sector}{p.city?" · "+p.city:""}</div>
                      </div>
                      {p.assignedTo !== user && (
                        <button onClick={()=>{lastWrite.current=Date.now();setProspects(pr=>pr.map(x=>x.id===p.id?{...x,assignedTo:user}:x));toast$("Prospect récupéré");}}
                          style={{background:"#F9F8F6",border:"1px solid #EDE9E3",borderRadius:8,padding:"5px 10px",fontSize:11,color:"#78716C",flexShrink:0,whiteSpace:"nowrap"}}>
                          Prendre
                        </button>
                      )}
                      {p.assignedTo && (
                        <div style={{width:26,height:26,borderRadius:"50%",background:ACOLORS[p.assignedTo],display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <span style={{fontSize:10,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#FAF9F6",fontStyle:"italic"}}>{ini(p.assignedTo)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* CALL */}
        {screen==="call" && (
          <div style={M?{}:{maxWidth:440,margin:"0 auto"}}>
            {sessionStatus==="done" ? (
              <div style={{textAlign:"center",paddingTop:60}}>
                <div style={{width:40,height:1,background:"#C4B49A",margin:"0 auto 28px"}}/>
                <div style={{fontSize:M?24:20,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#1C1917",marginBottom:6}}>Session terminée</div>
                <div style={{fontSize:12,color:"#A8A29E",marginBottom:36,letterSpacing:".04em"}}>{sessionLog.length} appels · {sessionLog.filter(l=>l.result==="rdv").length} RDV</div>
                <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:260,margin:"0 auto"}}>
                  <button onClick={()=>setScreen("prospects")} style={{background:"#FFFFFF",color:"#1C1917",border:"1px solid #EDE9E3",borderRadius:12,padding:"14px",fontSize:14,fontWeight:500}}>Ajouter des prospects</button>
                  <button onClick={stopSession} style={{background:"#1C1917",color:"#FAF9F6",border:"none",borderRadius:12,padding:"14px",fontSize:14,fontWeight:600}}>Terminer</button>
                </div>
              </div>
            ) : curP ? (
              <>
                {/* Progress */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
                  <div style={{fontSize:11,color:"#A8A29E"}}>{sessionIdx+1} / {sessionQueue.length}</div>
                  <div style={{display:"flex",gap:3}}>
                    {Array.from({length:Math.min(sessionQueue.length,10)}).map((_,i) => (
                      <div key={i} style={{height:2,width:i===sessionIdx?20:6,borderRadius:1,background:i<sessionIdx?"#C4B49A":i===sessionIdx?"#1C1917":"#E8E4DC",transition:"all .3s"}}/>
                    ))}
                  </div>
                  <div style={{fontSize:11,color:"#A8A29E"}}>{sessionLog.filter(l=>l.result==="rdv").length} RDV · {sessionLog.length} appels</div>
                </div>

                {/* Prospect card */}
                <div onMouseDown={pd} onMouseMove={pm} onMouseUp={pu} onMouseLeave={pu} onTouchStart={pd} onTouchMove={pm} onTouchEnd={pu}
                  style={{background:"#FFFFFF",border:"1px solid #EDE9E3",borderRadius:18,padding:"32px 28px",userSelect:"none",minHeight:M?200:220,
                    transform:"translateX("+dragX+"px) rotate("+(dragX*.018)+"deg)",transition:!dragging?"transform .15s":"none",boxShadow:"0 2px 16px rgba(28,25,23,.05)"}}>
                  <div style={{fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"#C4B49A",fontWeight:500,marginBottom:18}}>{curP.sector}</div>
                  <div style={{fontSize:M?28:26,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",letterSpacing:-.8,marginBottom:8,lineHeight:1.1}}>{curP.name}</div>
                  {curP.city && <div style={{fontSize:13,color:"#A8A29E",marginBottom:curP.note?0:4}}>{curP.city}</div>}
                  {curP.note && <div style={{fontSize:12,color:"#78716C",marginTop:14,paddingTop:14,borderTop:"1px solid #F5F2EE",fontStyle:"italic"}}>"{curP.note}"</div>}
                </div>

                {/* Call CTA */}
                <div style={{display:"flex",justifyContent:"center",marginTop:M?28:22}}>
                  {curP.phone
                    ? <a href={"tel:"+curP.phone.replace(/[\s.\-()]/g,"")} onClick={()=>setCallModal(curP)}
                        style={{background:"#C4B49A",color:"#1C1917",textDecoration:"none",borderRadius:14,padding:M?"18px 40px":"16px 36px",fontSize:M?17:16,fontWeight:600,letterSpacing:"-.2px",boxShadow:"0 4px 14px rgba(196,180,154,.3)"}}>
                        {curP.phone}
                      </a>
                    : <button onClick={()=>setCallModal(curP)} style={{background:"#C4B49A",color:"#1C1917",border:"none",borderRadius:14,padding:M?"16px 32px":"14px 28px",fontSize:M?16:15,fontWeight:600}}>
                        Appeler
                      </button>
                  }
                </div>
              </>
            ) : (
              <div style={{textAlign:"center",paddingTop:80,fontSize:13,color:"#A8A29E"}}>Chargement…</div>
            )}
          </div>
        )}

        {/* AGENDA */}
        {screen==="agenda" && (
          <div style={M?{}:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
            <div>
              <div className="card" style={{padding:"18px",marginBottom:M?16:0}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                  <button onClick={()=>setWeekStart(w=>addDays(w,-7))} style={{background:"#F9F8F6",border:"1px solid #EDE9E3",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#78716C"}}>‹</button>
                  <div style={{fontSize:13,fontWeight:500,color:"#44403C"}}>{fmt(weekStart).slice(0,5)} — {fmt(addDays(weekStart,6)).slice(0,5)}</div>
                  <button onClick={()=>setWeekStart(w=>addDays(w,7))} style={{background:"#F9F8F6",border:"1px solid #EDE9E3",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#78716C"}}>›</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:8}}>
                  {DAYS_S.map((d,i) => <div key={i} style={{textAlign:"center",fontSize:10,fontWeight:600,color:"#A8A29E",letterSpacing:".06em"}}>{d}</div>)}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                  {weekDays.map((day,i) => {
                    const ev=rdvOnDay(day); const isT=sameDay(day,today); const isSel=selDay&&sameDay(day,selDay);
                    return (
                      <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,marginBottom:2,cursor:"pointer"}} onClick={()=>setSelDay(isSel?null:day)}>
                        <div style={{width:36,height:36,borderRadius:"50%",background:isT?"#1C1917":isSel?"#F5F2EE":"transparent",display:"flex",alignItems:"center",justifyContent:"center",border:isSel&&!isT?"1px solid #C4B49A":"none"}}>
                          <span style={{fontSize:13,fontWeight:isT||isSel?600:400,color:isT?"#FAF9F6":"#44403C"}}>{day.getDate()}</span>
                        </div>
                        {ev.length>0 && <div style={{width:4,height:4,borderRadius:"50%",background:isT?"#FAF9F6":"#C4B49A"}}/>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div>
              {selDay ? (()=>{
                const ev=rdvOnDay(selDay); const di=weekDays.findIndex(d=>sameDay(d,selDay));
                return (
                  <>
                    <div style={{fontSize:9,color:"#A8A29E",fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>
                      {di>=0?DAYS[di]:""} {selDay.getDate()} {MONTHS[selDay.getMonth()]}
                      {ev.length>0 && <span style={{color:"#1C1917"}}> · {ev.length}</span>}
                    </div>
                    {ev.length===0
                      ? <div className="card" style={{padding:"20px",textAlign:"center",color:"#D6D3D1",fontSize:13}}>Aucun RDV ce jour</div>
                      : ev.map((e,j) => (
                        <div key={j} className="card fu" style={{padding:"16px",marginBottom:10}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:600,fontSize:M?15:14,marginBottom:3}}>{e.name}</div>
                              <div style={{fontSize:12,color:"#A8A29E"}}>{e.rdvTime||"—"}{e.city?" · "+e.city:""}</div>
                              {e.calledBy && <div style={{fontSize:10,color:"#C4B49A",marginTop:3,letterSpacing:".04em"}}>{e.calledBy}</div>}
                              {e.phone && <a href={"tel:"+e.phone.replace(/[\s.\-()]/g,"")} style={{display:"inline-block",marginTop:10,background:"#C4B49A",color:"#1C1917",textDecoration:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600}}>{e.phone}</a>}
                            </div>
                            <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:10}}>
                              <button onClick={()=>e.status!=="good"&&setWinModal(e)} style={{background:e.status==="good"?"#1C1917":"#F9F8F6",color:e.status==="good"?"#FAF9F6":"#A8A29E",border:"1px solid #EDE9E3",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:500}}>✓</button>
                              <button onClick={()=>setPipeline(pr=>pr.map(x=>(x.rdvId&&x.rdvId===e.rdvId)||(!x.rdvId&&x.id===e.id&&x.rdvDate===e.rdvDate)?{...x,status:"bad"}:x))} style={{background:e.status==="bad"?"#1C1917":"#F9F8F6",color:e.status==="bad"?"#FAF9F6":"#A8A29E",border:"1px solid #EDE9E3",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:500}}>✗</button>
                            </div>
                          </div>
                          <div style={{fontSize:9,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:e.status==="good"?"#1C1917":e.status==="bad"?"#A8A29E":"#C4B49A"}}>
                            {e.status==="good"?"Converti":e.status==="bad"?"Perdu":"En attente"}
                          </div>
                        </div>
                      ))
                    }
                  </>
                );
              })() : (
                <>
                  <div style={{fontSize:9,color:"#A8A29E",fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>Tous les RDV</div>
                  {rdvList.filter(r=>r.status==="pending").length===0
                    ? <div className="card" style={{padding:"32px",textAlign:"center"}}>
                        <div style={{width:28,height:1,background:"#E8E4DC",margin:"0 auto 16px"}}/>
                        <div style={{fontSize:15,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#A8A29E"}}>Aucun RDV</div>
                      </div>
                    : rdvList.filter(r=>r.status==="pending").map((r,i) => {
                        const key=r.rdvId||r.id+"-"+(r.rdvDate||String(i)); const isExp=expandedRdv===key;
                        return (
                          <div key={i} className="card" style={{padding:"13px 16px",marginBottom:8}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}} onClick={()=>setExpandedRdv(isExp?null:key)}>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:500,fontSize:13,marginBottom:2}}>{r.name}</div>
                                <div style={{fontSize:11,color:"#A8A29E"}}>{r.rdvDate}{r.rdvTime?" · "+r.rdvTime:""}{r.calledBy?" · "+r.calledBy:""}</div>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <button onClick={e=>{e.stopPropagation();r.status!=="good"&&setWinModal(r);}} style={{background:r.status==="good"?"#1C1917":"#F9F8F6",color:r.status==="good"?"#FAF9F6":"#A8A29E",border:"1px solid #EDE9E3",borderRadius:6,padding:"5px 10px",fontSize:12}}>✓</button>
                                <button onClick={e=>{e.stopPropagation();setPipeline(pr=>pr.map((x,j)=>j===i?{...x,status:"bad"}:x));}} style={{background:r.status==="bad"?"#1C1917":"#F9F8F6",color:r.status==="bad"?"#FAF9F6":"#A8A29E",border:"1px solid #EDE9E3",borderRadius:6,padding:"5px 10px",fontSize:12}}>✗</button>
                                <span style={{fontSize:12,color:"#C4B49A"}}>{isExp?"↑":"↓"}</span>
                              </div>
                            </div>
                            {isExp && (
                              <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #F5F2EE"}}>
                                {r.city && <div style={{fontSize:12,color:"#78716C",marginBottom:4}}>{r.city}</div>}
                                {r.sector && <div style={{fontSize:12,color:"#78716C",marginBottom:4}}>{r.sector}</div>}
                                {r.address && <div style={{fontSize:12,color:"#78716C",marginBottom:4}}>{r.address}</div>}
                                {r.note && <div style={{fontSize:12,color:"#A8A29E",marginBottom:10,fontStyle:"italic"}}>"{r.note}"</div>}
                                {r.phone
                                  ? <a href={"tel:"+r.phone.replace(/[\s.\-()]/g,"")} style={{display:"inline-block",background:"#C4B49A",color:"#1C1917",textDecoration:"none",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:600}}>{r.phone}</a>
                                  : <div style={{fontSize:12,color:"#D6D3D1"}}>Pas de numéro</div>
                                }
                              </div>
                            )}
                          </div>
                        );
                      })
                  }
                </>
              )}
            </div>
          </div>
        )}

        {/* STATS */}
        {screen==="stats" && (
          <div>
            {/* CA */}
            <div className="card" style={{padding:"20px 24px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:9,color:"#A8A29E",fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Chiffre d'affaires</div>
                <div style={{fontSize:M?32:36,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",letterSpacing:-1.5,color:"#1C1917",lineHeight:1}}>
                  {wins.reduce((a,w)=>a+w.amount,0).toLocaleString("fr-FR")} <span style={{fontSize:16,color:"#C4B49A",fontWeight:300}}>€</span>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:9,color:"#A8A29E",fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Contrats</div>
                <div style={{fontSize:M?32:36,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",letterSpacing:-1.5,color:"#1C1917",lineHeight:1}}>{wins.length}</div>
              </div>
            </div>

            {/* Per user */}
            <div style={M?{}:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              {USERS.map(u => {
                const uPl=pipeline.filter(p=>p.calledBy===u);
                const uRdv=uPl.filter(p=>p.result==="rdv").length;
                const uCalls=uPl.length;
                const uConv=uPl.filter(p=>p.status==="good").length;
                const uTaux=uCalls>0?Math.round(uRdv/uCalls*100):0;
                const uTauxConv=uRdv>0?Math.round(uConv/uRdv*100):0;
                const uSess=sessions.filter(s=>s.user===u);
                const isMe=u===user;
                return (
                  <div key={u} className="card" style={{padding:"16px 18px",marginBottom:M?10:0,borderLeft:isMe?"3px solid #C4B49A":"3px solid transparent"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                      <div style={{width:38,height:38,borderRadius:"50%",background:ACOLORS[u],display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <span style={{fontSize:14,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#FAF9F6",fontStyle:"italic"}}>{ini(u)}</span>
                      </div>
                      <div>
                        <div style={{fontWeight:600,fontSize:14,letterSpacing:-.2}}>{u}</div>
                        <div style={{fontSize:11,color:"#A8A29E"}}>{uSess.length} session{uSess.length>1?"s":""}</div>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                      {[["Appels",uCalls],["RDV",uRdv],["Taux",uTaux+"%"],["Conv.",uTauxConv+"%"]].map(([l,v]) => (
                        <div key={l} style={{background:"#FAF9F6",borderRadius:10,padding:"10px 4px",textAlign:"center"}}>
                          <div style={{fontSize:18,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#1C1917",letterSpacing:-.5,lineHeight:1,marginBottom:3}}>{v}</div>
                          <div style={{fontSize:9,color:"#A8A29E",fontWeight:600,letterSpacing:".08em",textTransform:"uppercase"}}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Global */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14,marginTop:M?0:4}}>
              {[["Appels",realCalls],["RDV",rdvList.length],["Taux RDV",taux+"%"],["Taux conv.",tauxConv+"%"]].map(([l,v]) => (
                <div key={l} style={{background:"#FFFFFF",border:"1px solid #EDE9E3",borderRadius:12,padding:"14px 16px"}}>
                  <div style={{fontSize:9,color:"#A8A29E",fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>{l}</div>
                  <div style={{fontSize:24,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#1C1917",letterSpacing:-.8,lineHeight:1}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Bar */}
            {realCalls>0 && (
              <div className="card" style={{padding:"14px 16px",marginBottom:14}}>
                <div style={{fontSize:9,color:"#A8A29E",fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>Répartition</div>
                <div style={{display:"flex",height:3,borderRadius:2,overflow:"hidden",gap:1,marginBottom:10}}>
                  {rdvList.length>0 && <div style={{flex:rdvList.length,background:"#1C1917"}}/>}
                  {pipeline.filter(p=>p.result==="no_answer").length>0 && <div style={{flex:pipeline.filter(p=>p.result==="no_answer").length,background:"#C4B49A"}}/>}
                  {pipeline.filter(p=>p.result==="refused").length>0 && <div style={{flex:pipeline.filter(p=>p.result==="refused").length,background:"#E8E4DC"}}/>}
                </div>
                <div style={{display:"flex",gap:18}}>
                  {[["RDV","#1C1917",rdvList.length],["Pas rép.","#C4B49A",pipeline.filter(p=>p.result==="no_answer").length],["Refus","#E8E4DC",pipeline.filter(p=>p.result==="refused").length]].map(([l,c,v]) => (
                    <div key={l} style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:c,border:"1px solid #EDE9E3"}}/>
                      <span style={{fontSize:11,color:"#A8A29E"}}>{l} <strong style={{color:"#78716C",fontWeight:500}}>{v}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historique */}
            {/* Reset button */}
            <button onClick={()=>setShowReset(true)} style={{width:"100%",background:"none",border:"1px solid #EDE9E3",borderRadius:12,padding:"12px",fontSize:12,color:"#D6D3D1",letterSpacing:".06em",textTransform:"uppercase",marginBottom:20}}>
              Réinitialiser toutes les données
            </button>

            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:9,color:"#A8A29E",fontWeight:600,letterSpacing:".1em",textTransform:"uppercase"}}>Historique · {sessions.length} session{sessions.length>1?"s":""}</div>
              <button onClick={()=>setShowSessions(s=>!s)} style={{background:"#F9F8F6",border:"1px solid #EDE9E3",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:500,color:"#78716C"}}>
                {showSessions?"Masquer":"Voir"}
              </button>
            </div>
            {showSessions && (sessions.length===0
              ? <div className="card" style={{padding:"20px",textAlign:"center",color:"#D6D3D1",fontSize:13}}>Aucune session.</div>
              : sessions.map((s,i) => {
                  const showDate=i===0||sessions[i-1].date!==s.date;
                  return (
                    <div key={s.id}>
                      {showDate && <div style={{fontSize:18,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#1C1917",letterSpacing:-.3,marginBottom:10,marginTop:i>0?16:0,paddingBottom:8,borderBottom:"1px solid #EDE9E3"}}>{s.date}</div>}
                      <div className="card fu" style={{animationDelay:i*.025+"s",padding:"14px 16px",marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:28,height:28,borderRadius:"50%",background:ACOLORS[s.user]||"#1C1917",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              <span style={{fontSize:11,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#FAF9F6",fontStyle:"italic"}}>{ini(s.user)}</span>
                            </div>
                            <div>
                              <div style={{fontWeight:600,fontSize:12}}>{s.user}</div>
                              <div style={{fontSize:10,color:"#A8A29E"}}>{s.time}</div>
                            </div>
                          </div>
                          <div style={{fontSize:18,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#1C1917",letterSpacing:-.5}}>{s.taux}<span style={{fontSize:10,color:"#A8A29E"}}>%</span></div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                          {[["Appels",s.calls],["RDV",s.rdv],["Pas rép.",s.noAnswer],["Refus",s.refused]].map(([l,v]) => (
                            <div key={l} style={{background:"#FAF9F6",borderRadius:8,padding:"8px 4px",textAlign:"center"}}>
                              <div style={{fontSize:16,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:"#1C1917",lineHeight:1,marginBottom:3}}>{v}</div>
                              <div style={{fontSize:8,color:"#A8A29E",fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>{l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>

      {/* Mobile nav */}
      {M && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#FFFFFF",borderTop:"1px solid #EDE9E3",height:70,display:"flex",alignItems:"center",zIndex:100}}>
          {[["home","Accueil"],["prospects","Prospects"],["agenda","Agenda"],["stats","Stats"]].map(([id,label]) => (
            <button key={id} onClick={()=>setScreen(id)} style={{background:"none",border:"none",flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"8px 0"}}>
              <div style={{width:4,height:4,borderRadius:"50%",background:screen===id?"#1C1917":"transparent",transition:"all .2s"}}/>
              <span style={{fontSize:10,fontWeight:screen===id?600:400,color:screen===id?"#1C1917":"#C4B49A",letterSpacing:".08em",textTransform:"uppercase"}}>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
