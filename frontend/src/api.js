// Every network call lives here. Nowhere else in the app should call
// fetch() directly. When you move from localhost to a real server, or
// add auth tokens, you change one file.

const BASE_URL = "http://localhost:8000";

/**
 * Thin wrapper over fetch that does three things fetch does NOT do for you:
 *
 *  1. fetch() does not throw on 404 or 500. It resolves normally with
 *     response.ok === false. This is the number one fetch gotcha - forget
 *     to check .ok and a 500 silently becomes `undefined` in your state.
 *
 *  2. Pulls FastAPI's error message out of the `detail` field so the user
 *     sees "Invoice not found" instead of "something went wrong".
 *
 *  3. Parses the JSON.
 */
async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      // A plain error is a string. A 422 validation error is an array of
      // objects, one per bad field - useful while you are learning.
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail)) {
        message = body.detail
          .map((e) => `${e.loc.slice(1).join(".")}: ${e.msg}`)
          .join("; ");
      }
    } catch {
      // response had no JSON body; keep the status-code message
    }
    throw new Error(message);
  }

  return response.json();
}

export function listInvoices() {
  return request("/api/invoices");
}

export function getInvoice(id) {
  return request(`/api/invoices/${id}`);
}

export function createInvoice(invoice) {
  return request("/api/invoices", {
    method: "POST",
    // JSON.stringify is the moment your JS object stops being an object
    // and becomes text. Everything after this point is just characters
    // until Pydantic rebuilds it on the other side.
    body: JSON.stringify(invoice),
  });
}

export function pdfUrl(id) {
  // No fetch needed - just a URL. The browser requests it directly when
  // you open it in a new tab, and renders the PDF itself.
  return `${BASE_URL}/api/invoices/${id}/pdf`;
}

export function listBuyers() {
  return request("/api/buyers");
}

export function getBuyer(id) {
  return request(`/api/buyers/${id}`);
}

export function createBuyer(buyer) {
  return request("/api/buyers", {
    method: "POST",
    body: JSON.stringify(buyer),
  });
}

export function updateBuyer(id, buyer) {
  return request(`/api/buyers/${id}`, {
    method: "PUT",
    body: JSON.stringify(buyer),
  });
}

export function deleteBuyer(id) {
  return request(`/api/buyers/${id}`, {
    method: "DELETE",
  });
}

export function listItems() {
  return request("/api/items");
}

export function getItem(id) {
  return request(`/api/items/${id}`);
}

export function createItem(item) {
  return request("/api/items", {
    method: "POST",
    body: JSON.stringify(item),
  });
}

export function updateItem(id, item) {
  return request(`/api/items/${id}`, {
    method: "PUT",
    body: JSON.stringify(item),
  });
}

export function deleteItem(id) {
  return request(`/api/items/${id}`, {
    method: "DELETE",
  });
}


