# Reparar la generación de PDF de reportes

## Objetivo
Hacer que todos los PDF se descarguen completos, legibles y sin romper la pantalla ni cortar contenido.

## Cambios
- Reemplazar la captura de bloques gigantes del Reporte Área Comercial por un generador PDF paginado y estable.
- Mantener logo transparente, membrete, período, numeración y crédito en cada página.
- Dibujar KPIs, tendencias, tablas, Pareto, productos sin rotación y conclusiones directamente en el PDF, evitando depender del tamaño visible de la pantalla.
- Reforzar los demás reportes tabulares para repetir encabezados y reservar correctamente cabecera y pie en cada página.
- Mostrar un error claro si una descarga falla y restaurar siempre el estado del botón.

## Validación
- Generar los reportes desde la aplicación con datos activos.
- Renderizar los PDF como imágenes y revisar visualmente todas las páginas: cortes, superposiciones, márgenes, caracteres y tablas.
- Comprobar que la aplicación siga compilando sin errores.

## Detalles técnicos
- Se conservarán jsPDF y jspdf-autotable.
- Se eliminará html2canvas del flujo del Reporte Área Comercial, que actualmente crea imágenes demasiado altas y frágiles.
- No se crearán ni modificarán archivos de bloqueo de dependencias.
