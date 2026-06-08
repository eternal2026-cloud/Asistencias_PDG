# Control de Asistencias — El Pedregal S.A.

Aplicación web moderna para el control de asistencias del personal de **El Pedregal S.A.**, con soporte para escaneo de códigos QR, registro individual y masivo, y un validador cruzado con marcaciones de reloj biométrico.

---

## 🛠️ Tecnologías Utilizadas

*   **Frontend:** React (v18) + Vite (v5)
*   **Base de Datos Relacional:** Supabase (PostgreSQL)
*   **Escáner QR:** `html5-qrcode` para lectura mediante cámara y carga de imágenes.
*   **Iconografía:** Lucide React
*   **Animaciones:** Canvas Confetti

---

## 📂 Estructura del Proyecto

*   `src/components/SupervisorDashboard.jsx` — Interfaz para supervisores (teclado numérico, escáner QR en vivo y cuadrícula masiva tipo Excel).
*   `src/components/AdminDashboard.jsx` — Visualizador de reportes consolidados y exportación en formato CSV.
*   `src/components/ValidatorDashboard.jsx` — Herramienta para cargar archivos del reloj marcador y realizar el cruce y validación de marcaciones.
*   `src/supabaseClient.js` — Cliente de conexión con la base de datos de Supabase.
*   `supabase_schema.sql` — Esquema de base de datos relacional para ejecutar en el dashboard de Supabase.

---

## 🚀 Instalación y Desarrollo Local

Dado que la aplicación está estructurada con Vite, requiere Node.js instalado localmente para desarrollo:

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   * Duplica el archivo `.env.example` y renombralo a `.env`.
   * Reemplaza `VITE_SUPABASE_ANON_KEY` con la clave anon public de tu proyecto de Supabase.

3. **Iniciar el servidor local de desarrollo:**
   ```bash
   npm run dev
   ```
   *La aplicación se abrirá en `http://localhost:3000`.*

---

## 💾 Configuración de la Base de Datos (Supabase)

1. Ingresa a tu panel de Supabase: [zicvanezsbmwgbporfps](https://supabase.com/dashboard/project/zicvanezsbmwgbporfps).
2. Ve al **SQL Editor** en el menú izquierdo.
3. Abre una nueva consulta ("New query"), copia el código del archivo `supabase_schema.sql` y haz clic en **Run**. Esto creará todas las tablas, índices y políticas necesarias.

---

## ☁️ Despliegue en Vercel

Vite está configurado de forma estándar, por lo que el despliegue en Vercel es automático:

1. Sube el código de este directorio a un repositorio de **GitHub**, **GitLab** o **Bitbucket**.
2. Ingresa a [Vercel](https://vercel.com) e inicia sesión con tu cuenta.
3. Haz clic en **Add New** -> **Project**.
4. Importa tu repositorio recién creado.
5. En la sección **Environment Variables**, agrega las siguientes dos variables:
   * `VITE_SUPABASE_URL` = `https://zicvanezsbmwgbporfps.supabase.co`
   * `VITE_SUPABASE_ANON_KEY` = *[Tu clave anon public de Supabase]*
6. Haz clic en **Deploy**. Vercel detectará el framework (Vite), compilará los archivos de producción y generará el enlace de despliegue en la nube en cuestión de segundos.
