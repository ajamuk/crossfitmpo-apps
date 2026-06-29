// Cliente de API + gestión de sesión
const API = (() => {
  let token = localStorage.getItem('entrena_token') || null;

  function setToken(t) {
    token = t;
    if (t) localStorage.setItem('entrena_token', t);
    else localStorage.removeItem('entrena_token');
  }

  async function req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch('/api' + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      setToken(null);
      if (location.hash !== '#login') window.dispatchEvent(new Event('entrena:logout'));
    }
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error((data && data.error) || 'Error ' + res.status);
    return data;
  }

  return {
    get isAuthed() { return !!token; },
    setToken,
    get: (p) => req('GET', p),
    post: (p, b) => req('POST', p, b),
    put: (p, b) => req('PUT', p, b),
    patch: (p, b) => req('PATCH', p, b),
    del: (p) => req('DELETE', p),
  };
})();
