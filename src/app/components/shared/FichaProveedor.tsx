import {useEffect,useState} from 'react';
import {Save, X} from 'lucide-react';
const fields: [string,string][] = [
 ['nit','NIT'],['razon_social','Razón social'],['nombre_comercial','Razón comercial'],
 ['contacto_principal','Nombre del contacto principal'],['nombre_propietario','Nombre del propietario'],
 ['dpi_propietario','Número de DPI'],['direccion_predio','Dirección predio'],
 ['tipo_contribuyente','Tipo de contribuyente'],['direccion_fisica','Dirección física'],
 ['cuenta_bancaria','Número de cuenta bancaria'],['banco','Nombre del banco'],
 ['dueno_cuenta','Dueño de la cuenta bancaria'],['tipo_cuenta','Tipo de cuenta'],
 ['correo','Correo electrónico'],['contacto_telefono','Número telefónico contacto principal'],
 ['investigacion_sat','Investigación SAT'],['investigacion_clinton','Investigación Clinton'],
 ['referencias','Referencias (separadas por coma)']
];
export default function FichaProveedor({id,onClose}:{id:number;onClose:()=>void}){
 const [form,setForm]=useState<Record<string,string>>({});const [msg,setMsg]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{fetch(`/api/proveedores/${id}/ficha`).then(r=>r.json()).then(j=>{if(j.ok===false)throw Error(j.message);const d=j.data||j;setForm(Object.fromEntries(Object.entries(d).map(([k,v])=>[k,String(v??'')])));}).catch(e=>setMsg(e.message))},[id]);
 const save=async()=>{setBusy(true);setMsg('');try{const r=await fetch(`/api/proveedores/${id}/ficha`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const j=await r.json();if(!r.ok||j.ok===false)throw Error(j.message||'Error');setMsg('Ficha actualizada correctamente.')}catch(e:any){setMsg(e.message)}finally{setBusy(false)}};
 return <div className="fixed inset-0 z-[120] overflow-auto bg-black/60 p-4"><section className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
 <div className="flex items-center justify-between border-b pb-3"><div><h2 className="text-2xl font-bold text-[#0C2D6B]">Ficha de datos del proveedor</h2><p className="text-sm text-gray-500">Formato Pricing · campos opcionales para proveedores nacionales</p></div><button aria-label="Cerrar" onClick={onClose}><X/></button></div>
 {msg&&<div className="my-3 rounded bg-orange-50 p-3 text-sm text-[#0C2D6B]">{msg}</div>}
 <div className="mt-5 grid gap-3 md:grid-cols-2">{fields.map(([key,label])=><label key={key} className="grid grid-cols-[155px_1fr] overflow-hidden rounded border border-orange-300 text-sm"><span className="flex items-center bg-[#E98760] px-3 py-2 font-semibold text-white">{label}</span><input readOnly={['nit','razon_social','nombre_comercial','correo'].includes(key)} className="min-w-0 p-2 outline-none focus:bg-orange-50" value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}/></label>)}</div>
 <p className="mt-3 text-xs text-gray-500">Los datos principales de proveedor se editan en su formulario habitual. En esta ficha los campos adicionales pueden quedar vacíos.</p>
 <div className="mt-5 flex justify-end"><button disabled={busy} onClick={save} className="inline-flex gap-2 rounded-lg bg-[#0C2D6B] px-5 py-3 font-bold text-white"><Save/>Guardar datos opcionales</button></div>
 </section></div>;
}
