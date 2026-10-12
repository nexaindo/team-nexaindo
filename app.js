(() => {
  const cfg = window.NEXAINDO_CONFIG || {};
  const configured = cfg.SUPABASE_URL?.startsWith("https://") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("PASTE_");
  const $ = (id) => document.getElementById(id);
  const money = (n) => new Intl.NumberFormat("id-ID", {style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n || 0));
  const todayISO = () => new Date().toLocaleDateString("en-CA");
  const monthISO = () => todayISO().slice(0,7);
  const escapeHTML = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let sb, customers = [], packages = [], bills = [], payments = [], currentUser = null;
  let currentView = "overview";
  const toast = (msg, error=false) => { const t=$("toast"); t.textContent=msg; t.className=error?"show error-toast":"show"; clearTimeout(toast.timer); toast.timer=setTimeout(()=>t.className="",3500); };
  const errMsg = (e) => e?.message || "Terjadi kesalahan. Coba lagi.";
  const isConfigured = () => configured;
  const showLogin = () => { $("login-screen").classList.remove("hidden"); $("app").classList.add("hidden"); };
  const showApp = () => { $("login-screen").classList.add("hidden"); $("app").classList.remove("hidden"); $("admin-email").textContent=currentUser?.email||"Administrator"; };
  const run = async (promise) => { const {data,error}=await promise; if(error) throw error; return data; };
  async function init() {
    $("today").textContent = new Date().toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}).toUpperCase();
    if (!isConfigured() || !window.supabase) {
      showLogin();
      $("login-error").textContent = "Konfigurasi Supabase belum diisi. Ikuti README.md, lalu isi config.js.";
      $("login-form").addEventListener("submit", e=>{e.preventDefault(); $("login-error").textContent="Isi config.js terlebih dahulu.";});
      return;
    }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    $("login-form").addEventListener("submit", login);
    $("logout").addEventListener("click", async()=>{await sb.auth.signOut(); currentUser=null; showLogin();});
    sb.auth.onAuthStateChange((_event, session)=>{ if(session?.user){currentUser=session.user; showApp(); loadAll().catch(e=>toast(errMsg(e),true));} else {currentUser=null;showLogin();} });
    const {data:{session}} = await sb.auth.getSession();
    if(session?.user){currentUser=session.user;showApp();await loadAll();} else showLogin();
    bindUI();
  }
  async function login(e) {
    e.preventDefault(); $("login-error").textContent="";
    try { const {error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value}); if(error) throw error; }
    catch(err){$("login-error").textContent=errMsg(err);}
  }
  function bindUI() {
    document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
    document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
    $("menu-toggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
    $("refresh").addEventListener("click",()=>loadAll().then(()=>toast("Data diperbarui")).catch(e=>toast(errMsg(e),true)));
    $("add-customer").addEventListener("click",()=>openCustomer());
    $("add-package").addEventListener("click",()=>openPackage());
    $("customer-search").addEventListener("input",renderCustomers);
    $("billing-search").addEventListener("input",renderBills);
    $("customer-form").addEventListener("submit",saveCustomer);
    $("package-form").addEventListener("submit",savePackage);
    $("payment-form").addEventListener("submit",savePayment);
    $("generate-bills").addEventListener("click",generateBills);
    document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));
    document.addEventListener("click",e=>{
      const b=e.target.closest("[data-action]"); if(!b)return;
      const {action,id}=b.dataset;
      if(action==="edit-customer") openCustomer(id);
      if(action==="delete-customer") deleteCustomer(id);
      if(action==="edit-package") openPackage(id);
      if(action==="delete-package") deletePackage(id);
      if(action==="pay") openPayment(id);
    });
  }
  function navigate(view) {
    currentView=view;
    document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
    $("view-"+view).classList.remove("hidden");
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    $("crumb-current").textContent=({overview:"Overview",customers:"Pelanggan",packages:"Paket internet",billing:"Tagihan & pembayaran"})[view];
    $("sidebar").classList.remove("open");
  }
  async function loadAll() {
    if(!currentUser || !sb) return;
    $("sync-label").textContent="MENYINKRONKAN…";
    try {
      [customers,packages,bills,payments]=await Promise.all([
        run(sb.from("customers").select("*").order("created_at",{ascending:false})),
        run(sb.from("internet_packages").select("*").order("price_monthly")),
        run(sb.from("bills").select("*, customers(name, phone)").order("period",{ascending:false})),
        run(sb.from("payments").select("*").order("paid_at",{ascending:false}))
      ]);
      $("sync-label").textContent="DATABASE ONLINE";
      renderAll();
    } catch(e) { $("sync-label").textContent="GAGAL SINKRON"; throw e; }
  }
  function renderAll(){renderOverview();renderCustomers();renderPackages();renderBills();$("nav-count").textContent=customers.length;}
  function renderOverview(){
    const active=customers.filter(c=>c.connection_status==="active").length;
    $("active-count").textContent=active;$("offline-count").textContent=customers.length-active;
    const m=monthISO(), billed=bills.filter(b=>b.period===m).reduce((s,b)=>s+Number(b.amount),0);
    const paid=payments.filter(p=>String(p.paid_at).slice(0,7)===m).reduce((s,p)=>s+Number(p.amount),0);
    $("billed-total").textContent=money(billed);$("paid-total").textContent=money(paid);
    const recent=customers.slice(0,5);
    $("recent-customers").innerHTML=customerTableHTML(recent,false);
    const chart=$("revenue-chart");
    const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(5-i));return d.toLocaleDateString("en-CA").slice(0,7);});
    const vals=months.map(mo=>({month:mo, billed:bills.filter(b=>b.period===mo).reduce((s,b)=>s+Number(b.amount),0),paid:payments.filter(p=>String(p.paid_at).slice(0,7)===mo).reduce((s,p)=>s+Number(p.amount),0)}));
    const max=Math.max(1,...vals.flatMap(v=>[v.billed,v.paid]));
    chart.innerHTML=`<div class="chart-bars">${vals.map(v=>`<div class="chart-col"><div class="bar-pair"><i class="bar billed" style="height:${Math.max(3,v.billed/max*100)}%"></i><i class="bar paid" style="height:${Math.max(3,v.paid/max*100)}%"></i></div><small>${escapeHTML(v.month.slice(5))}/${escapeHTML(v.month.slice(2,4))}</small></div>`).join("")}</div><div class="chart-note">Nilai dihitung dari data tagihan dan pembayaran yang tersimpan.</div>`;
  }
  function statusHTML(status){return `<span class="pill ${status==="active"?"pill-active":"pill-offline"}">${status==="active"?"Aktif":"Offline"}</span>`;}
  function customerTableHTML(list, actions=true){
    if(!list.length)return `<div class="empty">Belum ada data pelanggan.</div>`;
    return `<table><thead><tr><th>Pelanggan</th><th>Paket</th><th>Tagihan</th><th>Status</th>${actions?"<th>Aksi</th>":""}</tr></thead><tbody>${list.map(c=>`<tr><td><div class="person"><span class="avatar">${escapeHTML((c.name||"?").slice(0,1).toUpperCase())}</span><div><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.phone||"Nomor belum diisi")}</small></div></div></td><td>${escapeHTML(c.package_name||"—")}</td><td>${money(c.monthly_fee)}</td><td>${statusHTML(c.connection_status)}</td>${actions?`<td class="actions"><button class="text-button" data-action="edit-customer" data-id="${c.id}">Edit</button><button class="text-button danger" data-action="delete-customer" data-id="${c.id}">Hapus</button></td>`:""}</tr>`).join("")}</tbody></table>`;
  }
  function renderCustomers(){
    const q=($("customer-search").value||"").toLowerCase();
    const list=customers.filter(c=>[c.name,c.phone,c.address,c.package_name].some(v=>String(v||"").toLowerCase().includes(q)));
    $("customer-count").textContent=`${list.length} pelanggan`; $("customer-table").innerHTML=customerTableHTML(list);
  }
  function renderPackages(){
    $("package-list").innerHTML=packages.length?packages.map(p=>`<article class="panel package-card"><div class="package-icon">⌁</div><p class="eyebrow">INTERNET PLAN</p><h2>${escapeHTML(p.name)}</h2><p class="speed">${escapeHTML(p.speed_mbps)} <small>Mbps</small></p><strong class="package-price">${money(p.price_monthly)}<small> / bulan</small></strong><div class="package-actions"><button class="secondary" data-action="edit-package" data-id="${p.id}">Edit</button><button class="secondary danger" data-action="delete-package" data-id="${p.id}">Hapus</button></div></article>`).join(""):`<div class="panel empty">Belum ada paket. Tambahkan paket pertama.</div>`;
  }
  function renderBills(){
    const q=($("billing-search").value||"").toLowerCase(), m=monthISO();
    const list=bills.filter(b=>(b.period===m)&&String(b.customers?.name||"").toLowerCase().includes(q));
    $("billing-count").textContent=`${list.length} tagihan bulan ini`;
    $("billing-table").innerHTML=list.length?`<table><thead><tr><th>Pelanggan</th><th>Periode</th><th>Tagihan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${list.map(b=>`<tr><td><strong>${escapeHTML(b.customers?.name||"Pelanggan")}</strong><small>${escapeHTML(b.customers?.phone||"")}</small></td><td>${escapeHTML(b.period)}</td><td>${money(b.amount)}</td><td><span class="pill ${b.status==="paid"?"pill-active":"pill-pending"}">${b.status==="paid"?"Lunas":"Belum lunas"}</span></td><td>${b.status!=="paid"?`<button class="text-button" data-action="pay" data-id="${b.id}">Catat bayar</button>`:"—"}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">Belum ada tagihan untuk bulan ini. Tekan “Buat tagihan bulan ini”.</div>`;
  }
  function openCustomer(id=null){
    const c=customers.find(x=>x.id===id);
    $("customer-dialog-title").textContent=c?"Edit pelanggan":"Tambah pelanggan";
    $("customer-id").value=c?.id||"";$("customer-name").value=c?.name||"";$("customer-phone").value=c?.phone||"";$("customer-address").value=c?.address||"";
    $("customer-status").value=c?.connection_status||"active";
    $("customer-package").innerHTML=packages.map(p=>`<option value="${escapeHTML(p.name)}" data-price="${p.price_monthly}">${escapeHTML(p.name)}</option>`).join("")+`<option value="Custom">Paket custom</option>`;
    if(c)$("customer-package").value=c.package_name||"Custom";
    const pkg=packages.find(p=>p.name===$("customer-package").value);
    $("customer-price").value=c?.monthly_fee??pkg?.price_monthly??150000;
    $("customer-package").onchange=()=>{const p=packages.find(x=>x.name===$("customer-package").value);if(p)$("customer-price").value=p.price_monthly;};
    $("customer-dialog").showModal();
  }
  async function saveCustomer(e){
    e.preventDefault();
    const id=$("customer-id").value, name=$("customer-name").value.trim();
    const row={name,phone:$("customer-phone").value.trim(),address:$("customer-address").value.trim(),package_name:$("customer-package").value||"Custom",monthly_fee:Number($("customer-price").value),connection_status:$("customer-status").value};
    try{
      if(id) await run(sb.from("customers").update(row).eq("id",id));
      else await run(sb.from("customers").insert(row));
      $("customer-dialog").close();await loadAll();toast(id?"Pelanggan diperbarui":"Pelanggan ditambahkan");
    }catch(err){toast(errMsg(err),true);}
  }
  async function deleteCustomer(id){
    const c=customers.find(x=>x.id===id);if(!c||!confirm(`Hapus pelanggan ${c.name}? Tagihan terkait mungkin ikut dibatasi oleh relasi database.`))return;
    try{await run(sb.from("customers").delete().eq("id",id));await loadAll();toast("Pelanggan dihapus");}catch(e){toast(errMsg(e),true);}
  }
  function openPackage(id=null){
    const p=packages.find(x=>x.id===id);$("package-dialog-title").textContent=p?"Edit paket":"Tambah paket";
    $("package-id").value=p?.id||"";$("package-name").value=p?.name||"";$("package-speed").value=p?.speed_mbps||20;$("package-price").value=p?.price_monthly||150000;
    $("package-dialog").showModal();
  }
  async function savePackage(e){
    e.preventDefault();const id=$("package-id").value;
    const row={name:$("package-name").value.trim(),speed_mbps:Number($("package-speed").value),price_monthly:Number($("package-price").value)};
    try{if(id)await run(sb.from("internet_packages").update(row).eq("id",id));else await run(sb.from("internet_packages").insert(row));$("package-dialog").close();await loadAll();toast("Paket tersimpan");}
    catch(err){toast(errMsg(err),true);}
  }
  async function deletePackage(id){
    const p=packages.find(x=>x.id===id);if(!p||!confirm(`Hapus paket ${p.name}?`))return;
    try{await run(sb.from("internet_packages").delete().eq("id",id));await loadAll();toast("Paket dihapus");}catch(e){toast(errMsg(e),true);}
  }
  async function generateBills(){
    const period=monthISO(), existing=new Set(bills.filter(b=>b.period===period).map(b=>b.customer_id));
    const rows=customers.filter(c=>!existing.has(c.id)).map(c=>({customer_id:c.id,period,amount:c.monthly_fee,status:"unpaid"}));
    if(!rows.length){toast("Semua pelanggan sudah memiliki tagihan bulan ini.");return;}
    try{await run(sb.from("bills").insert(rows));await loadAll();toast(`${rows.length} tagihan berhasil dibuat.`);}catch(e){toast(errMsg(e),true);}
  }
  function openPayment(id){
    const b=bills.find(x=>x.id===id);if(!b)return;
    $("payment-bill-id").value=id;$("payment-description").textContent=`${b.customers?.name||"Pelanggan"} • ${b.period} • Tagihan ${money(b.amount)}`;
    $("payment-amount").value=b.amount;$("payment-date").value=todayISO();$("payment-note").value="";$("payment-dialog").showModal();
  }
  async function savePayment(e){
    e.preventDefault();const billId=$("payment-bill-id").value, b=bills.find(x=>x.id===billId);
    const amount=Number($("payment-amount").value);
    if(!b||amount<=0)return;
    try{
      await run(sb.from("payments").insert({bill_id:billId,customer_id:b.customer_id,amount,paid_at:$("payment-date").value,note:$("payment-note").value.trim()}));
      if(amount>=Number(b.amount)) await run(sb.from("bills").update({status:"paid"}).eq("id",billId));
      $("payment-dialog").close();await loadAll();toast("Pembayaran dicatat");
    }catch(err){toast(errMsg(err),true);}
  }
  init().catch(e=>{console.error(e);toast(errMsg(e),true);});
})();
