const express = require("express");
const cors = require("cors");
const path = require("path");
const { sql, getPool, config } = require("./db");
const {
  locationsQuery,
  orderFlowQuery,
  cartonsQuery,
  cartonItemsQuery,
} = require("./queries");

const app = express();
const port = Number(process.env.PORT || 4300);
app.use(cors());
app.use(express.json());

function parseDate(value, fallback) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : fallback;
}

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDateInputs(request, query) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const rateTypes = new Set(["purchase_rate", "purchase_cost", "sale_rate"]);
  const rateType = rateTypes.has(query.rateType)
    ? query.rateType
    : "purchase_rate";
  return request
    .input(
      "FromDate",
      sql.VarChar(10),
      parseDate(query.from, localDate(monthStart)),
    )
    .input("ToDate", sql.VarChar(10), parseDate(query.to, localDate(today)))
    .input("RateType", sql.VarChar(20), rateType);
}

app.get("/api/health", async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT DB_NAME() databaseName, @@SERVERNAME serverName");
    res.json({ ok: true, ...result.recordset[0] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/locations", async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(locationsQuery);
    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
});

app.get("/api/flow", async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await addDateInputs(pool.request(), req.query).query(
      orderFlowQuery,
    );
    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
});

app.get("/api/cartons", async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await addDateInputs(pool.request(), req.query).query(
      cartonsQuery,
    );
    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
});

app.get("/api/cartons/:serialNumber/items", async (req, res, next) => {
  try {
    const serialNumber = Number(req.params.serialNumber);
    if (!Number.isFinite(serialNumber) || serialNumber <= 0)
      return res.status(400).json({ error: "Invalid carton serial number" });
    const pool = await getPool();
    const result = await pool
      .request()
      .input("SerialNumber", sql.Decimal(18, 4), serialNumber)
      .query(cartonItemsQuery);
    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
});

const dist = path.join(__dirname, "..", "dist");
app.use(express.static(dist));
app.get("*", (_req, res, next) =>
  res.sendFile(path.join(dist, "index.html"), (error) => error && next(error)),
);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message, database: config.database });
});

app.listen(port, "127.0.0.1", () =>
  console.log(`Sales flow API: http://127.0.0.1:${port}`),
);
