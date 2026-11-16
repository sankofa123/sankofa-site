/* Sankofa · pont Supabase pour la version web (remplace claude.use("db"/"user")).
   Identité anonyme Supabase (aucun compte à créer), données en table "docs". */
(function(){
  var URL_ = "https://crcxgbzenljnolnuriln.supabase.co";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyY3hnYnplbmxqbm9sbnVyaWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzOTQ1NzQsImV4cCI6MjEwOTk3MDU3NH0.BQ-g7ybSvHckaWTzCpyjo_wVdCvSIZ1UOKXIO-uBBdw";
  window.__SBKEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyY3hnYnplbmxqbm9sbnVyaWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzOTQ1NzQsImV4cCI6MjEwOTk3MDU3NH0.BQ-g7ybSvHckaWTzCpyjo_wVdCvSIZ1UOKXIO-uBBdw";
  var SK = "sankofa-sb", sess = null, ready = null, LOGS = [];
  function note(m){ LOGS.push(new Date().toISOString().slice(11,19)+" "+m); }
  function load(){ try{ return JSON.parse(localStorage.getItem(SK)||"null"); }catch(e){ return null; } }
  function keep(s){ sess = s; try{ localStorage.setItem(SK, JSON.stringify(s)); }catch(e){} }
  var SITE = location.origin + location.pathname;
  function claimsOf(at){ try{ var p = at.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"); return JSON.parse(decodeURIComponent(escape(atob(p + "===".slice((p.length+3)%4))))); }catch(e){ return {}; } }
  var AUTHMSG = null;
  /* Lien de parrainage : sankofa-atlas.org/?p=xxxxxxxx */
  (function(){ try{ var p = new URLSearchParams(location.search).get("p"); if(p && /^[0-9a-f]{8}$/i.test(p) && !localStorage.getItem("skf-parrain")) localStorage.setItem("skf-parrain", p.toLowerCase()); }catch(e){} })();
  /* Retour d'un lien reçu par e-mail : la session arrive dans l'ancre (#access_token=…) */
  (function(){
    var h = location.hash.slice(1); if(!/(access_token|error_description|message)=/.test(h)) return;
    var q = {}; h.split("&").forEach(function(kv){ var i = kv.indexOf("="); if(i>0) q[kv.slice(0,i)] = decodeURIComponent(kv.slice(i+1).replace(/\+/g," ")); });
    if(q.access_token){
      var c = claimsOf(q.access_token);
      keep({at:q.access_token, rt:q.refresh_token, exp:Date.now()+((+q.expires_in||3600)-60)*1000, uid:c.sub});
      AUTHMSG = q.type==="email_change" ? "linked" : "signedin";
    } else if(q.message) AUTHMSG = "confirmed";
    else AUTHMSG = "error:"+(q.error_code||q.error||"");
    try{ history.replaceState(null, "", location.pathname + location.search + "#passeport"); }catch(e){ location.hash = "passeport"; }
  })();
  function withTimeout(p, ms){ return Promise.race([p, new Promise(function(_,r){ setTimeout(function(){ r(new Error("timeout")); }, ms); })]); }
  async function authCall(path, body){
    var r = await withTimeout(fetch(URL_+"/auth/v1/"+path, {method:"POST", headers:{apikey:KEY, "Content-Type":"application/json"}, body:JSON.stringify(body)}), 8000);
    if(!r.ok){ var tx = ""; try{ tx = (await r.text()).slice(0,200); }catch(e){} note("auth "+path.split("?")[0]+" -> "+r.status+" "+tx); throw new Error("auth "+r.status); }
    note("auth "+path.split("?")[0]+" -> ok");
    var j = await r.json();
    return {at:j.access_token, rt:j.refresh_token, exp:Date.now()+((j.expires_in||3600)-60)*1000, uid:j.user&&j.user.id};
  }
  async function session(){
    if(sess && sess.exp > Date.now()) return sess;
    var s = sess || load();
    if(s && s.exp > Date.now()){ sess = s; return s; }
    if(s && s.rt){ try{ var n = await authCall("token?grant_type=refresh_token", {refresh_token:s.rt}); n.uid = n.uid||s.uid; keep(n); return n; }catch(e){} }
    var a = await authCall("signup", {data:{}}); keep(a); return a;
  }
  function init(){ return ready || (ready = session()); }
  async function rest(method, qs, body, prefer){
    var s = await session();
    var h = {apikey:KEY, Authorization:"Bearer "+s.at, "Content-Type":"application/json"};
    if(prefer) h.Prefer = prefer;
    var r = await withTimeout(fetch(URL_+"/rest/v1/docs"+qs, {method:method, headers:h, body:body?JSON.stringify(body):undefined}), 10000);
    if(!r.ok){ var tx = ""; try{ tx = (await r.text()).slice(0,200); }catch(e){} note("db "+method+" -> "+r.status+" "+tx); throw new Error("db "+r.status); }
    if(method!=="GET") note("db "+method+" -> ok");
    return method==="GET" ? r.json() : null;
  }
  function split(path){ var i = path.lastIndexOf("/"); return [path.slice(0,i), path.slice(i+1)]; }
  var enc = encodeURIComponent;
  function snapOf(id, row){ return {id:id, exists:!!row, data:function(){ return row ? row.data : undefined; }}; }
  function docRef(coll, id){
    var q = "?coll=eq."+enc(coll)+"&id=eq."+enc(id);
    return {
      id:id,
      get: async function(){ var rows = await rest("GET", q+"&select=data"); return snapOf(id, rows[0]); },
      set: async function(data){ await rest("POST", "?on_conflict=coll,id", {coll:coll, id:id, owner:sess.uid, data:data, updated_at:new Date().toISOString()}, "resolution=merge-duplicates,return=minimal"); },
      delete: async function(){ await rest("DELETE", q, null, "return=minimal"); }
    };
  }
  function query(coll, filters, order, lim){
    return {
      where: function(f, op, v){ if(op!=="==") throw new Error("op"); return query(coll, filters.concat([[f,v]]), order, lim); },
      orderBy: function(f, dir){ return query(coll, filters, [f, dir||"asc"], lim); },
      limit: function(n){ return query(coll, filters, order, n); },
      doc: function(id){ return docRef(coll, id); },
      get: async function(){
        var q = "?coll=eq."+enc(coll)+"&select=id,data";
        filters.forEach(function(f){ q += "&data->>"+enc(f[0])+"=eq."+enc(String(f[1])); });
        if(order) q += "&order=data->"+enc(order[0])+"."+(order[1]==="desc"?"desc":"asc");
        q += "&limit="+(lim||1000);
        var rows = await rest("GET", q);
        var docs = rows.map(function(r){ return snapOf(r.id, r); });
        return {docs:docs, empty:!docs.length, size:docs.length};
      }
    };
  }
  var db = {
    doc: function(path){ var p = split(path); return docRef(p[0], p[1]); },
    collection: function(name){ return query(name, [], null, 0); }
  };
  var user = {
    id: async function(){ try{ var s = await init(); return s.uid; }catch(e){ return null; } },
    profiles: async function(){ return {}; }
  };
  async function authUser(method, path, body){
    var s = await session();
    var r = await withTimeout(fetch(URL_+"/auth/v1/"+path, {method:method, headers:{apikey:KEY, Authorization:"Bearer "+s.at, "Content-Type":"application/json"}, body:body?JSON.stringify(body):undefined}), 10000);
    var tx = ""; try{ tx = await r.text(); }catch(e){}
    note("auth "+path.split("?")[0]+" -> "+r.status+(r.ok?"":" "+tx.slice(0,160)));
    var j = {}; try{ j = JSON.parse(tx||"{}"); }catch(e){}
    return {ok:r.ok, status:r.status, code:j.error_code||j.code||"", msg:j.msg||j.message||""};
  }
  var redir = "?redirect_to="+encodeURIComponent(SITE);
  window.SB = {
    message: function(){ var m = AUTHMSG; AUTHMSG = null; return m; },
    account: async function(){
      try{
        var s = await init();
        var r = await withTimeout(fetch(URL_+"/auth/v1/user", {headers:{apikey:KEY, Authorization:"Bearer "+s.at}}), 8000);
        if(r.ok){ var u = await r.json(); if(u.email && (u.email_confirmed_at || u.confirmed_at)) return {email:u.email}; if(u.new_email) return {pending:u.new_email}; return null; }
      }catch(e){}
      try{ var c = claimsOf(sess.at); return c.email ? {email:c.email} : null; }catch(e){ return null; }
    },
    /* Créer un compte : on rattache l'adresse au passeport anonyme actuel (même identifiant, rien n'est perdu) */
    link: async function(email){ return authUser("PUT", "user"+redir, {email:email}); },
    /* Se connecter sur un autre appareil : lien magique */
    magic: async function(email){
      var r = await withTimeout(fetch(URL_+"/auth/v1/otp"+redir, {method:"POST", headers:{apikey:KEY, "Content-Type":"application/json"}, body:JSON.stringify({email:email, create_user:false})}), 10000);
      var tx = ""; try{ tx = await r.text(); }catch(e){} note("auth otp -> "+r.status+(r.ok?"":" "+tx.slice(0,160)));
      var j = {}; try{ j = JSON.parse(tx||"{}"); }catch(e){}
      return {ok:r.ok, status:r.status, code:j.error_code||j.code||"", msg:j.msg||j.message||""};
    },
    rpc: async function(name, args){
      var s = await init();
      var r = await withTimeout(fetch(URL_+"/rest/v1/rpc/"+name, {method:"POST", headers:{apikey:KEY, Authorization:"Bearer "+s.at, "Content-Type":"application/json"}, body:JSON.stringify(args||{})}), 10000);
      var tx = ""; try{ tx = await r.text(); }catch(e){}
      var j = null; try{ j = JSON.parse(tx||"null"); }catch(e){}
      if(!r.ok){ var m = (j && (j.message||j.hint)) || ("erreur "+r.status); var er = new Error(m); er.status = r.status; throw er; }
      return j;
    },
    launch: async function(){
      var s = await init();
      var r = await withTimeout(fetch(URL_+"/rest/v1/rpc/sankofa_launch", {method:"POST", headers:{apikey:KEY, Authorization:"Bearer "+s.at, "Content-Type":"application/json"}, body:"{}"}), 9000);
      if(!r.ok) throw new Error("launch "+r.status);
      return r.json();
    },
    signOut: async function(){ try{ await authUser("POST","logout"); }catch(e){} sess = null; ready = null; try{ localStorage.removeItem(SK); }catch(e){} }
  };

  async function pub(path, body){
    var r = await withTimeout(fetch(URL_+"/auth/v1/"+path, {method:"POST", headers:{apikey:KEY, Authorization:"Bearer "+KEY, "Content-Type":"application/json"}, body:JSON.stringify(body)}), 10000);
    var tx = ""; try{ tx = await r.text(); }catch(e){}
    note("auth "+path.split("?")[0]+" -> "+r.status+(r.ok?"":" "+tx.slice(0,160)));
    var j = {}; try{ j = JSON.parse(tx||"{}"); }catch(e){}
    return {ok:r.ok, status:r.status, code:j.error_code||j.code||"", msg:j.msg||j.message||j.error_description||"", data:j};
  }
  function takeSession(j){
    if(!j || !j.access_token) return false;
    keep({at:j.access_token, rt:j.refresh_token, exp:Date.now()+((j.expires_in||3600)-60)*1000, uid:(j.user&&j.user.id)||claimsOf(j.access_token).sub});
    ready = Promise.resolve(sess); return true;
  }
  window.SB_PW = {
    signUp: async function(email, pw){
      var par = null; try{ par = localStorage.getItem("skf-parrain"); }catch(e){}
      var body = {email:email, password:pw}; if(par && /^[0-9a-f]{8}$/.test(par)) body.data = {parrain:par};
      var r = await pub("signup", body);
      if(r.ok && !takeSession(r.data)) return {ok:false, code:"confirm_required"};
      return r;
    },
    signIn: async function(email, pw){
      var r = await pub("token?grant_type=password", {email:email, password:pw});
      if(r.ok) takeSession(r.data);
      return r;
    },
    recover: async function(email){ return pub("recover", {email:email}); },
    reset: async function(email, code, pw){
      var r = await pub("verify", {type:"recovery", email:email, token:code});
      if(!r.ok || !takeSession(r.data)) return r.ok ? {ok:false, code:"no_session"} : r;
      return authUser("PUT", "user", {password:pw});
    },
    setPassword: async function(pw){ return authUser("PUT", "user", {password:pw}); }
  };
  window.SB_DIAG = async function(){
    var out = ["Version : supabase-1", "Navigateur : "+navigator.userAgent.slice(0,80)];
    try{ var s = await session(); out.push("Connexion anonyme : OK ("+String(s.uid).slice(0,8)+"…)"); }
    catch(e){ out.push("Connexion anonyme : ÉCHEC ("+(e&&e.message)+")"); }
    try{ var rows = await rest("GET","?coll=eq.actu&select=id&limit=5"); out.push("Lecture actu : OK ("+rows.length+" lignes)"); }
    catch(e){ out.push("Lecture actu : ÉCHEC ("+(e&&e.message)+")"); }
    try{ if(sess){ await docRef("data/users/"+sess.uid,"diag").set({t:Date.now()}); out.push("Écriture : OK"); } }
    catch(e){ out.push("Écriture : ÉCHEC ("+(e&&e.message)+")"); }
    return out.concat(["--- détails ---"]).concat(LOGS);
  };
  if(/[?&]diag/.test(location.search)) window.addEventListener("load", function(){ setTimeout(async function(){
    var d = document.createElement("pre"); d.style.cssText = "position:fixed;inset:20px;z-index:99999;background:#fff;color:#111;font:14px/1.5 monospace;padding:24px;border:2px solid #111;border-radius:12px;overflow:auto;white-space:pre-wrap";
    d.textContent = "Diagnostic Sankofa…"; document.body.appendChild(d);
    d.textContent = (await window.SB_DIAG()).join("\n");
  }, 1500); });
  window.claude = { use: async function(cap){
    if(cap==="db"){ try{ await init(); return db; }catch(e){ return null; } }
    if(cap==="user"){ try{ await init(); return user; }catch(e){ return null; } }
    return null;
  }};
})();
/* Nouvelle version en ligne : on recharge une fois, automatiquement */
(function(){
  if(!("serviceWorker" in navigator)) return;
  var had = !!navigator.serviceWorker.controller, done = false;
  navigator.serviceWorker.addEventListener("controllerchange", function(){ if(had && !done){ done = true; location.reload(); } });
})();
/* Compteur de visites : pages vues, sessions et quelques événements. Aucun nom, aucune adresse IP. */
(function(){
  var URLV = "https://crcxgbzenljnolnuriln.supabase.co", last = "", lastT = 0, first = true;
  function rid(){ return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function vid(){ try{ var o = JSON.parse(localStorage.getItem("skf-vid") || "null");
      if(!o || Date.now() - o.t > 395*864e5){ o = {v:rid(), t:Date.now()}; localStorage.setItem("skf-vid", JSON.stringify(o)); } return o.v; }catch(e){ return null; } }
  function sid(){ try{ var o = JSON.parse(sessionStorage.getItem("skf-sid") || "null");
      if(!o || Date.now() - o.t > 30*60e3) o = {v:rid(), t:0}; o.t = Date.now(); sessionStorage.setItem("skf-sid", JSON.stringify(o)); return o.v; }catch(e){ return null; } }
  function scr(){ var w = Math.min(screen.width || innerWidth, screen.height || innerHeight, innerWidth); return w < 600 ? "mobile" : w < 1024 ? "tablette" : "ordinateur"; }
  function dev(){ var u = navigator.userAgent, os = /iPhone|iPad|iPod/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1) ? "iOS" : /Android/.test(u) ? "Android" : /Windows/.test(u) ? "Windows" : /Mac OS X/.test(u) ? "macOS" : /CrOS/.test(u) ? "ChromeOS" : /Linux/.test(u) ? "Linux" : "Autre";
    var br = /Instagram/.test(u) ? "Instagram" : /musical_ly|TikTok|BytedanceWebview/.test(u) ? "TikTok" : /Snapchat/.test(u) ? "Snapchat" : /FBAN|FBAV/.test(u) ? "Facebook" : /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera" : /SamsungBrowser/.test(u) ? "Samsung" : /Firefox|FxiOS/.test(u) ? "Firefox" : /Chrome|CriOS/.test(u) ? "Chrome" : /Safari/.test(u) ? "Safari" : "Autre";
    return os + " · " + br; }
  function isApp(){ try{ return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }catch(e){ return false; } }
  function theme(){ try{ var c = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number); return (c[0]*.3 + c[1]*.59 + c[2]*.11) > 128 ? "clair" : "sombre"; }catch(e){ return null; } }
  /* temps passé et lecture (part de la page parcourue), envoyés quand on quitte la page */
  var cur = null;
  function startPage(p){ cur = {p:p, t:Date.now(), pct:0}; }
  function scrollPct(){ if(!cur) return; var h = document.documentElement.scrollHeight - innerHeight; var x = h > 40 ? Math.round(100 * scrollY / h) : 100; if(x > cur.pct) cur.pct = Math.min(100, x); }
  var spT = 0; addEventListener("scroll", function(){ if(spT) return; spT = setTimeout(function(){ spT = 0; scrollPct(); }, 400); }, {passive:true});
  function endPage(){ if(!cur) return; var sec = Math.round((Date.now() - cur.t) / 1000); var c = cur; cur = null;
    if(sec >= 2) send({path:c.p.slice(0,110), ev:"time", meta:Math.min(sec, 1800) + "|" + c.pct}); }
  document.addEventListener("visibilitychange", function(){ if(document.visibilityState === "hidden") endPage(); else if(!cur) startPage(page()); });
  addEventListener("pagehide", endPage);
  function page(){ var h = (location.hash || "").replace(/^#/, "").split("?")[0]; return h || "globe"; }
  async function send(row){
    try{
      var db = await window.claude.use("db"); if(!db) return;
      var s = JSON.parse(localStorage.getItem("sankofa-sb") || "null"); if(!s || !s.at) return;
      var tz = ""; try{ tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; }catch(e){}
      row.vid = vid(); row.sid = sid(); row.scr = scr(); row.tz = tz.slice(0,58);
      row.dev = dev(); row.app = isApp(); row.th = theme();
      row.mobile = row.scr === "mobile"; row.lang = (document.documentElement.lang || "fr").slice(0,7);
      fetch(URLV + "/rest/v1/visits", {method:"POST", keepalive:true, headers:{apikey:window.__SBKEY, Authorization:"Bearer " + s.at, "Content-Type":"application/json", Prefer:"return=minimal"}, body:JSON.stringify(row)}).catch(function(){});
    }catch(e){}
  }
  function track(){
    var p = page(), now = Date.now();
    if(!cur || cur.p !== p){ endPage(); startPage(p); setTimeout(scrollPct, 800); }
    if(p === last && now - lastT < 30000) return; last = p; lastT = now;
    var ref = ""; if(first){ try{ var u = new URL(document.referrer); if(u.host && u.host !== location.host) ref = u.host.replace(/^www\./, ""); }catch(e){}
      try{ var q = new URLSearchParams(location.search), src = q.get("utm_source") || q.get("ref") || q.get("src") || (q.get("p") ? "parrainage" : ""); if(src) ref = src.toLowerCase(); }catch(e){} first = false; }
    send({path:p.slice(0,110), ref:ref.slice(0,110), ev:"view"});
  }
  window.skfEvent = function(ev, meta){ send({path:page().slice(0,110), ev:String(ev).slice(0,18), meta:meta ? String(meta).slice(0,78) : null}); };
  /* quelques gestes utiles : partage, calque du globe, installation, erreurs */
  var nErr = 0;
  addEventListener("error", function(e){ if(nErr++ >= 3) return; var m = String((e && e.message) || "erreur").slice(0, 60), f = String((e && e.filename) || "").split("/").pop().split("?")[0].slice(0, 14);
    window.skfEvent("error", m + (f ? " (" + f + ":" + (e.lineno||0) + ")" : "")); });
  addEventListener("appinstalled", function(){ window.skfEvent("install"); });
  addEventListener("load", function(){ setTimeout(function(){
    if(typeof window.shareCard === "function" && !window.shareCard._skf){ var o = window.shareCard; window.shareCard = function(kind, id){ try{ window.skfEvent("share", String(kind) + ":" + String(id||"")); }catch(e){} return o.apply(this, arguments); }; window.shareCard._skf = 1; }
    if(typeof window.setLayer === "function" && !window.setLayer._skf){ var l = window.setLayer, lt = 0; window.setLayer = function(id){ var r = l.apply(this, arguments); var n = Date.now(); if(n - lt > 1500 && id){ lt = n; try{ window.skfEvent("layer", String(id)); }catch(e){} } return r; }; window.setLayer._skf = 1; }
  }, 2500); });
  addEventListener("load", function(){ setTimeout(track, 1500); });
  addEventListener("hashchange", function(){ setTimeout(track, 400); });
})();
