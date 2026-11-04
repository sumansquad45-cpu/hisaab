(function(){
"use strict";
const LS_KEY="biharswad-hisaab-v1";
const CH={amazon_fba:"Amazon FBA",easy_ship:"Easy Ship",website:"वेबसाइट"};
const DEFAULT_SETTINGS={adPer:60,nextPrice:289,lastBackup:0,products:[
  {id:"p250",name:"ठेकुआ 250g (Pack of 1)",code:"250g, सिंगल, single, पैक ऑफ 1, pack of 1",price:260,raw:57,pouch:18,box:10,tape:2,courier:68,fee:0},
  {id:"p2",name:"ठेकुआ Pack of 2 (2×250g)",code:"पैक ऑफ 2, pack of 2, 2 वाला, डबल, double",price:449,raw:114,pouch:36,box:10,tape:2,courier:68,fee:0},
  {id:"p3",name:"ठेकुआ Pack of 3 (3×250g)",code:"पैक ऑफ 3, pack of 3, 3 वाला",price:699,raw:171,pouch:54,box:10,tape:2,courier:68,fee:0}
 ],loans:[]};
const clone=o=>JSON.parse(JSON.stringify(o));
let S={settings:clone(DEFAULT_SETTINGS),months:{}};

/* ---------- helpers ---------- */
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>{const n=parseFloat(v);return isFinite(n)?n:0};
const rs=n=>(n<0?"−":"")+"₹"+Math.abs(Math.round(n)).toLocaleString("en-IN");
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const today=()=>ymd(new Date());
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const MONTHS=["जनवरी","फ़रवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];
const niceDate=s=>{const [y,m,d]=s.split("-");return (+d)+" "+MONTHS[+m-1]+" "+y};
const niceMonth=s=>{const [y,m]=s.split("-");return MONTHS[+m-1]+" "+y};
const pcost=p=>num(p.raw)+num(p.pouch)+num(p.box)+num(p.tape)+num(p.courier)+num(p.fee);
let toastT;
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),2600)}

/* ---------- storage (सिर्फ़ फोन में) ---------- */
function loadLocal(){
  try{const r=localStorage.getItem(LS_KEY);if(r){const d=JSON.parse(r);if(d&&d.settings){S=d;S.months=S.months||{};}}}catch(e){}
  S.settings=Object.assign(clone(DEFAULT_SETTINGS),S.settings);
  S.settings.products.forEach(p=>{if(p.code==null)p.code=""});
}
function saveLocal(){try{localStorage.setItem(LS_KEY,JSON.stringify(S))}catch(e){toast("फोन में जगह नहीं बची, बैकअप लेकर पुराना डेटा हटाएँ")}}
function saveSettings(){saveLocal();render()}
function month(k){if(!S.months[k])S.months[k]={sales:[],exp:[]};return S.months[k]}
function saveMonth(){saveLocal();render()}

/* ---------- calculations ---------- */
function stats(sales,exp){
  let orders=0,rev=0,cost=0,adsEst=0;
  sales.forEach(s=>{orders+=s.qty;rev+=s.qty*s.price;cost+=s.qty*s.cost;adsEst+=s.qty*s.adPer});
  let adsDep=0,adsReal=0,other=0;
  exp.forEach(e=>{if(e.kind==="ads")adsDep+=e.amount;else if(e.kind==="adspend")adsReal+=e.amount;else other+=e.amount});
  const adsUsed=adsReal>0?adsReal:adsEst;
  return {orders,rev,cost,adsEst,adsDep,adsReal,adsUsed,other,profit:rev-cost-adsUsed-other,profitDep:rev-cost-adsDep-other};
}
function dayStats(d){const m=S.months[d.slice(0,7)]||{sales:[],exp:[]};return stats(m.sales.filter(s=>s.date===d),m.exp.filter(e=>e.date===d))}
function monthStats(k){const m=S.months[k]||{sales:[],exp:[]};return stats(m.sales,m.exp)}
function wallet(){let dep=0,used=0;Object.keys(S.months).forEach(k=>{const m=S.months[k];m.exp.forEach(e=>{if(e.kind==="ads")dep+=e.amount});used+=stats(m.sales,m.exp).adsUsed});return {dep,used,left:dep-used}}

/* ---------- entries ---------- */
function addSale(date,pid,qty,channel){
  const p=S.settings.products.find(x=>x.id===pid);if(!p||!(qty>0))return false;
  const k=date.slice(0,7);
  month(k).sales.push({id:uid(),date,pid,name:p.name,qty:Math.round(qty),price:num(p.price),cost:pcost(p),adPer:num(S.settings.adPer),channel:CH[channel]?channel:"amazon_fba",at:Date.now()});
  return k;
}
function addExp(date,kind,amount,note){
  if(!(amount>0))return false;const k=date.slice(0,7);
  month(k).exp.push({id:uid(),date,kind:["ads","adspend"].includes(kind)?kind:"other",amount:Math.round(amount),note:String(note||"").slice(0,120),at:Date.now()});
  return k;
}
function delEntry(k,id){const m=S.months[k];if(!m)return;m.sales=m.sales.filter(s=>s.id!==id);m.exp=m.exp.filter(e=>e.id!==id);saveMonth()}

/* ---------- render ---------- */
function tile(k,v,cls){return `<div class="tile ${cls||""}"><span class="k">${k}</span><span class="v">${v}</span></div>`}
function render(){
  $("hdrDate").textContent=niceDate(today());
  renderProducts();renderToday();renderMonth();renderLoans();renderSetup();
}
function renderProducts(){
  const sel=$("sProd"),cur=sel.value;
  sel.innerHTML=S.settings.products.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ₹${num(p.price)}</option>`).join("");
  if(cur&&S.settings.products.some(p=>p.id===cur))sel.value=cur;
}
function renderToday(){
  const d=$("viewDate").value||today();
  const st=dayStats(d);const isToday=d===today();
  $("todayTiles").innerHTML=tile(isToday?"आज ऑर्डर":"ऑर्डर",st.orders)+tile("बिक्री",rs(st.rev))+tile("मुनाफ़ा*",`<span class="${st.profit<0?"neg":""}">${rs(st.profit)}</span>`);
  $("dayTitle").textContent=isToday?"आज की एंट्री":niceDate(d)+" की एंट्री";
  const k=d.slice(0,7),m=S.months[k]||{sales:[],exp:[]};
  const rows=[...m.sales.filter(s=>s.date===d).map(s=>({t:"s",o:s})),...m.exp.filter(e=>e.date===d).map(e=>({t:"e",o:e}))].sort((a,b)=>b.o.at-a.o.at);
  $("dayList").innerHTML=rows.length?rows.map(r=>{
    if(r.t==="s"){const s=r.o;return `<div class="item"><div class="main"><div class="t">${esc(s.name)} × ${s.qty}</div><div class="s"><span class="tag">${esc(CH[s.channel]||s.channel)}</span>₹${s.price} का · लागत ₹${s.cost}+Ads ₹${s.adPer}</div></div><span class="amt">${rs(s.qty*s.price)}</span><button class="del" data-act="del" data-k="${k}" data-id="${s.id}">हटाएँ</button></div>`}
    const e=r.o;const lab=e.kind==="ads"?"Ads वॉलेट में डाला":e.kind==="adspend"?"Ads का असली खर्च":"खर्च";return `<div class="item"><div class="main"><div class="t">${lab}${e.note?" · "+esc(e.note):""}</div><div class="s"><span class="tag ${e.kind==="other"?"bad":"ads"}">${e.kind==="other"?"खर्च":"Ads"}</span></div></div><span class="amt neg">${rs(-e.amount)}</span><button class="del" data-act="del" data-k="${k}" data-id="${e.id}">हटाएँ</button></div>`;
  }).join("")+`<p class="note">*मुनाफ़ा = बिक्री − पैक की लागत − Ads − दूसरे खर्च (Ads का असली खर्च डाला हो तो वही, वरना ₹${num(S.settings.adPer)}/ऑर्डर)</p>`:`<p class="empty">इस दिन की कोई एंट्री नहीं है। ऊपर से बिक्री जोड़ें।</p>`;
}
function renderMonth(){
  const k=$("mSel").value||today().slice(0,7);
  const st=monthStats(k);
  $("mTiles").innerHTML=tile("शुद्ध मुनाफ़ा · "+niceMonth(k),rs(st.profit),"hero"+(st.profit<0?" loss":""))+tile("ऑर्डर",st.orders)+tile("बिक्री",rs(st.rev))+tile("प्रति ऑर्डर",st.orders?rs(st.profit/st.orders):"—");
  $("mMath").innerHTML=`<span>कुल बिक्री</span><span>${rs(st.rev)}</span><span>पैक की लागत (माल, पैकिंग, कूरियर)</span><span class="neg">${rs(-st.cost)}</span><span>${st.adsReal>0?"Ads (Amazon का असली खर्च)":"Ads (₹"+num(S.settings.adPer)+"/ऑर्डर अंदाज़ा)"}</span><span class="neg">${rs(-st.adsUsed)}</span><span>दूसरे खर्च</span><span class="neg">${rs(-st.other)}</span><span class="tot">शुद्ध मुनाफ़ा</span><span class="tot ${st.profit<0?"neg":"pos"}">${rs(st.profit)}</span>`;
  const w=wallet();let note="";
  if(st.adsReal>0&&st.orders)note+=`Ads का असली खर्च ${rs(st.adsReal)} = ${rs(st.adsReal/st.orders)} प्रति ऑर्डर (आपका अंदाज़ा ₹${num(S.settings.adPer)})। `;
  if(st.adsDep>0&&!st.adsReal)note+=`इस महीने Ads में ${rs(st.adsDep)} डाले। अगर ये पूरा पैसा इसी महीने खर्च मानें तो मुनाफ़ा ${rs(st.profitDep)} होगा`+(st.orders?`, और असली Ads खर्च ${rs(st.adsDep/st.orders)} प्रति ऑर्डर।`:"।")+" ";
  if(w.dep>0)note+=`Ads वॉलेट: अब तक ${rs(w.dep)} डाले, ${rs(w.used)} खर्च हुए, यानी लगभग ${rs(w.left)} बचे होने चाहिए। Amazon में असली बैलेंस से मिला लें।`;
  else if(!st.adsReal) note+="Ads में डाला पैसा \"आज\" वाले पेज से जोड़ें, तो यहाँ बचा बैलेंस दिखेगा।";
  $("mAdsNote").textContent=note;
  const [y,mo]=k.split("-").map(Number);const days=new Date(y,mo,0).getDate();
  const m=S.months[k]||{sales:[],exp:[]};const per=new Array(days).fill(0);
  m.sales.forEach(s=>{const d=+s.date.slice(8,10);if(d>=1&&d<=days)per[d-1]+=s.qty});
  const mx=Math.max(...per);const td=today();
  $("mBars").innerHTML=(mx?`<span class="maxl">${mx}</span>`:"")+per.map((v,i)=>{const ds=k+"-"+pad(i+1);return `<div class="bar ${v?"":"zero"} ${ds===td?"today":""}" style="height:${mx?Math.max(4,v/mx*100):0}%" title="${i+1}: ${v} ऑर्डर"></div>`}).join("");
  $("mAxis").innerHTML=`<span>1</span><span>${Math.ceil(days/2)}</span><span>${days}</span>`;
  const by={};m.sales.forEach(s=>{const b=by[s.name]||(by[s.name]={q:0,r:0,p:0});b.q+=s.qty;b.r+=s.qty*s.price;b.p+=s.qty*(s.price-s.cost)});
  const names=Object.keys(by);
  $("mProd").innerHTML=names.length?`<table><thead><tr><th>पैक</th><th>बिके</th><th>बिक्री</th><th>बचत (Ads से पहले)</th></tr></thead><tbody>${names.map(n=>`<tr><td>${esc(n)}</td><td>${by[n].q}</td><td>${rs(by[n].r)}</td><td class="${by[n].p<0?"neg":""}">${rs(by[n].p)}</td></tr>`).join("")}</tbody></table>`:`<p class="empty">इस महीने अभी कोई बिक्री नहीं जुड़ी।</p>`;
}
function renderLoans(){
  const L=[...S.settings.loans].sort((a,b)=>b.rate-a.rate);
  const tot=L.reduce((a,l)=>a+num(l.amount),0),emi=L.reduce((a,l)=>a+num(l.emi),0),int=L.reduce((a,l)=>a+num(l.amount)*num(l.rate)/1200,0);
  $("lTiles").innerHTML=tile("कुल बकाया",rs(tot))+tile("कुल EMI / महीना",rs(emi))+tile("ब्याज / महीना (लगभग)",rs(int))+tile("लोन",L.length);
  $("lList").innerHTML=L.length?L.map((l,i)=>`<div class="item ${i===0&&L.length>1?"top":""}"><div class="main"><div class="t">${esc(l.name)}</div><div class="s">${num(l.rate)}% सालाना · EMI ${rs(num(l.emi))} · ब्याज लगभग ${rs(num(l.amount)*num(l.rate)/1200)}/महीना${i===0&&L.length>1?' · <span class="tag bad">सबसे महँगा</span>':""}</div></div><span class="amt">${rs(num(l.amount))}</span><button class="del" data-act="delLoan" data-id="${l.id}">हटाएँ</button></div>`).join(""):`<p class="empty">अभी कोई लोन नहीं जोड़ा। नीचे से जोड़ें, फिर "महीना" पेज के सुझाव में ये भी शामिल होंगे।</p>`;
}
function renderSetup(){
  if(document.activeElement!==$("adPer"))$("adPer").value=num(S.settings.adPer);
  if(document.activeElement!==$("nextPrice"))$("nextPrice").value=num(S.settings.nextPrice);
  const ap=num(S.settings.adPer);
  const f=(p,key,lab)=>`<label for="${p.id}-${key}">${lab}<input type="number" inputmode="decimal" id="${p.id}-${key}" data-pid="${p.id}" data-key="${key}" value="${esc(p[key])}"></label>`;
  const box=$("prodList");
  if(box.contains(document.activeElement))return;
  box.innerHTML=S.settings.products.map(p=>{const c=pcost(p);const o=num(p.price)-c,a=o-ap;return `<div class="card prod">
    <div class="row">
      <label class="f" for="${p.id}-name" style="flex:2 1 160px">पैक का नाम<input type="text" id="${p.id}-name" data-pid="${p.id}" data-key="name" value="${esc(p.name)}"></label>
      <label class="f" for="${p.id}-code">बोलने वाला नाम<input type="text" id="${p.id}-code" data-pid="${p.id}" data-key="code" value="${esc(p.code)}" placeholder="जैसे: 250g"></label>
    </div>
    <div class="grid3">${f(p,"price","बिक्री दाम ₹")}${f(p,"raw","कच्चा माल ₹")}${f(p,"pouch","पाउच ₹")}${f(p,"box","बॉक्स ₹")}${f(p,"tape","टेप/लेबल ₹")}${f(p,"courier","कूरियर/डिलीवरी ₹")}${f(p,"fee","Amazon कमीशन ₹")}</div>
    <div class="math"><span>लागत (बिना Ads)</span><span>${rs(c)}</span><span>Ads के साथ लागत</span><span>${rs(c+ap)}</span><span>मुनाफ़ा, ऑर्गेनिक ऑर्डर</span><span class="${o<0?"neg":"pos"}">${rs(o)}</span><span class="tot">मुनाफ़ा, Ads वाला ऑर्डर</span><span class="tot ${a<0?"neg":"pos"}">${rs(a)}</span></div>
    <button class="ghost" data-act="recalc" data-id="${p.id}" style="align-self:flex-start">इस पैक की पुरानी एंट्री भी इसी लागत से अपडेट करें</button>
    ${S.settings.products.length>1?`<button class="del" data-act="delProd" data-id="${p.id}" style="align-self:flex-start">ये पैक हटाएँ</button>`:""}
  </div>`}).join("");
  const lb=num(S.settings.lastBackup);
  $("storeNote").textContent="डेटा सिर्फ़ इसी फोन में है, कहीं और नहीं जाता। फोन खो जाए या ऐप हट जाए तो डेटा भी जाएगा, इसलिए हफ़्ते में एक बार बैकअप फ़ाइल डाउनलोड करके Google Drive या WhatsApp पर खुद को भेज दें। "+(lb?"आख़िरी बैकअप: "+niceDate(ymd(new Date(lb)))+"।":"अभी तक कोई बैकअप नहीं लिया।");
}

/* ---------- report ---------- */
function report(k){
  const st=monthStats(k),w=wallet();
  const m=S.months[k]||{sales:[],exp:[]};
  const by={};m.sales.forEach(s=>{const b=by[s.name]||(by[s.name]={q:0,r:0});b.q+=s.qty;b.r+=s.qty*s.price});
  let t=`Bihar Swad — ${niceMonth(k)} का हिसाब\n`;
  t+=`ऑर्डर: ${st.orders}\nबिक्री: ${rs(st.rev)}\nपैक की लागत: ${rs(st.cost)}\nAds खर्च${st.adsReal>0?" (Amazon असली)":" (₹"+num(S.settings.adPer)+"/ऑर्डर अंदाज़ा)"}: ${rs(st.adsUsed)}\nइस महीने Ads वॉलेट में डाले: ${rs(st.adsDep)}\nदूसरे खर्च: ${rs(st.other)}\nशुद्ध मुनाफ़ा: ${rs(st.profit)}\n`;
  t+=`Ads वॉलेट (अंदाज़ा): डाले ${rs(w.dep)}, लगे ${rs(w.used)}, बचे ${rs(w.left)}\n`;
  Object.keys(by).forEach(n=>{t+=`- ${n}: ${by[n].q} बिके, ${rs(by[n].r)}\n`});
  t+=`\nअभी के पैक:\n`;S.settings.products.forEach(p=>{t+=`- ${p.name}: दाम ₹${num(p.price)}, लागत बिना Ads ₹${pcost(p)} (माल ${num(p.raw)}, पाउच ${num(p.pouch)}, बॉक्स ${num(p.box)}, टेप ${num(p.tape)}, कूरियर ${num(p.courier)}, कमीशन ${num(p.fee)})\n`});
  if(S.settings.loans.length){t+=`\nलोन:\n`;S.settings.loans.forEach(l=>{t+=`- ${l.name}: बकाया ${rs(num(l.amount))}, ${num(l.rate)}% सालाना, EMI ${rs(num(l.emi))}\n`})}
  return t;
}

/* ---------- बोलकर एंट्री: बिना इंटरनेट वाला पार्सर ---------- */
const DEV="०१२३४५६७८९";
const WORDNUM={"एक":1,"दो":2,"तीन":3,"चार":4,"पांच":5,"पाँच":5,"छह":6,"छः":6,"छे":6,"सात":7,"आठ":8,"नौ":9,"दस":10,"ग्यारह":11,"बारह":12,"तेरह":13,"चौदह":14,"पंद्रह":15,"सोलह":16,"सत्रह":17,"अठारह":18,"उन्नीस":19,"बीस":20,"पच्चीस":25,"तीस":30,"ek":1,"do":2,"teen":3,"char":4,"paanch":5,"panch":5,"chhe":6,"saat":7,"aath":8,"nau":9,"das":10};
function normText(t){
  t=t.replace(/[०-९]/g,c=>DEV.indexOf(c)).toLowerCase();
  t=t.replace(/(\d)\s*,\s*(\d{3})/g,"$1$2");                      // 10,000 -> 10000
  t=t.replace(/(\d+(?:\.\d+)?)\s*(हजार|हज़ार|hazar|hajar|k)(?![a-z])/g,(m,a)=>String(Math.round(parseFloat(a)*1000)));
  t=t.replace(/(\d+)\s*(ग्राम|ग्रा|gram|grams|gm|gms|g)(?![a-z])/g,"$1g");
  Object.keys(WORDNUM).forEach(w=>{t=t.replace(new RegExp("(^|[\\s,।])"+w+"(?=[\\s,।]|$)","g"),"$1"+WORDNUM[w])});
  return t;
}
const normCode=c=>normText(String(c||"")).replace(/\s+/g,"");
const aliases=p=>String(p.code||"").split(/[,;]/).map(a=>a.trim()).filter(Boolean).map(a=>({raw:normText(a),flat:normCode(a)})).filter(a=>a.flat);
const looseRe=a=>new RegExp(a.flat.split("").map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("\\s*"));
const ADS_RE=/(ads?\b|ऐड|एड|ऐड्स|एड्स|विज्ञापन|प्रमोशन|promotion|sponsored|campaign)/;
const EXP_RE=/(खर्च|खर्चा|kharch|kharcha|दिया|दिए|payment|भुगतान)/;
function parseEntry(text){
  const base=normText(text);
  const now=new Date();let date=today();
  if(/(^|\s)(परसों|parso)(\s|$)/.test(base))date=ymd(new Date(now.getTime()-2*864e5));
  else if(/(^|\s)(कल|kal|yesterday)(\s|$)/.test(base))date=ymd(new Date(now.getTime()-864e5));
  const prods=[];S.settings.products.forEach(p=>aliases(p).forEach(a=>prods.push({p,a})));
  prods.sort((x,y)=>y.a.flat.length-x.a.flat.length); // लंबा नाम पहले मिलाओ
  const segs=base.split(/[,।\n]|\s(?:और|aur|and|तथा)\s/).map(s=>s.trim()).filter(Boolean);
  const sales=[],exps=[],unclear=[];
  segs.forEach(seg=>{
    const flat=seg.replace(/\s+/g,"");
    if(ADS_RE.test(seg)||EXP_RE.test(seg)){
      const nums=(seg.match(/\d+(?:\.\d+)?/g)||[]).map(Number).filter(n=>n>0);
      if(nums.length){const amt=Math.max(...nums);exps.push({kind:ADS_RE.test(seg)?"ads":"other",amount:Math.round(amt),note:ADS_RE.test(seg)?"Ads":seg.slice(0,60),date});}
      else unclear.push(seg);
      return;
    }
    let hit=null;
    prods.forEach(x=>{if(!hit&&flat.includes(x.a.flat))hit=x});
    let rest=seg;
    if(hit){rest=rest.replace(looseRe(hit.a)," ");} // बोलने वाला नाम हटाओ ताकि उसकी संख्या गिनती न बने
    else if(S.settings.products.length===1){hit={p:S.settings.products[0]};}
    const chOf=t=>/(website|वेबसाइट|वेब|shopify|साइट)/.test(t)?"website":/(easy|ईज़ी|ईजी|इजी|घर से|ghar se)/.test(t)?"easy_ship":/(fba|एफबीए)/.test(t)?"amazon_fba":null;
    const qn=(rest.match(/\d+/g)||[]).map(Number).filter(n=>n>0&&n<1000);
    if(!qn.length&&chOf(seg)&&sales.length){sales[sales.length-1].channel=chOf(seg);return}
    if(!qn.length){if(/(बिक|बिके|बिका|sold|bika|bike|order|ऑर्डर|आर्डर)/.test(seg)||hit&&prods.length)unclear.push(seg);return}
    if(!hit){unclear.push(seg);return}
    const channel=chOf(seg)||$("sChan").value||"easy_ship";
    sales.push({pid:hit.p.id,qty:qn[0],channel,date});
  });
  return {sales,exps,unclear};
}
let pending=null;
function doParse(){
  const text=$("aiText").value.trim();if(!text){toast("पहले कुछ लिखिए या बोलिए");return}
  const r=parseEntry(text);pending=r;
  const pn=id=>(S.settings.products.find(p=>p.id===id)||{}).name;
  let h=`<div class="preview">`;
  if(!r.sales.length&&!r.exps.length)h+=`<div>कोई एंट्री समझ नहीं आई। ऐसे लिखें: "250g के 5 बिके" या "Ads में 10000 डाले"।</div>`;
  r.sales.forEach(s=>{h+=`<div><span class="tag">${esc(CH[s.channel])}</span>${esc(pn(s.pid))} × <b>${s.qty}</b> · ${esc(niceDate(s.date))}</div>`});
  r.exps.forEach(e=>{h+=`<div><span class="tag ${e.kind==="ads"?"ads":"bad"}">${e.kind==="ads"?"Ads":"खर्च"}</span><b>${rs(e.amount)}</b>${e.note&&e.kind!=="ads"?" · "+esc(e.note):""} · ${esc(niceDate(e.date))}</div>`});
  if(r.unclear.length)h+=`<div class="muted">ये हिस्सा समझ नहीं आया: "${esc(r.unclear.join(", "))}"। इसे नीचे वाले फ़ॉर्म से जोड़ें।</div>`;
  h+=`</div>`;
  if(r.sales.length||r.exps.length)h+=`<div class="row" style="margin-top:8px"><button data-act="aiSave">ठीक है, सेव करें</button><button class="ghost" data-act="aiCancel">रद्द करें</button></div>`;
  $("aiOut").innerHTML=h;
}
function doSave(){
  if(!pending)return;
  pending.sales.forEach(s=>addSale(s.date,s.pid,s.qty,s.channel));
  pending.exps.forEach(e=>addExp(e.date,e.kind,e.amount,e.note));
  pending=null;saveMonth();$("aiOut").innerHTML="";$("aiText").value="";toast("सेव हो गया");
}

/* ---------- माइक: बोलकर लिखना (Chrome की आवाज़ पहचान, इंटरनेट चाहिए) ---------- */
let rec=null,recOn=false;
function startMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast("इस फोन के ब्राउज़र में बोलकर लिखना नहीं चलता, Chrome में खोलें");return}
  if(recOn&&rec){rec.stop();return}
  rec=new SR();rec.lang="hi-IN";rec.interimResults=true;rec.continuous=false;
  const box=$("aiText"),before=box.value?box.value.trim()+" ":"";const btn=$("micBtn");
  rec.onstart=()=>{recOn=true;btn.classList.add("on");btn.textContent="🔴 सुन रहा हूँ… (रोकने के लिए दबाएँ)"};
  rec.onresult=ev=>{let t="";for(let i=0;i<ev.results.length;i++)t+=ev.results[i][0].transcript;box.value=before+t};
  rec.onerror=ev=>{toast(ev.error==="not-allowed"?"माइक की अनुमति दें (ब्राउज़र सेटिंग में)":ev.error==="network"?"बोलकर लिखने के लिए इंटरनेट चाहिए":"आवाज़ समझ नहीं आई, फिर बोलें")};
  rec.onend=()=>{recOn=false;btn.classList.remove("on");btn.textContent="🎤 बोलिए";if(box.value.trim()&&box.value.trim()!==before.trim())doParse()};
  try{rec.start()}catch(e){toast("माइक शुरू नहीं हुआ")}
}

/* ---------- सुझाव: बिना इंटरनेट ---------- */
function advice(){
  const k=$("mSel").value||today().slice(0,7);const st=monthStats(k);const ap=num(S.settings.adPer);const np=num(S.settings.nextPrice);
  const pts=[];
  if(!st.orders){pts.push("इस महीने अभी कोई बिक्री नहीं जुड़ी। रोज़ की बिक्री डालते रहिए, तब सुझाव बनेंगे।")}
  else{
    pts.push(`${niceMonth(k)} में ${st.orders} ऑर्डर से ${rs(st.rev)} की बिक्री हुई और ${rs(st.profit)} बचे, यानी हर ऑर्डर पर लगभग ${rs(st.profit/st.orders)}।`);
    const parts=[["पैक की लागत (माल, पैकिंग, कूरियर)",st.cost],["Ads",st.adsUsed],["दूसरे खर्च",st.other]].sort((a,b)=>b[1]-a[1]);
    pts.push(`सबसे बड़ा खर्च: ${parts[0][0]}, ${rs(parts[0][1])} (बिक्री का ${Math.round(parts[0][1]/st.rev*100)}%)।`);
    if(st.adsReal>0){const real=st.adsReal/st.orders;pts.push(`Ads का असली खर्च ${rs(st.adsReal)} रहा, यानी हर ऑर्डर पर ${rs(real)}। आपका अंदाज़ा ₹${ap} था${real>ap*1.2?"। Ads अंदाज़े से महँगे पड़ रहे हैं: जो keyword बिना बिक्री के पैसे खा रहे हैं उन्हें बंद करें या bid घटाएँ।":real<ap*0.8?"। Ads अंदाज़े से सस्ते पड़ रहे हैं।":"। अंदाज़ा ठीक है।"}`)}
    else if(st.adsDep>0){const real=st.adsDep/st.orders;pts.push(`इस महीने Ads में ${rs(st.adsDep)} डाले, जो ${st.orders} ऑर्डर पर ${rs(real)} प्रति ऑर्डर बैठता है। आपका अंदाज़ा ₹${ap} है${real>ap*1.2?"। अगर ये पूरा पैसा खर्च हो चुका है तो Ads अंदाज़े से महँगे पड़ रहे हैं; अगर वॉलेट में बचा है तो Amazon में असली खर्च देखकर मिलाइए।":real<ap*0.8?", यानी Ads अंदाज़े से सस्ते पड़ रहे हैं (वॉलेट में पैसा बचा भी हो सकता है)।":", यानी अंदाज़ा ठीक चल रहा है।"}`)}
  }
  S.settings.products.forEach(p=>{if(np&&np!==num(p.price)){const c=pcost(p);pts.push(`${p.name}: दाम ₹${np} करने पर Ads वाले ऑर्डर पर ${rs(np-c-ap)} और ऑर्गेनिक पर ${rs(np-c)} बचेंगे (अभी ₹${num(p.price)} पर ${rs(num(p.price)-c-ap)} / ${rs(num(p.price)-c)})।`)}
    if(num(p.fee)===0)pts.push(`${p.name}: "Amazon कमीशन" अभी ₹0 है। अगर Amazon referral/closing फीस अलग से काटता है तो सेटअप में डालिए, वरना मुनाफ़ा ज़्यादा दिखेगा।`)});
  const L=[...S.settings.loans].filter(l=>num(l.amount)>0).sort((a,b)=>b.rate-a.rate);
  if(L.length){const top=L[0];pts.push(`लोन: सबसे महँगा "${top.name}" है (${num(top.rate)}% सालाना)। इसमें हर ₹10,000 extra चुकाने से हर महीने लगभग ${rs(10000*num(top.rate)/1200)} ब्याज कम लगेगा${L.length>1?`, जबकि सबसे सस्ते "${L[L.length-1].name}" में सिर्फ़ ${rs(10000*num(L[L.length-1].rate)/1200)}`:""}। चुकाने से पहले prepayment चार्ज पूछ लें।`);
    if(st.profit>0){const emi=L.reduce((a,l)=>a+num(l.emi),0);if(emi)pts.push(`इस महीने का मुनाफ़ा ${rs(st.profit)} है और कुल EMI ${rs(emi)}। ${st.profit>=emi?"मुनाफ़ा EMI से ज़्यादा है।":"मुनाफ़ा अभी EMI से कम है, EMI का बाकी पैसा कहीं और से जा रहा है।"}`)}}
  pts.push("ये सुझाव सिर्फ़ आपके डाले आँकड़ों से हैं। बड़ा फ़ैसला लेने से पहले खुद जाँच लें।");
  $("advOut").innerHTML=`<div class="advice">${pts.map(p=>"• "+esc(p)).join("\n\n")}</div>`;
}

/* ---------- backup ---------- */
function download(name,text){
  const blob=new Blob([text],{type:"application/json"});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}

/* ---------- events ---------- */
function setTab(t){
  if(!["today","month","loans","setup"].includes(t))t="today";
  document.querySelectorAll("section.view").forEach(s=>s.classList.toggle("on",s.id==="v-"+t));
  document.querySelectorAll("nav.tabs a").forEach(a=>a.classList.toggle("on",a.dataset.tab===t));
}
window.addEventListener("hashchange",()=>{setTab(location.hash.slice(1));window.scrollTo(0,0)});
const sureT={};
document.addEventListener("click",ev=>{
  const b=ev.target.closest("[data-act]");if(!b)return;const a=b.dataset.act;
  if(a==="qty"){const q=$("sQty");q.value=Math.max(1,(parseInt(q.value)||1)+parseInt(b.dataset.d));return}
  if(a==="aiSave")return doSave();
  if(a==="recalc"){const p=S.settings.products.find(x=>x.id===b.dataset.id);if(!p)return;const c=pcost(p);let n=0;Object.values(S.months).forEach(m=>m.sales.forEach(s=>{if(s.pid===p.id){s.cost=c;s.name=p.name;n++}}));saveSettings();toast(n+" एंट्री नई लागत ₹"+c+" से अपडेट हुईं");return}
  if(a==="mic")return startMic();
  if(a==="aiCancel"){pending=null;$("aiOut").innerHTML="";return}
  if(a==="del"||a==="delLoan"||a==="delProd"){
    const key=a+b.dataset.id;
    if(!b.classList.contains("sure")){b.classList.add("sure");b.textContent="पक्का?";clearTimeout(sureT[key]);sureT[key]=setTimeout(()=>{b.classList.remove("sure");b.textContent=a==="delProd"?"ये पैक हटाएँ":"हटाएँ"},3000);return}
    if(a==="del")delEntry(b.dataset.k,b.dataset.id);
    if(a==="delLoan"){S.settings.loans=S.settings.loans.filter(l=>l.id!==b.dataset.id);saveSettings()}
    if(a==="delProd"){S.settings.products=S.settings.products.filter(p=>p.id!==b.dataset.id);$("prodList").innerHTML="";saveSettings()}
    toast("हटा दिया");
  }
});
$("addSale").addEventListener("click",()=>{
  const d=$("sDate").value||today(),q=parseInt($("sQty").value);
  if(!(q>0)){toast("कितने बिके, वो डालिए");return}
  if(!addSale(d,$("sProd").value,q,$("sChan").value))return;
  $("viewDate").value=d;saveMonth();$("sQty").value=1;toast(q+" पैक जुड़ गए");
});
$("addExp").addEventListener("click",()=>{
  const d=$("eDate").value||today(),amt=num($("eAmt").value);
  if(!(amt>0)){toast("रकम डालिए");return}
  addExp(d,$("eKind").value,amt,$("eNote").value);$("viewDate").value=d;saveMonth();
  $("eAmt").value="";$("eNote").value="";toast("खर्च जुड़ गया");
});
$("viewDate").addEventListener("change",renderToday);
$("mSel").addEventListener("change",()=>{$("advOut").innerHTML="";renderMonth()});
$("aiGo").addEventListener("click",doParse);
$("askAdv").addEventListener("click",advice);
$("copyRep").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(report($("mSel").value||today().slice(0,7)));toast("रिपोर्ट कॉपी हो गई")}catch(e){toast("कॉपी नहीं हो पाई")}});
$("addLoan").addEventListener("click",()=>{
  const name=$("lName").value.trim(),amount=num($("lAmt").value),rate=num($("lRate").value),emi=num($("lEmi").value);
  if(!name||!(amount>0)){toast("नाम और बकाया रकम डालिए");return}
  S.settings.loans.push({id:uid(),name,amount,rate,emi});["lName","lAmt","lRate","lEmi"].forEach(i=>$(i).value="");saveSettings();toast("लोन जुड़ गया");
});
$("adPer").addEventListener("change",e=>{S.settings.adPer=num(e.target.value);saveSettings()});
$("nextPrice").addEventListener("change",e=>{S.settings.nextPrice=num(e.target.value);saveSettings()});
$("prodList").addEventListener("change",e=>{
  const el=e.target;if(!el.dataset.pid)return;const p=S.settings.products.find(x=>x.id===el.dataset.pid);if(!p)return;
  const key=el.dataset.key;
  p[key]=key==="name"?(el.value.trim()||p.name):key==="code"?el.value.trim():num(el.value);
  el.blur();saveSettings();
});
$("addProd").addEventListener("click",()=>{
  const base=S.settings.products[0]||DEFAULT_SETTINGS.products[0];
  S.settings.products.push({id:"p"+uid(),name:"नया पैक",code:"",price:0,raw:0,pouch:num(base.pouch),box:num(base.box),tape:num(base.tape),courier:num(base.courier),fee:0});
  saveSettings();toast("नया पैक जुड़ा, नाम और लागत भरें");
});
$("dlBackup").addEventListener("click",()=>{download("bihar-swad-hisaab-"+today()+".json",JSON.stringify(S,null,1));S.settings.lastBackup=Date.now();saveSettings();toast("बैकअप फ़ाइल Downloads में सेव हुई")});
$("cpBackup").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(JSON.stringify(S));S.settings.lastBackup=Date.now();saveSettings();toast("बैकअप कॉपी हो गया, कहीं सेव कर लें")}catch(e){toast("कॉपी नहीं हो पाया")}});
$("imp").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const d=JSON.parse(await f.text());
    if(d&&d.type==="merge"){ // Amazon/दूसरे डेटा को जोड़ो, पुराना कुछ नहीं हटेगा
      let ns=0,ne=0,np=0;
      (d.products||[]).forEach(p=>{const ex=S.settings.products.find(x=>x.id===p.id);if(ex)Object.assign(ex,p);else{S.settings.products.push(p);np++}});
      Object.keys(d.months||{}).forEach(k=>{const m=month(k),src=d.months[k];const have=new Set([...m.sales,...m.exp].map(x=>x.id));
        (src.sales||[]).forEach(x=>{if(!have.has(x.id)){m.sales.push(x);ns++}else{const i=m.sales.findIndex(y=>y.id===x.id);m.sales[i]=x}});
        (src.exp||[]).forEach(x=>{if(!have.has(x.id)){m.exp.push(x);ne++}else{const i=m.exp.findIndex(y=>y.id===x.id);m.exp[i]=x}})});
      if(d.settings)Object.assign(S.settings,d.settings);
      $("prodList").innerHTML="";saveSettings();toast(`जुड़ गया: ${ns} बिक्री, ${ne} खर्च, ${np} नए पैक`);
    }else{
      if(!d||!d.settings||!Array.isArray(d.settings.products))throw 0;
      S={settings:Object.assign(clone(DEFAULT_SETTINGS),d.settings),months:d.months||{}};
      $("prodList").innerHTML="";saveSettings();toast("बैकअप वापस आ गया");
    }
  }catch(err){toast("ये बैकअप फ़ाइल सही नहीं लगी")}
  e.target.value="";
});

/* ---------- start ---------- */
loadLocal();
$("sDate").value=$("eDate").value=$("viewDate").value=today();
$("mSel").value=today().slice(0,7);
setTab(location.hash.slice(1)||"today");
render();
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}
if("serviceWorker" in navigator&&location.protocol.startsWith("http")){
  let hadCtrl=!!navigator.serviceWorker.controller,reloaded=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(hadCtrl&&!reloaded){reloaded=true;location.reload()}});
  window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").then(r=>r.update()).catch(()=>{})})}
window.__parse=parseEntry;
})();
