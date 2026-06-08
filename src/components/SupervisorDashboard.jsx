import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { 
  Keyboard, Camera, Upload, Trash2, Plus, Save, Clock, 
  UserPlus, Search, Briefcase, FileSpreadsheet, ListTodo, Users, CheckCircle2, AlertTriangle, ChevronRight
} from 'lucide-react';

export default function SupervisorDashboard({ supervisor }) {
  const [activeTab, setActiveTab] = useState('nuevo'); // 'nuevo', 'excel', 'hoy', 'personal'
  const [dniMode, setDniMode] = useState('kp'); // 'kp' o 'qr'
  
  // Individual form states
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [isNewWorker, setIsNewWorker] = useState(false);
  const [estado, setEstado] = useState('Trabajo');
  const [labor, setLabor] = useState('');
  const [lote, setLote] = useState('');
  const [hi, setHi] = useState('');
  const [hf, setHf] = useState('');
  const [extraLabors, setExtraLabors] = useState([]); // Array of extra labor blocks
  const [savingIndividual, setSavingIndividual] = useState(false);
  const [toastMsg, setToastMsg] = useState({ text: '', type: '' }); // type: 'ok' or 'error'
  
  // QR scanner states
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [qrReader, setQrReader] = useState(null);
  const [scannedDni, setScannedDni] = useState('');
  
  // Excel (Massive) states
  const [excelRows, setExcelRows] = useState([]);
  const [savingExcel, setSavingExcel] = useState(false);
  const [excelToast, setExcelToast] = useState({ text: '', type: '' });
  
  // Autocomplete search helper cache
  const [autocompleteIndex, setAutocompleteIndex] = useState(-1);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  
  // Today's list states
  const [todayLogs, setTodayLogs] = useState([]);
  const [loadingToday, setLoadingToday] = useState(false);
  
  // Personal history states
  const [personalHistory, setPersonalHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Audio synthesizer beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 1000;
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn("Audio Context not supported", e);
    }
  };

  // Trigger celebration micro-animation
  const triggerConfetti = () => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#c8102e', '#10b981', '#f59e0b', '#ffffff']
    });
  };

  // Initialize Excel view rows
  useEffect(() => {
    if (activeTab === 'excel' && excelRows.length === 0) {
      const initial = Array.from({ length: 10 }, (_, i) => ({
        id: `r-${Date.now()}-${i}`,
        dni: '',
        nombre: '',
        estado: 'Trabajo',
        labor: '',
        lote: '',
        hi: '',
        hf: '',
        suggestions: [],
        saved: false
      }));
      setExcelRows(initial);
    } else if (activeTab === 'hoy') {
      fetchTodayLogs();
    } else if (activeTab === 'personal') {
      fetchPersonalHistory();
    }
  }, [activeTab]);

  // Clean QR scanner on tab changes
  useEffect(() => {
    return () => {
      if (qrReader && qrReader.isScanning) {
        qrReader.stop().catch(e => console.error(e));
      }
    };
  }, [qrReader]);

  const showToast = (text, type = 'ok') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg({ text: '', type: '' }), 5000);
  };

  const showExcelToast = (text, type = 'ok') => {
    setExcelToast({ text, type });
    setTimeout(() => setExcelToast({ text: '', type: '' }), 5000);
  };

  // DNI keypad entry handlers
  const handleKeypadPress = (val) => {
    if (dni.length < 8) {
      const newDni = dni + val;
      setDni(newDni);
      if (newDni.length === 8) {
        lookupDNI(newDni);
      }
    }
  };

  const handleKeypadDelete = () => {
    if (dni.length > 0) {
      setDni(dni.slice(0, -1));
      setNombre('');
      setIsNewWorker(false);
    }
  };

  // DNI Lookup
  const lookupDNI = async (targetDni) => {
    try {
      const { data, error } = await supabase
        .from('operarios')
        .select('nombre_completo')
        .eq('dni', targetDni);

      if (error) throw error;

      if (data && data.length > 0) {
        setNombre(data[0].nombre_completo);
        setIsNewWorker(false);
      } else {
        // Not found, new operario
        setNombre('');
        setIsNewWorker(true);
        showToast('Operario nuevo: ingrese su nombre completo.', 'ok');
      }
    } catch (err) {
      console.warn("Supabase DNI lookup failed, falling back to local simulation", err);
      // Fallback
      setNombre('');
      setIsNewWorker(true);
    }
  };

  // QR Live Scanning
  const initQrReader = () => {
    if (!qrReader) {
      const reader = new Html5Qrcode("qr-reader");
      setQrReader(reader);
      return reader;
    }
    return qrReader;
  };

  const startCameraScan = async () => {
    setScannedDni('');
    setToastMsg({ text: '', type: '' });
    const reader = initQrReader();

    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Default to environment (back) camera
        const backCam = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('entorno') || 
          d.label.toLowerCase().includes('trasera')
        );
        const camId = backCam ? backCam.id : devices[devices.length - 1].id;
        setSelectedCameraId(camId);
        
        setIsScanning(true);
        await reader.start(
          camId,
          { fps: 15, qrbox: { width: 180, height: 180 } },
          onScanSuccess,
          () => {} // silent frame error handler
        );
      } else {
        // Fallback facingMode
        setIsScanning(true);
        await reader.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 180, height: 180 } },
          onScanSuccess,
          () => {}
        );
      }
    } catch (err) {
      showToast('No se pudo acceder a la cámara: ' + err.message, 'error');
      setIsScanning(false);
    }
  };

  const stopCameraScan = async () => {
    if (qrReader && qrReader.isScanning) {
      try {
        await qrReader.stop();
      } catch (err) {
        console.error(err);
      }
    }
    setIsScanning(false);
  };

  const changeCamera = async () => {
    if (cameras.length < 2 || !qrReader) return;
    const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamId = cameras[nextIndex].id;
    setSelectedCameraId(nextCamId);

    try {
      await qrReader.stop();
      await qrReader.start(
        nextCamId,
        { fps: 15, qrbox: { width: 180, height: 180 } },
        onScanSuccess,
        () => {}
      );
    } catch (err) {
      console.error(err);
      setIsScanning(false);
    }
  };

  const onScanSuccess = async (decodedText) => {
    playBeep();
    
    // Clean numeric text
    let cleanDni = decodedText.replace(/\D/g, '');
    if (cleanDni.length > 8) {
      cleanDni = cleanDni.slice(-8);
    }
    while (cleanDni.length < 8 && cleanDni.length > 0) {
      cleanDni = '0' + cleanDni;
    }

    if (cleanDni.length !== 8) {
      showToast('El código QR no contiene un DNI válido (8 dígitos): ' + decodedText, 'error');
      return;
    }

    setScannedDni(cleanDni);
    setDni(cleanDni);
    
    // Stop scanning
    if (qrReader && qrReader.isScanning) {
      try {
        await qrReader.stop();
      } catch (e) {
        console.error(e);
      }
    }
    setIsScanning(false);
    
    // Look up and load form
    await lookupDNI(cleanDni);
  };

  // Image Upload Scan
  const handleImageUpload = (e) => {
    if (e.target.files.length === 0) return;
    const file = e.target.files[0];
    const readerInstance = initQrReader();

    readerInstance.scanFile(file, true)
      .then(decodedText => {
        onScanSuccess(decodedText);
      })
      .catch(() => {
        showToast('No se encontró ningún código QR legible en la imagen.', 'error');
      });
  };

  // Save Individual Registration
  const saveIndividual = async (e) => {
    e.preventDefault();
    if (!dni || dni.length !== 8) {
      showToast('Ingrese un DNI válido de 8 dígitos.', 'error');
      return;
    }
    if (!nombre.trim()) {
      showToast('Ingrese el nombre del operario.', 'error');
      return;
    }

    if (estado === 'Trabajo') {
      if (!labor) { showToast('Ingrese código de labor.', 'error'); return; }
      if (!lote) { showToast('Ingrese el lote.', 'error'); return; }
      if (!hi) { showToast('Ingrese hora de inicio.', 'error'); return; }
    }

    setSavingIndividual(true);
    try {
      const todayStr = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      // 1. Ensure operario exists in DB
      await supabase.from('operarios').upsert({
        dni: dni,
        nombre_completo: nombre.toUpperCase().trim()
      }, { onConflict: 'dni' });

      // 2. Insert main attendance record
      const mainRecord = {
        fecha: todayStr,
        dni: dni,
        nombre: nombre.toUpperCase().trim(),
        supervisor: supervisor,
        estado: estado,
        codigo_labor: estado === 'Trabajo' ? labor.toUpperCase().trim() : null,
        lote: estado === 'Trabajo' ? lote.toUpperCase().trim() : null,
        hora_inicio: estado === 'Trabajo' ? hi : null,
        hora_fin: estado === 'Trabajo' ? hf : null
      };

      const { error: errorMain } = await supabase.from('asistencia').insert(mainRecord);
      if (errorMain) throw errorMain;

      // 3. Save extra labors if any
      if (estado === 'Trabajo' && extraLabors.length > 0) {
        const extraRecords = extraLabors.map(ex => ({
          fecha: todayStr,
          dni: dni,
          nombre: nombre.toUpperCase().trim(),
          supervisor: supervisor,
          estado: 'Trabajo',
          codigo_labor: ex.labor.toUpperCase().trim(),
          lote: ex.lote.toUpperCase().trim(),
          hora_inicio: ex.hi || null,
          hora_fin: ex.hf || null
        }));
        await supabase.from('asistencia').insert(extraRecords);
      }

      // 4. Update supervisor historial
      await supabase.from('historial').upsert({
        dni: dni,
        nombre: nombre.toUpperCase().trim(),
        supervisor: supervisor,
        ultima_vez: new Date().toISOString()
      }, { onConflict: 'dni,supervisor' });

      triggerConfetti();
      showToast('Asistencia registrada correctamente.', 'ok');
      
      // Clean form fields for next entry (keep DNI clean, clear labor fields)
      setDni('');
      setNombre('');
      setIsNewWorker(false);
      setLabor('');
      setLote('');
      setHi('');
      setHf('');
      setExtraLabors([]);
    } catch (err) {
      showToast('Error al registrar: ' + err.message, 'error');
    } finally {
      setSavingIndividual(false);
    }
  };

  const addExtraLabor = () => {
    setExtraLabors([...extraLabors, { id: Date.now(), labor: '', lote: '', hi: '', hf: '' }]);
  };

  const updateExtraLabor = (id, field, value) => {
    setExtraLabors(extraLabors.map(ex => ex.id === id ? { ...ex, [field]: value } : ex));
  };

  const removeExtraLabor = (id) => {
    setExtraLabors(extraLabors.filter(ex => ex.id !== id));
  };

  // Excel (Massive Grid) handlers
  const updateExcelRow = (id, field, value) => {
    setExcelRows(excelRows.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value };
        // Trigger lookup if DNI has 8 digits
        if (field === 'dni' && value.replace(/\D/g, '').length === 8) {
          updated.dni = value.replace(/\D/g, '').slice(0, 8);
          // Async lookup
          supabase.from('operarios')
            .select('nombre_completo')
            .eq('dni', updated.dni)
            .then(({ data }) => {
              if (data && data.length > 0) {
                setExcelRows(rows => rows.map(r => r.id === id ? { ...r, nombre: data[0].nombre_completo } : r));
              }
            });
        }
        return updated;
      }
      return row;
    }));
  };

  const handleExcelNameInput = async (id, val) => {
    updateExcelRow(id, 'nombre', val);
    if (val.length < 2) {
      updateExcelSuggestions(id, []);
      return;
    }

    try {
      const { data } = await supabase
        .from('operarios')
        .select('dni,nombre_completo')
        .or(`nombre_completo.ilike.%${val}%,dni.like.%${val}%`)
        .limit(5);

      updateExcelSuggestions(id, data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const updateExcelSuggestions = (id, suggestions) => {
    setExcelRows(rows => rows.map(r => r.id === id ? { ...r, suggestions } : r));
  };

  const pickExcelSuggestion = (id, dniVal, nombreVal) => {
    setExcelRows(rows => rows.map(r => r.id === id ? { 
      ...r, 
      dni: dniVal, 
      nombre: nombreVal, 
      suggestions: [] 
    } : r));
  };

  const addExcelRow = () => {
    setExcelRows([...excelRows, {
      id: `r-${Date.now()}`,
      dni: '',
      nombre: '',
      estado: 'Trabajo',
      labor: '',
      lote: '',
      hi: '',
      hf: '',
      suggestions: [],
      saved: false
    }]);
  };

  const removeExcelRow = (id) => {
    if (excelRows.length > 1) {
      setExcelRows(excelRows.filter(r => r.id !== id));
    }
  };

  const saveExcelAll = async () => {
    setSavingExcel(true);
    setExcelToast({ text: '', type: '' });

    const activeRows = excelRows.filter(r => r.dni.trim() || r.nombre.trim());
    if (activeRows.length === 0) {
      showExcelToast('No hay datos rellenados en la tabla.', 'error');
      setSavingExcel(false);
      return;
    }

    // Validation checks
    const errors = [];
    activeRows.forEach((r, i) => {
      if (r.dni.length !== 8) errors.push(`Fila ${i+1}: DNI inválido (debe tener 8 dígitos).`);
      else if (!r.nombre.trim()) errors.push(`Fila ${i+1}: Falta el nombre completo.`);
      else if (r.estado === 'Trabajo' && (!r.labor.trim() || !r.lote.trim())) {
        errors.push(`Fila ${i+1}: Faltan ingresar labor y lote para Trabajo.`);
      }
    });

    if (errors.length > 0) {
      showExcelToast(errors[0] + ` (${errors.length} errores encontrados)`, 'error');
      setSavingExcel(false);
      return;
    }

    try {
      const todayStr = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      // Save all to database
      for (const r of activeRows) {
        // Upsert operario
        await supabase.from('operarios').upsert({
          dni: r.dni,
          nombre_completo: r.nombre.toUpperCase().trim()
        }, { onConflict: 'dni' });

        // Save attendance record
        const record = {
          fecha: todayStr,
          dni: r.dni,
          nombre: r.nombre.toUpperCase().trim(),
          supervisor: supervisor,
          estado: r.estado,
          codigo_labor: r.estado === 'Trabajo' ? r.labor.toUpperCase().trim() : null,
          lote: r.estado === 'Trabajo' ? r.lote.toUpperCase().trim() : null,
          hora_inicio: r.estado === 'Trabajo' ? r.hi || null : null,
          hora_fin: r.estado === 'Trabajo' ? r.hf || null : null
        };
        await supabase.from('asistencia').insert(record);

        // Update history
        await supabase.from('historial').upsert({
          dni: r.dni,
          nombre: r.nombre.toUpperCase().trim(),
          supervisor: supervisor,
          ultima_vez: new Date().toISOString()
        }, { onConflict: 'dni,supervisor' });
      }

      // Mark row states as saved successfully
      const savedIds = activeRows.map(r => r.id);
      setExcelRows(rows => rows.map(r => savedIds.includes(r.id) ? { ...r, saved: true } : r));
      
      triggerConfetti();
      showExcelToast(`Se registraron ${activeRows.length} asistencia(s) correctamente.`, 'ok');
    } catch (err) {
      showExcelToast('Error al guardar asistencia masiva: ' + err.message, 'error');
    } finally {
      setSavingExcel(false);
    }
  };

  const clearExcelTable = () => {
    if (window.confirm('¿Está seguro de que desea limpiar toda la tabla?')) {
      const initial = Array.from({ length: 10 }, (_, i) => ({
        id: `r-${Date.now()}-${i}`,
        dni: '',
        nombre: '',
        estado: 'Trabajo',
        labor: '',
        lote: '',
        hi: '',
        hf: '',
        suggestions: [],
        saved: false
      }));
      setExcelRows(initial);
      setExcelToast({ text: '', type: '' });
    }
  };

  // Fetch registers registered today
  const fetchTodayLogs = async () => {
    setLoadingToday(true);
    try {
      const todayStr = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const { data, error } = await supabase
        .from('asistencia')
        .select('*')
        .eq('supervisor', supervisor)
        .eq('fecha', todayStr)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodayLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingToday(false);
    }
  };

  // Fetch supervisor personal logs history
  const fetchPersonalHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('historial')
        .select('*')
        .eq('supervisor', supervisor)
        .order('ultima_vez', { ascending: false });

      if (error) throw error;
      setPersonalHistory(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Tab Selectors */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', overflowX: 'auto' }}>
        <button 
          onClick={() => setActiveTab('nuevo')}
          style={{ padding: '10px 18px', background: activeTab === 'nuevo' ? 'var(--brand-red)' : 'var(--bg-card)', border: '1px solid var(--border)', color: '#fff', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', transition: '0.15s' }}
        >
          <UserPlus size={16} /> Individual
        </button>
        <button 
          onClick={() => setActiveTab('excel')}
          style={{ padding: '10px 18px', background: activeTab === 'excel' ? 'var(--brand-red)' : 'var(--bg-card)', border: '1px solid var(--border)', color: '#fff', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', transition: '0.15s' }}
        >
          <FileSpreadsheet size={16} /> Registro Excel
        </button>
        <button 
          onClick={() => setActiveTab('hoy')}
          style={{ padding: '10px 18px', background: activeTab === 'hoy' ? 'var(--brand-red)' : 'var(--bg-card)', border: '1px solid var(--border)', color: '#fff', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', transition: '0.15s' }}
        >
          <ListTodo size={16} /> Resumen Hoy
        </button>
        <button 
          onClick={() => setActiveTab('personal')}
          style={{ padding: '10px 18px', background: activeTab === 'personal' ? 'var(--brand-red)' : 'var(--bg-card)', border: '1px solid var(--border)', color: '#fff', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', transition: '0.15s' }}
        >
          <Users size={16} /> Mi Personal
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────
          TAB: INDIVIDUAL REGISTRATION
          ──────────────────────────────────────────────────────── */}
      {activeTab === 'nuevo' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          
          {/* Section 1: DNI input panel (Keypad or Scanner) */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Identificación del Operario</h3>
                <p style={{ fontSize: '12px', color: 'var(--txt-secondary)' }}>Seleccione teclado numérico o escáner QR</p>
              </div>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <button 
                  onClick={() => { setDniMode('kp'); stopCameraScan(); }}
                  style={{ padding: '6px 12px', background: dniMode === 'kp' ? 'var(--brand-red)' : 'transparent', border: 'none', color: '#fff', borderRadius: 'var(--radius-xs)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Keyboard size={14} /> Teclado
                </button>
                <button 
                  onClick={() => setDniMode('qr')}
                  style={{ padding: '6px 12px', background: dniMode === 'qr' ? 'var(--brand-red)' : 'transparent', border: 'none', color: '#fff', borderRadius: 'var(--radius-xs)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Camera size={14} /> Cámara QR
                </button>
              </div>
            </div>

            {/* Keypad Container */}
            {dniMode === 'kp' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                {/* DNI Display */}
                <div style={{ width: '100%', maxWidth: '280px', height: '54px', background: 'rgba(0,0,0,0.25)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 700, letterSpacing: '4px', color: 'var(--brand-red)' }}>
                  {dni || '—'}
                </div>

                {/* Keypad Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: '10px', justifyContent: 'center' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button 
                      key={num}
                      type="button"
                      onClick={() => handleKeypadPress(num.toString())}
                      style={{ height: '54px', fontSize: '20px', fontWeight: 700, background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: '#fff', cursor: 'pointer', transition: '0.15s' }}
                      onMouseEnter={(e) => e.target.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={(e) => e.target.style.background = 'var(--bg-app)'}
                    >
                      {num}
                    </button>
                  ))}
                  <button 
                    type="button"
                    onClick={handleKeypadDelete}
                    style={{ height: '54px', background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.15)', borderRadius: 'var(--radius-md)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    Borrar
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    style={{ height: '54px', fontSize: '20px', fontWeight: 700, background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: '#fff', cursor: 'pointer' }}
                  >
                    0
                  </button>
                  <button 
                    type="button"
                    onClick={() => { if (dni.length === 8) lookupDNI(dni); }}
                    disabled={dni.length !== 8}
                    style={{ height: '54px', background: dni.length === 8 ? 'var(--grn)' : 'var(--bg-app)', border: dni.length === 8 ? 'none' : '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: dni.length === 8 ? '#fff' : 'var(--txt-muted)', cursor: dni.length === 8 ? 'pointer' : 'default', fontWeight: 700, fontSize: '15px' }}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}

            {/* QR Scanner Container */}
            {dniMode === 'qr' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                {isScanning ? (
                  <div style={{ textAlign: 'center', width: '100%' }}>
                    <div className="qr-scanner-box">
                      <div id="qr-reader" style={{ width: '100%', height: '100%', background: '#000' }}></div>
                      <div className="corner top-left"></div>
                      <div className="corner top-right"></div>
                      <div className="corner bottom-left"></div>
                      <div className="corner bottom-right"></div>
                      <div className="qr-laser"></div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
                      <button type="button" onClick={changeCamera} style={{ padding: '8px 12px', background: 'var(--bg-app)', border: '1px solid var(--border)', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px' }}>
                        Cambiar Cámara
                      </button>
                      <button type="button" onClick={stopCameraScan} style={{ padding: '8px 12px', background: 'rgba(248,113,113,0.15)', border: 'none', color: '#f87171', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                        Detener Escaneo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
                    <button 
                      type="button"
                      onClick={startCameraScan}
                      style={{ width: '100%', padding: '12px 16px', background: 'var(--brand-red)', border: 'none', color: '#fff', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: 'var(--shadow)' }}
                    >
                      <Camera size={18} /> Escanear con Cámara
                    </button>
                    
                    <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--txt-muted)', margin: '4px 0' }}>ó cargue una foto</div>

                    <div 
                      onClick={() => document.getElementById('qr-upload-input').click()}
                      style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)', transition: '0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--brand-red)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <Upload size={24} color="var(--txt-secondary)" style={{ marginBottom: '8px' }} />
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>Subir Imagen de Fotocheck</div>
                      <div style={{ fontSize: '11px', color: 'var(--txt-muted)', marginTop: '3px' }}>PNG, JPG o JPEG</div>
                      <input 
                        type="file" 
                        id="qr-upload-input" 
                        accept="image/*" 
                        style={{ display: 'none' }}
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>
                )}

                {scannedDni && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--grn-glow)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', color: 'var(--grn)', fontWeight: 600, fontSize: '14px' }}>
                    <CheckCircle2 size={16} /> QR Detectado: {scannedDni}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Registration Detail Form */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Detalles de Asistencia</h3>
            
            <form onSubmit={saveIndividual} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px' }}>DNI Operario</label>
                  <input type="text" readOnly value={dni} placeholder="Ingrese DNI arriba" style={{ width: '100%', padding: '11px 14px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '15px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px' }}>Nombre Completo</label>
                  <input 
                    type="text" 
                    value={nombre} 
                    onChange={(e) => setNombre(e.target.value)} 
                    readOnly={!isNewWorker}
                    placeholder={dni ? (isNewWorker ? 'Ingrese nombre completo' : 'Buscando...') : 'Ingrese DNI primero'} 
                    style={{ width: '100%', padding: '11px 14px', background: isNewWorker ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '15px', outline: 'none' }} 
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px' }}>Estado de Asistencia</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['Trabajo', 'Descanso', 'Falta'].map(est => (
                    <button 
                      key={est}
                      type="button"
                      onClick={() => setEstado(est)}
                      style={{ flex: 1, padding: '10px', background: estado === est ? 'var(--brand-red)' : 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                    >
                      {est}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extra Work details (Visible only if State is 'Trabajo') */}
              {estado === 'Trabajo' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px' }}>Código de Labor</label>
                      <input 
                        type="text" 
                        value={labor} 
                        onChange={(e) => setLabor(e.target.value)} 
                        placeholder="Ej: COS-002" 
                        style={{ width: '100%', padding: '11px 14px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '15px', outline: 'none' }} 
                        onFocus={(e) => e.target.style.borderColor = 'var(--brand-red)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px' }}>Lote</label>
                      <input 
                        type="text" 
                        value={lote} 
                        onChange={(e) => setLote(e.target.value)} 
                        placeholder="Ej: LOTE-B" 
                        style={{ width: '100%', padding: '11px 14px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '15px', outline: 'none' }} 
                        onFocus={(e) => e.target.style.borderColor = 'var(--brand-red)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px' }}>Hora de Inicio</label>
                      <input 
                        type="time" 
                        value={hi} 
                        onChange={(e) => setHi(e.target.value)} 
                        style={{ width: '100%', padding: '11px 14px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '15px', outline: 'none' }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '5px' }}>Hora de Fin (Opcional)</label>
                      <input 
                        type="time" 
                        value={hf} 
                        onChange={(e) => setHf(e.target.value)} 
                        style={{ width: '100%', padding: '11px 14px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '15px', outline: 'none' }} 
                      />
                    </div>
                  </div>

                  {/* Extra labors section */}
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--txt-secondary)' }}>Labores adicionales</span>
                      <button 
                        type="button" 
                        onClick={addExtraLabor} 
                        style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Plus size={14} /> Añadir labor
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {extraLabors.map((ex, index) => (
                        <div key={ex.id} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--brand-red)' }}>LABOR ADICIONAL #{index + 1}</span>
                            <button 
                              type="button" 
                              onClick={() => removeExtraLabor(ex.id)} 
                              style={{ background: 'none', border: 'none', color: 'var(--txt-muted)', cursor: 'pointer', marginLeft: 'auto' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                            <input 
                              type="text" 
                              value={ex.labor} 
                              onChange={(e) => updateExtraLabor(ex.id, 'labor', e.target.value)} 
                              placeholder="Labor (Ej: COS-002)" 
                              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', color: '#fff', fontSize: '13px', outline: 'none' }}
                            />
                            <input 
                              type="text" 
                              value={ex.lote} 
                              onChange={(e) => updateExtraLabor(ex.id, 'lote', e.target.value)} 
                              placeholder="Lote" 
                              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', color: '#fff', fontSize: '13px', outline: 'none' }}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <input 
                              type="time" 
                              value={ex.hi} 
                              onChange={(e) => updateExtraLabor(ex.id, 'hi', e.target.value)} 
                              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', color: '#fff', fontSize: '13px', outline: 'none' }}
                            />
                            <input 
                              type="time" 
                              value={ex.hf} 
                              onChange={(e) => updateExtraLabor(ex.id, 'hf', e.target.value)} 
                              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', color: '#fff', fontSize: '13px', outline: 'none' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {toastMsg.text && (
                <div style={{ 
                  color: '#fff', 
                  background: toastMsg.type === 'ok' ? 'var(--grn-glow)' : 'rgba(248, 113, 113, 0.08)', 
                  border: `1px solid ${toastMsg.type === 'ok' ? 'var(--grn)' : 'rgba(248, 113, 113, 0.2)'}`, 
                  padding: '10px 12px', 
                  borderRadius: 'var(--radius-sm)', 
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {toastMsg.type === 'ok' ? <CheckCircle2 size={16} color="var(--grn)" /> : <AlertTriangle size={16} color="#f87171" />}
                  {toastMsg.text}
                </div>
              )}

              <button 
                type="submit"
                disabled={savingIndividual}
                style={{ width: '100%', padding: '12px', background: 'var(--brand-red)', border: 'none', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.15s', marginTop: '10px' }}
              >
                {savingIndividual ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                {savingIndividual ? 'Registrando...' : 'Registrar Asistencia'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          TAB: EXCEL (MASSIVE ENTRY GRID)
          ──────────────────────────────────────────────────────── */}
      {activeTab === 'excel' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Cuadrícula de Registro Rápido</h3>
              <p style={{ fontSize: '12px', color: 'var(--txt-secondary)' }}>Ingrese múltiples operarios en lote. Navegue con Tabulador.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                onClick={clearExcelTable}
                style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600 }}
              >
                Limpiar Tabla
              </button>
              <button 
                type="button" 
                onClick={addExcelRow}
                style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} /> Añadir Fila
              </button>
            </div>
          </div>

          {/* Grid Layout Container */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: 'var(--txt-secondary)', width: '40px', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: 'var(--txt-secondary)', width: '110px' }}>DNI</th>
                  <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: 'var(--txt-secondary)' }}>Operario (Nombre completo)</th>
                  <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: 'var(--txt-secondary)', width: '110px' }}>Estado</th>
                  <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: 'var(--txt-secondary)', width: '110px' }}>Labor</th>
                  <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: 'var(--txt-secondary)', width: '100px' }}>Lote</th>
                  <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: 'var(--txt-secondary)', width: '90px' }}>Inicio</th>
                  <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: 'var(--txt-secondary)', width: '90px' }}>Fin</th>
                  <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: 'var(--txt-secondary)', width: '45px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {excelRows.map((row, index) => {
                  const trBg = row.saved ? 'rgba(16, 185, 129, 0.04)' : (row.estado === 'Descanso' ? 'rgba(245, 158, 11, 0.02)' : (row.estado === 'Falta' ? 'rgba(248, 113, 113, 0.02)' : 'transparent'));
                  return (
                    <tr key={row.id} style={{ background: trBg, borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--txt-muted)' }}>
                        {row.saved ? <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--grn)' }}></span> : index + 1}
                      </td>
                      
                      {/* DNI cell */}
                      <td style={{ padding: '6px 8px', position: 'relative' }}>
                        <input 
                          type="text" 
                          placeholder="DNI"
                          maxLength={8}
                          value={row.dni}
                          onChange={(e) => updateExcelRow(row.id, 'dni', e.target.value)}
                          style={{ width: '100%', padding: '8px 6px', background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', outline: 'none', borderBottom: '1px solid transparent' }}
                          onFocus={(e) => e.target.style.borderBottomColor = 'var(--brand-red)'}
                          onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
                        />
                      </td>

                      {/* Name with autocomplete suggestions cell */}
                      <td style={{ padding: '6px 8px', position: 'relative' }}>
                        <input 
                          type="text" 
                          placeholder="Nombre Completo"
                          value={row.nombre}
                          onChange={(e) => handleExcelNameInput(row.id, e.target.value)}
                          style={{ width: '100%', padding: '8px 6px', background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', outline: 'none', borderBottom: '1px solid transparent' }}
                          onFocus={(e) => e.target.style.borderBottomColor = 'var(--brand-red)'}
                          onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
                        />
                        {/* Autocomplete Dropdown */}
                        {row.suggestions && row.suggestions.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: '8px', right: '8px', zIndex: 100, background: '#161d2d', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', boxShadow: '0 8px 16px rgba(0,0,0,0.5)' }}>
                            {row.suggestions.map(s => (
                              <div 
                                key={s.dni}
                                onMouseDown={() => pickExcelSuggestion(row.id, s.dni, s.nombre_completo)}
                                style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <span style={{ fontWeight: 600 }}>{s.nombre_completo}</span>
                                <span style={{ color: 'var(--brand-red)', fontSize: '11px' }}>{s.dni}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Status select cell */}
                      <td style={{ padding: '6px 8px' }}>
                        <select 
                          value={row.estado}
                          onChange={(e) => updateExcelRow(row.id, 'estado', e.target.value)}
                          style={{ width: '100%', padding: '8px 6px', background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                        >
                          <option value="Trabajo" style={{ background: 'var(--bg-card)' }}>Trabajo</option>
                          <option value="Descanso" style={{ background: 'var(--bg-card)' }}>Descanso</option>
                          <option value="Falta" style={{ background: 'var(--bg-card)' }}>Falta</option>
                        </select>
                      </td>

                      {/* Labor cell */}
                      <td style={{ padding: '6px 8px' }}>
                        <input 
                          type="text" 
                          placeholder="COS-001"
                          disabled={row.estado !== 'Trabajo'}
                          value={row.labor}
                          onChange={(e) => updateExcelRow(row.id, 'labor', e.target.value)}
                          style={{ width: '100%', padding: '8px 6px', background: 'transparent', border: 'none', color: row.estado === 'Trabajo' ? '#fff' : 'var(--txt-muted)', fontSize: '14px', outline: 'none', borderBottom: '1px solid transparent' }}
                          onFocus={(e) => e.target.style.borderBottomColor = 'var(--brand-red)'}
                          onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
                        />
                      </td>

                      {/* Lote cell */}
                      <td style={{ padding: '6px 8px' }}>
                        <input 
                          type="text" 
                          placeholder="Lote"
                          disabled={row.estado !== 'Trabajo'}
                          value={row.lote}
                          onChange={(e) => updateExcelRow(row.id, 'lote', e.target.value)}
                          style={{ width: '100%', padding: '8px 6px', background: 'transparent', border: 'none', color: row.estado === 'Trabajo' ? '#fff' : 'var(--txt-muted)', fontSize: '14px', outline: 'none', borderBottom: '1px solid transparent' }}
                          onFocus={(e) => e.target.style.borderBottomColor = 'var(--brand-red)'}
                          onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
                        />
                      </td>

                      {/* Hour start cell */}
                      <td style={{ padding: '6px 8px' }}>
                        <input 
                          type="time" 
                          disabled={row.estado !== 'Trabajo'}
                          value={row.hi}
                          onChange={(e) => updateExcelRow(row.id, 'hi', e.target.value)}
                          style={{ width: '100%', padding: '8px 6px', background: 'transparent', border: 'none', color: row.estado === 'Trabajo' ? '#fff' : 'var(--txt-muted)', fontSize: '13px', outline: 'none' }}
                        />
                      </td>

                      {/* Hour end cell */}
                      <td style={{ padding: '6px 8px' }}>
                        <input 
                          type="time" 
                          disabled={row.estado !== 'Trabajo'}
                          value={row.hf}
                          onChange={(e) => updateExcelRow(row.id, 'hf', e.target.value)}
                          style={{ width: '100%', padding: '8px 6px', background: 'transparent', border: 'none', color: row.estado === 'Trabajo' ? '#fff' : 'var(--txt-muted)', fontSize: '13px', outline: 'none' }}
                        />
                      </td>

                      {/* Delete cell */}
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => removeExcelRow(row.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--txt-muted)', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {excelToast.text && (
            <div style={{ 
              color: '#fff', 
              background: excelToast.type === 'ok' ? 'var(--grn-glow)' : 'rgba(248, 113, 113, 0.08)', 
              border: `1px solid ${excelToast.type === 'ok' ? 'var(--grn)' : 'rgba(248, 113, 113, 0.2)'}`, 
              padding: '10px 12px', 
              borderRadius: 'var(--radius-sm)', 
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {excelToast.type === 'ok' ? <CheckCircle2 size={16} color="var(--grn)" /> : <AlertTriangle size={16} color="#f87171" />}
              {excelToast.text}
            </div>
          )}

          <button 
            onClick={saveExcelAll}
            disabled={savingExcel}
            style={{ padding: '12px', background: 'var(--brand-red)', border: 'none', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.15s' }}
          >
            {savingExcel ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            {savingExcel ? 'Registrando...' : 'Registrar Todo el Lote'}
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          TAB: TODAY RESUME LIST
          ──────────────────────────────────────────────────────── */}
      {activeTab === 'hoy' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '15px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Asistencias Registradas Hoy</h3>
              <p style={{ fontSize: '12px', color: 'var(--txt-secondary)' }}>Resumen diario de sus registros cargados</p>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--brand-red)', fontWeight: 600 }}>{todayLogs.length} operario(s)</span>
          </div>

          {loadingToday ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Loader2 className="spin spin-large" />
            </div>
          ) : todayLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--txt-muted)' }}>
              No se han registrado asistencias el día de hoy.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {todayLogs.map(log => {
                const borderLeftCol = log.estado === 'Trabajo' ? 'var(--grn)' : (log.estado === 'Descanso' ? 'var(--amber)' : 'var(--brand-red)');
                return (
                  <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderLeft: `4px solid ${borderLeftCol}`, borderRadius: 'var(--radius-sm)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{log.nombre}</div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '4px', fontSize: '12px', color: 'var(--txt-secondary)' }}>
                        <span>DNI: {log.dni}</span>
                        <span>•</span>
                        <span>Estado: <span style={{ fontWeight: 600, color: borderLeftCol }}>{log.estado}</span></span>
                        {log.estado === 'Trabajo' && (
                          <>
                            <span>•</span>
                            <span>Labor: {log.codigo_labor}</span>
                            <span>•</span>
                            <span>Lote: {log.lote}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {log.estado === 'Trabajo' && log.hora_inicio && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--txt-secondary)', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                        <Clock size={12} /> {log.hora_inicio} {log.hora_fin ? `— ${log.hora_fin}` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          TAB: MY PERSONNEL HISTORY
          ──────────────────────────────────────────────────────── */}
      {activeTab === 'personal' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow)' }}>
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '15px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Historial de Personal</h3>
            <p style={{ fontSize: '12px', color: 'var(--txt-secondary)' }}>Operarios que ha registrado anteriormente</p>
          </div>

          {loadingHistory ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Loader2 className="spin spin-large" />
            </div>
          ) : personalHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--txt-muted)' }}>
              Aún no cuenta con historial de personal registrado.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
              {personalHistory.map(row => (
                <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{row.nombre}</div>
                    <div style={{ fontSize: '12px', color: 'var(--txt-secondary)', marginTop: '2px' }}>DNI: {row.dni}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--txt-muted)' }}>
                    Último registro: {new Date(row.ultima_vez).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
    </div>
  );
}
