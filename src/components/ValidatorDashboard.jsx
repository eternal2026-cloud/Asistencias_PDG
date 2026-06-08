import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Upload, FileCheck, CheckCircle2, AlertTriangle, AlertCircle, 
  HelpCircle, Clock, Calendar, RefreshCw, Loader2, ChevronRight, ChevronDown
} from 'lucide-react';

export default function ValidatorDashboard() {
  const [datesList, setDatesList] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loadingDates, setLoadingDates] = useState(false);
  const [validating, setValidating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // File parsing states
  const [fileData, setFileData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [uploadToast, setUploadToast] = useState({ text: '', type: '' });

  // Cross-reference results
  const [hasValidated, setHasValidated] = useState(false);
  const [resumen, setResumen] = useState({ totalAsis: 0, totalReloj: 0, ok: 0, faltaReloj: 0, soloReloj: 0, todosPresentes: false });
  const [detalle, setDetalle] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    fetchFechas();
  }, []);

  const fetchFechas = async () => {
    setLoadingDates(true);
    try {
      const { data, error } = await supabase
        .from('asistencia')
        .select('fecha');

      if (error) throw error;

      if (data && data.length > 0) {
        // Group unique
        const dates = [...new Set(data.map(d => (d.fecha || '').replace(/[^\d/]/g, '')))].sort((a, b) => {
          const k = (s) => {
            const p = s.split('/');
            return p[2] + p[1] + p[0]; // YYYYMMDD sorting
          };
          return k(b).localeCompare(k(a)); // Descending order
        });
        setDatesList(dates);
        if (dates.length > 0 && !selectedDate) {
          setSelectedDate(dates[0]);
        }
      } else {
        setDatesList([]);
      }
    } catch (err) {
      console.error('Error fetching dates:', err);
    } finally {
      setLoadingDates(false);
    }
  };

  // Helper to normalize DNI (make sure it has 8 digits)
  const normalizarDni = (dni) => {
    let d = String(dni || '').replace(/\D/g, '');
    if (d.length > 8) d = d.slice(-8);
    while (d.length < 8 && d.length > 0) d = '0' + d;
    return d;
  };

  // Helper to calculate hours between HH:mm start and end
  const calcularHoras = (inicio, fin) => {
    if (!inicio || !fin) return 0;
    try {
      const [h1, m1] = inicio.split(':').map(Number);
      const [h2, m2] = fin.split(':').map(Number);
      let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff < 0) diff += 24 * 60; // Cross-midnight
      return Math.round((diff / 60) * 100) / 100;
    } catch (e) {
      return 0;
    }
  };

  // Parse TXT / CSV Time Clock files
  const handleFileUpload = (e) => {
    if (e.target.files.length === 0) return;
    const file = e.target.files[0];
    setFileName(file.name);
    setUploadToast({ text: '', type: '' });

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/);
        const parsed = [];

        lines.forEach((line, idx) => {
          const cleanLine = line.replace(/^\uFEFF/, '').trim(); // Remove UTF-8 BOM if present
          if (!cleanLine) return;

          // Skip header if matches text headers
          const lowerLine = cleanLine.toLowerCase();
          if (lowerLine.includes('dni') || lowerLine.includes('fecha') || lowerLine.includes('nombre') || lowerLine.includes('entrada') || lowerLine.includes('salida')) {
            return;
          }

          const cols = cleanLine.split(/[;,\t]/).map(col => col.replace(/['"]/g, '').trim());
          if (cols.length >= 2) {
            const rawFecha = cols[0];
            const rawDni = cols[1];
            const nombre = cols[2] ? cols[2] : '';
            const entrada = cols[3] ? cols[3] : '';
            const salida = cols[4] ? cols[4] : '';
            const rawHoras = cols[5] ? cols[5] : '';

            const dni = normalizarDni(rawDni);
            if (!dni) return;

            // Normalize fecha format if it uses dashes or other delimiters
            let fecha = rawFecha.replace(/[-.\s]/g, '/'); // replace dashes, dots, spaces with slash
            const parts = fecha.split('/');
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                // YYYY/MM/DD -> DD/MM/YYYY
                fecha = `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
              } else {
                // Ensure zero pads
                fecha = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
              }
            }
            fecha = fecha.replace(/[^\d/]/g, ''); // strip any invisible unicode characters

            let horas = null;
            if (rawHoras) {
              const parsedH = parseFloat(rawHoras.replace(',', '.')); // support comma decimals
              if (!isNaN(parsedH)) {
                horas = parsedH;
              }
            }

            if (dni && fecha) {
              parsed.push({
                fecha,
                dni,
                nombre: nombre.toUpperCase(),
                entrada,
                salida,
                horas
              });
            }
          }
        });

        if (parsed.length > 0) {
          setFileData(parsed);
          setUploadToast({ text: `Se leyeron ${parsed.length} registros del reloj. Listos para cargar.`, type: 'ok' });
        } else {
          setFileData([]);
          setUploadToast({ text: 'No se encontraron registros válidos en el archivo. Revise el formato.', type: 'error' });
        }
      } catch (err) {
        setFileData([]);
        setUploadToast({ text: 'Error al procesar archivo: ' + err.message, type: 'error' });
      }
    };
    reader.onerror = () => {
      setUploadToast({ text: 'Error al leer el archivo.', type: 'error' });
    };
    reader.readAsText(file, 'UTF-8');
  };

  const uploadToSupabase = async () => {
    if (fileData.length === 0) return;
    setUploadingFile(true);
    setUploadToast({ text: '', type: '' });

    try {
      // Upsert batch records in chunks of 100 to avoid query size limits
      const chunkSize = 100;
      let count = 0;
      
      for (let i = 0; i < fileData.length; i += chunkSize) {
        const chunk = fileData.slice(i, i + chunkSize);
        
        const { error } = await supabase
          .from('reloj')
          .upsert(chunk, { onConflict: 'dni,fecha' });

        if (error) throw error;
        count += chunk.length;
      }

      setUploadToast({ text: `Se cargaron ${count} registros a la base de datos de Supabase satisfactoriamente.`, type: 'ok' });
      setFileData([]);
      setFileName('');
      fetchFechas(); // Refresh date list
    } catch (err) {
      setUploadToast({ text: 'Error al cargar: ' + err.message, type: 'error' });
    } finally {
      setUploadingFile(false);
    }
  };

  // Crossover Validation Logic
  const runValidation = async () => {
    if (!selectedDate) {
      alert('Por favor seleccione una fecha.');
      return;
    }
    setValidating(true);
    setHasValidated(false);
    setExpandedRows({});

    try {
      // 1. Fetch assistance records for selectedDate
      const { data: asisData, error: errAsis } = await supabase
        .from('asistencia')
        .select('*')
        .eq('fecha', selectedDate);

      if (errAsis) throw errAsis;

      // 2. Fetch clock-in records for selectedDate
      const { data: relojData, error: errReloj } = await supabase
        .from('reloj')
        .select('*')
        .eq('fecha', selectedDate);

      if (errReloj) throw errReloj;

      // 3. Perform cross-matching
      const asisMap = {};
      asisData.forEach(a => {
        const dni = normalizarDni(a.dni);
        if (!asisMap[dni]) {
          asisMap[dni] = {
            dni,
            nombre: a.nombre,
            supervisor: a.supervisor,
            estado: a.estado,
            totalHoras: 0,
            numLabores: 0,
            labores: []
          };
        }
        const hrs = calcularHoras(a.hora_inicio, a.hora_fin);
        asisMap[dni].totalHoras += hrs;
        asisMap[dni].numLabores++;
        asisMap[dni].labores.push({
          codigoLabor: a.codigo_labor,
          lote: a.lote,
          horaInicio: a.hora_inicio,
          horaFin: a.hora_fin,
          horas: hrs
        });
      });

      const relojMap = {};
      relojData.forEach(r => {
        const dni = normalizarDni(r.dni);
        relojMap[dni] = r;
      });

      const detail = [];
      // Loop over assistance logs
      Object.keys(asisMap).forEach(dni => {
        const a = asisMap[dni];
        const inReloj = !!relojMap[dni];
        detail.push({
          dni,
          nombre: a.nombre,
          supervisor: a.supervisor,
          estado: a.estado,
          totalHoras: Math.round(a.totalHoras * 100) / 100,
          numLabores: a.numLabores,
          labores: a.labores,
          enReloj: inReloj,
          estadoCruce: inReloj ? 'ok' : 'faltaReloj'
        });
      });

      // Loop over clock-in logs to find "soloReloj" (in clock but not registered)
      Object.keys(relojMap).forEach(dni => {
        if (!asisMap[dni]) {
          const r = relojMap[dni];
          detail.push({
            dni,
            nombre: r.nombre || 'DESCONOCIDO',
            supervisor: '—',
            estado: '—',
            totalHoras: r.horas || 0,
            numLabores: 0,
            labores: [],
            enReloj: true,
            estadoCruce: 'soloReloj'
          });
        }
      });

      // Sort: mismatches first (faltaReloj, soloReloj, then ok)
      detail.sort((a, b) => {
        const priority = { faltaReloj: 0, soloReloj: 1, ok: 2 };
        if (priority[a.estadoCruce] !== priority[b.estadoCruce]) {
          return priority[a.estadoCruce] - priority[b.estadoCruce];
        }
        return a.nombre.localeCompare(b.nombre);
      });

      const totalAsis = Object.keys(asisMap).length;
      const totalReloj = Object.keys(relojMap).length;
      const ok = detail.filter(d => d.estadoCruce === 'ok').length;
      const faltaReloj = detail.filter(d => d.estadoCruce === 'faltaReloj').length;
      const soloReloj = detail.filter(d => d.estadoCruce === 'soloReloj').length;

      setResumen({
        totalAsis,
        totalReloj,
        ok,
        faltaReloj,
        soloReloj,
        todosPresentes: (faltaReloj === 0 && totalAsis > 0)
      });
      setDetalle(detail);
      setHasValidated(true);

    } catch (err) {
      alert('Error en validación: ' + err.message);
    } finally {
      setValidating(false);
    }
  };

  const toggleRow = (idx) => {
    setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Title */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Validador de Marcaciones</h2>
        <p style={{ fontSize: '13px', color: 'var(--txt-secondary)' }}>Cruzar asistencias con los registros biométricos del reloj marcador</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        
        {/* Panel 1: Upload clock data file */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={16} color="var(--brand-red)" /> Cargar Marcaciones Reloj (.csv / .txt)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label 
              htmlFor="txt-reloj-upload"
              style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)', transition: '0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--brand-red)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <Upload size={24} color="var(--txt-secondary)" style={{ display: 'block', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--txt)' }}>{fileName ? `Archivo: ${fileName}` : 'Seleccione archivo de marcaciones de reloj'}</div>
              <div style={{ fontSize: '11px', color: 'var(--txt-muted)', marginTop: '3px' }}>Formato: Fecha, DNI, Nombre, Entrada, Salida, Horas</div>
              <input 
                type="file" 
                id="txt-reloj-upload" 
                accept=".txt,.csv" 
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </label>

            {fileData.length > 0 && (
              <button 
                onClick={uploadToSupabase}
                disabled={uploadingFile}
                style={{ padding: '10px 16px', background: 'var(--grn)', border: 'none', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {uploadingFile ? <Loader2 className="spin" size={14} /> : <FileCheck size={14} />}
                {uploadingFile ? 'Cargando registros...' : 'Confirmar Cargar Datos de Reloj'}
              </button>
            )}

            {uploadToast.text && (
              <div style={{ 
                color: '#fff', 
                background: uploadToast.type === 'ok' ? 'var(--grn-glow)' : 'rgba(248, 113, 113, 0.08)', 
                border: `1px solid ${uploadToast.type === 'ok' ? 'var(--grn)' : 'rgba(248, 113, 113, 0.2)'}`, 
                padding: '10px 12px', 
                borderRadius: 'var(--radius-sm)', 
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {uploadToast.type === 'ok' ? <CheckCircle2 size={16} color="var(--grn)" /> : <AlertTriangle size={16} color="#f87171" />}
                {uploadToast.text}
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Cross check triggers */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '15px' }}>Ejecutar Validación por Fecha</h3>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px' }}>Fecha de Asistencia</label>
              <select 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={loadingDates}
                style={{ width: '100%', padding: '11px 14px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', outline: 'none', cursor: 'pointer' }}
              >
                {loadingDates ? (
                  <option>Cargando fechas...</option>
                ) : datesList.length === 0 ? (
                  <option value="">No hay asistencias registradas</option>
                ) : (
                  datesList.map(date => (
                    <option key={date} value={date}>{date}</option>
                  ))
                )}
              </select>
            </div>
            
            <button 
              onClick={runValidation}
              disabled={validating || !selectedDate}
              style={{ padding: '11px 20px', background: 'var(--brand-red)', border: 'none', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {validating ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
              {validating ? 'Cruzando...' : 'Validar Marcaciones'}
            </button>

            <button 
              onClick={fetchFechas}
              disabled={loadingDates}
              style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '13.5px' }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Crossover Results Section */}
        {hasValidated && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Verdict Alert */}
            <div style={{ 
              padding: '14px 18px', 
              borderRadius: 'var(--radius-md)', 
              fontWeight: 700, 
              fontSize: '15px', 
              background: resumen.todosPresentes ? 'var(--grn-glow)' : 'rgba(245, 158, 11, 0.08)',
              border: `1px solid ${resumen.todosPresentes ? 'var(--grn)' : 'var(--amber)'}`,
              color: resumen.todosPresentes ? 'var(--grn)' : 'var(--amber)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              {resumen.todosPresentes ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              <div>
                {resumen.todosPresentes ? (
                  `Todos los operarios de la asistencia (${resumen.totalAsis}) cruzaron OK con el biométrico.`
                ) : (
                  `Existen ${resumen.faltaReloj} operarios en la planilla de asistencia que NO registran marcación en el reloj biométrico.`
                )}
              </div>
            </div>

            {/* Verdict Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--txt-secondary)', textTransform: 'uppercase' }}>Asistencia</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginTop: '3px' }}>{resumen.totalAsis}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--txt-secondary)', textTransform: 'uppercase' }}>Carga Reloj</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--txt-secondary)', marginTop: '3px' }}>{resumen.totalReloj}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center', borderBottom: '3px solid var(--grn)' }}>
                <div style={{ fontSize: '11px', color: 'var(--txt-secondary)', textTransform: 'uppercase' }}>Cruzan OK</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--grn)', marginTop: '3px' }}>{resumen.ok}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center', borderBottom: '3px solid var(--amber)' }}>
                <div style={{ fontSize: '11px', color: 'var(--txt-secondary)', textTransform: 'uppercase' }}>Faltas en Reloj</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--amber)', marginTop: '3px' }}>{resumen.faltaReloj}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center', borderBottom: '3px solid var(--txt-secondary)' }}>
                <div style={{ fontSize: '11px', color: 'var(--txt-secondary)', textTransform: 'uppercase' }}>Solo en Reloj</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--txt-secondary)', marginTop: '3px' }}>{resumen.soloReloj}</div>
              </div>
            </div>

            {/* Detail Table */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Desglose de Marcaciones — {selectedDate}</h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600, width: '30px' }}></th>
                      <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>DNI</th>
                      <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>Nombre Completo</th>
                      <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>Supervisor</th>
                      <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600 }}>Estado</th>
                      <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600, textAlign: 'center' }}>Horas</th>
                      <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600, textAlign: 'center' }}>Labores</th>
                      <th style={{ padding: '12px 10px', color: 'var(--txt-secondary)', fontWeight: 600, textAlign: 'center' }}>Cruce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((row, idx) => {
                      const badgeBg = row.estadoCruce === 'ok' ? 'var(--grn-glow)' : (row.estadoCruce === 'faltaReloj' ? 'var(--amber-glow)' : 'rgba(255,255,255,0.04)');
                      const badgeTxt = row.estadoCruce === 'ok' ? 'var(--grn)' : (row.estadoCruce === 'faltaReloj' ? 'var(--amber)' : 'var(--txt-secondary)');
                      const badgeLabel = row.estadoCruce === 'ok' ? 'OK' : (row.estadoCruce === 'faltaReloj' ? 'Falta' : 'Solo Reloj');
                      const isExpanded = !!expandedRows[idx];

                      return (
                        <React.Fragment key={idx}>
                          <tr 
                            onClick={() => row.labores.length > 0 && toggleRow(idx)}
                            style={{ 
                              borderBottom: '1px solid var(--border)', 
                              cursor: row.labores.length > 0 ? 'pointer' : 'default', 
                              background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                              transition: 'background-color 0.15s' 
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent'}
                          >
                            <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                              {row.labores.length > 0 && (
                                isExpanded ? <ChevronDown size={14} color="var(--txt-muted)" /> : <ChevronRight size={14} color="var(--txt-muted)" />
                              )}
                            </td>
                            <td style={{ padding: '12px 10px', fontWeight: 600 }}>{row.dni}</td>
                            <td style={{ padding: '12px 10px' }}>{row.nombre}</td>
                            <td style={{ padding: '12px 10px', color: 'var(--txt-secondary)' }}>{row.supervisor}</td>
                            <td style={{ padding: '12px 10px' }}>{row.estado}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600 }}>{row.totalHoras !== '' ? row.totalHoras.toFixed(2) : '—'}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--txt-secondary)' }}>{row.numLabores}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                              <span style={{ 
                                display: 'inline-block', 
                                padding: '2px 8px', 
                                borderRadius: '999px', 
                                fontSize: '11px', 
                                fontWeight: 700, 
                                background: badgeBg, 
                                color: badgeTxt 
                              }}>
                                {badgeLabel}
                              </span>
                            </td>
                          </tr>

                          {/* Expanded dropdown with labor codes & lot distributions */}
                          {isExpanded && row.labores.length > 0 && (
                            <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                              <td colSpan={8} style={{ padding: '12px 15px 12px 45px', fontSize: '13px', color: 'var(--txt-secondary)', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {row.labores.map((lab, lIdx) => (
                                    <div key={lIdx} style={{ display: 'flex', gap: '20px' }}>
                                      <span><strong style={{ color: 'var(--brand-red)' }}>Labor:</strong> {lab.codigoLabor || '—'}</span>
                                      <span><strong style={{ color: 'var(--brand-red)' }}>Lote:</strong> {lab.lote || '—'}</span>
                                      <span><strong style={{ color: 'var(--brand-red)' }}>Hora:</strong> {lab.horaInicio || '—'} → {lab.horaFin || '—'}</span>
                                      <span><strong style={{ color: 'var(--brand-red)' }}>Duración:</strong> {lab.horas.toFixed(2)} h</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
