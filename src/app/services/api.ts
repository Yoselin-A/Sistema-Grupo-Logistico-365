const API_BASE_URL = "/api";

export async function apiGet<T = any>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Error al consultar la API");
  }

  return data;
}

export async function apiPost<T = any>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Error al enviar datos a la API");
  }

  return data;
}

export async function apiPut<T = any>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Error al actualizar datos");
  }

  return data;
}

export async function apiDelete<T = any>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json"
    }
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Error al eliminar datos");
  }

  return data;
}

export { API_BASE_URL };