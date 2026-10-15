import { useMemo, useState } from 'react';
import { adminMoney as money, useResource } from './context.jsx';
import { Badge, Button, DataTable, ResourceState } from './ui.jsx';

export function Dashboard(){
  const [range,setRange]=useState('30'),[custom,setCustom]=useState({from:'',to:''}),[applied,setApplied]=useState({from:'',to:''});
  const query=useMemo(()=>{
    const to=range==='custom'&&applied.to?new Date(applied.to+'T23:59:59'):new Date();
    const from=range==='custom'&&applied.from?new Date(applied.from+'T00:00:00'):new Date();
    if(range!=='custom'||!applied.from){from.setHours(0,0,0,0);from.setDate(from.getDate()-(Number(range==='custom'?30:range)-1));}
    return new URLSearchParams({from:from.toISOString(),to:to.toISOString()}).toString();
  },[range,applied]);
  const resource=useResource('/dashboard?'+query),recent=useResource('/orders?limit=5&page=1');
  return <><div className="toolbar"><span className="muted small">Sales performance</span><div className="toolbar-right"><select id="dashboardRange" value={range} onChange={event=>setRange(event.target.value)}><option value="1">Today</option><option value="7">7 days</option><option value="30">30 days</option><option value="custom">Custom</option></select>{range==='custom'&&<><input type="date" id="dashFrom" aria-label="From date" value={custom.from} onChange={event=>setCustom({...custom,from:event.target.value})}/><input type="date" id="dashTo" aria-label="To date" value={custom.to} onChange={event=>setCustom({...custom,to:event.target.value})}/><Button id="applyDashDates" onClick={()=>setApplied(custom)}>Apply</Button></>}</div></div><ResourceState resource={resource}>{data=>{
    const {kpis,revenueByDay=[],ordersByStatus={},topProducts=[],salesByCategory=[],lowStock=[]}=data,total=Object.values(ordersByStatus).reduce((a,b)=>a+b,0)||1,max=Math.max(1,...revenueByDay.map(row=>Number(row.amount||0)));
    return <><div className="grid kpis">{[['Revenue',money(kpis.revenue)],['Orders',kpis.orders],['Average order',money(kpis.averageOrderValue)],['New customers',kpis.newCustomers],['Repeat customer rate',((kpis.repeatCustomerRate||0)*100).toFixed(1)+'%']].map(([label,value])=><div className="card kpi" key={label}><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div></div>)}</div><div className="grid dashboard-grid">
      <section className="panel"><h2>Revenue over time</h2><div className="chart">{revenueByDay.slice(-14).map(row=><div className="bar-column" key={row.date} title={row.date+' · '+money(row.amount)}><div className="bar" style={{height:Math.max(3,Number(row.amount||0)/max*100)+'%'}}/><span>{row.date.slice(5)}</span></div>)}</div></section>
      <section className="panel"><h2>Orders by status</h2><div className="status-list">{Object.entries(ordersByStatus).length?Object.entries(ordersByStatus).map(([status,count])=><div key={status}><div className="status-row"><span>{status}</span><strong>{count}</strong></div><div className="status-track"><div className="status-fill" style={{width:count/total*100+'%'}}/></div></div>):<p className="muted small">No orders in this period.</p>}</div></section>
      <section className="panel"><h2>Top products</h2><div className="alerts">{topProducts.length?topProducts.map(product=><div className="alert-row" key={product.id||product.name}><span>{product.name}</span><strong>{product.quantity}</strong></div>):<p className="muted small">No product sales in this period.</p>}</div></section>
      <section className="panel"><h2>Sales by category</h2><div className="alerts">{salesByCategory.length?salesByCategory.map(category=><div className="alert-row" key={category.id||category.name}><span>{category.name}</span><strong>{money(category.amount)}</strong></div>):<p className="muted small">Category sales appear after product IDs are saved with orders.</p>}</div></section>
      <section className="panel"><h2>Recent orders</h2><ResourceState resource={recent}>{result=>result.data?.length?<DataTable columns={['Order','Customer','Total','Status']}>{result.data.map(order=><tr key={order.id}><td>{order.id.slice(0,8)}</td><td>{order.customer?.name||order.customer?.email||'Guest'}</td><td>{money(order.subtotal-(order.discount||0))}</td><td><Badge value={order.status}/></td></tr>)}</DataTable>:<p className="muted small">No recent orders.</p>}</ResourceState></section>
      <section className="panel"><h2>Low stock</h2><div className="alerts">{lowStock.length?lowStock.map(product=><div className="alert-row" key={product.id}><span>{product.name}</span><Badge value={product.stock_count+' left'}/></div>):<p className="muted small">No low stock alerts.</p>}</div></section>
    </div></>;
  }}</ResourceState></>;
}
