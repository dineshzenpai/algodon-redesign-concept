import { useMemo, useState } from 'react';
import { adminMoney as money, useAdmin, useResource } from './context.jsx';
import { Badge, Button, DataTable, ResourceState } from './ui.jsx';
import { OrderEditor } from './Management.jsx';
import { StockEditor } from './Catalog.jsx';

export function Dashboard() {
  const a = useAdmin();
  const [range, setRange] = useState('30'), [custom, setCustom] = useState({ from: '', to: '' }), [applied, setApplied] = useState({ from: '', to: '' });
  const query = useMemo(() => {
    const to = range === 'custom' && applied.to ? new Date(applied.to + 'T23:59:59') : new Date();
    const from = range === 'custom' && applied.from ? new Date(applied.from + 'T00:00:00') : new Date();
    if (range !== 'custom' || !applied.from) {
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - (Number(range === 'custom' ? 30 : range) - 1));
    }
    return new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }).toString();
  }, [range, applied]);

  const resource = useResource('/dashboard?' + query);
  const recent = useResource('/orders?limit=5&page=1');

  return (
    <>
      <div className="toolbar">
        <span className="muted small">Live store analytics & performance</span>
        <div className="toolbar-right">
          <select id="dashboardRange" value={range} onChange={event => setRange(event.target.value)}>
            <option value="1">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="custom">Custom Date Range</option>
          </select>
          {range === 'custom' && (
            <>
              <input type="date" id="dashFrom" aria-label="From date" value={custom.from} onChange={event => setCustom({ ...custom, from: event.target.value })} />
              <input type="date" id="dashTo" aria-label="To date" value={custom.to} onChange={event => setCustom({ ...custom, to: event.target.value })} />
              <Button id="applyDashDates" onClick={() => setApplied(custom)}>Apply</Button>
            </>
          )}
        </div>
      </div>
      <ResourceState resource={resource}>
        {data => {
          const { kpis = {}, revenueByDay = [], ordersByStatus = {}, topProducts = [], salesByCategory = [], lowStock = [] } = data || {};
          const total = Object.values(ordersByStatus).reduce((acc, b) => acc + b, 0) || 1;
          const max = Math.max(1, ...revenueByDay.map(row => Number(row.amount || 0)));

          return (
            <>
              <div className="grid kpis">
                {[
                  ['Total Revenue', money(kpis.revenue)],
                  ['Total Orders', kpis.orders || 0],
                  ['Average Order Value', money(kpis.averageOrderValue)],
                  ['Unique Customers', kpis.newCustomers || 0],
                  ['Repeat Customer Rate', ((kpis.repeatCustomerRate || 0) * 100).toFixed(1) + '%']
                ].map(([label, value]) => (
                  <div className="card kpi" key={label}>
                    <div className="kpi-label">{label}</div>
                    <div className="kpi-value">{value}</div>
                  </div>
                ))}
              </div>

              <div className="grid dashboard-grid">
                {/* Revenue chart */}
                <section className="panel">
                  <h2>Revenue over time</h2>
                  {revenueByDay.length > 0 ? (
                    <div className="chart">
                      {revenueByDay.slice(-14).map(row => (
                        <div className="bar-column" key={row.date} title={`${row.date} · ${money(row.amount)}`}>
                          <div className="bar" style={{ height: Math.max(4, Number(row.amount || 0) / max * 100) + '%' }} />
                          <span>{row.date.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted small" style={{ padding: '30px 0', textAlign: 'center' }}>No revenue recorded for this period.</p>
                  )}
                </section>

                {/* Orders by status */}
                <section className="panel">
                  <h2>Orders by status</h2>
                  <div className="status-list">
                    {Object.entries(ordersByStatus).length ? (
                      Object.entries(ordersByStatus).map(([status, count]) => (
                        <div key={status}>
                          <div className="status-row">
                            <span>{status}</span>
                            <strong>{count}</strong>
                          </div>
                          <div className="status-track">
                            <div className="status-fill" style={{ width: (count / total * 100) + '%' }} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="muted small">No orders in this period.</p>
                    )}
                  </div>
                </section>

                {/* Top products */}
                <section className="panel">
                  <h2>Top products</h2>
                  <div className="alerts">
                    {topProducts.length ? (
                      topProducts.map(product => (
                        <div className="alert-row" key={product.id || product.name}>
                          <span>{product.name}</span>
                          <strong>{product.quantity} sold</strong>
                        </div>
                      ))
                    ) : (
                      <p className="muted small">No product sales in this period.</p>
                    )}
                  </div>
                </section>

                {/* Sales by category */}
                <section className="panel">
                  <h2>Sales by category</h2>
                  <div className="alerts">
                    {salesByCategory.length ? (
                      salesByCategory.map(category => (
                        <div className="alert-row" key={category.id || category.name}>
                          <span>{category.name}</span>
                          <strong>{money(category.amount)}</strong>
                        </div>
                      ))
                    ) : (
                      <p className="muted small">Category sales appear after products are purchased.</p>
                    )}
                  </div>
                </section>

                {/* Recent orders with quick edit action */}
                <section className="panel">
                  <h2>Recent orders</h2>
                  <ResourceState resource={recent}>
                    {result => result.data?.length ? (
                      <DataTable columns={['Order', 'Customer', 'Total', 'Status', 'Actions']}>
                        {result.data.map(order => (
                          <tr key={order.id}>
                            <td>
                              <span className="cell-title">{order.id.slice(0, 8)}</span>
                            </td>
                            <td>{order.customer?.name || order.customer?.email || 'Guest'}</td>
                            <td>{money(order.subtotal - (order.discount || 0))}</td>
                            <td><Badge value={order.status} /></td>
                            <td>
                              <Button
                                data-order={order.id}
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => a.openModal(<OrderEditor id={order.id} />)}
                              >
                                View ↗
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </DataTable>
                    ) : (
                      <p className="muted small">No recent orders.</p>
                    )}
                  </ResourceState>
                </section>

                {/* Low stock alerts with quick restock action */}
                <section className="panel">
                  <h2>Low stock alerts</h2>
                  <div className="alerts">
                    {lowStock.length ? (
                      lowStock.map(product => (
                        <div className="alert-row" key={product.id}>
                          <span>{product.name}</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Badge value={product.stock_count + ' left'} />
                            {a.canEdit && (
                              <Button
                                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                onClick={() => a.openModal(<StockEditor ids={[product.id]} initialStock={product.stock_count} />)}
                              >
                                Restock
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="muted small">No low stock alerts. All inventory healthy.</p>
                    )}
                  </div>
                </section>
              </div>
            </>
          );
        }}
      </ResourceState>
    </>
  );
}
