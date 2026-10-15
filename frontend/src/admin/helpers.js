export function parseCsv(text) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted&&ch==='"'&&text[i+1]==='"'){cell+='"';i++;}
    else if(ch==='"')quoted=!quoted;
    else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(value=>value!==''))rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(quoted)throw new Error('CSV contains an unclosed quote.');
  if(cell||row.length){row.push(cell);rows.push(row);}
  if(!rows.length)return [];
  const keys=rows.shift();return rows.map(values=>Object.fromEntries(keys.map((key,i)=>[key,values[i]||''])));
}
export function csvDownload(filename,rows) {
  if(!rows.length)throw new Error('There is no data to export.');
  const columns=Object.keys(rows[0]);
  const quote=value=>{
    let text=String(typeof value==='object'&&value!==null?JSON.stringify(value):value??'');
    if(/^[\s]*[=+@-]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  const csv=[columns.map(quote).join(','),...rows.map(row=>columns.map(key=>quote(row[key])).join(','))].join('\r\n');
  const link=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function compressImage(file) {
  if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))throw new Error('Choose a JPEG, PNG, WebP, or AVIF image.');
  const image=await createImageBitmap(file),scale=Math.min(1,2200/Math.max(image.width,image.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.84));
  if(!blob)throw new Error('Image compression failed.');
  return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp'});
}
export const slugify=value=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
