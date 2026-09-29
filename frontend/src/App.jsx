import { useEffect, useState } from "react";
import {
  listInvoices,
  createInvoice,
  pdfUrl,
  listBuyers,
  createBuyer,
  updateBuyer,
  deleteBuyer,
  listItems,
  createItem,
  updateItem,
  deleteItem,
} from "./api";

const GUJARAT = "24";

const blankLine = () => ({
  item_name: "",
  description: "",
  hsn_sac: "8423",
  quantity: "1",
  rate: "",
  gst_rate: "18",
});

const blankBuyer = () => ({
  name: "",
  address: "",
  gstin: "",
  state_code: GUJARAT,
  email: "",
  phone: "",
});

const blankItem = () => ({
  item_name: "",
  description: "",
  hsn_sac: "",
  rate: "",
  gst_rate: "18",
});

export default function App() {
  const [activeTab, setActiveTab] = useState("invoices"); // "invoices" | "buyers" | "items"

  // ---- invoice form state -----------------------------------------
  const [buyerName, setBuyerName] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerGstin, setBuyerGstin] = useState("");
  const [poNo, setPoNo] = useState("");
  const [stateCode, setStateCode] = useState(GUJARAT);
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [excludeGstFromTotal, setExcludeGstFromTotal] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [lines, setLines] = useState([blankLine()]);

  // ---- buyer master state -----------------------------------------
  const [buyers, setBuyers] = useState([]);
  const [buyerForm, setBuyerForm] = useState(blankBuyer());
  const [editingBuyerId, setEditingBuyerId] = useState(null);
  const [buyerSaving, setBuyerSaving] = useState(false);

  // ---- item master state ------------------------------------------
  const [items, setItems] = useState([]);
  const [itemForm, setItemForm] = useState(blankItem());
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemSaving, setItemSaving] = useState(false);

  // ---- request state ----------------------------------------------
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    refreshList();
    refreshBuyers();
    refreshItems();
  }, []);

  async function refreshList() {
    try {
      setInvoices(await listInvoices());
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshBuyers() {
    try {
      const data = await listBuyers();
      setBuyers(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshItems() {
    try {
      const data = await listItems();
      setItems(data);
    } catch (err) {
      setError(err.message);
    }
  }

  // ---- Buyer handlers ---------------------------------------------
  function handleSelectBuyer(buyerId) {
    setSelectedBuyerId(buyerId);
    if (!buyerId) return;

    const buyer = buyers.find((b) => String(b.id) === String(buyerId));
    if (buyer) {
      setBuyerName(buyer.name);
      setBuyerAddress(buyer.address || "");
      setBuyerGstin(buyer.gstin || "");
      setStateCode(buyer.state_code || GUJARAT);
    }
  }

  async function handleSaveBuyerFromInvoice() {
    if (!buyerName.trim()) {
      setError("Please enter a Buyer Name before saving to directory.");
      return;
    }
    setError(null);
    try {
      const newBuyer = await createBuyer({
        name: buyerName.trim(),
        address: buyerAddress.trim(),
        gstin: buyerGstin.trim(),
        state_code: stateCode,
        email: "",
        phone: "",
      });
      await refreshBuyers();
      setSelectedBuyerId(String(newBuyer.id));
      alert(`Buyer "${newBuyer.name}" saved to database!`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBuyerFormSubmit(e) {
    e.preventDefault();
    if (!buyerForm.name.trim()) {
      setError("Buyer Company name is required.");
      return;
    }

    setError(null);
    setBuyerSaving(true);
    try {
      if (editingBuyerId) {
        await updateBuyer(editingBuyerId, buyerForm);
      } else {
        await createBuyer(buyerForm);
      }
      setBuyerForm(blankBuyer());
      setEditingBuyerId(null);
      await refreshBuyers();
    } catch (err) {
      setError(err.message);
    } finally {
      setBuyerSaving(false);
    }
  }

  function handleEditBuyer(b) {
    setEditingBuyerId(b.id);
    setBuyerForm({
      name: b.name,
      address: b.address || "",
      gstin: b.gstin || "",
      state_code: b.state_code || GUJARAT,
      email: b.email || "",
      phone: b.phone || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEditBuyer() {
    setEditingBuyerId(null);
    setBuyerForm(blankBuyer());
  }

  async function handleDeleteBuyer(id, name) {
    if (!window.confirm(`Are you sure you want to delete buyer company "${name}"?`)) {
      return;
    }
    setError(null);
    try {
      await deleteBuyer(id);
      if (editingBuyerId === id) handleCancelEditBuyer();
      if (selectedBuyerId === String(id)) setSelectedBuyerId("");
      await refreshBuyers();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleUseBuyerInInvoice(b) {
    setSelectedBuyerId(String(b.id));
    setBuyerName(b.name);
    setBuyerAddress(b.address || "");
    setBuyerGstin(b.gstin || "");
    setStateCode(b.state_code || GUJARAT);
    setActiveTab("invoices");
  }

  // ---- Item Master handlers ---------------------------------------
  async function handleItemFormSubmit(e) {
    e.preventDefault();
    if (!itemForm.item_name.trim()) {
      setError("Item name is required.");
      return;
    }

    setError(null);
    setItemSaving(true);
    try {
      const payload = {
        item_name: itemForm.item_name.trim(),
        description: itemForm.description.trim(),
        hsn_sac: itemForm.hsn_sac.trim(),
        rate: Number(itemForm.rate) || 0,
        gst_rate: Number(itemForm.gst_rate) || 18,
      };

      if (editingItemId) {
        await updateItem(editingItemId, payload);
      } else {
        await createItem(payload);
      }
      setItemForm(blankItem());
      setEditingItemId(null);
      await refreshItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setItemSaving(false);
    }
  }

  function handleEditItem(item) {
    setEditingItemId(item.id);
    setItemForm({
      item_name: item.item_name,
      description: item.description || "",
      hsn_sac: item.hsn_sac || "",
      rate: String(item.rate ?? ""),
      gst_rate: String(item.gst_rate ?? "18"),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEditItem() {
    setEditingItemId(null);
    setItemForm(blankItem());
  }

  async function handleDeleteItem(id, name) {
    if (!window.confirm(`Are you sure you want to delete item "${name}"?`)) {
      return;
    }
    setError(null);
    try {
      await deleteItem(id);
      if (editingItemId === id) handleCancelEditItem();
      await refreshItems();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSelectLineItem(index, itemId) {
    if (!itemId) return;
    const item = items.find((it) => String(it.id) === String(itemId));
    if (item) {
      setLines((current) =>
        current.map((line, i) =>
          i === index
            ? {
              ...line,
              item_name: item.item_name,
              description: item.description || "",
              hsn_sac: item.hsn_sac || "",
              rate: String(item.rate ?? ""),
              gst_rate: String(item.gst_rate ?? "18"),
            }
            : line
        )
      );
    }
  }

  async function handleQuickSaveItem(line) {
    if (!line.item_name.trim()) {
      setError("Please enter an item name first.");
      return;
    }
    setError(null);
    try {
      const savedItem = await createItem({
        item_name: line.item_name.trim(),
        description: line.description.trim(),
        hsn_sac: line.hsn_sac.trim(),
        rate: Number(line.rate) || 0,
        gst_rate: Number(line.gst_rate) || 18,
      });
      await refreshItems();
      alert(`Item "${savedItem.item_name}" saved to Product Master!`);
    } catch (err) {
      setError(err.message);
    }
  }

  // ---- Invoice line handlers --------------------------------------
  function updateLine(index, field, value) {
    setLines((current) =>
      current.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      )
    );
  }

  function addLine() {
    setLines((current) => [...current, blankLine()]);
  }

  function removeLine(index) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  const preview = lines.reduce(
    (acc, line) => {
      const taxable = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
      const tax = (taxable * (Number(line.gst_rate) || 0)) / 100;
      return {
        taxable: acc.taxable + taxable,
        tax: acc.tax + tax,
        total: acc.total + taxable + tax,
      };
    },
    { taxable: 0, tax: 0, total: 0 }
  );

  const displayedGrandTotal = excludeGstFromTotal ? preview.taxable : preview.total;

  async function handleSave() {
    setError(null);
    setSaved(null);
    setSaving(true);

    try {
      const payload = {
        invoice_date: invoiceDate,
        buyer_name: buyerName,
        buyer_address: buyerAddress,
        buyer_gstin: buyerGstin,
        po_no: poNo,
        place_of_supply_code: stateCode,
        exclude_gst_from_total: excludeGstFromTotal,
        lines: lines.map((line) => ({
          item_name: line.item_name,
          description: line.description,
          hsn_sac: line.hsn_sac,
          quantity: Number(line.quantity),
          rate: Number(line.rate),
          gst_rate: Number(line.gst_rate),
        })),
      };

      const result = await createInvoice(payload);

      setSaved(result);
      setLines([blankLine()]);
      setBuyerName("");
      setBuyerAddress("");
      setBuyerGstin("");
      setPoNo("");
      setSelectedBuyerId("");
      refreshList();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.page}>
      {/* Header Navigation */}
      <div style={styles.headerBar}>
        <div>
          <h1 style={styles.h1}>Invoice, Buyer & Item System</h1>
        </div>
        <div style={styles.navTabs}>
          <button
            style={activeTab === "invoices" ? styles.navTabActive : styles.navTab}
            onClick={() => setActiveTab("invoices")}
          >
            Invoices
          </button>
          <button
            style={activeTab === "buyers" ? styles.navTabActive : styles.navTab}
            onClick={() => setActiveTab("buyers")}
          >
            Buyer Companies ({buyers.length})
          </button>
          <button
            style={activeTab === "items" ? styles.navTabActive : styles.navTab}
            onClick={() => setActiveTab("items")}
          >
            Items Master ({items.length})
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* ----------------- ITEMS MASTER TAB ----------------- */}
      {activeTab === "items" && (
        <div>
          <section style={styles.card}>
            <h2 style={{ ...styles.h2, margin: "0 0 14px 0" }}>
              {editingItemId ? "Edit Master Item" : "Add New Item to Master"}
            </h2>
            <form onSubmit={handleItemFormSubmit}>
              <div style={styles.grid}>
                <Field label="Item / Product Name *">
                  <input
                    value={itemForm.item_name}
                    style={styles.input}
                    placeholder="e.g. Paracetamol 650mg Tablets"
                    required
                    onChange={(e) =>
                      setItemForm({ ...itemForm, item_name: e.target.value })
                    }
                  />
                </Field>
                <Field label="HSN / SAC Code">
                  <input
                    value={itemForm.hsn_sac}
                    style={styles.input}
                    placeholder="e.g. 3004"
                    maxLength={8}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, hsn_sac: e.target.value })
                    }
                  />
                </Field>
                <Field label="Default Rate / Price (₹) (Can be changed in invoice)">
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.rate}
                    style={styles.input}
                    placeholder="e.g. 120.00"
                    onChange={(e) =>
                      setItemForm({ ...itemForm, rate: e.target.value })
                    }
                  />
                </Field>
                <Field label="Default GST Rate (%) (Can be changed in invoice)">
                  <select
                    value={itemForm.gst_rate}
                    style={styles.input}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, gst_rate: e.target.value })
                    }
                  >
                    <option value="0">0% (Nil / Exempted)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST (Medicines / Pharma)</option>
                    <option value="18">18% GST (Standard)</option>
                    <option value="28">28% GST</option>
                  </select>
                </Field>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="Default Description (Specifications, Dosage, Make)">
                    <textarea
                      value={itemForm.description}
                      rows={2}
                      style={styles.input}
                      placeholder="e.g. Pack of 10x10 Strips, USP Grade"
                      onChange={(e) =>
                        setItemForm({ ...itemForm, description: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                <button
                  type="submit"
                  disabled={itemSaving}
                  style={styles.primaryBtn}
                >
                  {itemSaving
                    ? "Saving..."
                    : editingItemId
                      ? "Update Item"
                      : "Add Item"}
                </button>
                {editingItemId && (
                  <button
                    type="button"
                    onClick={handleCancelEditItem}
                    style={styles.secondaryBtn}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <h2 style={styles.h2}>Registered Product Items ({items.length})</h2>
          {items.length === 0 ? (
            <p style={styles.hint}>No items in master yet. Add products above.</p>
          ) : (
            <section style={styles.card}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Item Name</th>
                    <th style={styles.th}>Description</th>
                    <th style={styles.th}>HSN/SAC</th>
                    <th style={styles.thNum}>Default Price (₹)</th>
                    <th style={styles.thNum}>GST %</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td style={styles.td}>#{it.id}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{it.item_name}</td>
                      <td style={{ ...styles.td, fontSize: 13, color: "#555" }}>
                        {it.description || "—"}
                      </td>
                      <td style={styles.td}>{it.hsn_sac || "—"}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {Number(it.rate).toFixed(2)}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>{it.gst_rate}%</td>
                      <td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          onClick={() => handleEditItem(it)}
                          style={{ ...styles.smallBtn, marginRight: 6 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteItem(it.id, it.item_name)}
                          style={{ ...styles.smallBtn, color: "#c00", borderColor: "#e0b4b0" }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}

      {/* ----------------- BUYER COMPANIES TAB ----------------- */}
      {activeTab === "buyers" && (
        <div>
          <section style={styles.card}>
            <h2 style={{ ...styles.h2, margin: "0 0 14px 0" }}>
              {editingBuyerId ? "Edit Buyer Company" : "Add New Buyer Company"}
            </h2>
            <form onSubmit={handleBuyerFormSubmit}>
              <div style={styles.grid}>
                <Field label="Company / Buyer Name *">
                  <input
                    value={buyerForm.name}
                    style={styles.input}
                    placeholder="e.g. Sun Pharmaceutical Industries Ltd"
                    required
                    onChange={(e) =>
                      setBuyerForm({ ...buyerForm, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="GSTIN (15-digit)">
                  <input
                    value={buyerForm.gstin}
                    style={styles.input}
                    placeholder="e.g. 27AAACS1363F1ZX"
                    maxLength={15}
                    onChange={(e) =>
                      setBuyerForm({ ...buyerForm, gstin: e.target.value.toUpperCase() })
                    }
                  />
                </Field>
                <Field label="State / Place of Supply">
                  <select
                    value={buyerForm.state_code}
                    style={styles.input}
                    onChange={(e) =>
                      setBuyerForm({ ...buyerForm, state_code: e.target.value })
                    }
                  >
                    <option value="24">24 — Gujarat (Intra-state: CGST + SGST)</option>
                    <option value="27">27 — Maharashtra (Inter-state: IGST)</option>
                    <option value="29">29 — Karnataka (Inter-state: IGST)</option>
                    <option value="36">36 — Telangana (Inter-state: IGST)</option>
                    <option value="07">07 — Delhi (Inter-state: IGST)</option>
                    <option value="08">08 — Rajasthan (Inter-state: IGST)</option>
                  </select>
                </Field>
                <Field label="Contact Phone">
                  <input
                    value={buyerForm.phone}
                    style={styles.input}
                    placeholder="e.g. 022-43244324"
                    onChange={(e) =>
                      setBuyerForm({ ...buyerForm, phone: e.target.value })
                    }
                  />
                </Field>
                <Field label="Email Address">
                  <input
                    type="email"
                    value={buyerForm.email}
                    style={styles.input}
                    placeholder="e.g. purchase@company.com"
                    onChange={(e) =>
                      setBuyerForm({ ...buyerForm, email: e.target.value })
                    }
                  />
                </Field>
                <Field label="Full Billing Address">
                  <textarea
                    value={buyerForm.address}
                    rows={2}
                    style={styles.input}
                    placeholder="Plot No, Street, GIDC, City, State, PIN"
                    onChange={(e) =>
                      setBuyerForm({ ...buyerForm, address: e.target.value })
                    }
                  />
                </Field>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                <button
                  type="submit"
                  disabled={buyerSaving}
                  style={styles.primaryBtn}
                >
                  {buyerSaving
                    ? "Saving..."
                    : editingBuyerId
                      ? "Update Company"
                      : "Add Company"}
                </button>
                {editingBuyerId && (
                  <button
                    type="button"
                    onClick={handleCancelEditBuyer}
                    style={styles.secondaryBtn}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <h2 style={styles.h2}>Registered Buyer Companies ({buyers.length})</h2>
          {buyers.length === 0 ? (
            <p style={styles.hint}>No buyer companies registered yet. Add one above.</p>
          ) : (
            <section style={styles.card}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Company Name</th>
                    <th style={styles.th}>GSTIN</th>
                    <th style={styles.th}>State</th>
                    <th style={styles.th}>Contact</th>
                    <th style={styles.th}>Address</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map((b) => (
                    <tr key={b.id}>
                      <td style={styles.td}>#{b.id}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{b.name}</td>
                      <td style={styles.td}>{b.gstin || "—"}</td>
                      <td style={styles.td}>{b.state_code}</td>
                      <td style={styles.td}>
                        {b.phone && <div>📞 {b.phone}</div>}
                        {b.email && <div style={{ fontSize: 12, color: "#666" }}>✉️ {b.email}</div>}
                        {!b.phone && !b.email && "—"}
                      </td>
                      <td style={{ ...styles.td, fontSize: 13, maxWidth: 220 }}>
                        {b.address || "—"}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          onClick={() => handleUseBuyerInInvoice(b)}
                          style={{ ...styles.smallBtn, marginRight: 6, background: "#1a1a1a", color: "#fff" }}
                        >
                          Use in Invoice
                        </button>
                        <button
                          onClick={() => handleEditBuyer(b)}
                          style={{ ...styles.smallBtn, marginRight: 6 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteBuyer(b.id, b.name)}
                          style={{ ...styles.smallBtn, color: "#c00", borderColor: "#e0b4b0" }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}

      {/* ----------------- INVOICES TAB ----------------- */}
      {activeTab === "invoices" && (
        <div>
          <section style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ ...styles.h2, margin: 0 }}>Buyer & Invoice Details</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#555" }}>
                  Select Saved Buyer:
                </span>
                <select
                  value={selectedBuyerId}
                  style={{ ...styles.input, width: "auto", minWidth: 240 }}
                  onChange={(e) => handleSelectBuyer(e.target.value)}
                >
                  <option value="">— Or enter buyer manually —</option>
                  {buyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.state_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.grid}>
              <Field label="Invoice date">
                <input
                  type="date"
                  value={invoiceDate}
                  style={styles.input}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </Field>
              <Field label="PO number">
                <input
                  value={poNo}
                  style={styles.input}
                  placeholder="e.g. PO-PHARMA-2026"
                  onChange={(e) => setPoNo(e.target.value)}
                />
              </Field>
              <Field label="Buyer name">
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={buyerName}
                    style={styles.input}
                    placeholder="Buyer company name"
                    onChange={(e) => {
                      setBuyerName(e.target.value);
                      setSelectedBuyerId("");
                    }}
                  />
                  {!selectedBuyerId && buyerName.trim() && (
                    <button
                      type="button"
                      onClick={handleSaveBuyerFromInvoice}
                      style={{ ...styles.secondaryBtn, margin: 0, whiteSpace: "nowrap" }}
                      title="Save this buyer to database for future invoices"
                    >
                      + Save as Buyer
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Buyer GSTIN">
                <input
                  value={buyerGstin}
                  style={styles.input}
                  placeholder="24AAJCA4284G1ZP"
                  onChange={(e) => setBuyerGstin(e.target.value)}
                />
              </Field>
              <Field label="Buyer address">
                <textarea
                  value={buyerAddress}
                  rows={2}
                  style={styles.input}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                />
              </Field>
              <Field label="Place of supply">
                <select
                  value={stateCode}
                  style={styles.input}
                  onChange={(e) => setStateCode(e.target.value)}
                >
                  <option value="24">24 — Gujarat (CGST + SGST)</option>
                  <option value="27">27 — Maharashtra (IGST)</option>
                  <option value="29">29 — Karnataka (IGST)</option>
                  <option value="36">36 — Telangana (IGST)</option>
                  <option value="07">07 — Delhi (IGST)</option>
                  <option value="08">08 — Rajasthan (IGST)</option>
                </select>
              </Field>
            </div>

            {/* Special Pharma GST Condition Toggle */}
            <div style={styles.pharmaBox}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={excludeGstFromTotal}
                  onChange={(e) => setExcludeGstFromTotal(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2 }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: "#1a1a1a", fontSize: 14 }}>
                    Special Pharma Condition: Exclude GST cost from Final Total
                  </div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                    When enabled, the final total cost will equal the basic taxable amount (GST excluded from final total).
                    The invoice will print separate rows in words: <b>INR :</b> [Total cost in words] and <b>Tax :</b> [Tax cost in words].
                  </div>
                </div>
              </label>
            </div>
          </section>

          {/* Line Items Table */}
          <section style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Product Line Items</h3>
              <span style={{ fontSize: 12, color: "#666" }}>
                * Product price and GST % are decided by the invoice owner and can be adjusted per row.
              </span>
            </div>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 140 }}>Master Preset</th>
                  <th style={styles.th}>Item Name</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>HSN</th>
                  <th style={styles.thNum}>Qty</th>
                  <th style={styles.thNum}>Rate (Price)</th>
                  <th style={styles.thNum}>GST %</th>
                  <th style={styles.thNum}>Taxable</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i}>
                    {/* Item Master Preset Dropdown */}
                    <td style={styles.td}>
                      <select
                        defaultValue=""
                        style={{ ...styles.cellInput, fontSize: 12 }}
                        onChange={(e) => {
                          handleSelectLineItem(i, e.target.value);
                          e.target.value = "";
                        }}
                      >
                        <option value="">Choose item...</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.item_name} (₹{it.rate})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={styles.td}>
                      <input
                        value={line.item_name}
                        style={styles.cellInput}
                        placeholder="Item name"
                        onChange={(e) => updateLine(i, "item_name", e.target.value)}
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        value={line.description}
                        style={styles.cellInput}
                        placeholder="Description / pack"
                        onChange={(e) => updateLine(i, "description", e.target.value)}
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        value={line.hsn_sac}
                        style={{ ...styles.cellInput, width: 65 }}
                        placeholder="HSN"
                        onChange={(e) => updateLine(i, "hsn_sac", e.target.value)}
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        value={line.quantity}
                        type="number"
                        style={{ ...styles.cellInput, width: 55, textAlign: "right" }}
                        onChange={(e) => updateLine(i, "quantity", e.target.value)}
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        value={line.rate}
                        type="number"
                        step="0.01"
                        style={{ ...styles.cellInput, width: 85, textAlign: "right", fontWeight: 500 }}
                        placeholder="0.00"
                        title="Price decided by invoice owner"
                        onChange={(e) => updateLine(i, "rate", e.target.value)}
                      />
                    </td>
                    <td style={styles.td}>
                      {/* <select
                        value={line.gst_rate}
                        style={{ ...styles.cellInput, width: 65, textAlign: "right" }}
                        title="GST % decided by invoice owner"
                        onChange={(e) => updateLine(i, "gst_rate", e.target.value)}
                      > */}
                      <select
                        value={["0", "5", "12", "18", "28"].includes(String(line.gst_rate))
                          ? String(line.gst_rate)
                          : "custom"}
                        style={{ ...styles.cellInput, width: 65, textAlign: "right" }}
                        title="GST % decided by invoice owner"
                        onChange={(e) => {
                          if (e.target.value !== "custom") {
                            updateLine(i, "gst_rate", e.target.value);
                          }
                        }}
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                        <option value="custom">Custom</option>
                      </select>
                      {!["0", "5", "12", "18", "28"].includes(String(line.gst_rate)) && (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={line.gst_rate}
                          style={{
                            ...styles.cellInput,
                            width: 65,
                            textAlign: "right",
                            marginTop: 4,
                          }}
                          placeholder="%"
                          onChange={(e) => updateLine(i, "gst_rate", e.target.value)}
                        />
                      )}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right", fontWeight: 500 }}>
                      {((Number(line.quantity) || 0) * (Number(line.rate) || 0)).toFixed(2)}
                    </td>
                    <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                      {line.item_name && (
                        <button
                          type="button"
                          onClick={() => handleQuickSaveItem(line)}
                          style={{ ...styles.linkBtn, color: "#0066cc", marginRight: 8, fontSize: 11 }}
                          title="Save this line as reusable item in Master"
                        >
                          + Save Item
                        </button>
                      )}
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(i)} style={styles.linkBtn}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button onClick={addLine} style={styles.secondaryBtn}>
              + Add line item
            </button>

            {/* Totals Summary */}
            <div style={styles.totals}>
              <div>Basic / Taxable Total: <b>₹{preview.taxable.toFixed(2)}</b></div>
              <div>GST Tax Amount: <b>₹{preview.tax.toFixed(2)}</b></div>
              {excludeGstFromTotal ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 17, color: "#006633" }}>
                    Final Total Cost: <b>₹{displayedGrandTotal.toFixed(2)}</b>
                  </div>
                  <div style={{ fontSize: 12, color: "#006633", fontWeight: 500 }}>
                    * Special Pharma Condition Active: GST (₹{preview.tax.toFixed(2)}) is not included in final total.
                  </div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    Invoice words will print: <b>INR :</b> in Total cost in words & <b>Tax :</b> in Tax cost in words
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 17, marginTop: 4 }}>
                  Grand Total Cost: <b>₹{displayedGrandTotal.toFixed(2)}</b>
                </div>
              )}
              <div style={styles.hint}>Live preview. Server recalculates and validates on save.</div>
            </div>
          </section>

          <button onClick={handleSave} disabled={saving} style={styles.primaryBtn}>
            {saving ? "Saving..." : "Save invoice"}
          </button>

          {saved && (
            <div style={styles.success}>
              <div style={{ fontWeight: 600 }}>
                ✓ Saved as invoice #{saved.invoice_no}!
              </div>
              <div style={{ marginTop: 4 }}>
                <b>Final Total Cost:</b> ₹{saved.grand_total} &mdash; {saved.amount_in_words}
              </div>
              {saved.exclude_gst_from_total && saved.tax_in_words && (
                <div style={{ marginTop: 4, color: "#005522" }}>
                  <b>Tax Amount:</b> ₹{saved.tax_total} &mdash; {saved.tax_in_words}
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <a href={pdfUrl(saved.id)} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: "#0066cc" }}>
                  📄 Open Generated PDF
                </a>
              </div>
            </div>
          )}

          <h2 style={styles.h2}>Saved invoices</h2>
          {invoices.length === 0 ? (
            <p style={styles.hint}>Nothing saved yet. Fill the form above.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Invoice #</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Buyer</th>
                  <th style={styles.th}>Condition</th>
                  <th style={styles.thNum}>Grand Total</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={styles.td}>#{inv.invoice_no}</td>
                    <td style={styles.td}>{inv.invoice_date}</td>
                    <td style={styles.td}>{inv.buyer_name}</td>
                    <td style={styles.td}>
                      {inv.exclude_gst_from_total ? (
                        <span style={styles.badge}>Pharma (Excl. GST)</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#666" }}>Standard</span>
                      )}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>
                      ₹{inv.grand_total}
                    </td>
                    <td style={styles.td}>
                      <a href={pdfUrl(inv.id)} target="_blank" rel="noreferrer" style={{ color: "#0066cc" }}>
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

const border = "1px solid #d4d4d0";

const styles = {
  page: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 24,
    fontFamily: "system-ui, sans-serif",
    color: "#1a1a1a",
  },
  headerBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottom: "1px solid #e0e0e0",
    paddingBottom: 12,
  },
  h1: { fontSize: 24, fontWeight: 600, margin: 0 },
  h2: { fontSize: 18, fontWeight: 600, margin: "24px 0 12px" },
  navTabs: { display: "flex", gap: 8 },
  navTab: {
    padding: "8px 16px",
    background: "#f0f0f0",
    border: "1px solid #d4d4d0",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  navTabActive: {
    padding: "8px 16px",
    background: "#1a1a1a",
    color: "#ffffff",
    border: "1px solid #1a1a1a",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  card: {
    border,
    borderRadius: 6,
    padding: 18,
    marginBottom: 18,
    background: "#fff",
  },
  pharmaBox: {
    marginTop: 16,
    padding: 14,
    background: "#f3f8f4",
    border: "1px solid #b6d7b9",
    borderRadius: 6,
  },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  label: { display: "block", fontSize: 13, marginBottom: 4, color: "#555" },
  input: {
    width: "100%",
    padding: "7px 9px",
    border,
    borderRadius: 3,
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: {
    textAlign: "left",
    padding: "8px 10px",
    borderBottom: "2px solid #333",
    fontSize: 12,
    color: "#555",
    fontWeight: 600,
  },
  thNum: {
    textAlign: "right",
    padding: "8px 10px",
    borderBottom: "2px solid #333",
    fontSize: 12,
    color: "#555",
    fontWeight: 600,
  },
  td: { padding: "8px 10px", borderBottom: "1px solid #eee" },
  cellInput: {
    width: "100%",
    padding: "5px 6px",
    border,
    borderRadius: 3,
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  totals: { marginTop: 16, textAlign: "right", lineHeight: 1.7 },
  hint: { fontSize: 12, color: "#777" },
  badge: {
    background: "#e8f5e9",
    color: "#2e7d32",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    border: "1px solid #c8e6c9",
  },
  primaryBtn: {
    padding: "10px 22px",
    fontSize: 15,
    cursor: "pointer",
    background: "#1a1a1a",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    fontWeight: 500,
  },
  secondaryBtn: {
    marginTop: 12,
    padding: "6px 12px",
    cursor: "pointer",
    background: "#fff",
    border,
    borderRadius: 4,
    fontSize: 13,
  },
  smallBtn: {
    padding: "4px 8px",
    cursor: "pointer",
    background: "#fff",
    border,
    borderRadius: 3,
    fontSize: 12,
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#a00",
    cursor: "pointer",
    fontSize: 13,
    padding: 0,
  },
  error: {
    marginTop: 14,
    marginBottom: 14,
    padding: 12,
    background: "#fdf0ef",
    border: "1px solid #e0b4b0",
    borderRadius: 4,
    fontSize: 14,
    color: "#900",
  },
  success: {
    marginTop: 14,
    padding: 14,
    background: "#f0f6f0",
    border: "1px solid #b6cdb6",
    borderRadius: 4,
    fontSize: 14,
  },
};
