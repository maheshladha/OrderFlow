import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { demoCartons, demoFlow, demoHealth } from './demoData';

const fmtQty = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });
const fmtMoney = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function StatusPill({ value }) {
  const tone = value === 'Closed' || value === 'Loaded' ? 'good' : 'warn';
  return <span className={`status ${tone}`}><i />{value}</span>;
}

function Metric({ label, value, note, tone = '' }) {
  return <article className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function FlowStep({ code, label, value, detail, active, complete }) {
  return <div className={`flow-step ${complete ? 'complete' : ''} ${active ? 'active' : ''}`}>
    <div className="step-icon">{code}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
  </div>;
}

function App() {
  const [filters, setFilters] = useState({ from: '2026-10-01', to: '2026-10-27', poSerial: 'all' });
  const [applied, setApplied] = useState(filters);
  const [rows, setRows] = useState([]);
  const [cartons, setCartons] = useState([]);
  const [selected, setSelected] = useState(null);
  const [health] = useState(demoHealth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('items');
  const [page, setPage] = useState('orders');

  useEffect(() => {
    setLoading(true); setError('');
    const flow = demoFlow.filter(row => {
      const day = row.PODate.slice(0, 10);
      return day >= applied.from && day <= applied.to && (applied.poSerial === 'all' || String(row.POSerialNumber) === String(applied.poSerial));
    });
    const soSerials = new Set(flow.map(row => Number(row.SOSerialNumber)));
    const boxes = demoCartons.filter(box => soSerials.has(Number(box.SOSerialNumber)));
    setRows(flow); setCartons(boxes);
    if (flow.length && !selected) setSelected(String(flow[0].POSerialNumber));
    setLoading(false);
  }, [applied]);

  const orders = useMemo(() => {
    const map = new Map();
    rows.forEach(row => {
      const key = String(row.POSerialNumber);
      if (!map.has(key)) map.set(key, { ...row, lines: [], ordered: 0, packed: 0, despatched: 0, billed: 0, received: 0, orderedAmount: 0, billedAmount: 0, receivedAmount: 0 });
      const order = map.get(key); order.lines.push(row);
      order.ordered += Number(row.OrderedQuantity || 0); order.packed += Number(row.PackedQuantity || 0);
      order.despatched += Number(row.DespatchedQuantity || 0); order.billed += Number(row.BilledQuantity || 0);
      order.received += Number(row.ReceivedQuantity || 0);
      order.orderedAmount += Number(row.OrderedAmount || 0);
      order.billedAmount += Number(row.BilledAmount || 0);
      order.receivedAmount += Number(row.ReceivedAmount || 0);
    });
    return [...map.values()];
  }, [rows]);

  useEffect(() => { if (orders.length && !orders.some(o => String(o.POSerialNumber) === selected)) setSelected(String(orders[0].POSerialNumber)); }, [orders, selected]);
  const order = orders.find(o => String(o.POSerialNumber) === selected) || orders[0];
  const orderCartons = order ? cartons.filter(c => order.lines.some(l => Number(l.SOSerialNumber) && Number(l.SOSerialNumber) === Number(c.SOSerialNumber))) : cartons;
  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter(o => o.OrderStatus === 'Pending').length,
    closed: orders.filter(o => o.OrderStatus === 'Closed').length,
    cartons: cartons.length,
    loaded: cartons.filter(c => c.LoadingStatus === 'Loaded').length
  }), [orders, cartons]);

  const pageMeta = {
    orders: ['Order flow control', 'Trace every item from outlet purchase order to final receipt.'],
    loading: ['Loading sheets', 'Track packed cartons, loading numbers, drivers, vehicles and dispatch status.'],
    reports: ['Order reconciliation report', 'Compare ordered, billed and received quantities and values.']
  }[page];

  const FilterBar = () => <section className="filters panel">
    <label>From date<input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })}/></label>
    <label>To date<input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })}/></label>
    <label>Purchase order<select value={filters.poSerial} onChange={e => setFilters({ ...filters, poSerial: e.target.value })}><option value="all">All purchase orders</option>{orders.map(o => <option key={o.POSerialNumber} value={o.POSerialNumber}>{o.PurchaseOrderVchNumber}</option>)}</select></label>
    <button className="primary" onClick={() => setApplied(filters)}>Apply filters</button>
  </section>;

  return <div className="app-shell">
    <aside>
      <div className="brand"><div className="brand-mark">RF</div><div><strong>RanceFlow</strong><span>Order control tower</span></div></div>
      <nav>
        <button className={page === 'orders' ? 'active' : ''} onClick={() => setPage('orders')}>⌁ <span>Order flow</span></button>
        <button className={page === 'loading' ? 'active' : ''} onClick={() => setPage('loading')}>▦ <span>Loading sheets</span></button>
        <button className={page === 'reports' ? 'active' : ''} onClick={() => setPage('reports')}>▤ <span>Reports</span></button>
      </nav>
      <div className="connection"><i className={health?.ok ? 'online' : ''}/><div><strong>Demo snapshot</strong><span>{health?.databaseName || 'NEWDEMO'} · 27 Oct 2026</span></div></div>
    </aside>

    <main>
      <header><div><p className="eyebrow">SALES ORDER MANAGEMENT</p><h1>{pageMeta[0]}</h1><p>{pageMeta[1]}</p></div><button className="refresh" onClick={() => setApplied({ ...filters })}>↻ Refresh data</button></header>
      <FilterBar />
      {error && <div className="error">{error}</div>}

      {page === 'orders' && <>
        <section className="metrics">
          <Metric label="Purchase orders" value={stats.total} note={`${stats.pending} need attention`} />
          <Metric label="Pending" value={stats.pending} note="Not fully received" tone="amber" />
          <Metric label="Closed" value={stats.closed} note="Quantity fulfilled" tone="green" />
          <Metric label="Cartons packed" value={stats.cartons} note={`${stats.loaded} loaded for dispatch`} tone="blue" />
        </section>
        <section className="workspace">
          <div className="order-list panel">
            <div className="section-head"><div><span>ORDERS</span><strong>{orders.length} results</strong></div></div>
            <div className="order-scroll">{loading ? <div className="empty">Loading orders…</div> : orders.length === 0 ? <div className="empty">No orders in this period.</div> : orders.map(o => <button key={o.POSerialNumber} className={`order-card ${String(o.POSerialNumber) === selected ? 'selected' : ''}`} onClick={() => setSelected(String(o.POSerialNumber))}>
              <div><strong>PO {o.PurchaseOrderVchNumber}</strong><StatusPill value={o.OrderStatus}/></div><span>SO {o.SaleOrderVchNumber || 'Not converted'}</span><small>{new Date(o.PODate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small><div className="progress"><i style={{ width: `${Math.min(100, o.ordered ? (o.received/o.ordered)*100 : 0)}%` }}/></div><small>{fmtQty.format(o.received)} of {fmtQty.format(o.ordered)} received</small>
            </button>)}</div>
          </div>
          <div className="detail panel">
            {!order ? <div className="empty">Select an order to see its flow.</div> : <>
              <div className="detail-head"><div><p>PO {order.PurchaseOrderVchNumber}</p><h2>{order.SaleOrderVchNumber ? `SO ${order.SaleOrderVchNumber}` : 'Awaiting SO conversion'}</h2></div><StatusPill value={order.OrderStatus}/></div>
              <div className="flow-strip">
                <FlowStep code="PO" label="Ordered" value={fmtQty.format(order.ordered)} detail={`${order.lines.length} items`} complete />
                <FlowStep code="PK" label="Packed" value={fmtQty.format(order.packed)} detail={`${Math.max(...order.lines.map(x => Number(x.PackedCartonCount || 0)))} cartons`} complete={order.packed > 0}/>
                <FlowStep code="LD" label="Despatched" value={fmtQty.format(order.despatched)} detail="Loading sheet" complete={order.despatched > 0} active={order.packed > 0 && order.despatched === 0}/>
                <FlowStep code="SI" label="Billed" value={fmtQty.format(order.billed)} detail="Sale invoices" complete={order.billed > 0}/>
                <FlowStep code="PI" label="Received" value={fmtQty.format(order.received)} detail="Purchase invoices" complete={order.received >= order.ordered}/>
              </div>
              <div className="tabs"><button className={tab === 'items' ? 'active' : ''} onClick={() => setTab('items')}>Item reconciliation</button><button className={tab === 'cartons' ? 'active' : ''} onClick={() => setTab('cartons')}>Cartons & loading</button></div>
              {tab === 'items' ? <div className="table-wrap"><table><thead><tr><th>Item</th><th>Ordered</th><th>Packed</th><th>Despatched</th><th>Billed</th><th>Received</th><th>Pending</th><th>Status</th></tr></thead><tbody>{order.lines.map(line => <tr key={line.ProductID}><td><strong>{line.ProductName}</strong><small>{line.ProductID}</small></td><td>{fmtQty.format(line.OrderedQuantity)}<small>{fmtMoney.format(line.OrderedAmount)}</small></td><td>{fmtQty.format(line.PackedQuantity)}<small>{fmtMoney.format(line.PackedAmount)}</small></td><td>{fmtQty.format(line.DespatchedQuantity)}<small>{fmtMoney.format(line.DespatchedAmount)}</small></td><td>{fmtQty.format(line.BilledQuantity)}<small>{fmtMoney.format(line.BilledAmount)}</small></td><td>{fmtQty.format(line.ReceivedQuantity)}<small>{fmtMoney.format(line.ReceivedAmount)}</small></td><td className={Number(line.PendingQuantity) > 0 ? 'danger-text' : ''}>{fmtQty.format(line.PendingQuantity)}</td><td><StatusPill value={line.ItemStatus}/></td></tr>)}</tbody></table></div> : <div className="carton-grid">{orderCartons.length === 0 ? <div className="empty">No cartons found for this order.</div> : orderCartons.map(c => <article className="carton" key={c.SCSerialNumber}><div className="barcode">|||| ||| || |||||</div><div><span>CARTON / CHALLAN</span><h3>{c.CartonNumber}</h3></div><dl><div><dt>Packed</dt><dd>{new Date(c.PackingDate).toLocaleDateString('en-IN')}</dd></div><div><dt>Customer</dt><dd>{c.CustomerName || '—'}</dd></div><div><dt>Location</dt><dd>{c.LocationName || '—'}</dd></div><div><dt>Gross weight</dt><dd>{c.GrossWeight || 'Not entered'}</dd></div><div><dt>Loading no.</dt><dd>{Number(c.LoadingNo) ? c.LoadingNo : 'Not loaded'}</dd></div><div><dt>Vehicle</dt><dd>{c.VehicleNo || '—'}</dd></div></dl><StatusPill value={c.LoadingStatus}/></article>)}</div>}
            </>}
          </div>
        </section>
      </>}

      {page === 'loading' && <>
        <section className="metrics">
          <Metric label="Cartons packed" value={cartons.length} note="One challan per carton" />
          <Metric label="Loaded" value={stats.loaded} note="Assigned to loading sheet" tone="green" />
          <Metric label="Awaiting loading" value={cartons.length - stats.loaded} note="Ready in dispatch area" tone="amber" />
          <Metric label="Gross weight" value={fmtQty.format(cartons.reduce((a,c) => a + Number(c.GrossWeight || 0), 0))} note="Total entered weight" tone="blue" />
        </section>
        <section className="panel report-panel">
          <div className="section-head"><div><span>LOADING SHEETS</span><strong>{cartons.length} cartons</strong></div></div>
          <div className="table-wrap"><table><thead><tr><th>Carton / Challan</th><th>Packing date</th><th>Customer</th><th>Location</th><th>Gross weight</th><th>Loading no.</th><th>Loading date</th><th>Driver</th><th>Vehicle</th><th>Status</th></tr></thead><tbody>{cartons.length === 0 ? <tr><td colSpan="10"><div className="empty">No cartons in this period.</div></td></tr> : cartons.map(c => <tr key={c.SCSerialNumber}><td><strong>{c.CartonNumber}</strong><small>Serial {c.SCSerialNumber}</small></td><td>{new Date(c.PackingDate).toLocaleDateString('en-IN')}</td><td>{c.CustomerName || '—'}</td><td>{c.LocationName || '—'}</td><td>{c.GrossWeight || '—'}</td><td>{Number(c.LoadingNo) ? c.LoadingNo : '—'}</td><td>{Number(c.LoadingNo) ? new Date(c.LoadingDate).toLocaleDateString('en-IN') : '—'}</td><td>{c.DriverName || '—'}</td><td>{c.VehicleNo || '—'}</td><td><StatusPill value={c.LoadingStatus}/></td></tr>)}</tbody></table></div>
        </section>
      </>}

      {page === 'reports' && <>
        <section className="metrics">
          <Metric label="Ordered value" value={fmtMoney.format(orders.reduce((a,o) => a + o.orderedAmount, 0))} note={`${fmtQty.format(orders.reduce((a,o) => a + o.ordered, 0))} quantity`} />
          <Metric label="Billed value" value={fmtMoney.format(orders.reduce((a,o) => a + o.billedAmount, 0))} note={`${fmtQty.format(orders.reduce((a,o) => a + o.billed, 0))} quantity`} tone="blue" />
          <Metric label="Received value" value={fmtMoney.format(orders.reduce((a,o) => a + o.receivedAmount, 0))} note={`${fmtQty.format(orders.reduce((a,o) => a + o.received, 0))} quantity`} tone="green" />
          <Metric label="Pending orders" value={stats.pending} note="Require fulfilment or closure" tone="amber" />
        </section>
        <section className="panel report-panel">
          <div className="section-head"><div><span>HEADER LEVEL REPORT</span><strong>PO → SO → SC → SI → PI</strong></div></div>
          <div className="table-wrap"><table><thead><tr><th>PO / SO</th><th>Date</th><th>Ordered</th><th>Packed</th><th>Despatched</th><th>Billed</th><th>Received</th><th>Pending</th><th>Value variance</th><th>Status</th></tr></thead><tbody>{orders.length === 0 ? <tr><td colSpan="10"><div className="empty">No report data in this period.</div></td></tr> : orders.map(o => <tr key={o.POSerialNumber}><td><strong>PO {o.PurchaseOrderVchNumber}</strong><small>SO {o.SaleOrderVchNumber || '—'}</small></td><td>{new Date(o.PODate).toLocaleDateString('en-IN')}</td><td>{fmtQty.format(o.ordered)}<small>{fmtMoney.format(o.orderedAmount)}</small></td><td>{fmtQty.format(o.packed)}</td><td>{fmtQty.format(o.despatched)}</td><td>{fmtQty.format(o.billed)}<small>{fmtMoney.format(o.billedAmount)}</small></td><td>{fmtQty.format(o.received)}<small>{fmtMoney.format(o.receivedAmount)}</small></td><td className={o.ordered-o.received > 0 ? 'danger-text' : ''}>{fmtQty.format(o.ordered-o.received)}</td><td>{fmtMoney.format(o.receivedAmount-o.orderedAmount)}</td><td><StatusPill value={o.OrderStatus}/></td></tr>)}</tbody></table></div>
        </section>
      </>}
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
