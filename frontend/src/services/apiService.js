// EmployeeHub API Service Layer - Integration with Spring Boot Backend
//
// IMPORTANT: set VITE_API_BASE_URL in your hosting platform's environment
// variables (Netlify: Site configuration > Environment variables;
// Vercel: Settings > Environment Variables), then trigger a fresh deploy.
// Vite bakes env vars in at BUILD time - changing the variable alone does
// nothing until you rebuild.
//
//   Vite (this file):    import.meta.env.VITE_API_BASE_URL
//   Create React App:    process.env.REACT_APP_API_BASE_URL

const FALLBACK_LOCAL_URL = 'http://localhost:8080/api';
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || FALLBACK_LOCAL_URL;

// Guard rail: if this bundle is running in production (deployed) but never
// got a real VITE_API_BASE_URL, it silently falls back to localhost - which
// can NEVER reach a real backend from a visitor's browser. Rather than fail
// mysteriously via "Failed to fetch", warn loudly in the console so this is
// obvious to catch immediately after a deploy.
if (import.meta.env?.PROD && API_BASE_URL === FALLBACK_LOCAL_URL) {
  console.error(
    '[apiService] VITE_API_BASE_URL is not set in this production build. ' +
    'Falling back to localhost, which will never work for real visitors. ' +
    'Set VITE_API_BASE_URL in your hosting platform\'s environment variables ' +
    'and redeploy.'
  );
}

// Initial fallback mock data for testing UI when local backend/database is offline
let mockEmployees = [
  { id: 101, name: 'Aarav Sharma', salary: 92000, gender: 'Male', age: 29 },
  { id: 102, name: 'Priya Patel', salary: 115000, gender: 'Female', age: 32 },
  { id: 103, name: 'Vikram Singh', salary: 84000, gender: 'Male', age: 26 },
  { id: 104, name: 'Ananya Iyer', salary: 135000, gender: 'Female', age: 36 },
  { id: 105, name: 'Rohan Mehta', salary: 98000, gender: 'Male', age: 31 }
];

// A fetch response with a non-2xx status is a REAL backend error (bad
// request, validation failure, server exception) - not a "backend is
// offline" situation. Throwing a typed error here lets callers decide to
// surface it instead of silently masking it behind mock data.
class ApiHttpError extends Error {
  constructor(status, body) {
    super(`HTTP Error ${status}`);
    this.name = 'ApiHttpError';
    this.status = status;
    this.body = body;
  }
}

async function parseErrorBody(res) {
  try {
    return await res.clone().json();
  } catch {
    try {
      return await res.text();
    } catch {
      return null;
    }
  }
}

// Only network-level failures (server unreachable, DNS failure, request
// aborted/timed out) should trigger the mock-data fallback. Anything that
// got a real HTTP response, even an error one, means the backend IS up and
// the bug is elsewhere - so it should propagate instead of being masked.
function isOfflineError(err) {
  return err instanceof TypeError || err?.name === 'AbortError';
}

function toNumberOrThrow(value, fieldName) {
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  return n;
}

export const apiService = {
  // Check backend server availability
  async checkHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${API_BASE_URL}/employees`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  },

  // Fetch all employees
  async getAllEmployees() {
    try {
      const res = await fetch(`${API_BASE_URL}/employees`);
      if (!res.ok) throw new ApiHttpError(res.status, await parseErrorBody(res));
      const data = await res.json();
      return { data, isLive: true };
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      console.warn('Backend unreachable, using local mock data:', err.message);
      return { data: mockEmployees, isLive: false };
    }
  },

  // Fetch single employee by ID
  async getEmployeeById(id) {
    try {
      const res = await fetch(`${API_BASE_URL}/employee/${id}`);
      if (!res.ok) throw new ApiHttpError(res.status, await parseErrorBody(res));
      const data = await res.json();
      return { data, isLive: true };
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      const found = mockEmployees.find(e => e.id === Number(id));
      return { data: found || null, isLive: false };
    }
  },

  // Create new employee
  async createEmployee(employeeData) {
    const salary = toNumberOrThrow(employeeData.salary, 'Salary');
    const age = toNumberOrThrow(employeeData.age, 'Age');

    const payload = {
      name: employeeData.name,
      password: employeeData.password || 'default123',
      salary,
      gender: employeeData.gender,
      age
    };

    try {
      const res = await fetch(`${API_BASE_URL}/employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new ApiHttpError(res.status, await parseErrorBody(res));
      const created = await res.json();
      return { data: created, isLive: true };
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      const newId = mockEmployees.length ? Math.max(...mockEmployees.map(e => e.id)) + 1 : 101;
      const { password, ...rest } = payload;
      const newEmp = { ...rest, id: newId };
      mockEmployees = [newEmp, ...mockEmployees];
      return { data: newEmp, isLive: false };
    }
  },

  // Update employee
  async updateEmployee(employeeData) {
    const salary = toNumberOrThrow(employeeData.salary, 'Salary');
    const age = toNumberOrThrow(employeeData.age, 'Age');

    const payload = {
      id: toNumberOrThrow(employeeData.id, 'Id'),
      name: employeeData.name,
      password: employeeData.password,
      salary,
      gender: employeeData.gender,
      age
    };

    try {
      const res = await fetch(`${API_BASE_URL}/employee`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new ApiHttpError(res.status, await parseErrorBody(res));
      const updated = await res.json();
      return { data: updated, isLive: true };
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      const { password, ...rest } = payload;
      mockEmployees = mockEmployees.map(e => e.id === payload.id ? { ...e, ...rest } : e);
      return { data: rest, isLive: false };
    }
  },

  // Delete employee
  async deleteEmployee(id) {
    const numId = toNumberOrThrow(id, 'Id');
    try {
      const res = await fetch(`${API_BASE_URL}/employee/${numId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new ApiHttpError(res.status, await parseErrorBody(res));
      const text = await res.text();
      return { success: true, message: text, isLive: true };
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      mockEmployees = mockEmployees.filter(e => e.id !== numId);
      return { success: true, message: 'Employee deleted locally', isLive: false };
    }
  }
};