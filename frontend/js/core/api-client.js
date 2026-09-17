/* ============================================================
   Core — the backend REST API client (all fetch() calls to the FastAPI backend).
   ============================================================ */

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiSignup(name, email, password, role = 'traveler') {
  const res = await fetch(BACKEND_URL + '/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Signup failed'); }
  return res.json();
}
async function apiLogin(email, password) {
  const res = await fetch(BACKEND_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Login failed'); }
  return res.json();
}
async function apiGetMyTrips() {
  const token = getToken();
  if (!token) return [];
  const res = await fetch(BACKEND_URL + '/api/ai-trips/my', { headers: { 'Authorization': `Bearer ${token}` } });
  return res.ok ? res.json() : [];
}
async function apiSaveAITrip(data) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/ai-trips/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Save failed'); }
  return res.json();
}
async function apiGetDestinations() {
  try { const r = await fetch(BACKEND_URL + '/api/destinations/?limit=100'); return r.ok ? r.json() : []; } catch { return []; }
}
async function apiGetDestination(id) {
  const r = await fetch(BACKEND_URL + `/api/destinations/${id}`);
  if (!r.ok) throw new Error('Destination not found');
  return r.json();
}
async function apiGetPlanners() {
  try { const r = await fetch(BACKEND_URL + '/api/planners/?limit=100'); return r.ok ? r.json() : []; } catch { return []; }
}
async function apiGetPlanner(id) {
  const r = await fetch(BACKEND_URL + `/api/planners/${id}`);
  if (!r.ok) throw new Error('Planner not found');
  return r.json();
}
async function apiSavePlannerProfile(payload) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/planners/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not save profile'); }
  return res.json();
}
async function apiGetPackages(destinationId) {
  try {
    const url = BACKEND_URL + (destinationId ? `/api/packages/?destination_id=${destinationId}&limit=100` : '/api/packages/?limit=100');
    const r = await fetch(url);
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiGetPackage(id) {
  const r = await fetch(BACKEND_URL + `/api/packages/${id}`);
  if (!r.ok) throw new Error('Package not found');
  return r.json();
}
async function apiGetDestinationBlogs(destinationId) {
  try {
    const r = await fetch(BACKEND_URL + `/api/blogs/destination/${destinationId}`);
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiGetDestinationReviews(destinationId) {
  try {
    const r = await fetch(BACKEND_URL + `/api/reviews/destination/${destinationId}`);
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiGetDestinationWeather(destinationName) {
  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() + 5);
  try {
    const r = await fetch(BACKEND_URL + '/search_weather/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: destinationName,
        start_date: formatDate(today),
        end_date: formatDate(end),
      }),
    });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
async function apiCreatePackage(payload) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/packages/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not create package'); }
  return res.json();
}
async function apiGetMyPackages() {
  const token = getToken();
  if (!token) return [];
  try {
    const r = await fetch(BACKEND_URL + '/api/packages/mine', { headers: { 'Authorization': `Bearer ${token}` } });
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiUpdatePackageStatus(packageId, status) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + `/api/packages/${packageId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not update package'); }
  return res.json();
}
async function apiDeletePackage(packageId) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + `/api/packages/${packageId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not delete package'); }
}
async function apiGetChatRooms() {
  const token = getToken();
  if (!token) return [];
  try {
    const r = await fetch(BACKEND_URL + '/api/chat/rooms', { headers: { 'Authorization': `Bearer ${token}` } });
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiCreateBlog(payload) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/blogs/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not publish blog'); }
  return res.json();
}
async function apiGetPlannerReviews(plannerUserId) {
  try { const r = await fetch(BACKEND_URL + `/api/reviews/planner/${plannerUserId}`); return r.ok ? r.json() : []; } catch { return []; }
}
async function apiCreateReview(payload) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/reviews/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not submit review'); }
  return res.json();
}
async function apiCreateTripRequest(payload) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/trips/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not send request'); }
  return res.json();
}
async function apiGetMyTripRequests() {
  const token = getToken();
  if (!token) return [];
  try {
    const r = await fetch(BACKEND_URL + '/api/trips/my', { headers: { 'Authorization': `Bearer ${token}` } });
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiUpdateTripStatus(tripId, status) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + `/api/trips/${tripId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not update status'); }
  return res.json();
}
async function apiGetFavorites() {
  const token = getToken();
  if (!token) return [];
  try {
    const r = await fetch(BACKEND_URL + '/api/favorites/my', { headers: { 'Authorization': `Bearer ${token}` } });
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiAddFavorite(payload) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/favorites/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not add favorite'); }
  return res.json();
}
async function apiRemoveFavorite(favoriteId) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + `/api/favorites/${favoriteId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) throw new Error('Could not remove favorite');
}

