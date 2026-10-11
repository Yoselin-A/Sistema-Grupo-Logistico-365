/** Solicitud de datos del cliente GL365 - A4 de una sola página, lista para imprimir. */
import jsPDF from 'jspdf';
import logoOficial from '../../../assets/logo_gl365_oficial.png';
type Dato=Record<string,unknown>;
const texto=(d:Dato,k:string)=>String(d[k]??'').trim();
const contactos:[string,string][]=[
 ['contacto_empresa','Nombre del contacto en la empresa'],
 ['puesto_empresa','Puesto dentro de la empresa'],
 ['email_contacto','E-mail'],
 ['contacto_comercial','Contacto comercial'],
 ['email_comercial','E-mail del contacto comercial'],
 ['telefono_comercial','Teléfono(s) del contacto comercial'],
 ['contacto_financiero','Contacto financiero'],
 ['email_financiero','E-mail del contacto financiero'],
 ['telefono_financiero','Teléfono(s) del contacto financiero'],
 ['cuentas_pagar','Encargado de cuentas por pagar'],
 ['email_cuentas_pagar','E-mail del contacto'],
 ['telefono_cuentas_pagar','Teléfono(s) del contacto'],
 ['representante_legal','Representante legal'],
 ['email_representante','E-mail del contacto'],
 ['telefono_representante','Teléfono(s) del contacto']
];
async function logoData():Promise<string|null>{
 return new Promise(resolve=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d')?.drawImage(im,0,0);resolve(c.toDataURL('image/png'))};im.onerror=()=>resolve(null);im.src=logoOficial;});
}
export async function descargarSolicitudCliente(datos:Dato){
 const doc=new jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
 const color:[number,number,number]=[50,50,50];
 const logo=await logoData();
 if(logo)doc.addImage(logo,'PNG',15,10,37,17,undefined,'FAST');
 doc.setFont('helvetica','bold');doc.setFontSize(10.2);doc.setTextColor(0,0,0);
 doc.text('SOLICITUD DE DATOS DEL CLIENTE',111,19,{align:'center'});
 doc.setFont('helvetica','normal');doc.setFontSize(7.4);
 const codigo=texto(datos,'codigo_documento')||'DC-SD-01-03-2022-VR-01';
 doc.text(doc.splitTextToSize(codigo,49),158,13);
 doc.text('Página: 1 de 1',158,23);
 function celda(x:number,y:number,w:number,h:number,t:string,negrita=false,fuente=7.4){
   doc.setDrawColor(...color);doc.setLineWidth(.19);doc.rect(x,y,w,h);
   doc.setFillColor(246,246,246);
   if(negrita)doc.rect(x+.1,y+.1,w-.2,h-.2,'F');
   doc.setFont('helvetica',negrita?'bold':'normal');doc.setFontSize(fuente);
   const ancho=w-3;
   const lines=doc.splitTextToSize(String(t||''),ancho);
   const limit=Math.max(1,Math.floor((h-1.6)/3.1));
   const visibles=lines.slice(0,limit);
   if(lines.length>limit&&visibles.length){let last=visibles[visibles.length-1];visibles[visibles.length-1]=last.length>3?last.slice(0,-3)+'...':'...';}
   doc.text(visibles,x+1.5,y+Math.min(3.6,h/2+1),{lineHeightFactor:1.1});
 }
 function titulo(s:string,y:number){doc.setFont('helvetica','bold');doc.setFontSize(9.3);doc.text(s,105,y,{align:'center'});}
 const sy=32;
 const top:[string,string,number][]=[
  ['Fecha:',texto(datos,'fecha_solicitud'),25],
  ['Registro inicial:',texto(datos,'registro_inicial'),23],
  ['Código interno (NIT):',texto(datos,'nit'),27]
 ];
 let x=14;
 top.forEach(([k,v,l])=>{celda(x,sy,l,12,k,true,7.1);x+=l;const valueW=k==='Fecha:'?27:k==='Registro inicial:'?20:60;celda(x,sy,valueW,12,v);x+=valueW;});
 titulo('INFORMACIÓN BÁSICA',52);
 let y=56;
 const basicos:[string,string][]=[
 ['Nombre o razón social de la empresa:',texto(datos,'nombre_empresa')],
 ['Actividad económica de la empresa:',texto(datos,'actividad_economica')],
 ['Número de identificación tributaria (NIT u otro):',texto(datos,'nit')],
 ['Dirección física de la empresa:',texto(datos,'direccion')],
 ['Teléfono(s):',texto(datos,'telefonos_empresa')],
 ['E-mail empresarial:',texto(datos,'email_empresarial')]
 ];
 basicos.forEach(([a,b],i)=>{const h=i===1?11:8.5;celda(14,y,91,h,a,true);celda(105,y,91,h,b);y+=h;});
 y+=6;titulo('INFORMACIÓN DE CONTACTOS',y);y+=4;
 contactos.forEach(([k,label])=>{const h=7.0;celda(14,y,91,h,label+':',true,7.3);celda(105,y,91,h,texto(datos,k),false,7.2);y+=h;});
 y+=7;titulo('DOCUMENTOS SOLICITADOS',y);y+=4;
 celda(14,y,182,22,texto(datos,'documentos_solicitados')||'Documentos pendientes de especificar',false,7.5);
 y+=26;
 doc.setFontSize(7.7);doc.setFont('helvetica','normal');doc.text('Observaciones / recepción:',14,y);
 doc.setDrawColor(120,120,120);doc.line(58,y+1,196,y+1);
 doc.save(`Solicitud_Datos_${texto(datos,'codigo_cliente')||'Cliente'}.pdf`);
}
