import { useState } from "react";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0d0d0f;
    color: #c8c8d0;
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
  }

  .app {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }

  .header {
    border-bottom: 1px solid #2a2a32;
    padding-bottom: 1.25rem;
    margin-bottom: 2rem;
  }

  .header-eyebrow {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    color: #5a5a6e;
    text-transform: uppercase;
    margin-bottom: 0.4rem;
  }

  .header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #e8e8f0;
    letter-spacing: -0.02em;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 640px) {
    .grid { grid-template-columns: 1fr; }
  }

  .card {
    background: #14141a;
    border: 1px solid #22222c;
    border-radius: 8px;
    padding: 1.25rem;
  }

  .card-title {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #5a5a6e;
    margin-bottom: 1rem;
  }

  .field {
    margin-bottom: 0.85rem;
  }

  .field label {
    display: block;
    font-size: 0.78rem;
    color: #8080a0;
    margin-bottom: 0.3rem;
  }

  .field input {
    width: 100%;
    background: #0d0d0f;
    border: 1px solid #2a2a36;
    border-radius: 5px;
    color: #e0e0ec;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.95rem;
    padding: 0.5rem 0.7rem;
    outline: none;
    transition: border-color 0.15s;
  }

  .field input:focus {
    border-color: #5050a0;
  }

  .field input::placeholder {
    color: #3a3a50;
  }

  /* Bartenders */
  .bartender-row {
    display: grid;
    grid-template-columns: 1fr 80px 28px;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.6rem;
  }

  .bartender-row input {
    background: #0d0d0f;
    border: 1px solid #2a2a36;
    border-radius: 5px;
    color: #e0e0ec;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.88rem;
    padding: 0.45rem 0.6rem;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
  }

  .bartender-row input:focus { border-color: #5050a0; }
  .bartender-row input::placeholder { color: #3a3a50; }

  .btn-remove {
    background: none;
    border: 1px solid #2a2a36;
    border-radius: 5px;
    color: #5a5a6e;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0.4rem 0;
    text-align: center;
    transition: color 0.15s, border-color 0.15s;
    width: 28px;
    height: 28px;
  }

  .btn-remove:hover { color: #cc4444; border-color: #cc4444; }

  .btn-add {
    background: none;
    border: 1px dashed #2a2a44;
    border-radius: 5px;
    color: #5050a0;
    cursor: pointer;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    padding: 0.5rem;
    text-align: center;
    width: 100%;
    transition: border-color 0.15s, color 0.15s;
    margin-top: 0.3rem;
  }

  .btn-add:hover { border-color: #5050a0; color: #8080d0; }

  .row-labels {
    display: grid;
    grid-template-columns: 1fr 80px 28px;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }

  .row-labels span {
    font-size: 0.7rem;
    color: #4a4a60;
    font-family: 'IBM Plex Mono', monospace;
    letter-spacing: 0.06em;
  }

  /* Results */
  .results-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  @media (max-width: 640px) {
    .results-grid { grid-template-columns: 1fr; }
  }

  .result-block {
    background: #14141a;
    border: 1px solid #22222c;
    border-radius: 8px;
    padding: 1.1rem 1.25rem;
  }

  .result-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #5a5a6e;
    margin-bottom: 0.3rem;
  }

  .result-value {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 1.6rem;
    font-weight: 600;
    color: #e0e0f0;
    letter-spacing: -0.02em;
  }

  .result-value.over { color: #3dcc7a; }
  .result-value.short { color: #cc4444; }

  .till-badge {
    display: inline-block;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border-radius: 3px;
    padding: 0.2rem 0.45rem;
    margin-top: 0.4rem;
  }

  .till-badge.over { background: #0f2a1a; color: #3dcc7a; border: 1px solid #1a4a2a; }
  .till-badge.short { background: #2a0f0f; color: #cc4444; border: 1px solid #4a1a1a; }
  .till-badge.even { background: #1a1a2a; color: #8080c0; border: 1px solid #2a2a44; }

  /* Bartender payouts table */
  .payout-table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.82rem;
  }

  .payout-table th {
    text-align: left;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a60;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #22222c;
  }

  .payout-table th:last-child { text-align: right; }

  .payout-table td {
    padding: 0.5rem 0;
    border-bottom: 1px solid #1a1a22;
    color: #c0c0d8;
    vertical-align: middle;
  }

  .payout-table td:last-child {
    text-align: right;
    color: #e0e0f0;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .payout-table tr:last-child td { border-bottom: none; }

  .payout-table .hrs {
    color: #5a5a6e;
    font-size: 0.75rem;
  }

  .divider {
    border: none;
    border-top: 1px solid #1e1e28;
    margin: 1.5rem 0;
  }

  .section-title {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #5a5a6e;
    margin-bottom: 1rem;
  }

  .full-width { grid-column: 1 / -1; }

  .timestamp {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.68rem;
    color: #3a3a50;
    margin-top: 0.4rem;
  }
`;

function customRound(val: number) {
  const floor = Math.floor(val);
  const dec = val - floor;
  return dec >= 0.9 ? floor + 1 : floor;
}

function fmt(val: number) {
  return (
    "$" +
    val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtInt(val: number) {
  return "$" + customRound(val).toLocaleString("en-US");
}

const defaultBartenders = [
  { id: 1, name: "", hours: "" },
  { id: 2, name: "", hours: "" },
  { id: 3, name: "", hours: "" },
];

let nextId = 4;

function getDefaultDate() {
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  return now.toISOString().split("T")[0];
}

export default function App() {
  const [ccTips, setCcTips] = useState("");
  const [cashTips, setCashTips] = useState("");
  const [till, setTill] = useState("");
  const [cashSales, setCashSales] = useState("");
  const [amBank, setAmBank] = useState("400");
  const [bartenders, setBartenders] = useState(defaultBartenders);

  const ccVal = parseFloat(ccTips) || 0;
  const cashTipsVal = parseFloat(cashTips) || 0;
  const tillVal = parseFloat(till) || 0;
  const cashSalesVal = parseFloat(cashSales) || 0;
  const amBankVal = parseFloat(amBank) || 0;

  const totalTips = ccVal + cashTipsVal;
  const totalHours = bartenders.reduce(
    (s, b) => s + (parseFloat(b.hours) || 0),
    0,
  );
  const hourlyRate = totalHours > 0 ? totalTips / totalHours : 0;
  const expectedTill = cashSalesVal + amBankVal;
  const delta = tillVal - expectedTill;
  const hasTill = till !== "" && cashSales !== "";

  const addBartender = () => {
    setBartenders((prev) => [...prev, { id: nextId++, name: "", hours: "" }]);
  };

  const removeBartender = (id: number) => {
    setBartenders((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBartender = (id: number, field: string, value: string) => {
    setBartenders((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    );
  };

  const [shiftDate, setShiftDate] = useState(getDefaultDate);

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="header">
          <div className="header-eyebrow">End of Night</div>
          <h1>Bar Math</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem" }}>
            <span style={{
              color: "#3a3a50",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "0.68rem",
              pointerEvents: "none",
            }}>
              {new Date(shiftDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </span>
            <input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              style={{
                background: "none",
                border: "none",
                color: "transparent",
                width: "1.2rem",
                cursor: "pointer",
                outline: "none",
                padding: 0,
                colorScheme: "dark",
              }}
            />
          </div>
        </div>

        <div className="grid">
          {/* Inputs */}
          <div className="card">
            <div className="card-title">Tips</div>
            <div className="field">
              <label>Credit Card Tips</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={ccTips}
                onChange={(e) => setCcTips(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Cash Tips</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={cashTips}
                onChange={(e) => setCashTips(e.target.value)}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-title">Till</div>
            <div className="field">
              <label>AM Bank (Expected Amount)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="400.00"
                value={amBank}
                onChange={(e) => setAmBank(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Cash Sales</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={cashSales}
                onChange={(e) => setCashSales(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Money in the Till</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={till}
                onChange={(e) => setTill(e.target.value)}
              />
            </div>
          </div>

          {/* Bartenders full width */}
          <div className="card full-width">
            <div className="card-title">Staff</div>
            <div className="row-labels">
              <span>Name</span>
              <span>Hours</span>
              <span></span>
            </div>
            {bartenders.map((b) => (
              <div className="bartender-row" key={b.id}>
                <input
                  type="text"
                  placeholder="Bartender name"
                  value={b.name}
                  onChange={(e) =>
                    updateBartender(b.id, "name", e.target.value)
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={b.hours}
                  onChange={(e) =>
                    updateBartender(b.id, "hours", e.target.value)
                  }
                />
                <button
                  className="btn-remove"
                  onClick={() => removeBartender(b.id)}
                  disabled={bartenders.length <= 1}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            <button className="btn-add" onClick={addBartender}>
              + Add Bartender
            </button>
          </div>
        </div>

        {/* Results */}
        <hr className="divider" />
        <div className="section-title">
          Results for {new Date(shiftDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
        </div>

        <div className="results-grid">
          <div className="result-block">
            <div className="result-label">Total Tips</div>
            <div className="result-value">{fmt(totalTips)}</div>
          </div>

          <div className="result-block">
            <div className="result-label">Hourly Rate</div>
            <div className="result-value">
              {totalHours > 0 ? fmt(hourlyRate) : "—"}
              {totalHours > 0 && (
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "#5a5a6e",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  /hr
                </span>
              )}
            </div>
          </div>

          {/* Till delta */}
          <div className="result-block">
            <div className="result-label">Till Delta</div>
            {hasTill ? (
              <>
                <div
                  className={`result-value ${delta > 0 ? "over" : delta < 0 ? "short" : ""}`}
                >
                  {delta === 0
                    ? "Even"
                    : `${delta > 0 ? "+" : ""}${fmt(delta)}`}
                </div>
                <div
                  className={`till-badge ${delta > 0 ? "over" : delta < 0 ? "short" : "even"}`}
                >
                  {delta > 0 ? "Over" : delta < 0 ? "Short" : "Exact"}
                </div>
                <div
                  style={{
                    marginTop: "0.5rem",
                    fontSize: "0.72rem",
                    color: "#4a4a60",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  Expected {fmt(expectedTill)} (incl. {fmt(amBankVal)} AM bank)
                </div>
              </>
            ) : (
              <div className="result-value" style={{ color: "#3a3a50" }}>
                —
              </div>
            )}
          </div>

          {/* Payouts */}
          <div className="result-block">
            <div className="result-label">Bartender Payouts</div>
            {totalHours > 0 ? (
              <table className="payout-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Hrs</th>
                    <th>Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {bartenders.map((b) => {
                    const hrs = parseFloat(b.hours) || 0;
                    const payout = hrs * hourlyRate;
                    return (
                      <tr key={b.id}>
                        <td>
                          {b.name || (
                            <span style={{ color: "#3a3a50" }}>Unnamed</span>
                          )}
                        </td>
                        <td className="hrs">{hrs}</td>
                        <td>{hrs > 0 ? fmtInt(payout) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div
                style={{
                  color: "#3a3a50",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "0.85rem",
                }}
              >
                Add hours to calculate
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}