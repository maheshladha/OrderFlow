import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const fmtQty = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });
const fmtMoney = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const rateTypeLabels = {
  purchase_rate: "Purchase Rate",
  purchase_cost: "Purchase Cost",
  sale_rate: "Sale Rate",
};

function getDeliveryTiming(deliveryDate, orderStatus) {
  if (!deliveryDate || orderStatus === "Closed") return null;
  const today = new Date();
  const due = new Date(deliveryDate);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  if (days < 0)
    return {
      label: `Overdue by ${Math.abs(days)} day${days === -1 ? "" : "s"}`,
      tone: "overdue",
    };
  if (days === 0) return { label: "Delivery today", tone: "today" };
  return {
    label: `Delivery in ${days} day${days === 1 ? "" : "s"}`,
    tone: "upcoming",
  };
}

function StatusPill({ value }) {
  const tone = value === "Closed" || value === "Loaded" ? "good" : "warn";
  return (
    <span className={`status ${tone}`}>
      <i />
      {value}
    </span>
  );
}

function Metric({ label, value, note, tone = "" }) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function FlowStep({
  code,
  label,
  value,
  detail,
  memo,
  date,
  active,
  complete,
}) {
  const [memoOpen, setMemoOpen] = useState(false);
  const memoControlRef = useRef(null);
  const memoNumbers = memo
    ? String(memo)
        .split(",")
        .map((number) => number.trim())
        .filter(Boolean)
    : [];

  useEffect(() => {
    if (!memoOpen) return undefined;
    const closeOutside = (event) => {
      if (!memoControlRef.current?.contains(event.target)) setMemoOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMemoOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [memoOpen]);

  return (
    <div
      className={`flow-step ${complete ? "complete" : ""} ${active ? "active" : ""} ${memoOpen ? "memo-open" : ""}`}
    >
      <div className="step-icon">{code}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
        {memo !== undefined && (
          <div className="memo-control" ref={memoControlRef}>
            <button
              type="button"
              className="memo-toggle"
              disabled={memoNumbers.length === 0}
              onClick={() => setMemoOpen((open) => !open)}
              aria-expanded={memoOpen}
            >
              ☰{" "}
              {memoNumbers.length
                ? `${memoNumbers.length} memo${memoNumbers.length === 1 ? "" : "s"}`
                : "No memo"}
            </button>
            {memoOpen && (
              <div className="memo-menu">
                <div className="memo-menu-head">
                  <strong>{label} memos</strong>
                  <small>Stage total: {value}</small>
                  <small>Latest date: {date}</small>
                </div>
                {memoNumbers.map((number, index) => (
                  <div className="memo-menu-item" key={`${number}-${index}`}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{number}</strong>
                      <small>{label} memo</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <small className="step-date">{date}</small>
      </div>
    </div>
  );
}

function CartonCard({ carton }) {
  const [itemsOpen, setItemsOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const itemControlRef = useRef(null);

  useEffect(() => {
    if (!itemsOpen) return undefined;
    const closeOutside = (event) => {
      if (!itemControlRef.current?.contains(event.target)) setItemsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setItemsOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [itemsOpen]);

  const toggleItems = () => {
    const opening = !itemsOpen;
    setItemsOpen(opening);
    if (!opening || items.length || itemsLoading) return;
    setItemsLoading(true);
    setItemsError("");
    fetch(`/api/cartons/${carton.SCSerialNumber}/items`)
      .then((response) =>
        response.ok
          ? response.json()
          : response
              .json()
              .then((body) =>
                Promise.reject(new Error(body.error || "Unable to load items")),
              ),
      )
      .then(setItems)
      .catch((error) => setItemsError(error.message))
      .finally(() => setItemsLoading(false));
  };

  return (
    <article className={`carton ${itemsOpen ? "items-open" : ""}`}>
      <div className="carton-head">
        <div>
          <span>CARTON</span>
          <h3>{carton.CartonNumber}</h3>
        </div>
        <div className="carton-item-control" ref={itemControlRef}>
          <button
            type="button"
            className="carton-item-toggle"
            onClick={toggleItems}
            aria-expanded={itemsOpen}
            aria-label={`Show items in carton ${carton.CartonNumber}`}
          >
            ☰
          </button>
          {itemsOpen && (
            <div className="carton-item-menu">
              <div className="carton-item-menu-head">
                <strong>Carton {carton.CartonNumber}</strong>
                <small>
                  {items.length} item{items.length === 1 ? "" : "s"}
                </small>
              </div>
              {itemsLoading ? (
                <div className="carton-item-state">Loading items…</div>
              ) : itemsError ? (
                <div className="carton-item-state error-text">{itemsError}</div>
              ) : items.length === 0 ? (
                <div className="carton-item-state">No items found.</div>
              ) : (
                items.map((item) => (
                  <div className="carton-item-row" key={item.ProductID}>
                    <div>
                      <strong>{item.ProductName || item.ProductID}</strong>
                      <small>{item.ProductID}</small>
                    </div>
                    <div>
                      <strong>{fmtQty.format(item.Quantity)}</strong>
                      <small>{fmtMoney.format(item.Amount)}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <dl>
        <div>
          <dt>Packed</dt>
          <dd>{new Date(carton.PackingDate).toLocaleDateString("en-IN")}</dd>
        </div>
        <div>
          <dt>Customer</dt>
          <dd>{carton.CustomerName || "—"}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{carton.LocationName || "—"}</dd>
        </div>
        <div>
          <dt>Gross weight</dt>
          <dd>{carton.GrossWeight || "Not entered"}</dd>
        </div>
        <div>
          <dt>Loading no.</dt>
          <dd>{Number(carton.LoadingNo) ? carton.LoadingNo : "Not loaded"}</dd>
        </div>
        <div>
          <dt>Vehicle</dt>
          <dd>{carton.VehicleNo || "—"}</dd>
        </div>
      </dl>
      <StatusPill value={carton.LoadingStatus} />
    </article>
  );
}

function App() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [filters, setFilters] = useState({
    from: iso(monthStart),
    to: iso(today),
    locationID: "all",
    orderType: "franchisee",
    rateType: "purchase_rate",
    status: "all",
  });
  const [applied, setApplied] = useState(filters);
  const [allRows, setAllRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [cartons, setCartons] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("items");
  const [page, setPage] = useState("orders");

  useEffect(() => {
    fetch("/api/health")
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Database unavailable")),
      )
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
    fetch("/api/locations")
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Unable to load locations")),
      )
      .then(setLocations)
      .catch((error) => setError(error.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      from: applied.from,
      to: applied.to,
      rateType: applied.rateType,
    });
    Promise.all([
      fetch(`/api/flow?${query}`).then((response) =>
        response.ok
          ? response.json()
          : response
              .json()
              .then((body) =>
                Promise.reject(
                  new Error(body.error || "Unable to load orders"),
                ),
              ),
      ),
      fetch(`/api/cartons?${query}`).then((response) =>
        response.ok
          ? response.json()
          : response
              .json()
              .then((body) =>
                Promise.reject(
                  new Error(body.error || "Unable to load cartons"),
                ),
              ),
      ),
    ])
      .then(([flow, boxes]) => {
        setAllRows(flow);
        const filtered = flow.filter(
          (row) =>
            row.OrderType === applied.orderType &&
            (applied.locationID === "all" ||
              String(row.LocationID) === String(applied.locationID) ||
              (row.OrderType === "transfers" &&
                String(row.ToLocationID) === String(applied.locationID))) &&
            (applied.status === "all" ||
              String(row.OrderStatus).toLowerCase() === applied.status),
        );
        const orderSerials = new Set(
          filtered.map((row) => String(row.OrderSerialNumber)),
        );
        setRows(filtered);
        setCartons(
          boxes.filter(
            (box) =>
              box.OrderType === applied.orderType &&
              orderSerials.has(String(box.OrderSerialNumber)),
          ),
        );
      })
      .catch((error) => setError(error.message))
      .finally(() => setLoading(false));
  }, [applied]);

  const orders = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = String(row.OrderSerialNumber);
      if (!map.has(key))
        map.set(key, {
          ...row,
          lines: [],
          ordered: 0,
          packed: 0,
          despatched: 0,
          billed: 0,
          received: 0,
          pending: 0,
          orderedAmount: 0,
          despatchedAmount: 0,
          billedAmount: 0,
          receivedAmount: 0,
        });
      const order = map.get(key);
      order.lines.push(row);
      order.ordered += Number(row.OrderedQuantity || 0);
      order.packed += Number(row.PackedQuantity || 0);
      order.despatched += Number(row.DespatchedQuantity || 0);
      order.billed += Number(row.BilledQuantity || 0);
      order.received += Number(row.ReceivedQuantity || 0);
      order.pending += Number(row.PendingQuantity || 0);
      order.orderedAmount += Number(row.OrderedAmount || 0);
      order.despatchedAmount += Number(row.DespatchedAmount || 0);
      order.billedAmount += Number(row.BilledAmount || 0);
      order.receivedAmount += Number(row.ReceivedAmount || 0);
    });
    return [...map.values()].sort((a, b) => {
      const voucherA =
        a.OrderType === "sales"
          ? a.SaleOrderVchNumber
          : a.PurchaseOrderVchNumber;
      const voucherB =
        b.OrderType === "sales"
          ? b.SaleOrderVchNumber
          : b.PurchaseOrderVchNumber;
      const voucherDifference = String(voucherA || "").localeCompare(
        String(voucherB || ""),
        "en",
        { numeric: true, sensitivity: "base" },
      );
      return (
        voucherDifference ||
        Number(a.OrderSerialNumber) - Number(b.OrderSerialNumber)
      );
    });
  }, [rows]);

  useEffect(() => {
    if (
      orders.length &&
      !orders.some((o) => String(o.OrderSerialNumber) === selected)
    )
      setSelected(String(orders[0].OrderSerialNumber));
  }, [orders, selected]);
  const order =
    orders.find((o) => String(o.OrderSerialNumber) === selected) || orders[0];
  const stageValue = (quantityField, totalQuantity) => {
    const itemCount = new Set(
      (order?.lines || [])
        .filter((line) => Math.abs(Number(line[quantityField] || 0)) >= 0.001)
        .map((line) => String(line.ProductID)),
    ).size;
    return `${itemCount}/${fmtQty.format(totalQuantity)}`;
  };
  const countQuantityValue = (count, totalQuantity) =>
    `${fmtQty.format(count)}/${fmtQty.format(totalQuantity)}`;
  const maximumStageCount = (countField) =>
    Math.max(
      0,
      ...(order?.lines || []).map((line) => Number(line[countField] || 0)),
    );
  const varianceQuantity = order
    ? order.ordered - order.pending - order.billed
    : 0;
  const varianceItemCount = new Set(
    (order?.lines || [])
      .filter(
        (line) =>
          Math.abs(
            Number(line.OrderedQuantity || 0) -
              Number(line.PendingQuantity || 0) -
              Number(line.BilledQuantity || 0),
          ) >= 0.001,
      )
      .map((line) => String(line.ProductID)),
  ).size;
  const orderHasCartons =
    order?.lines.some((line) => Number(line.PackedCartonCount) > 0) || false;
  const deliveryTiming = getDeliveryTiming(
    order?.DeliveryDate,
    order?.OrderStatus,
  );
  const orderCartons = order
    ? cartons.filter((c) =>
        order.lines.some(
          (l) =>
            Number(l.SOSerialNumber) &&
            Number(l.SOSerialNumber) === Number(c.SOSerialNumber),
        ),
      )
    : cartons;
  const orderLoadedCartons = orderCartons.filter(
    (c) => Number(c.LoadingNo) > 0,
  );
  const stats = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((o) => o.OrderStatus === "Pending").length,
      closed: orders.filter((o) => o.OrderStatus === "Closed").length,
      cartons: cartons.length,
      loaded: cartons.filter((c) => c.LoadingStatus === "Loaded").length,
    }),
    [orders, cartons],
  );

  const pageMeta = {
    orders: [
      "Order flow control",
      "Trace every item from outlet purchase order to final receipt.",
    ],
    loading: [
      "Loading sheets",
      "Track packed cartons, loading numbers, drivers, vehicles and dispatch status.",
    ],
  }[page];

  const FilterBar = () => (
    <section className="filters panel">
      <label>
        From date
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />
      </label>
      <label>
        To date
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />
      </label>
      <label>
        Order type
        <select
          value={filters.orderType}
          onChange={(e) => {
            const orderType = e.target.value;
            const nextFilters = { ...filters, orderType };
            setFilters(nextFilters);
            setApplied(nextFilters);
          }}
        >
          <option value="franchisee">All Franchisee Orders</option>
          <option value="sales">All Sales Orders</option>
          <option value="transfers">All Transfers</option>
        </select>
      </label>
      <label>
        Location
        <select
          value={filters.locationID}
          onChange={(e) => {
            const nextFilters = { ...filters, locationID: e.target.value };
            setFilters(nextFilters);
            setApplied(nextFilters);
          }}
        >
          <option value="all">All Locations</option>
          {locations.map((location) => (
            <option key={location.LocationID} value={location.LocationID}>
              {location.LocationName}
            </option>
          ))}
        </select>
      </label>
      <label>
        Rate type
        <select
          value={filters.rateType}
          onChange={(e) => {
            const nextFilters = { ...filters, rateType: e.target.value };
            setFilters(nextFilters);
            setApplied(nextFilters);
          }}
        >
          <option value="purchase_rate">Purchase Rate</option>
          <option value="purchase_cost">Purchase Cost</option>
          <option value="sale_rate">Sale Rate</option>
        </select>
      </label>
      <label>
        Status
        <select
          value={filters.status}
          onChange={(e) => {
            const nextFilters = { ...filters, status: e.target.value };
            setFilters(nextFilters);
            setApplied(nextFilters);
          }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="closed">Closed</option>
        </select>
      </label>
      <button className="primary" onClick={() => setApplied(filters)}>
        Apply filters
      </button>
    </section>
  );

  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <div className="brand-mark">RF</div>
          <div>
            <strong>RanceFlow</strong>
            <span>Order control tower</span>
          </div>
        </div>
        <nav>
          <button
            className={page === "orders" ? "active" : ""}
            onClick={() => setPage("orders")}
          >
            ⌁ <span>Order flow</span>
          </button>
        </nav>
        <div className="connection">
          <i className={health?.ok ? "online" : ""} />
          <div>
            <strong>
              {health?.ok ? "Live SQL connection" : "Connecting…"}
            </strong>
            <span>{health?.databaseName || "NEWDEMO"} · SQL2019</span>
          </div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <p className="eyebrow">SALES ORDER MANAGEMENT</p>
            <h1>{pageMeta[0]}</h1>
            <p>{pageMeta[1]}</p>
          </div>
          <button
            className="refresh"
            onClick={() => setApplied({ ...filters })}
          >
            ↻ Refresh data
          </button>
        </header>
        <FilterBar />
        {error && <div className="error">{error}</div>}

        {page === "orders" && (
          <>
            <section className="metrics">
              <Metric
                label={
                  applied.orderType === "sales"
                    ? "Sales orders"
                    : applied.orderType === "transfers"
                      ? "Transfer indents"
                      : "Purchase orders"
                }
                value={stats.total}
                note={`${stats.pending} need attention`}
              />
              <Metric
                label="Pending"
                value={stats.pending}
                note={
                  applied.orderType === "transfers"
                    ? "Awaiting stock transfer"
                    : "Not fully fulfilled"
                }
                tone="amber"
              />
              <Metric
                label="Closed"
                value={stats.closed}
                note="Quantity fulfilled"
                tone="green"
              />
              {applied.orderType === "transfers" ? (
                <Metric
                  label="Transferred quantity"
                  value={fmtQty.format(
                    orders.reduce((a, o) => a + o.despatched, 0),
                  )}
                  note="Sent from HO to branch"
                  tone="blue"
                />
              ) : (
                <Metric
                  label="Cartons packed"
                  value={stats.cartons}
                  note={`${stats.loaded} loaded for dispatch`}
                  tone="blue"
                />
              )}
            </section>
            <section className="metrics report-summary">
              <Metric
                label={`Ordered value · ${rateTypeLabels[applied.rateType]}`}
                value={fmtMoney.format(
                  orders.reduce((a, o) => a + o.orderedAmount, 0),
                )}
                note={`${fmtQty.format(orders.reduce((a, o) => a + o.ordered, 0))} quantity`}
              />
              <Metric
                label={
                  applied.orderType === "transfers"
                    ? "Transferred value"
                    : applied.orderType === "sales"
                      ? "Received value"
                      : "Billed value"
                }
                value={fmtMoney.format(
                  orders.reduce(
                    (a, o) =>
                      a +
                      (applied.orderType === "transfers"
                        ? o.despatchedAmount
                        : o.billedAmount),
                    0,
                  ),
                )}
                note={`${fmtQty.format(orders.reduce((a, o) => a + (applied.orderType === "transfers" ? o.despatched : o.billed), 0))} quantity`}
                tone="blue"
              />
              <Metric
                label="Pending orders"
                value={stats.pending}
                note="Require fulfilment or closure"
                tone="amber"
              />
            </section>
            <section className="workspace">
              <div className="order-list panel">
                <div className="section-head">
                  <div>
                    <span>ORDERS</span>
                    <strong>{orders.length} results</strong>
                  </div>
                </div>
                <div className="order-scroll">
                  {loading ? (
                    <div className="empty">Loading orders…</div>
                  ) : orders.length === 0 ? (
                    <div className="empty">No orders in this period.</div>
                  ) : (
                    orders.map((o) => {
                      const hasCartons = o.lines.some(
                        (line) => Number(line.PackedCartonCount) > 0,
                      );
                      const completed =
                        o.OrderType === "transfers"
                          ? o.despatched
                          : o.OrderType === "sales"
                            ? hasCartons
                              ? o.despatched
                              : o.billed
                            : o.received;
                      const completionLabel =
                        o.OrderType === "transfers"
                          ? "transferred"
                          : o.OrderType === "sales"
                            ? hasCartons
                              ? "despatched"
                              : "completed"
                            : "received";
                      return (
                        <button
                          key={o.OrderSerialNumber}
                          className={`order-card ${String(o.OrderSerialNumber) === selected ? "selected" : ""}`}
                          onClick={() =>
                            setSelected(String(o.OrderSerialNumber))
                          }
                        >
                          <div>
                            <strong>
                              {o.OrderType === "transfers"
                                ? `Indent ${o.PurchaseOrderVchNumber}`
                                : o.OrderType === "sales"
                                  ? `SO ${o.SaleOrderVchNumber}`
                                  : `PO ${o.PurchaseOrderVchNumber}`}
                            </strong>
                            <StatusPill value={o.OrderStatus} />
                          </div>
                          <span>
                            {o.OrderType === "transfers"
                              ? `${o.LocationName} / ${o.FromWarehouseName || "[None]"} → ${o.ToLocationName} / ${o.ToWarehouseName || "[None]"}`
                              : o.OrderType === "sales"
                                ? o.CustomerName || "Customer not available"
                                : `SO ${o.SaleOrderVchNumber || "Not converted"}`}
                          </span>
                          <small>
                            {new Date(o.PODate).toLocaleString("en-IN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </small>
                          <div className="progress">
                            <i
                              style={{
                                width: `${Math.min(100, o.ordered ? (completed / o.ordered) * 100 : 0)}%`,
                              }}
                            />
                          </div>
                          <small>
                            {fmtQty.format(completed)} of{" "}
                            {fmtQty.format(o.ordered)} {completionLabel}
                          </small>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="detail panel">
                {!order ? (
                  <div className="empty">Select an order to see its flow.</div>
                ) : (
                  <>
                    <div className="detail-head">
                      <div>
                        <p>
                          {order.OrderType === "transfers"
                            ? `Stock transfer indent · ${order.LocationName} / ${order.FromWarehouseName || "[None]"} → ${order.ToLocationName} / ${order.ToWarehouseName || "[None]"}`
                            : order.OrderType === "sales"
                              ? `Direct sales order · ${order.CustomerName || "Customer not available"}`
                              : `PO ${order.PurchaseOrderVchNumber}`}
                        </p>
                        <h2>
                          {order.OrderType === "transfers"
                            ? `Indent ${order.PurchaseOrderVchNumber}`
                            : `SO ${order.SaleOrderVchNumber}`}
                        </h2>
                      </div>
                      <div className="detail-actions">
                        {deliveryTiming && (
                          <span
                            className={`delivery-alert ${deliveryTiming.tone}`}
                          >
                            {deliveryTiming.label}
                            <small>Due {fmtDate(order.DeliveryDate)}</small>
                          </span>
                        )}
                        <StatusPill value={order.OrderStatus} />
                      </div>
                    </div>
                    <div
                      className={`flow-strip ${order.OrderType === "transfers" ? "transfers" : ""}`}
                    >
                      {order.OrderType === "transfers" ? (
                        <>
                          <FlowStep
                            code="IN"
                            label="Indented"
                            value={stageValue("OrderedQuantity", order.ordered)}
                            detail={`${order.lines.length} items`}
                            memo={order.PurchaseOrderVchNumber}
                            date={fmtDate(order.PODate)}
                            complete
                          />
                          <FlowStep
                            code="ST"
                            label="Transferred"
                            value={stageValue(
                              "DespatchedQuantity",
                              order.despatched,
                            )}
                            detail="HO to branch"
                            memo={order.LoadingMemoNumbers}
                            date={fmtDate(order.DespatchedDate)}
                            complete={order.despatched > 0}
                          />
                          <FlowStep
                            code="PN"
                            label="Pending"
                            value={stageValue("PendingQuantity", order.pending)}
                            detail="Remaining quantity"
                            date={`As of ${fmtDate(`${applied.to}T00:00:00`)}`}
                            complete={order.pending === 0}
                            active={order.pending > 0}
                          />
                        </>
                      ) : order.OrderType === "sales" ? (
                        <>
                          <FlowStep
                            code="SO"
                            label="Ordered"
                            value={stageValue("OrderedQuantity", order.ordered)}
                            detail={`${order.lines.length} items`}
                            memo={order.SaleOrderVchNumber}
                            date={fmtDate(order.PODate)}
                            complete
                          />
                          <FlowStep
                            code="DS"
                            label="Dispatch"
                            value={
                              orderHasCartons
                                ? countQuantityValue(
                                    maximumStageCount("DespatchedCartonCount"),
                                    order.despatched,
                                  )
                                : "—"
                            }
                            detail={
                              orderHasCartons
                                ? "Compulsory · Loading sheet"
                                : "Not required · Direct invoice"
                            }
                            memo={
                              orderHasCartons
                                ? order.LoadingMemoNumbers
                                : undefined
                            }
                            date={
                              orderHasCartons
                                ? fmtDate(order.DespatchedDate)
                                : "Not applicable"
                            }
                            complete={!orderHasCartons || order.despatched > 0}
                          />
                          <FlowStep
                            code="PN"
                            label="Pending"
                            value={stageValue("PendingQuantity", order.pending)}
                            detail="Remaining quantity"
                            date={`As of ${fmtDate(`${applied.to}T00:00:00`)}`}
                            complete={order.pending === 0}
                            active={order.pending > 0}
                          />
                          <FlowStep
                            code="RC"
                            label="Received"
                            value={countQuantityValue(
                              maximumStageCount("BilledVoucherCount"),
                              order.billed,
                            )}
                            detail="Billed quantity"
                            memo={order.BilledMemoNumbers}
                            date={fmtDate(order.BilledDate)}
                            complete={order.billed > 0}
                          />
                          <FlowStep
                            code="VR"
                            label="Variance"
                            value={`${varianceItemCount}/${fmtQty.format(varianceQuantity)}`}
                            detail="Dispatch vs received"
                            date={`As of ${fmtDate(`${applied.to}T00:00:00`)}`}
                            complete={Math.abs(varianceQuantity) < 0.001}
                            active={Math.abs(varianceQuantity) >= 0.001}
                          />
                        </>
                      ) : (
                        <>
                          <FlowStep
                            code="PO"
                            label="Ordered"
                            value={stageValue("OrderedQuantity", order.ordered)}
                            detail={`${order.lines.length} items`}
                            memo={order.PurchaseOrderVchNumber}
                            date={fmtDate(order.PODate)}
                            complete
                          />
                          <FlowStep
                            code="PK"
                            label="Packed"
                            value={countQuantityValue(
                              maximumStageCount("PackedCartonCount"),
                              order.packed,
                            )}
                            detail={`${Math.max(...order.lines.map((x) => Number(x.PackedCartonCount || 0)))} cartons`}
                            memo={order.PackedMemoNumbers}
                            date={fmtDate(order.PackedDate)}
                            complete={order.packed > 0}
                          />
                          <FlowStep
                            code="SI"
                            label="Billed"
                            value={countQuantityValue(
                              maximumStageCount("BilledVoucherCount"),
                              order.billed,
                            )}
                            detail="Sale invoices"
                            memo={order.BilledMemoNumbers}
                            date={fmtDate(order.BilledDate)}
                            complete={order.billed > 0}
                          />
                          <FlowStep
                            code="LD"
                            label="Despatched"
                            value={countQuantityValue(
                              maximumStageCount("DespatchedCartonCount"),
                              order.despatched,
                            )}
                            detail="Loading sheet"
                            memo={order.LoadingMemoNumbers}
                            date={fmtDate(order.DespatchedDate)}
                            complete={order.despatched > 0}
                            active={order.packed > 0 && order.despatched === 0}
                          />
                          <FlowStep
                            code="PN"
                            label="Pending"
                            value={stageValue("PendingQuantity", order.pending)}
                            detail="Remaining quantity"
                            date={`As of ${fmtDate(`${applied.to}T00:00:00`)}`}
                            complete={order.pending === 0}
                            active={order.pending > 0}
                          />
                        </>
                      )}
                    </div>
                    <div className="tabs">
                      <button
                        className={tab === "items" ? "active" : ""}
                        onClick={() => setTab("items")}
                      >
                        Item reconciliation
                      </button>
                      {order.OrderType !== "transfers" && (
                        <>
                          <button
                            className={tab === "cartons" ? "active" : ""}
                            onClick={() => setTab("cartons")}
                          >
                            Cartons
                          </button>
                          <button
                            className={tab === "loading" ? "active" : ""}
                            onClick={() => setTab("loading")}
                          >
                            Loading sheet
                          </button>
                        </>
                      )}
                    </div>
                    {order.OrderType === "transfers" ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Indented</th>
                              <th>Transferred</th>
                              <th>Pending</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.lines.map((line, index) => (
                              <tr
                                key={`${order.OrderSerialNumber}-${line.ProductID}-${index}`}
                              >
                                <td>
                                  <strong>{line.ProductName}</strong>
                                  <small>{line.ProductID}</small>
                                </td>
                                <td>
                                  {fmtQty.format(line.OrderedQuantity)}
                                  <small>
                                    {fmtMoney.format(line.OrderedAmount)}
                                  </small>
                                </td>
                                <td>
                                  {fmtQty.format(line.DespatchedQuantity)}
                                  <small>
                                    {fmtMoney.format(line.DespatchedAmount)}
                                  </small>
                                </td>
                                <td
                                  className={
                                    Number(line.PendingQuantity) > 0
                                      ? "danger-text"
                                      : ""
                                  }
                                >
                                  {fmtQty.format(line.PendingQuantity)}
                                  <small>
                                    {fmtMoney.format(line.PendingAmount)}
                                  </small>
                                </td>
                                <td>
                                  <StatusPill value={line.ItemStatus} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : order.OrderType === "sales" && tab === "items" ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Ordered</th>
                              <th>Dispatch</th>
                              <th>Pending</th>
                              <th>Received</th>
                              <th>Variance</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.lines.map((line, index) => {
                              const varianceQuantity =
                                Number(line.OrderedQuantity) -
                                Number(line.PendingQuantity) -
                                Number(line.BilledQuantity);
                              const varianceAmount =
                                Number(line.OrderedAmount) -
                                Number(line.PendingAmount) -
                                Number(line.BilledAmount);
                              return (
                                <tr
                                  key={`${order.OrderSerialNumber}-${line.ProductID}-${index}`}
                                >
                                  <td>
                                    <strong>{line.ProductName}</strong>
                                    <small>{line.ProductID}</small>
                                  </td>
                                  <td>
                                    {fmtQty.format(line.OrderedQuantity)}
                                    <small>
                                      {fmtMoney.format(line.OrderedAmount)}
                                    </small>
                                  </td>
                                  <td>
                                    {orderHasCartons ? (
                                      <>
                                        {fmtQty.format(line.DespatchedQuantity)}
                                        <small>
                                          {fmtMoney.format(
                                            line.DespatchedAmount,
                                          )}
                                        </small>
                                      </>
                                    ) : (
                                      <>
                                        —<small>Not required</small>
                                      </>
                                    )}
                                  </td>
                                  <td
                                    className={
                                      Number(line.PendingQuantity) > 0
                                        ? "danger-text"
                                        : ""
                                    }
                                  >
                                    {fmtQty.format(line.PendingQuantity)}
                                    <small>
                                      {fmtMoney.format(line.PendingAmount)}
                                    </small>
                                  </td>
                                  <td>
                                    {fmtQty.format(line.BilledQuantity)}
                                    <small>
                                      {fmtMoney.format(line.BilledAmount)}
                                    </small>
                                  </td>
                                  <td
                                    className={
                                      Math.abs(varianceQuantity) >= 0.001
                                        ? "danger-text"
                                        : ""
                                    }
                                  >
                                    {fmtQty.format(varianceQuantity)}
                                    <small>
                                      {fmtMoney.format(varianceAmount)}
                                    </small>
                                  </td>
                                  <td>
                                    <StatusPill value={line.ItemStatus} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : tab === "items" ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Ordered</th>
                              <th>Packed</th>
                              <th>Billed</th>
                              <th>Despatched</th>
                              <th>Pending</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.lines.map((line, index) => (
                              <tr
                                key={`${order.OrderSerialNumber}-${line.ProductID}-${index}`}
                              >
                                <td>
                                  <strong>{line.ProductName}</strong>
                                  <small>{line.ProductID}</small>
                                </td>
                                <td>
                                  {fmtQty.format(line.OrderedQuantity)}
                                  <small>
                                    {fmtMoney.format(line.OrderedAmount)}
                                  </small>
                                </td>
                                <td>
                                  {fmtQty.format(line.PackedQuantity)}
                                  <small>
                                    {fmtMoney.format(line.PackedAmount)}
                                  </small>
                                </td>
                                <td>
                                  {fmtQty.format(line.BilledQuantity)}
                                  <small>
                                    {fmtMoney.format(line.BilledAmount)}
                                  </small>
                                </td>
                                <td>
                                  {fmtQty.format(line.DespatchedQuantity)}
                                  <small>
                                    {fmtMoney.format(line.DespatchedAmount)}
                                  </small>
                                </td>
                                <td
                                  className={
                                    Number(line.PendingQuantity) > 0
                                      ? "danger-text"
                                      : ""
                                  }
                                >
                                  {fmtQty.format(line.PendingQuantity)}
                                </td>
                                <td>
                                  <StatusPill value={line.ItemStatus} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : tab === "cartons" ? (
                      <div className="carton-grid">
                        {orderCartons.length === 0 ? (
                          <div className="empty">
                            No cartons found for this order.
                          </div>
                        ) : (
                          orderCartons.map((c) => (
                            <CartonCard carton={c} key={c.SCSerialNumber} />
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Loading no.</th>
                              <th>Loading date</th>
                              <th>Bill number</th>
                              <th>Bill date</th>
                              <th>Carton number</th>
                              <th>Customer</th>
                              <th>Gross weight</th>
                              <th>Driver</th>
                              <th>Vehicle</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderLoadedCartons.length === 0 ? (
                              <tr>
                                <td colSpan="10">
                                  <div className="empty">
                                    No loaded cartons for this order.
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              orderLoadedCartons.map((c) => (
                                <tr key={c.SCSerialNumber}>
                                  <td>{c.LoadingNo}</td>
                                  <td>
                                    {new Date(c.LoadingDate).toLocaleDateString(
                                      "en-IN",
                                    )}
                                  </td>
                                  <td>{c.BillingNumber || "—"}</td>
                                  <td>
                                    {c.BillingDate
                                      ? new Date(
                                          c.BillingDate,
                                        ).toLocaleDateString("en-IN")
                                      : "—"}
                                  </td>
                                  <td>
                                    <strong>{c.CartonNumber}</strong>
                                    <small>Serial {c.SCSerialNumber}</small>
                                  </td>
                                  <td>{c.CustomerName || "—"}</td>
                                  <td>{c.GrossWeight || "—"}</td>
                                  <td>{c.DriverName || "—"}</td>
                                  <td>{c.VehicleNo || "—"}</td>
                                  <td>
                                    <StatusPill value={c.LoadingStatus} />
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
