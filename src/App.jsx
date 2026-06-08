import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import SupervisorDashboard from './components/SupervisorDashboard';
import AdminDashboard from './components/AdminDashboard';
import ValidatorDashboard from './components/ValidatorDashboard';
import { LogIn, Users, Shield, CalendarCheck2, LogOut, Loader2 } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('login'); // 'login', 'supervisor', 'admin', 'validation'
  const [user, setUser] = useState(null); // supervisor name
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Check if session exists in localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('pedregal_user');
    const savedView = localStorage.getItem('pedregal_view');
    if (savedUser) {
      setUser(savedUser);
      setView(savedView || 'supervisor');
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (isAdminMode) {
      // Admin Login
      if (adminPassword === '123123123') {
        setUser('Administrador');
        setView('admin');
        localStorage.setItem('pedregal_user', 'Administrador');
        localStorage.setItem('pedregal_view', 'admin');
      } else {
        setErrorMsg('Contraseña de administrador incorrecta.');
      }
      setLoading(false);
      return;
    }

    // Supervisor Login
    const cleanUsername = loginUsername.trim();
    if (!cleanUsername || !loginPassword) {
      setErrorMsg('Por favor complete todos los campos.');
      setLoading(false);
      return;
    }

    try {
      // 1. Query Supabase
      const { data, error } = await supabase
        .from('supervisores')
        .select('*')
        .eq('nombre', cleanUsername)
        .eq('clave', loginPassword)
        .eq('activo', true);

      if (error) throw error;

      if (data && data.length > 0) {
        loginSuccess(cleanUsername);
      } else {
        // Fallback local definitions
        const localDef = { 
          Edwin: 'Edwin2025!', 
          Damian: 'Damian2025!', 
          Demetrio: 'Demetrio2025!', 
          Gerardo: 'Gerardo2025!' 
        };
        if (localDef[cleanUsername] && localDef[cleanUsername] === loginPassword) {
          loginSuccess(cleanUsername);
        } else {
          setErrorMsg('Usuario o contraseña incorrectos.');
        }
      }
    } catch (err) {
      console.warn('Supabase login error, attempting fallback...', err);
      // Fallback local login
      const localDef = { 
        Edwin: 'Edwin2025!', 
        Damian: 'Damian2025!', 
        Demetrio: 'Demetrio2025!', 
        Gerardo: 'Gerardo2025!' 
      };
      if (localDef[cleanUsername] && localDef[cleanUsername] === loginPassword) {
        loginSuccess(cleanUsername);
      } else {
        setErrorMsg('Error de conexión. Verifique sus credenciales.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loginSuccess = (username) => {
    setUser(username);
    setView('supervisor');
    localStorage.setItem('pedregal_user', username);
    localStorage.setItem('pedregal_view', 'supervisor');
  };

  const handleLogout = () => {
    setUser(null);
    setView('login');
    setLoginUsername('');
    setLoginPassword('');
    setAdminPassword('');
    localStorage.removeItem('pedregal_user');
    localStorage.removeItem('pedregal_view');
  };

  const navigateTo = (newView) => {
    setView(newView);
    localStorage.setItem('pedregal_view', newView);
  };

  if (view === 'login') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'radial-gradient(circle at top, #3b0712, #0b0f19)' }}>
        <div style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '30px', boxShadow: 'var(--shadow)' }}>
          <div style={{ textAlign: 'center', marginBottom: '25px' }}>
            <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--brand-red-glow)', borderRadius: '50%', marginBottom: '10px', boxShadow: 'var(--shadow-glow)' }}>
              <Users size={32} color="var(--brand-red)" />
            </div>
            <h1 style={{ fontSize: '24px', letterSpacing: '-0.5px', marginBottom: '4px' }}>El Pedregal S.A.</h1>
            <p style={{ color: 'var(--txt-secondary)', fontSize: '14px' }}>Sistema de Control de Asistencias</p>
          </div>

          {/* Mode Switch tabs */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: 'var(--radius-md)', marginBottom: '20px', border: '1px solid var(--border)' }}>
            <button 
              type="button"
              onClick={() => { setIsAdminMode(false); setErrorMsg(''); }}
              style={{ flex: 1, padding: '10px', background: !isAdminMode ? 'var(--brand-red)' : 'transparent', border: 'none', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: '0.2s' }}
            >
              <Users size={16} /> Supervisor
            </button>
            <button 
              type="button"
              onClick={() => { setIsAdminMode(true); setErrorMsg(''); }}
              style={{ flex: 1, padding: '10px', background: isAdminMode ? 'var(--brand-red)' : 'transparent', border: 'none', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: '0.2s' }}
            >
              <Shield size={16} /> Administrador
            </button>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {!isAdminMode ? (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nombre de Supervisor</label>
                  <input 
                    type="text" 
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Ej: Edwin"
                    style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '15px', outline: 'none', transition: '0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--brand-red)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contraseña</label>
                  <input 
                    type="password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '15px', outline: 'none', transition: '0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--brand-red)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              </>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Clave de Administrador</label>
                <input 
                  type="password" 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '15px', outline: 'none', transition: '0.2s' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--brand-red)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            )}

            {errorMsg && (
              <div style={{ color: '#f87171', background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                {errorMsg}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '12px', background: 'var(--brand-red)', border: 'none', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.2s', marginTop: '10px' }}
            >
              {loading ? <Loader2 className="spin" size={18} /> : <LogIn size={18} />}
              {loading ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-app)' }}>
      {/* Header bar */}
      <header style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '6px', background: 'var(--brand-red-glow)', borderRadius: 'var(--radius-sm)' }}>
            <CalendarCheck2 size={20} color="var(--brand-red)" />
          </div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.3px' }}>Pedregal Asistencias</h2>
            <p style={{ fontSize: '11px', color: 'var(--txt-secondary)' }}>
              Supervisor: <span style={{ color: 'var(--brand-red)', fontWeight: 600 }}>{user}</span>
            </p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {user === 'Administrador' ? (
            <>
              <button 
                onClick={() => navigateTo('admin')}
                style={{ padding: '8px 16px', background: view === 'admin' ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', color: view === 'admin' ? '#fff' : 'var(--txt-secondary)', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}
              >
                Panel Admin
              </button>
              <button 
                onClick={() => navigateTo('validation')}
                style={{ padding: '8px 16px', background: view === 'validation' ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', color: view === 'validation' ? '#fff' : 'var(--txt-secondary)', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}
              >
                Validador Reloj
              </button>
            </>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--txt-secondary)', paddingRight: '10px' }}>
              Portal de Supervisor
            </span>
          )}

          <button 
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.15)', borderRadius: 'var(--radius-sm)', color: '#f87171', cursor: 'pointer', fontSize: '13.0px', fontWeight: 600 }}
          >
            <LogOut size={14} /> Salir
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '20px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        {view === 'supervisor' && <SupervisorDashboard supervisor={user} />}
        {view === 'admin' && <AdminDashboard />}
        {view === 'validation' && <ValidatorDashboard />}
      </main>
    </div>
  );
}
