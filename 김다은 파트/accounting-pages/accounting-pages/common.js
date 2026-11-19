const STORE_KEY='ai_accounting_journals_v1';
function loadStore(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{"datasets":[]}')}catch{return {datasets:[]}}}
function saveStore(data){localStorage.setItem(STORE_KEY,JSON.stringify(data))}
function money(v){return Number(v||0).toLocaleString('ko-KR')+'원'}
function num(v){if(typeof v==='number')return v;const n=Number(String(v??'').replace(/[₩,\s원]/g,''));return Number.isFinite(n)?n:0}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(msg){let el=document.querySelector('.toast');if(!el){el=document.createElement('div');el.className='toast';document.body.append(el)}el.textContent=msg;el.classList.remove('hidden');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.add('hidden'),2800)}
function allRows(){return loadStore().datasets.flatMap(d=>d.rows.map(r=>({...r,datasetId:d.id,datasetName:d.name,year:d.year}))) }
function normalizeRow(r){const get=(...keys)=>{for(const k of keys){if(r[k]!==undefined&&r[k]!==null&&String(r[k]).trim()!=='')return r[k]}return ''};const date=String(get('거래일자','일자','전표일자','date','Date')).slice(0,10);const debit=num(get('차변','차변금액','차변금액(원)','debit','Debit'));const credit=num(get('대변','대변금액','대변금액(원)','credit','Credit'));return {date,accountCode:String(get('계정코드','계정과목코드','account_code','code')),accountName:String(get('계정과목','계정과목명','account_name','account')),description:String(get('적요','거래내용','description','memo')),customer:String(get('거래처','거래처명','customer','customer_name')),debit,credit,voucherNo:String(get('전표번호','번호','voucher_no')),type:String(get('구분','전표구분','type')),amount:debit||credit,raw:r}}
function yearOf(r){const y=String(r.date||'').match(/(19|20)\d{2}/);return y?Number(y[0]):Number(r.year)||null}
function formatDate(s){return s||'-'}
function download(name,content,type='application/json'){const blob=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href)}
