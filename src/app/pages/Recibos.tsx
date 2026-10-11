import {useEffect, useMemo, useState} from 'react';
import {FileDown, Plus, RefreshCw, Trash2, Save, ReceiptText, Eye, Pencil, X} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../../assets/logo_gl365_oficial.png';
import firmaSelloDefault from '../../assets/firma_sello_default.png';

type Row = Record<string,any>;
type Detalle = {factura:string;valor:string;retencion:string};
type Recibo = {lugar:string;numero:string;serie:string;cliente_id:string;cotizacion_id:string;asignacion_id:string;fecha:string;monto_total:string;moneda:string;concepto:string;forma_pago:string;banco:string;referencia:string;observaciones:string;firma_cobrador:string;firma_imagen:string;sello_imagen:string;detalles:Detalle[]};
const blank = ():Recibo => ({lugar:'Guatemala',numero:'',serie:'A',cliente_id:'',cotizacion_id:'',asignacion_id:'',fecha:new Date().toISOString().slice(0,10),monto_total:'',moneda:'GTQ',concepto:'',forma_pago:'transferencia',banco:'',referencia:'',observaciones:'',firma_cobrador:'',firma_imagen:'',sello_imagen:'',detalles:[{factura:'',valor:'',retencion:''}]});
const money = (n:any,m='GTQ') => `${m==='USD'?'US$':'Q'} ${Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-blue-700';
const api = async(url:string,init:RequestInit={})=>{
 const res=await fetch(`/api${url}`,{...init,headers:{'Content-Type':'application/json',...(init.headers||{})}});
 const j=await res.json().catch(()=>null);
 if(!res.ok || j?.ok===false)throw new Error(j?.message||`HTTP ${res.status}`);
 return j?.data??j;
};
const loadImage = (file:File|null, setter:(data:string)=>void)=>{
 if(!file)return;
 if(!['image/jpeg','image/png'].includes(file.type)||file.size>350000)throw Error('Utiliza JPG/PNG de 350 KB o menos.');
 const fr=new FileReader();fr.onload=()=>setter(String(fr.result||''));fr.readAsDataURL(file);
};
const addImageUrl = async (pdf:jsPDF,url:string,x:number,y:number,w:number,h:number) => {
 try {const im=new Image();im.src=url;await new Promise<void>((resolve,reject)=>{im.onload=()=>resolve();im.onerror=reject});
 const canvas=document.createElement('canvas');canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;
 canvas.getContext('2d')?.drawImage(im,0,0);
 pdf.addImage(canvas.toDataURL('image/png'),'PNG',x,y,w,h); }catch{}
};
/** Dibuja la firma y sello dentro del área designada, conservando proporciones. */
const addSignatureContained = async (doc:jsPDF,src:string,box:{x:number;y:number;w:number;h:number})=>{
  try {
    const image=new Image();
    image.src=src;
    await new Promise<void>((resolve,reject)=>{
      if(image.complete && image.naturalWidth>0){resolve();return;}
      image.onload=()=>resolve();
      image.onerror=()=>reject(new Error('No se pudo cargar la firma y sello'));
    });
    const aspect=image.naturalWidth/image.naturalHeight;
    const width=Math.min(box.w,box.h*aspect);
    const height=width/aspect;
    const x=box.x+(box.w-width)/2;
    const y=box.y+(box.h-height)/2;
    // jsPDF no puede añadir directamente una URL de Vite; la convertimos
    // a PNG desde un canvas, preservando transparencia y relación de aspecto.
    const canvas=document.createElement('canvas');
    canvas.width=image.naturalWidth;
    canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('No se pudo preparar la imagen del recibo');
    ctx.drawImage(image,0,0);
    doc.addImage(canvas.toDataURL('image/png'),'PNG',x,y,width,height,undefined,'FAST');
  } catch (error) {
    console.warn('No se pudo agregar la firma y sello al PDF:',error);
  }
};

export function Recibos(){
 const [data,setData]=useState<{recibos:Row[];clientes:Row[];cotizaciones:Row[];detalles:Row[]}>({recibos:[],clientes:[],cotizaciones:[],detalles:[]});
 const [form,setForm]=useState<Recibo>(blank());
 const [editId,setEditId]=useState<number|null>(null);
 const [viewId,setViewId]=useState<number|null>(null);
 const [deleteId,setDeleteId]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [error,setError]=useState('');
 const refresh=async()=>{try {const payload=await api('/recibos/bootstrap');setData(payload);setError('');}catch(e:any){setError(e.message)}};
 useEffect(()=>{void refresh()},[]);
 const change=(key:keyof Recibo,value:any)=>setForm(p=>({...p,[key]:value}));
 const reset=()=>{setForm(blank());setEditId(null);setError('');setViewId(null);};
 const toForm=(r:Row):Recibo=>({
   lugar:String(r.lugar||'Guatemala'),numero:String(r.numero||''),serie:String(r.serie||'A'),
   cliente_id:String(r.cliente_id||''),cotizacion_id:String(r.cotizacion_id||''),asignacion_id:String(r.asignacion_id||''),
   fecha:String(r.fecha||'').slice(0,10),monto_total:String(r.monto_total??''),moneda:String(r.moneda||'GTQ'),
   concepto:String(r.concepto||''),forma_pago:String(r.forma_pago||'transferencia'),banco:String(r.banco||''),
   referencia:String(r.referencia||''),observaciones:String(r.observaciones||''),firma_cobrador:String(r.firma_cobrador||''),
   firma_imagen:String(r.firma_imagen||r.sello_imagen||''),sello_imagen:'',
   detalles:data.detalles.filter(d=>Number(d.recibo_id)===Number(r.id)).map(d=>({factura:String(d.factura||''),valor:String(d.valor??''),retencion:String(d.retencion??'')}))
 });
 const edit=(r:Row)=>{setForm(toForm(r));setEditId(Number(r.id));setViewId(null);setError('');window.scrollTo({top:0,behavior:'smooth'});};
 const remove=async()=>{if(!deleteId)return;setBusy(true);setError('');try{
   await api(`/recibos/${deleteId}`,{method:'DELETE'});setNotice('Recibo eliminado correctamente.');if(editId===deleteId)reset();
   setDeleteId(null);await refresh();
  }catch(e:any){setError(e.message)}finally{setBusy(false)}};
 const cliente=data.clientes.find(c=>String(c.id)===String(form.cliente_id));
 const totalDetalles=useMemo(()=>form.detalles.reduce((a,d)=>a+Number(d.valor||0)-Number(d.retencion||0),0),[form.detalles]);
 const onCotizacion=(s:string)=>{
 const quote=data.cotizaciones.find(c=>String(c.id)===s);
 setForm(p=>({...p,cotizacion_id:s,cliente_id:quote?String(quote.cliente_id):p.cliente_id,asignacion_id:quote?String(quote.asignacion_id):'',moneda:quote?.moneda_ui||p.moneda,monto_total:quote?String(Number(quote.total||0).toFixed(2)):p.monto_total}));
 };
 const save=async()=>{
 if(!form.numero.trim() || !form.cliente_id || !form.fecha){setError('Número, fecha y cliente son obligatorios.');return;}
 if(form.monto_total.trim()==='' || Number(form.monto_total)<0 || !Number.isFinite(Number(form.monto_total))){setError('Monto inválido.');return;}
 setBusy(true);setError('');try{await api(editId?`/recibos/${editId}`:'/recibos',{method:editId?'PUT':'POST',body:JSON.stringify({...form,cliente_id:Number(form.cliente_id),cotizacion_id:form.cotizacion_id||null,asignacion_id:form.asignacion_id||null,monto_total:Number(form.monto_total),detalles:form.detalles.map(d=>({...d,valor:Number(d.valor||0),retencion:Number(d.retencion||0)}))})});reset();await refresh();setNotice(editId?'Recibo actualizado correctamente.':'Recibo guardado correctamente en MySQL.');}catch(e:any){setError(e.message)}finally{setBusy(false)}
 };
 const pdf=async (r:Row,details:Detalle[])=>{
  // Recibo de caja horizontal. Formato de dos columnas fiel al documento impreso.
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'letter'});
  const navy:[number,number,number]=[36,77,105];
  const w=279.4,h=215.9;
  doc.setDrawColor(...navy);doc.setLineWidth(.48);doc.rect(6,7,w-12,h-14);
  await addImageUrl(doc,logo,26,12,49,23);
  doc.setTextColor(...navy);doc.setFont('helvetica','bold');doc.setFontSize(10.5);
  doc.text('GRUPO LOGÍSTICO 365',139,15,{align:'center'});
  doc.setFontSize(7.2);doc.setFont('helvetica','normal');
  doc.text('Logistics Group 365, S. A.',139,20,{align:'center'});
  doc.text('Villa Nueva, Guatemala',139,24,{align:'center'});
  doc.setFont('helvetica','bold');doc.setFontSize(11.5);doc.text('RECIBO DE',245,14,{align:'center'});
  doc.text('CAJA',245,20,{align:'center'});
  doc.setFontSize(8);doc.text(`SERIE “${String(r.serie||'A')}”`,245,26,{align:'center'});
  doc.setTextColor(192,50,65);doc.text(`N° ${r.numero||''}`,245,31,{align:'center'});
  doc.setDrawColor(...navy);doc.setTextColor(...navy);doc.setFontSize(10);
  doc.text('POR:',181,39);doc.line(193,40,262,40);
  doc.text(money(r.monto_total,r.moneda),215,38);
  // Rectángulo izquierdo: facturas, valores y retenciones.
  autoTable(doc,{startY:43,theme:'grid',margin:{left:12,right:189},
   head:[['FACTURA','VALOR','RETENCIÓN']],
   body:Array.from({length:18},(_,i)=>{const d=details[i];return d?[String(d.factura||''),Number(d.valor||0)?money(d.valor,r.moneda):'',Number(d.retencion||0)?money(d.retencion,r.moneda):'']:['','',''];}),
   styles:{fontSize:8,cellPadding:1.45,minCellHeight:7.3,lineColor:navy,lineWidth:.20},
   headStyles:{fillColor:[229,240,247],textColor:navy,fontStyle:'bold',fontSize:8.4},
   columnStyles:{0:{cellWidth:35},1:{cellWidth:26},2:{cellWidth:18}}});
  doc.setFont('helvetica','bold');doc.setTextColor(...navy);doc.setFontSize(9.5);
  doc.text('LUGAR Y FECHA:',98,50);doc.setFont('helvetica','normal');
  doc.text(`${String(r.lugar||'GUATEMALA')} · ${String(r.fecha||'').slice(0,10)}`,135,50);
  doc.setDrawColor(...navy);doc.line(95,54,265,54);
  doc.rect(96,57,167,41);
  doc.line(145,57,145,98);doc.line(96,76,263,76);
  doc.setFont('helvetica','bold');doc.text('RECIBO DE:',100,65);doc.text('LA SUMA DE:',100,84);
  doc.setFont('helvetica','normal');
  doc.text(doc.splitTextToSize(String(r.nombre_empresa||r.recibido_de||'').toUpperCase(),112),148,65);
  doc.text(doc.splitTextToSize(String(r.concepto||money(r.monto_total,r.moneda)),110),148,84);
  const medios=[['cheque','CHEQUE'],['efectivo','EFECTIVO'],['transferencia','TRANSFERENCIA'],['otros','OTROS']];
  let xx=125;doc.setFont('helvetica','bold');doc.setFontSize(9);
  medios.forEach(([value,label])=>{doc.text(label+':',xx,108); const boxX=xx+doc.getTextWidth(label+':')+2;doc.rect(boxX,104.9,4,4);
   if(String(r.forma_pago).toLowerCase()===value){doc.line(boxX+.6,107,boxX+2,108);doc.line(boxX+2,108,boxX+3.4,105.7);} xx=boxX+9;});
  autoTable(doc,{startY:116,margin:{left:97,right:73},theme:'grid',
   head:[['No.','BANCO','VALOR']],body:[[String(r.referencia||''),String(r.banco||''),money(r.monto_total,r.moneda)],['','',''],['','','']],
   styles:{minCellHeight:6.4,cellPadding:1.2,fontSize:8,lineColor:navy,lineWidth:.17},
   headStyles:{fillColor:[223,235,244],textColor:navy,fontStyle:'bold'}});
  doc.setFontSize(8.5);doc.setFont('helvetica','bold');doc.text('OBSERVACIONES:',209,122);
  doc.setFont('helvetica','normal');doc.text(doc.splitTextToSize(String(r.observaciones||''),57),209,130);
  for(let yy=140;yy<159;yy+=7)doc.line(209,yy,266,yy);
  doc.setFontSize(6.4);doc.setTextColor(45,55,68);
  doc.text(doc.splitTextToSize('IMPORTANTE: SI EL PAGO SE HACE CON CHEQUE Y ESTE SALE RECHAZADO, QUEDARÁ ANULADO EL RECIBO Y PAGO. ADICIONAL SE HARÁ UN RECARGO DE Q250.00 POR RECHAZO.',118),97,158);
  // Nota impresa a la izquierda, separada del cuadro de firma para que no se tape.
  doc.text('ORIGINAL: Cliente. DUPLICADO: Cobros.',98,181);
  // Imagen predeterminada; una imagen cargada por el usuario tiene prioridad.
  // El área (205..263, 163..188) está reservada exclusivamente a firma/sello.
  const firmaSello=r.firma_imagen||r.sello_imagen||firmaSelloDefault;
  await addSignatureContained(doc,firmaSello,{x:205,y:163,w:58,h:25});
  doc.setDrawColor(...navy);doc.line(200,194,265,194);
  doc.setTextColor(...navy);doc.setFont('helvetica','bold');doc.setFontSize(9);
  doc.text('COBRADOR',232,200,{align:'center'});
  if(r.firma_cobrador){
    doc.setFontSize(7.3);
    doc.text(String(r.firma_cobrador).slice(0,42),232,191,{align:'center'});
  }
  doc.save(`Recibo_Caja_${r.numero}.pdf`);
 };
 const input=(label:string,key:keyof Recibo,kind='text')=><label className="block text-sm font-semibold text-slate-700">{label}<input type={kind} className={`${fieldClass} mt-1`} value={String(form[key]??'')} onChange={e=>change(key,e.target.value)}/></label>;
 return <main className="space-y-6 p-4 md:p-6">
  <header className="flex items-center justify-between"><div><h1 className="flex items-center gap-3 text-3xl font-extrabold text-[#0C2D6B]"><ReceiptText/>Recibos de caja</h1><p className="mt-1 text-sm text-slate-500">Registro y PDF basados en el formato utilizado por Logistics Group 365.</p></div><button onClick={refresh} className="rounded-lg bg-[#0C2D6B] px-4 py-2 font-semibold text-white"><RefreshCw className="mr-2 inline h-4 w-4"/>Actualizar</button></header>
  {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
  {notice&&<div className="rounded-xl border border-green-200 bg-green-50 p-3 text-green-700">{notice}</div>}
  <section className="rounded-2xl border bg-white p-5 shadow-sm">
   <div className="mb-4 flex items-center gap-2 text-xl font-bold text-[#0C2D6B]"><Plus className="h-5 w-5 text-[#FF6A00]"/>{editId?"Editar recibo de caja":"Nuevo recibo de caja"}</div>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {input('Número del recibo *','numero')}{input('Serie','serie')}{input('Fecha *','fecha','date')}{input('Monto total *','monto_total','number')}
    <label className="text-sm font-semibold text-slate-700">Cotización con asignación<select className={`${fieldClass} mt-1`} value={form.cotizacion_id} onChange={e=>onCotizacion(e.target.value)}><option value="">Sin vincular</option>{editId && form.cotizacion_id && !data.cotizaciones.some(c=>String(c.id)===String(form.cotizacion_id)) && <option value={form.cotizacion_id}>Cotización vinculada #{form.cotizacion_id}</option>}{data.cotizaciones.map(c=><option key={c.id} value={c.id}>{c.codigo_cotizacion} · {money(c.total,c.moneda_ui)}</option>)}</select></label>
    <label className="text-sm font-semibold text-slate-700">Cliente *<select className={`${fieldClass} mt-1`} value={form.cliente_id} onChange={e=>change('cliente_id',e.target.value)}><option value="">Seleccionar cliente</option>{data.clientes.map(c=><option key={c.id} value={c.id}>{c.nombre_empresa}</option>)}</select></label>
    <label className="text-sm font-semibold text-slate-700">Moneda<select className={`${fieldClass} mt-1`} value={form.moneda} onChange={e=>change('moneda',e.target.value)}><option value="GTQ">Quetzales</option><option value="USD">Dólares</option></select></label>
    <label className="text-sm font-semibold text-slate-700">Forma de pago<select className={`${fieldClass} mt-1`} value={form.forma_pago} onChange={e=>change('forma_pago',e.target.value)}>{['cheque','efectivo','transferencia','otros'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
    {input('Lugar','lugar')}{input('Banco','banco')}{input('No. de cheque / transferencia','referencia')}{input('Nombre del cobrador','firma_cobrador')}{input('La suma de / concepto','concepto')}
   </div>
   <div className="mt-5"><b className="text-[#0C2D6B]">Detalle de facturas y retenciones</b><div className="mt-2 space-y-2">{form.detalles.map((d,i)=><div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2" key={i}><input placeholder="Factura" className={fieldClass} value={d.factura} onChange={e=>setForm(p=>({...p,detalles:p.detalles.map((a,j)=>i===j?{...a,factura:e.target.value}:a)}))}/><input type="number" min="0" placeholder="Valor" className={fieldClass} value={d.valor} onChange={e=>setForm(p=>({...p,detalles:p.detalles.map((a,j)=>i===j?{...a,valor:e.target.value}:a)}))}/><input type="number" min="0" placeholder="Retención" className={fieldClass} value={d.retencion} onChange={e=>setForm(p=>({...p,detalles:p.detalles.map((a,j)=>i===j?{...a,retencion:e.target.value}:a)}))}/><button aria-label="Eliminar línea" className="p-2 text-red-600" onClick={()=>setForm(p=>({...p,detalles:p.detalles.filter((_,j)=>i!==j)}))}><Trash2/></button></div>)}</div><button className="mt-2 text-sm font-bold text-[#0C2D6B]" onClick={()=>setForm(p=>({...p,detalles:[...p.detalles,{factura:'',valor:'',retencion:''}]}))}>+ Agregar factura</button><p className="text-sm text-slate-500">Neto en detalles: {money(totalDetalles,form.moneda)}. Verifica que coincida con el monto recibido.</p></div>
   <label className="mt-4 block text-sm font-semibold">Observaciones<textarea className={`${fieldClass} mt-1`} value={form.observaciones} onChange={e=>change('observaciones',e.target.value)}/></label>
   <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
     <label className="block text-sm font-semibold text-[#0C2D6B]">Firma y sello juntos (una sola imagen PNG/JPG, opcional)
       <input className="mt-2 block" type="file" accept="image/png,image/jpeg" onChange={e=>{try{loadImage(e.target.files?.[0]||null,v=>{change('firma_imagen',v);})}catch(err:any){setError(err.message)}}}/>
     </label>
     <p className="mt-2 text-xs text-slate-600">Se utiliza la firma y sello predeterminados de la empresa si no adjuntas otra imagen. Puedes reemplazarla con un PNG/JPG autorizado de hasta 350 KB.</p>
     <div className="mt-3 flex items-center gap-3"><img src={form.firma_imagen||firmaSelloDefault} alt="Vista previa de firma y sello para el PDF" className="max-h-24 max-w-48 rounded border bg-white object-contain"/>{form.firma_imagen && <button type="button" className="text-sm text-red-700" onClick={()=>change('firma_imagen','')}>Usar imagen predeterminada</button>}</div>
   </div>
   <div className="mt-5 flex justify-end gap-3">{editId&&<button type="button" onClick={reset} className="rounded-xl border px-5 py-3 font-semibold text-slate-700">Cancelar edición</button>}<button disabled={busy} onClick={save} className="flex items-center gap-2 rounded-xl bg-[#FF6A00] px-6 py-3 font-bold text-white disabled:opacity-50"><Save className="h-5 w-5"/>{editId?'Actualizar recibo':'Guardar recibo'}</button></div>
  </section>
  <section className="rounded-2xl border bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold text-[#0C2D6B]">Recibos guardados</h2>
    <div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm">
      <thead className="bg-blue-50"><tr>{['Número','Fecha','Cliente','Valor','Acciones'].map(x=><th className="px-3 py-2 text-left" key={x}>{x}</th>)}</tr></thead>
      <tbody>{data.recibos.map(r=><tr key={r.id} className="border-t"><td className="p-3 font-bold">{r.serie}-{r.numero}</td><td className="p-3">{String(r.fecha||'').slice(0,10)}</td><td className="p-3">{r.nombre_empresa}</td><td className="p-3">{money(r.monto_total,r.moneda)}</td>
        <td className="p-3"><div className="flex flex-wrap gap-2">
          <button type="button" onClick={()=>setViewId(Number(r.id))} className="inline-flex gap-1 rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700"><Eye className="h-4 w-4"/>Ver</button>
          <button type="button" onClick={()=>edit(r)} className="inline-flex gap-1 rounded bg-orange-50 px-2 py-1 font-semibold text-orange-700"><Pencil className="h-4 w-4"/>Editar</button>
          <button type="button" onClick={()=>setDeleteId(Number(r.id))} className="inline-flex gap-1 rounded bg-red-50 px-2 py-1 font-semibold text-red-700"><Trash2 className="h-4 w-4"/>Eliminar</button>
          <button type="button" onClick={()=>pdf(r,data.detalles.filter(d=>Number(d.recibo_id)===Number(r.id)) as Detalle[])} className="inline-flex gap-1 rounded bg-blue-50 px-2 py-1 font-semibold text-blue-900"><FileDown className="h-4 w-4"/>PDF</button>
        </div></td>
      </tr>)}</tbody>
    </table>{!data.recibos.length&&<p className="p-4 text-center text-slate-400">Aún no hay recibos registrados.</p>}</div>
  </section>
  {viewId && (()=>{const r=data.recibos.find(x=>Number(x.id)===viewId);if(!r)return null;return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
     <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-[#0C2D6B]">Recibo {r.serie}-{r.numero}</h2><button onClick={()=>setViewId(null)} aria-label="Cerrar"><X/></button></div>
     <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">{[['Fecha',String(r.fecha||'').slice(0,10)],['Cliente',r.nombre_empresa],['Cotización',r.codigo_cotizacion||'Sin vincular'],['Lugar',r.lugar],['Monto',money(r.monto_total,r.moneda)],['Forma de pago',r.forma_pago],['Banco',r.banco],['Referencia',r.referencia],['Concepto',r.concepto],['Observaciones',r.observaciones],['Cobrador',r.firma_cobrador]].map(([k,v])=><div key={k} className="rounded-lg bg-gray-50 p-2"><dt className="font-semibold text-[#0C2D6B]">{k}</dt><dd className="break-words">{String(v||'—')}</dd></div>)}</dl>
     <div className="mt-4"><h3 className="font-bold text-[#0C2D6B]">Facturas, valores y retenciones</h3><div className="mt-2 space-y-1">{data.detalles.filter(d=>Number(d.recibo_id)===Number(r.id)).map(d=><div key={d.id} className="grid grid-cols-3 rounded border px-2 py-1 text-xs"><span>{d.factura||'Sin factura'}</span><span>Valor: {money(d.valor,r.moneda)}</span><span>Retención: {money(d.retencion,r.moneda)}</span></div>)}</div></div>
     <img className="mt-4 max-h-28 object-contain" alt="Firma y sello del recibo" src={r.firma_imagen||r.sello_imagen||firmaSelloDefault}/>
     <div className="mt-4 flex justify-end gap-2"><button onClick={()=>{setViewId(null);edit(r);}} className="rounded-lg bg-orange-50 px-4 py-2 font-semibold text-orange-700">Editar</button><button onClick={()=>pdf(r,data.detalles.filter(d=>Number(d.recibo_id)===Number(r.id)) as Detalle[])} className="rounded-lg bg-[#0C2D6B] px-4 py-2 font-bold text-white">Descargar PDF</button></div>
     </div></div>})()}
  {deleteId && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-lg font-bold text-[#0C2D6B]">¿Eliminar recibo?</h2><p className="mt-3 text-sm text-slate-600">Esta acción eliminará también los detalles asociados. No se puede deshacer.</p><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setDeleteId(null)} className="rounded-lg border px-3 py-2">Cancelar</button><button disabled={busy} onClick={remove} className="rounded-lg bg-red-600 px-3 py-2 font-semibold text-white">Eliminar</button></div></div></div>}
 </main>
}
