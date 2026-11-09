import { useRef, useState } from 'react';
import { adminMoney as money, useAdmin, useResource } from './context.jsx';
import { Badge, Button, Check, DataTable, Field, ModalActions, ResourceState, Select, TablePage, Textarea } from './ui.jsx';
import { compressImage, csvDownload, parseCsv, slugify } from './helpers.js';
import { safeImageUrl } from '../shared/safety.js';

export function Products(){
  const a=useAdmin(),[page,setPage]=useState(1),[search,setSearch]=useState(''),[visibility,setVisibility]=useState(''),[selected,setSelected]=useState([]),input=useRef(null);
  const query=new URLSearchParams({page:String(page),limit:'25',q:search});if(visibility)query.set('published',visibility);
  const resource=useResource('/products?'+query);
  async function action(path,method='POST',body={}){try{await a.api(path,{method,body:JSON.stringify(body)});a.notify('Products updated.');a.refresh();setSelected([]);}catch(error){a.notify(error.message,true);}}
  async function stock(ids){if(!ids.length)return a.notify('Select products first.',true);const value=prompt('Set stock count for '+ids.length+' products');if(value===null)return;const count=Number(value);if(!Number.isInteger(count)||count<0)return a.notify('Enter a non-negative whole number.',true);await action('/products/bulk-stock','PATCH',{items:ids.map(id=>({id,stock_count:count}))});}
  async function importCsv(event){
    const file=event.target.files[0];if(!file)return;
    try{
      const safeArray=val=>{if(!val)return [];try{const p=JSON.parse(val);return Array.isArray(p)?p:[p];}catch{return String(val).split(',').map(s=>s.trim()).filter(Boolean);}};
      const safeVariants=val=>{if(!val)return [];try{const p=JSON.parse(val);return Array.isArray(p)?p:[];}catch{return [];}};
      const rows=parseCsv(await file.text()).map(row=>({...row,price:Number(row.price),sale_price:row.sale_price?Number(row.sale_price):null,stock_count:Number(row.stock_count||0),low_stock_threshold:Number(row.low_stock_threshold||5),published:row.published==='true',out_of_stock_hidden:row.out_of_stock_hidden==='true',tags:safeArray(row.tags),variants:safeVariants(row.variants),images:safeArray(row.images),category_id:row.category_id||null}));
      const result=await a.api('/products/import',{method:'POST',body:JSON.stringify({products:rows})});a.notify(result.imported+' products imported.');a.refresh();
    }catch(error){a.notify(error.message,true);}finally{event.target.value='';}
  }
  async function exportCsv(){try{csvDownload('algodon-products.csv',(await a.api('/products/export')).data);}catch(error){a.notify(error.message,true);}}
  const tools=<><select id="productVisibility" aria-label="Product visibility" value={visibility} onChange={event=>{setVisibility(event.target.value);setPage(1);setSelected([]);}}><option value="">All products</option><option value="true">Published</option><option value="false">Drafts</option></select>{a.canEdit&&<><Button id="bulkStock" onClick={()=>stock(selected)}>Bulk stock</Button><Button id="productImport" onClick={()=>input.current.click()}>Import CSV</Button><input hidden type="file" ref={input} accept=".csv,text/csv" onChange={importCsv}/><Button id="productExport" onClick={exportCsv}>Export CSV</Button><Button primary id="addProduct" onClick={()=>a.openModal(<ProductEditor/>)}>Add product</Button></>}</>;
  return <ResourceState resource={resource}>{result=><TablePage title="Products" columns={['Product','Price','Stock','Visibility','Actions']} search={search} setSearch={setSearch} page={page} setPage={setPage} pagination={result} tools={tools} rows={result.data.map(product=><tr key={product.id}><td>{a.canEdit&&<input type="checkbox" aria-label={'Select '+product.name} checked={selected.includes(product.id)} onChange={event=>setSelected(ids=>event.target.checked?[...ids,product.id]:ids.filter(id=>id!==product.id))}/>}<div className="cell-title">{product.name}</div><div className="cell-sub">{product.sku||product.slug}</div></td><td>{money(product.sale_price??product.price)}</td><td>{product.stock_count}</td><td><Badge value={product.published?'Published':'Draft'}/></td><td><div className="row-actions">{a.canEdit&&<><Button data-edit-product={product.id} onClick={()=>a.openModal(<ProductEditor product={product}/>)}>Edit</Button><Button onClick={()=>stock([product.id])}>Stock</Button><Button onClick={()=>action('/products/'+product.id+'/duplicate')}>Copy</Button><Button danger onClick={()=>{if(confirm('Delete this product? This cannot be undone.'))action('/products/'+product.id,'DELETE');}}>Delete</Button></>}</div></td></tr>)}/>}</ResourceState>;
}
function ProductEditor({product={}}){
  const a=useAdmin(),resource=useResource('/categories'),
    [images,setImages]=useState(product.images||[]),
    [files,setFiles]=useState([]),
    [deleted,setDeleted]=useState([]),
    [saving,setSaving]=useState(false),
    [dragging,setDragging]=useState(false),
    [error,setError]=useState(''),
    [newImageUrl,setNewImageUrl]=useState('');
  const fileInputRef=useRef(null);

  function addImageUrl() {
    const url = String(newImageUrl || '').trim();
    if (!url) return;
    if (!url.startsWith('/') && !url.startsWith('https://') && !url.startsWith('data:image/')) {
      setError('Image URL must start with "/" (relative path) or "https://" (secure URL).');
      return;
    }
    if (images.length + files.length >= 20) {
      setError('Maximum 20 images allowed per product.');
      return;
    }
    setImages(prev => [...prev, url]);
    setNewImageUrl('');
    setError('');
  }

  function handleFiles(selectedFiles) {
    const list = Array.from(selectedFiles || []);
    if (!list.length) return;
    if (images.length + files.length + list.length > 20) {
      setError('Maximum 20 images allowed per product.');
      return;
    }
    setFiles(prev => [...prev, ...list]);
    setError('');
  }

  async function submit(event){
    event.preventDefault();const form=event.currentTarget,f=form.elements;setSaving(true);setError('');
    try{
      const variants=JSON.parse(f.variants.value||'[]');if(!Array.isArray(variants))throw new Error('Variants must be a JSON array.');
      let uploadedImages=[...images];
      if(files.length){
        if(files.length>12)throw new Error('Upload up to 12 new image files at a time.');
        const body=new FormData();
        for(const file of files)body.append('images',await compressImage(file));
        const result=await a.api('/images',{method:'POST',body});
        uploadedImages.push(...result.data.map(item=>item.url));
        setImages(uploadedImages);
        setFiles([]);
      }
      const payload={name:f.name.value.trim(),slug:f.slug.value.trim(),sku:f.sku.value.trim()||null,brand:f.brand.value,price:Number(f.price.value),sale_price:f.sale_price.value?Number(f.sale_price.value):null,stock_count:variants.length?variants.reduce((sum,v)=>sum+Number(v.stock||0),0):Number(f.stock_count.value),low_stock_threshold:Number(f.low_stock_threshold.value),category_id:f.category_id.value||null,tags:f.tags.value.split(',').map(value=>value.trim()).filter(Boolean),description:f.description.value,variants,seo_title:f.seo_title.value,meta_description:f.meta_description.value,images:uploadedImages,published:f.published.checked,out_of_stock_hidden:f.out_of_stock_hidden.checked};
      await a.api(product.id?'/products/'+product.id:'/products',{method:product.id?'PATCH':'POST',body:JSON.stringify(payload)});
      for(const url of deleted)await a.api('/images',{method:'DELETE',body:JSON.stringify({url})}).catch(()=>a.notify('Product saved; an unused image could not be removed.',true));
      a.closeModal();a.notify('Product saved.');a.refresh();
    }catch(error){setError(error.message);}finally{setSaving(false);}
  }
  return <><h2>{product.id?'Edit product':'Add product'}</h2><ResourceState resource={resource}>{result=><form id="editForm" onSubmit={submit}><div className="form-grid">
    <Field name="name" label="Name" value={product.name} required onChange={event=>{if(!product.id)event.target.form.elements.slug.value=slugify(event.target.value);}}/><Field name="slug" label="Slug" value={product.slug} required/><Field name="sku" label="SKU" value={product.sku}/><Field name="brand" label="Brand" value={product.brand||'Algodon Organic'}/>
    <Field name="price" label="Price (₹)" value={product.price} required type="number"/><Field name="sale_price" label="Sale price (₹)" value={product.sale_price} type="number"/><Field name="stock_count" label="Stock count" value={product.stock_count??0} required type="number" step="1"/><Field name="low_stock_threshold" label="Low stock alert at" value={product.low_stock_threshold??5} required type="number" step="1"/>
    <Select name="category_id" label="Category" value={product.category_id}><option value="">No category</option>{result.data.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</Select><Field name="tags" label="Tags · comma separated" value={(product.tags||[]).join(', ')}/>
    <Textarea name="description" label="Description" value={product.description} maxLength="10000"/><Textarea name="variants" label={'Variants · JSON (example: [{"size":"M","stock":5}])'} value={JSON.stringify(product.variants||[],null,2)} rows="3"/>
    <Field name="seo_title" label="SEO title" value={product.seo_title}/><Field name="meta_description" label="Meta description" value={product.meta_description} maxLength="320"/>
    <div className="field full" style={{ border: '1px solid var(--admin-line)', padding: '16px', borderRadius: '8px', background: 'var(--admin-card-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <label htmlFor="imageFiles" style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>
          Product Pictures ({images.length + files.length} added)
        </label>
        <span className="small muted">Max 20 pictures · Picture #1 is the main catalog cover</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
        <Button
          type="button"
          primary
          id="addPicsBtn"
          onClick={() => fileInputRef.current?.click()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          📁 Add Pictures from Device
        </Button>
        <input
          ref={fileInputRef}
          id="imageFiles"
          name="image_files"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          hidden
          onChange={event => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />

        <div style={{ display: 'flex', gap: '6px', flex: '1 1 280px' }}>
          <input
            type="text"
            placeholder="Or enter picture URL / path (e.g. /img/... or https://...)"
            value={newImageUrl}
            onChange={e => setNewImageUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addImageUrl(); } }}
            style={{ flex: 1, padding: '7px 10px', fontSize: '0.85rem' }}
          />
          <Button type="button" onClick={addImageUrl}>+ Add Picture URL</Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
        <span className="small muted">Quick add detail shots:</span>
        <Button
          type="button"
          onClick={() => {
            if (!images.includes('/img/story-texture.jpg')) setImages(prev => [...prev, '/img/story-texture.jpg']);
          }}
          style={{ fontSize: '0.74rem', padding: '3px 8px' }}
        >
          + Fabric Close-up
        </Button>
        <Button
          type="button"
          onClick={() => {
            if (!images.includes('/img/story-label.jpg')) setImages(prev => [...prev, '/img/story-label.jpg']);
          }}
          style={{ fontSize: '0.74rem', padding: '3px 8px' }}
        >
          + Collar & Buttons
        </Button>
      </div>

      <div
        className={'drop-zone' + (dragging ? ' dragging' : '')}
        id="imageDrop"
        onDragOver={event => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{ cursor: 'pointer', padding: '14px', marginBottom: '14px' }}
      >
        Drop images here or click to choose files from device
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px', marginTop: '10px' }}>
        {images.map((url, index) => (
          <div
            key={url + index}
            style={{
              position: 'relative',
              borderRadius: '8px',
              border: index === 0 ? '2px solid var(--admin-accent)' : '1px solid var(--admin-line)',
              overflow: 'hidden',
              background: 'var(--admin-surface)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
            }}
          >
            <div style={{ position: 'relative', aspectRatio: '1', width: '100%', background: 'var(--admin-table-row-alt)' }}>
              <img
                src={safeImageUrl(url)}
                alt={'Product image ' + (index + 1)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  left: '4px',
                  background: index === 0 ? 'var(--admin-accent)' : 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
              >
                {index === 0 ? '★ Cover' : `#${index + 1}`}
              </span>
              <button
                type="button"
                title="Remove picture"
                onClick={() => {
                  if (url.includes('/storage/v1/object/public/admin-product-images/')) setDeleted(prev => [...prev, url]);
                  setImages(prev => prev.filter((_, i) => i !== index));
                }}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'rgba(200, 40, 40, 0.85)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '22px',
                  height: '22px',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', background: 'var(--admin-table-row-alt)' }}>
              <Button
                type="button"
                disabled={index === 0}
                onClick={() => setImages(prev => { const n = [...prev]; [n[index - 1], n[index]] = [n[index], n[index - 1]]; return n; })}
                style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                title="Move left"
              >
                ←
              </Button>
              <Button
                type="button"
                disabled={index === images.length - 1}
                onClick={() => setImages(prev => { const n = [...prev]; [n[index + 1], n[index]] = [n[index], n[index + 1]]; return n; })}
                style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                title="Move right"
              >
                →
              </Button>
            </div>
          </div>
        ))}

        {files.map((file, fileIndex) => (
          <div
            key={file.name + fileIndex}
            style={{
              position: 'relative',
              borderRadius: '8px',
              border: '2px dashed var(--admin-accent)',
              overflow: 'hidden',
              background: 'var(--admin-surface)'
            }}
          >
            <div style={{ position: 'relative', aspectRatio: '1', width: '100%', background: 'var(--admin-table-row-alt)' }}>
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  left: '4px',
                  background: '#27ae60',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: '4px'
                }}
              >
                New Upload
              </span>
              <button
                type="button"
                title="Remove file"
                onClick={() => setFiles(prev => prev.filter((_, i) => i !== fileIndex))}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'rgba(200, 40, 40, 0.85)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '22px',
                  height: '22px',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '4px 6px', fontSize: '0.68rem', color: 'var(--admin-ink-muted)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {file.name}
            </div>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: '10px' }}>
        Pictures compress to WebP in your browser before saving. Use arrows to change order; picture #1 will be shown as the primary picture.
      </p>
    </div>
    <Check name="published" label="Published on storefront" checked={product.published}/><Check name="out_of_stock_hidden" label="Hide when out of stock" checked={product.out_of_stock_hidden}/>
  </div><p className="error" role="alert">{error}</p><ModalActions saving={saving} label="Save product"/></form>}</ResourceState></>;
}
export function Categories(){
  const a=useAdmin(),resource=useResource('/categories');
  async function move(data,index,direction){const reordered=[...data];[reordered[index],reordered[index+direction]]=[reordered[index+direction],reordered[index]];try{await a.api('/categories/reorder',{method:'PATCH',body:JSON.stringify({items:reordered.map((category,i)=>({id:category.id,sort_order:i}))})});a.refresh();a.notify('Category order saved.');}catch(error){a.notify(error.message,true);}}
  async function remove(id){if(!confirm('Delete this category? Products will keep their details and have no category.'))return;try{await a.api('/categories/'+id,{method:'DELETE'});a.refresh();a.notify('Category deleted.');}catch(error){a.notify(error.message,true);}}
  return <ResourceState resource={resource}>{({data})=><><div className="toolbar"><span className="muted small">Organize product collections and category artwork.</span>{a.canEdit&&<Button primary id="addCategory" onClick={()=>a.openModal(<CategoryEditor categories={data}/>)}>Add category</Button>}</div><DataTable columns={['Name','Slug','Order','Status','Actions']} empty="No categories yet.">{data.map((category,index)=><tr key={category.id}><td><span className="cell-title">{category.name}</span></td><td>{category.slug}</td><td>{category.sort_order}</td><td><Badge value={category.active?'Active':'Inactive'}/></td><td><div className="row-actions">{a.canEdit&&<><Button disabled={index===0} onClick={()=>move(data,index,-1)}>↑</Button><Button disabled={index===data.length-1} onClick={()=>move(data,index,1)}>↓</Button><Button onClick={()=>a.openModal(<CategoryEditor category={category} categories={data}/>)}>Edit</Button><Button danger onClick={()=>remove(category.id)}>Delete</Button></>}</div></td></tr>)}</DataTable></>}</ResourceState>;
}
function CategoryEditor({category={},categories}){
  const a=useAdmin(),[saving,setSaving]=useState(false),[error,setError]=useState('');
  async function submit(event){event.preventDefault();const f=event.currentTarget.elements;setSaving(true);setError('');try{await a.api(category.id?'/categories/'+category.id:'/categories',{method:category.id?'PATCH':'POST',body:JSON.stringify({name:f.name.value,slug:f.slug.value,sort_order:Number(f.sort_order.value),parent_id:f.parent_id.value||null,image_url:f.image_url.value||null,description:f.description.value,active:f.active.checked})});a.closeModal();a.refresh();a.notify('Category saved.');}catch(error){setError(error.message);}finally{setSaving(false);}}
  return <><h2>{category.id?'Edit':'Add'} category</h2><form id="editForm" onSubmit={submit}><div className="form-grid"><Field name="name" label="Name" value={category.name} required onChange={event=>{if(!category.id)event.target.form.elements.slug.value=slugify(event.target.value);}}/><Field name="slug" label="Slug" value={category.slug} required/><Field name="sort_order" label="Sort order" value={category.sort_order||0} type="number" step="1" required/><Select name="parent_id" label="Parent category" value={category.parent_id}><option value="">Top level</option>{categories.filter(item=>item.id!==category.id).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select><Field name="image_url" label="Category image URL" value={category.image_url} type="url"/><Textarea name="description" label="Description" value={category.description} rows="3"/><Check name="active" label="Active" checked={category.active!==false}/></div><p className="error" role="alert">{error}</p><ModalActions saving={saving} label="Save category"/></form></>;
}
