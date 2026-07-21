# Reporte de Auditoría de QA UI/UX Móvil — MorphIQ

Este documento presenta el análisis detallado de la interfaz y experiencia de usuario (UI/UX) de la aplicación móvil **MorphIQ** (Capacitor + React + Material 3), evaluada en un viewport móvil estándar de **390x844 px**.

---

## 1. Resumen Ejecutivo

MorphIQ presenta una estética moderna y premium de tipo **Cinema Dark** con elementos de vidrio esmerilado (*glassmorphism*), tipografías bien emparejadas (*Outfit* e *Inter*) y bordes redondeados consistentes con **Material Design 3 (M3)**. 

Sin embargo, durante la auditoría de navegación en dispositivos móviles se han identificado varios **puntos críticos de UX y maquetación CSS** que comprometen la usabilidad, destacando problemas de superposición con la barra de navegación inferior y comportamientos de scroll disruptivos en la pantalla del Coach.

---

## 2. Análisis por Secciones

### 2.1. Pantalla de Onboarding (Creación de Perfil)
*Ruta de captura: [onboarding.png](file:///C:/Users/march/.gemini/antigravity/brain/a9449cd1-f466-4993-b078-b6c7f94d3c93/onboarding.png)*

*   **Distribución y Jerarquía**: La cabecera y el título principal de bienvenida son claros y establecen un buen punto de partida. La tarjeta informativa "Profile Management" ("No profiles yet...") y el formulario de creación "Create New Profile" compiten visualmente en el mismo espacio.
*   **Problema de Altura / Carga Cognitiva**: Mostrar una tarjeta de aviso que dice "no hay perfiles" justo encima de un formulario cuyo único propósito es crear un perfil es redundante y consume alrededor de **120px de espacio vertical** que obliga a hacer scroll en pantallas móviles.
*   **Zonas de Toque (Touch Targets)**: Los campos de entrada (Name, Height, etc.) tienen una excelente altura de **48px**, lo que cumple perfectamente con las pautas de accesibilidad móvil (evitando el zoom automático disruptivo de iOS en inputs menores a 16px).

### 2.2. Dashboard (Pantalla Principal)
*Ruta de captura: [dashboard.png](file:///C:/Users/march/.gemini/antigravity/brain/a9449cd1-f466-4993-b078-b6c7f94d3c93/dashboard.png)*

*   **Jerarquía Visual**: La interfaz es limpia. La tarjeta de sincronización de la báscula en la parte superior destaca adecuadamente.
*   **Barra de Navegación Inferior (M3)**: Cumple de forma excelente con el estándar de Material 3. La cápsula de selección activa envuelve el icono de forma fluida y el texto cambia a negrita correctamente.
*   **Inconsistencia del Botón "+" en Cabecera**: Junto al selector de perfiles hay un botón con el icono `+` (`Plus`). En UX móvil, un botón `+` en la cabecera del home generalmente significa "Añadir un nuevo registro" o "Añadir perfil". Sin embargo, este botón redirige a la pestaña de **Settings (Configuración)**. Esto genera frustración y confusión en el usuario.

### 2.3. Registro Diario (Daily Logs)
*Ruta de captura: [logs.png](file:///C:/Users/march/.gemini/antigravity/brain/a9449cd1-f466-4993-b078-b6c7f94d3c93/logs.png)*

*   **Distribución de Métricas**: La cuadrícula de 2x2 para las calorías (Consumed, BMR, Exercise, Balance) aprovecha muy bien el ancho de la pantalla y la escala numérica es legible al instante.
*   **¡ERROR CRÍTICO DE UX! (Superposición de Barra)**: El formulario para registrar comidas ("Log Meals & Nutrition") sitúa la fila de macros (*Protein*, *Carbs*, *Fat*) en la parte inferior. Al cargar la pantalla, **estos campos quedan semicortados y ocultos detrás de la barra de navegación fija** (`.m3-navigation-bar`). El usuario no puede verlos a primera vista y, si intenta pulsarlos, corre el riesgo de accionar accidentalmente los botones de la barra de navegación móvil.

### 2.4. Entrenador IA (AI Coach)
*Ruta de captura: [coach.png](file:///C:/Users/march/.gemini/antigravity/brain/a9449cd1-f466-4993-b078-b6c7f94d3c93/coach.png)*

*   **Comportamiento de Altura Rígida (640px)**: El contenedor del chat de IA tiene un alto fijo en CSS de `640px`. En pantallas de altura limitada (como 844px de alto total, restando la cabecera de 64px y el nav inferior de 80px), este bloque empuja la caja de entrada de texto hacia el extremo inferior del viewport.
*   **Scroll Involuntario de Foco**: Debido a la altura de 640px del contenedor de chat, cuando el navegador enfoca el campo de entrada, realiza un scroll automático hacia abajo. Esto causa que **los sub-tabs de navegación superior y el propio título del chat se deslicen fuera de la pantalla**, mostrando el input de texto en el borde superior de la captura seguido del bloque de "Coaching Context Data". Esto rompe completamente el contexto visual del chat.
*   **Contexto Abierto por Defecto**: El bloque de "Coaching Context Data" está desplegado por defecto, ocupando un valioso espacio en pantalla móvil que debería destinarse al historial de la conversación.

### 2.5. Configuración (Settings)
*Ruta de captura: [settings.png](file:///C:/Users/march/.gemini/antigravity/brain/a9449cd1-f466-4993-b078-b6c7f94d3c93/settings.png)*

*   **Usabilidad del Formulario**: Los campos de edición de perfil y el botón "Save Profile Changes" son consistentes y tienen buen tamaño.
*   **Botón Recortado en la Cabecera**: El botón "+ Create New Profile" aparece recortado en su parte superior al inicio del scroll de la página de configuración, debido a que el cálculo de márgenes superiores no respeta adecuadamente la altura del encabezado sticky.

---

## 3. Zonas de Toque y Accesibilidad

*   **Puntos Fuertes**:
    *   Todos los botones principales (`m3-btn-filled`, `m3-btn-outlined`) y los campos de entrada tienen un alto mínimo de **48px**, garantizando que las zonas de toque se adapten a dedos de todos los tamaños.
    *   Los selectores de pestañas inferiores tienen un área de click generosa que evita errores de navegación.
*   **Puntos Débiles**:
    *   Los campos de macros (proteínas, carbohidratos, grasas) en Daily Logs miden menos de 48px de alto y están demasiado pegados entre sí en una sola fila de tres columnas, lo que dificulta su selección individual en pantallas de menor tamaño.

---

## 4. Auditoría de Consistencia Material Design 3 (M3)

*   **Colores**: El uso de `var(--m3-sys-primary)` (índigo) y `var(--m3-sys-secondary)` (teal) está bien balanceado. Los estados de error y contenedores secundarios siguen las pautas tonales de M3.
*   **Formas**: Se respeta de manera estricta la jerarquía de esquinas redondeadas:
    *   Tarjetas: `16px` (`--m3-shape-lg`).
    *   Inputs/Campos: `12px` (`--m3-shape-md`).
    *   Botones y Pestañas: Completamente redondeados (`--m3-shape-full`).
*   **Tipografía**: Las fuentes *Outfit* para títulos e *Inter* para el cuerpo ofrecen excelente legibilidad en pantallas de alta densidad de píxeles (Retina / OLED).

---

## 5. Propuestas de Corrección (Plan de Acción Recomendado)

Para elevar la aplicación a un nivel premium y resolver los fallos detectados de usabilidad móvil, se recomiendan los siguientes cambios en el código:

### Solución 1: Arreglar el espacio en el formulario de comidas (Daily Log)
Modificar el contenedor del formulario para asegurar que no se superponga con la barra de navegación inferior, o forzar una disposición en columna de los inputs de macros si el ancho de pantalla es inferior a `400px`.
*   **En `index.css`**: Incrementar ligeramente el padding inferior de `.main-content` en móviles a `120px` para asegurar suficiente margen de separación frente a la barra fija.

### Solución 2: Rediseñar la pantalla del Coach para Móviles
*   En lugar de una altura estática de `640px` para el chat en `.CoachChat`, se debe implementar un layout de flexbox con una altura dinámica: `height: calc(100vh - 220px)` o similar, asegurando que el input de texto siempre se posicione en la parte inferior de la pantalla por encima del menú de navegación, sin causar scrolls disruptivos de la página entera.
*   Configurar el estado inicial del acordeón "Coaching Context Data" a **colapsado** (`isContextCollapsed = true` por defecto) en móviles para dar prioridad al chat.

### Solución 3: Corregir el comportamiento del botón "+" del Header
*   Cambiar la acción del botón `+` en la cabecera (cuando el usuario ya tiene perfiles) para que abra un modal rápido de "Crear Perfil" o un menú contextual, en lugar de redirigir silenciosamente a la sección de Configuración.
*   Alternativamente, cambiar el icono a un engrane (`Settings` o `User`) para reflejar correctamente su destino.
