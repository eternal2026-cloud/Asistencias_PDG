import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Download, Filter, Calendar, Users, Briefcase, RefreshCw, 
  CheckCircle2, AlertCircle, HelpCircle, Loader2
} from 'lucide-react';

export default function AdminDashboard() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSupervisor, setSelectedSupervisor] = useState('Todos');
  const [supervisorsList, setSupervisorsList] = useState(['Edwin', 'Damian', 'Demetrio', 'Gerardo']);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Stats
  const [stats, setStats] = useState({ total: 0, trabajo: 0, descanso: 0, falta: 0 });

  useEffect(() => {
    fetchLogs();
  }, [startDate, endDate, selectedSupervisor]);

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Format dates from YYYY-MM-DD to dd/MM/yyyy or query directly if we format in JS
      // Since 'fecha' in DB is text (dd/MM/yyyy), we query all and filter in JS,
      // or we can convert the date range to an array of dd/MM/yyyy strings and filter by 'in'!
      // Filtering by 'in' array of formatted dates is extremely efficient and works directly in Postgrest.
      
      const datesArray = getFormattedDatesInRange(startDate, endDate);
      
      let query = supabase
        .from('asistencia')
        .select('*')
        .in('fecha', datesArray);

      if (selectedSupervisor !== 'Todos') {
        query = query.eq('supervisor', selectedSupervisor);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formattedLogs = data || [];
      setLogs(formattedLogs);

      // Calculate stats
      const total = formattedLogs.length;
      const trabajo = formattedLogs.filter(l => l.estado === 'Trabajo').length;
      const descanso = formattedLogs.filter(l => l.estado === 'Descanso').length;
      const falta = formattedLogs.filter(l => l.estado === 'Falta').length;

      setStats({ total, trabajo, descanso, falta });

    } catch (err) {
      setErrorMsg('Error al cargar reportes: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFormattedDatesInRange = (startStr, endStr) => {
    const dates = [];
    let current = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    
    while (current <= end) {
      const day = String(current.getDate()).padStart(2, '0');
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const year = current.getFullYear();
      dates.push(`${day}/${month}/${year}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const downloadCSV = () => {
    if (logs.length === 0) return;
    
    const headers = ['Fecha', 'DNI', 'Nombre completo', 'Supervisor', 'Estado', 'Labor', 'Lote', 'Hora Inicio', 'Hora Fin'];
    const rows = logs.map(l => [
      l.fecha,
      l.dni,
      l.nombre,
      l.supervisor,
      l.estado,
      l.codigo_labor || '',
      l.lote || '',
      l.hora_inicio || '',
      l.hora_fin || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Asistencias_${startDate}_al_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Page Title & Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Panel de Administración</h2>
          <p style={{ fontSize: '13px', color: 'var(--txt-secondary)' }}>Resumen consolidado y descargas de asistencias</p>
        </div>
        <button 
          onClick={fetchLogs} 
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', cursor: 'pointer', fontSize: '13px' }}
        >
          {loading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
          Actualizar
        </button>
      </div>

      {/* Stats row cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', color: 'var(--txt-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Registros Totales</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '5px', color: '#fff' }}>{stats.total}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', borderLeft: '4px solid var(--grn)', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', color: 'var(--txt-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Trabajando</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '5px', color: 'var(--grn)' }}>{stats.trabajo}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', borderLeft: '4px solid var(--amber)', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', color: 'var(--txt-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Descanso</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '5px', color: 'var(--amber)' }}>{stats.descanso}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', borderLeft: '4px solid var(--brand-red)', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', color: 'var(--txt-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Faltas</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '5px', color: 'var(--brand-red)' }}>{stats.falta}</div>
        </div>
      </div>

      {/* Filters card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} /> Filtros de Búsqueda
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px' }}>Fecha de Inicio</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px' }}>Fecha de Fin</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px' }}>Supervisor</label>
            <select 
              value={selectedSupervisor}
              onChange={(e) => setSelectedSupervisor(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', outline: 'none', cursor: 'pointer' }}
            >
              <option value="Todos">Todos los Supervisores</option>
              {supervisorsList.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Table Card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Detalle de Asistencias</h3>
          {logs.length > 0 && (
            <button 
              onClick={downloadCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--brand-red)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: '0.2s' }}
            >
              <Download size={14} /> Exportar CSV
            </button>
          )}
        </div>

        {errorMsg && (
          <div style={{ color: '#f87171', background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px', marginBottom: '15px' }}>
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
            <Loader2 className="spin spin-large" />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--txt-muted)' }}>
            No se encontraron asistencias registradas para el filtro seleccionado.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>Fecha</th>
                  <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>DNI</th>
                  <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>Operario</th>
                  <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>Supervisor</th>
                  <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>Estado</th>
                  <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>Labor</th>
                  <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>Lote</th>
                  <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>H. Inicio</th>
                  <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>H. Fin</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const stateColor = log.estado === 'Trabajo' ? 'var(--grn)' : (log.estado === 'Descanso' ? 'var(--amber)' : 'var(--brand-red)');
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 10px' }}>{log.fecha}</td>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>{log.dni}</td>
                      <td style={{ padding: '12px 10px' }}>{log.nombre}</td>
                      <td style={{ padding: '12px 10px' }}>{log.supervisor}</td>
                      <td style={{ padding: '12px 10px', fontWeight: 600, color: stateColor }}>{log.estado}</td>
                      <td style={{ padding: '12px 10px' }}>{log.codigo_labor || '—'}</td>
                      <td style={{ padding: '12px 10px' }}>{log.lote || '—'}</td>
                      <td style={{ padding: '12px 10px' }}>{log.hora_inicio || '—'}</td>
                      <td style={{ padding: '12px 10px' }}>{log.hora_fin || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
