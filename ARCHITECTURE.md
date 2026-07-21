# Documento de Arquitectura Funcional y Técnica
## Sistema de Control de Inventario de Cocina para Restaurantes (SCIC)

Este documento detalla la arquitectura completa, el diseño de módulos, las reglas de negocio, los flujos operativos y las directrices técnicas del Sistema de Control de Inventario de Cocina (SCIC). Ha sido concebido bajo los principios de simplicidad, robustez, bajo mantenimiento, alta consistencia de datos y facilidad de escala para entornos de restauración comercial.

---

### 1. Objetivos del Sistema

*   **Centralización del Control de Cocina:** Servir como el único punto de verdad para el stock y rendimiento de insumos y preparaciones dentro de la cocina.
*   **Consistencia y Trazabilidad Absoluta:** Garantizar que cada gramo, libra o unidad de mercancía esté justificado por un registro inalterable (compra, consumo o ajuste), eliminando la edición manual directa de existencias.
*   **Automatización Dinámica de Costos:** Calcular automáticamente el costo real de los insumos y de las recetas terminadas en tiempo real basándose en los flujos de compras (FIFO / Costo Promedio Ponderado).
*   **Resolución Recursiva de Recetas:** Permitir la preparación y el consumo de recetas complejas que utilizan otras sub-recetas de manera jerárquica y recursiva, resolviendo la cadena de ingredientes hasta su nivel más básico de insumo.
*   **Auditoría Total:** Ofrecer un historial inmutable y estructurado de todas las transacciones de inventario con identificación de usuario, fecha, hora y motivo.

---

### 2. Alcance (Scope)

El SCIC es un software de control de operaciones internas de cocina y almacén. 

*   **Enfoque Operativo:** El sistema se sitúa entre la recepción de mercancías de proveedores y la preparación de platos/producciones en cocina.
*   **Límites de Integración:** Recibe información de consumos (ya sea por integración futura con un POS o mediante interfaz de usuario directa) pero no procesa cobros ni interactúa con comensales.
*   **Precisión de Unidades:** Control riguroso y exclusivo en dos unidades estandarizadas: **Libra (lb)** y **Unidad (Und)**, simplificando la conversión y reduciendo drásticamente el error humano en pesajes y conteos.

---

### 3. Funcionalidades Detalladas

#### A. Catálogo de Insumos
*   Creación, lectura, actualización y desactivación lógica de insumos (Soft Delete / Inactividad).
*   Configuración de banderas operativas: `Permitir Compras` (insumos primarios que ingresan por proveedor) y `Permitir Producción` (preparaciones intermedias que se generan internamente mediante recetas).
*   Asociación estricta de una sola unidad de medida estándar (`lb` o `Und`) por insumo.

#### B. Registro de Compras
*   Formulario de ingreso para insumos primarios vinculando un proveedor, documento tributario/referencia (factura, remisión) y fecha.
*   Cálculo automático de costo unitario actual (`Precio Total / Cantidad`) al guardar la compra.
*   Generación automática e inmediata de un movimiento de inventario de tipo **Compra (Entrada)**.

#### C. Motor de Inventario Ledger-Based (Libro Mayor)
*   Cálculo sobre demanda o mediante vistas materializadas de la existencia de cada insumo mediante la fórmula agregada: 
    $$\text{Existencia} = \sum \text{Entradas} - \sum \text{Salidas}$$
*   Visualización consolidada en tiempo real de existencia, costo unitario actual, y valor total del stock actual ($\text{Existencia} \times \text{Costo Actual}$).

#### D. Motor de Recetas Recursivas
*   Modelado de relaciones ingrediente-receta permitiendo que el ingrediente de una receta sea un *Insumo Primitivo* o *Cualquier Otra Receta*.
*   Algoritmo de resolución recursiva (árbol de ingredientes) para calcular el desglose total de insumos primarios requeridos y el costo acumulado de la receta.
*   Bloqueo preventivo de referencias circulares en recetas (ej. Receta A requiere Receta B, y Receta B requiere Receta A).

#### E. Registro de Movimientos y Consumos
*   **Consumo Directo:** Interfaz rápida para registrar la salida directa de insumos (ej. desperdicios, mermas incidentales, obsolescencia).
*   **Consumo por Receta:** Entrada de producción donde el usuario indica "Receta" y "Cantidad", ejecutando el descuento automático del árbol jerárquico de insumos.
*   **Ajustes de Inventario:** Permite registrar mermas o sobrantes justificados mediante una transacción de ajuste (Entrada/Salida) con observaciones detalladas obligatorias.

#### F. Módulo de Seguridad y Permisos
*   Autenticación de usuarios y asignación de roles (Administrador, Gerente, Operador) con control de acceso basado en roles (RBAC) para proteger la inmutabilidad de los registros históricos.

---

### 4. Exclusiones (Fuera de Alcance)

Para mantener la simplicidad y el enfoque riguroso del sistema, quedan **explícitamente excluidas** las siguientes características:

1.  **Módulo de Ventas y Facturación (POS):** No se manejan tickets, cuentas de mesas, cobros con tarjeta, efectivo, ni arqueos de caja.
2.  **Gestión de Mesas y Salón:** No existe representación gráfica de mesas ni asignación de meseros.
3.  **CRM / Gestión de Clientes:** No se guardan historiales de visitas, preferencias de comensales ni programas de fidelización.
4.  **Cuentas por Pagar a Proveedores:** El módulo de compras registra el valor de la mercancía con fines de costeo y control de stock, pero no administra plazos de pago, estados de cuenta bancarios ni emisión de transferencias.
5.  **Multi-sucursal / Multi-almacén (En esta fase inicial):** El alcance asume un almacén único centralizado y una sola cocina asociada.

---

### 5. Arquitectura Propuesta

El SCIC adopta una arquitectura de **Libro Mayor de Inventario (Ledger-Based Inventory Architecture)**, similar a los sistemas de contabilidad partida doble o de transacciones bancarias.

```
       ┌────────────────────────────────────────────────────────┐
       │                   Interfaz de Usuario                  │
       │            (React + Tailwind CSS + Motion)             │
       └───────────────────────────┬────────────────────────────┘
                                   │ HTTPS / JSON API
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                   Backend API Server                   │
       │                   (Express + Node.js)                  │
       └───────────────────────────┬────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌──────────────────┐                                ┌──────────────────┐
│ Motor de Recetas │                                │ Motor Ledger     │
│    Recursivo     │                                │ (Movimientos)    │
│  (Arbol de Ings) │                                │ (Transaccional)  │
└──────────────────┘                                └──────────────────┘
         │                                                   │
         └─────────────────────────┬─────────────────────────┘
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │               Capa de Persistencia de Datos             │
       │                   (SQL / ORM relacional)               │
       └────────────────────────────────────────────────────────┘
```

#### Componentes Clave de la Arquitectura:

1.  **Capa de Presentación (Frontend):** 
    *   Construida en React utilizando Tailwind CSS para una interfaz de usuario limpia, de alta densidad de información y optimizada para dispositivos táctiles de cocina y laptops administrativas.
    *   Uso de `motion` (de `motion/react`) para micro-interacciones pulidas y transiciones fluidas de módulos.
2.  **Capa de Negocio (Backend):** 
    *   Servidor Express en Node.js que expone endpoints REST estandarizados.
    *   **Motor de Resolución de Recetas:** Un servicio especializado en recorrer estructuras de grafos acíclicos dirigidos (DAG) para descomponer recetas complejas en insumos básicos.
    *   **Motor de Transacciones de Inventario:** Garantiza que cada entrada y salida se registre con integridad referencial estricta.
3.  **Capa de Persistencia (Base de Datos Relacional - Sugerida):**
    *   Estructura tabular estricta que almacena: `Insumos`, `Compras`, `Recetas`, `RecetaIngredientes`, `Movimientos`, `MovimientoDetalles` y `Usuarios`.
    *   Uso mandatorio de **Transacciones ACID** a nivel de base de datos para asegurar que fallos a mitad de un descuento de receta no dejen el inventario en estado inconsistente.

---

### 6. Flujo Operativo Completo

#### Flujo A: Abastecimiento y Recepción (Compras)
1.  El chef o administrador recibe mercancía física de un proveedor.
2.  Ingresa al módulo **Compras** y selecciona el insumo primario preexistente.
3.  Registra la cantidad física (en `lb` o `Und`), el costo total y el número de documento.
4.  El sistema:
    *   Calcula el nuevo costo unitario del insumo: $C_u = \frac{\text{Costo Total}}{\text{Cantidad}}$
    *   Actualiza el campo `Costo Actual` del catálogo de insumos (utilizado como costo de referencia para valorización y recetas).
    *   Inserta una fila en la tabla de **Movimientos** como tipo `Compra` con signo positivo (+).
5.  Las existencias en el módulo **Inventario** reflejan el incremento inmediatamente al recalcular los movimientos históricos.

#### Flujo B: Preparación y Servicio (Consumo por Receta)
1.  La cocina prepara una tanda de producción o el POS reporta el despacho de platos terminados (ej. 10 porciones de "Taco Birria").
2.  Se registra el consumo de la receta en el sistema.
3.  El sistema inicia la **Resolución Jerárquica**:
    *   Analiza "Taco Birria". Encuentra que requiere:
        *   0.2 lb de "Birria" (que a su vez es otra receta).
        *   1 Und de "Tortilla" (insumo primario).
        *   0.05 lb de "Cebolla" (insumo primario).
        *   0.02 lb de "Cilantro" (insumo primario).
    *   Desciende a la receta "Birria" y encuentra que requiere:
        *   1.2 lb de "Carne" (insumo primario) para producir 1 lb de Birria.
        *   0.1 lb de "Chile" (insumo primario) para producir 1 lb de Birria.
    *   Calcula las cantidades netas de insumos primarios requeridas para las 10 porciones finales:
        *   Carne necesaria: $10 \times 0.2 \times 1.2 = 2.4 \text{ lb}$
        *   Chile necesario: $10 \times 0.2 \times 0.1 = 0.2 \text{ lb}$
        *   Tortillas necesarias: $10 \times 1 = 10 \text{ Und}$
        *   Cebolla necesaria: $10 \times 0.05 = 0.5 \text{ lb}$
        *   Cilantro necesario: $10 \times 0.02 = 0.2 \text{ lb}$
4.  **Validación Previa:** Comprueba si hay existencias suficientes de todos los ingredientes primarios mapeados. Si alguno es insuficiente y la regla de "No inventario negativo" está activa, la operación se cancela y se notifica el error.
5.  **Registro Transaccional:** Se abre una transacción en la base de datos y se registra un único encabezado de **Movimiento** de tipo `Consumo por Receta`, con múltiples registros en detalle (salidas con signo negativo) correspondientes a cada insumo primario desglosado.
6.  Se consolida la transacción. El stock físico real queda actualizado de manera consistente.

---

### 7. Reglas de Negocio (Business Rules)

| ID | Regla de Negocio | Descripción | Justificación |
| :--- | :--- | :--- | :--- |
| **RN-01** | **Inmutabilidad de Existencias** | Las existencias físicas de los insumos no se pueden modificar directamente mediante un valor estático en la base de datos. Todo cambio debe originarse a partir de un movimiento documentado (`Compra`, `Consumo Directo`, `Consumo por Receta` o `Ajuste`). | Evita la manipulación injustificada de inventarios y garantiza auditorías confiables. |
| **RN-02** | **No Inventario Negativo** | No se puede registrar ningún movimiento de salida que resulte en una existencia menor que cero ($Existencia < 0$) para cualquiera de los insumos afectados. Si ocurre, la transacción completa debe abortarse. | Evita inconsistencias matemáticas y fuerza al personal a registrar primero las compras antes de declarar consumos. |
| **RN-03** | **Unidades de Medida Estrictas** | Solo se permiten dos unidades de medida en todo el sistema: Libra (`lb`) y Unidad (`Und`). No existen conversiones complejas internas entre sistemas métricos diferentes (ej. kilogramos a onzas). | Reduce la complejidad en el desarrollo de software y minimiza errores de conversión por parte de los operadores. |
| **RN-04** | **Restricción de Eliminación por Trazabilidad** | No se permite la eliminación física de insumos que tengan al menos un movimiento asociado en su historial. En su lugar, se debe desactivar el insumo (`Activo = False`) para evitar compras futuras. | Preserva la integridad referencial histórica del ledger. |
| **RN-05** | **Bloqueo de Recetas en Uso** | No se puede eliminar o modificar estructuralmente una receta si esta forma parte como ingrediente de otra receta activa, o si tiene registros de consumos históricos guardados. | Evita romper la integridad del árbol jerárquico de recetas recursivas. |
| **RN-06** | **Ciclos Infinitos en Recetas** | El sistema debe verificar que no existan dependencias circulares al crear o modificar los ingredientes de una receta. Una receta "A" no puede requerir directa o indirectamente a la receta "A". | Previene desbordamientos de pila (Stack Overflow) en el motor de resolución recursiva de ingredientes. |
| **RN-07** | **Seguridad Transaccional** | Toda deducción o adición que afecte múltiples registros (ej. resolver una receta compleja con múltiples insumos primarios) debe ejecutarse bajo una transacción ACID única de base de datos. | Evita estados de inventario parcialmente actualizados ante fallos del sistema o de red. |

---

### 8. Estructura Conceptual de Módulos

El sistema se compone de 7 módulos altamente acoplados en su flujo de datos, pero con responsabilidades claramente delimitadas:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                 Módulos                                 │
├─────────────────┬──────────────────┬──────────────────┬─────────────────┤
│ 1. Catálogo     │ 2. Compras       │ 3. Inventario    │ 4. Recetas      │
│    - Insumos    │    - Proveedores │    - Ledger      │    - Fórmulas   │
│    - Categorías │    - Facturación │    - Valoración  │    - Costeo     │
├─────────────────┼──────────────────┼──────────────────┼─────────────────┤
│ 5. Movimientos  │ 6. Reportes      │ 7. Usuarios      │                 │
│    - Ajustes    │    - Desperdicio │    - Roles RBAC  │                 │
│    - Consumos   │    - Costeo/Valor│    - Sesiones    │                 │
└─────────────────┴──────────────────┴──────────────────┴─────────────────┘
```

1.  **Catálogo de Insumos:** Define las entidades base de la cocina. Clasifica los insumos en categorías (ej. Carnes, Verduras, Despensa) y determina el costo de mercado vigente de cada insumo a través del registro histórico de compras.
2.  **Compras:** Administra el ingreso de mercancía externa. Registra costos y genera movimientos de inventario del tipo `Compra`.
3.  **Inventario:** El módulo analítico y de consulta. Presenta el resumen consolidado de existencias actuales y valor de almacén. Permite buscar y filtrar rápidamente el estado de la despensa.
4.  **Recetas:** El núcleo de valor agregado del restaurante. Permite asociar insumos y sub-recetas con sus respectivas cantidades necesarias. Muestra un desglose en cascada del costo total calculado para cada receta en base al costo actual de los insumos primarios que la componen.
5.  **Movimientos de Inventario:** Panel operativo para declarar consumos directos, mermas de producción, consumos automáticos de recetas y ajustes para sincronizar existencias tras un conteo físico.
6.  **Reportes:** Proporciona visibilidad gerencial mediante tableros e indicadores clave:
    *   **Valorización de Almacén:** Capital actual invertido en la cocina.
    *   **Historial de Compras y Costos:** Gráficos de tendencias de precios de insumos críticos.
    *   **Mermas y Ajustes:** Análisis detallado de pérdidas y consumos directos no planificados.
7.  **Usuarios:** Gestión de identidades y accesos del sistema. Controla que un Operador de cocina no pueda registrar compras ficticias o realizar ajustes de inventario discrecionales sin autorización.

---

### 9. Dependencias entre Módulos

El orden de construcción de los módulos es crítico debido al flujo de dependencias lógicas:

```
    [7. Usuarios / Roles] (Transversal - Seguridad)
              │
              ▼
    [1. Catálogo de Insumos]
         │          │
         ▼          ├────────────────────────────────┐
    [2. Compras]    ▼                                ▼
         │     [4. Recetas (Recursivas)]    [3. Inventario (Ledger)]
         │          │                                ▲
         ▼          ▼                                │
    [   5. Movimientos de Inventario   ] ────────────┘
         │
         ▼
    [6. Reportes Analíticos]
```

*   **Insumos como Base:** Sin insumos, no se pueden registrar compras, ni estructurar recetas, ni realizar movimientos. El catálogo de insumos es la primera piedra del sistema.
*   **Inventario como una Vista del Historial:** El módulo de inventario depende de la existencia de movimientos de inventario (`Compras` y `Movimientos`). No puede existir stock si no hay un ledger histórico que procesar.
*   **Recetas como Consumidor de Insumos:** Las recetas dependen estrictamente del Catálogo de Insumos para existir.
*   **Movimientos como Orquestador:** El registro de movimientos requiere conocer las recetas (para consumos indirectos) e insumos (para consumos directos y ajustes).

---

### 10. Gestión de Riesgos y Mitigación

| Riesgo Técnico / Operativo | Impacto | Mitigación Arquitectónica |
| :--- | :--- | :--- |
| **Riesgo 1: Degradación de Rendimiento en el Ledger**<br>Calcular el inventario agregando miles de registros históricos de movimientos en cada consulta puede volverse lento con el tiempo. | Alto | **Uso de Tablas de Saldo / Instantáneas (Snapshots):** Implementar un proceso que cierre saldos al final de cada mes (Snapshot mensual). De este modo, el cálculo se realiza a partir de la última instantánea más los movimientos del mes en curso, en lugar de procesar todo el historial desde el día uno. |
| **Riesgo 2: Referencias Circulares en Recetas**<br>Que un usuario defina que la Receta A requiere Receta B, y la Receta B requiere Receta A, tirando el servidor por recursión infinita. | Crítico | **Algoritmo de Detección de Ciclos:** Al intentar guardar una receta, la API debe validar que la estructura resultante sea un Grafo Acíclico Dirigido (DAG). Si se detecta una ruta cíclica, la API bloquea el guardado devolviendo un error HTTP 400 descriptivo. |
| **Riesgo 3: Descuadres por Unidades de Medida**<br>Intentar descontar decimales muy pequeños en libras que provoquen errores de redondeo acumulativos en bases de datos. | Medio | **Precisión Decimal Estricta:** Almacenar todas las cantidades y costos con un mínimo de 4 decimales de precisión en la base de datos (ej. tipo de dato `DECIMAL(12, 4)`) y realizar el redondeo a 2 decimales únicamente en la interfaz visual de cara al usuario. |
| **Riesgo 4: Concurrencia de Consumos**<br>Múltiples operarios intentando registrar consumos o compras de un mismo insumo al mismo tiempo, generando condiciones de carrera (Race Conditions). | Alto | **Bloqueo Pesimista / Transacciones Serializables:** Utilizar transacciones de base de datos con niveles de aislamiento adecuados (`Read Committed` o `Serializable` según la base de datos elegida) para garantizar que los balances de stock intermedios se verifiquen correctamente antes de aplicar descuentos. |

---

### 11. Escalabilidad Futura

Aunque el diseño inicial está estrictamente acotado para simplificar la primera fase de desarrollo, la arquitectura propuesta facilita la incorporación orgánica de los siguientes módulos comerciales a futuro:

1.  **Multi-Almacén / Multi-Bodega:** La tabla de movimientos puede ampliarse fácilmente añadiendo una clave foránea `almacen_id` o `bodega_id` tanto de origen como de destino, permitiendo transferencias entre bodegas (ej. Almacén Central -> Cocina Caliente) sin reescribir el motor del Ledger.
2.  **Módulo de Alertas de Stock Mínimo (Reordenamiento):** Añadir una columna `stock_minimo` en el catálogo de insumos para que la pantalla de inventarios señale en rojo los insumos críticos que requieren compra urgente.
3.  **Integración Directa de POS mediante Webhooks:** Exponer un endpoint de API público para que sistemas de punto de venta (como Loyverse, Toast o Square) puedan notificar ventas de platos en tiempo real, permitiendo al SCIC descontar de forma totalmente automática los insumos asociados por receta.
4.  **Módulo de Producciones Manuales (Ensamble previo):** Permitir registrar la producción anticipada de una receta (ej. preparar 20 libras de Salsa Birria el lunes). Esto descontaría los insumos primarios inmediatamente y crearía un stock disponible de la receta "Salsa Birria" como un insumo de producción, evitando descontar ingredientes al momento de preparar el plato final.

---

### 12. Buenas Prácticas Recomendadas

*   **Clean Architecture & Principio de Única Responsabilidad (SRP):** Mantener el cálculo lógico del árbol de recetas aislado en un servicio puro (`RecipeService`), sin acoplamiento a controladores HTTP o vistas de interfaz. Esto facilitará las pruebas unitarias y la mantenibilidad del software.
*   **Manejo de Errores Descriptivos:** Retornar códigos de error legibles y específicos desde el backend (ej. `INSUFFICIENT_STOCK_ERROR`, `CIRCULAR_DEPENDENCY_DETECTED`) para que la UI pueda guiar al usuario exactamente sobre qué insumo o receta causó el bloqueo, en lugar de mostrar errores de sistema genéricos.
*   **Diseño de UI Orientado a la Densidad:** En una cocina, las manos suelen estar ocupadas y el ritmo es rápido. Las pantallas operativas (Consumos) deben contar con botones grandes, inputs con teclado numérico nativo optimizado para tabletas y flujos de clics simplificados. Las pantallas administrativas (Reportes y Catálogos) deben priorizar la visualización de datos densos, con tablas exportables y filtros dinámicos.

---

### 13. Observaciones Técnicas y Recomendaciones de Implementación

1.  **Costo Promedio Ponderado (CPP) vs FIFO para Valoración:**
    *   Para la cocina de un restaurante, la estimación más realista y simple del valor de inventario y costo de platos es el **Costo Promedio Ponderado**.
    *   Cada vez que ingresa una compra, el costo unitario del insumo en el catálogo debe actualizarse a:
        $$C_{\text{nuevo}} = \frac{(\text{Stock Actual} \times C_{\text{anterior}}) + (\text{Cantidad Comprada} \times C_{\text{compra}})}{\text{Stock Actual} + \text{Cantidad Comprada}}$$
    *   Esto simplifica enormemente el cálculo del costo de recetas jerárquicas en comparación con un modelo FIFO estricto, que requeriría rastrear lotes específicos de insumos a lo largo del árbol recursivo.

2.  **Uso de Soft-Deletes:**
    *   En lugar de ejecutar sentencias `DELETE` físicas en la base de datos, se debe implementar una columna `activo` (booleano) y `fecha_baja`. Esto garantiza que los reportes de rendimiento y costos históricos no se rompan por la ausencia de registros de insumos o recetas antiguas.

---

### 14. Revisión Crítica de Diseño y Propuestas de Mejora

Realizando un auto-análisis riguroso sobre los requerimientos iniciales del sistema, se han identificado las siguientes debilidades potenciales del diseño básico sugerido por la filosofía del sistema, junto con sus respectivas soluciones justificadas técnicamente sin romper las premisas originales de control inmutable y uso estricto de dos unidades (`lb` y `Und`):

#### Debilidad A: La conversión del formato de compra al formato de receta (Rendimiento por Desperdicio)
*   **Problema:** Muchos insumos se compran en una presentación pero se consumen de forma distinta tras un proceso de limpieza o merma (ej. se compra 1 lb de Carne de Res con hueso y grasa, pero tras limpiarla, solo quedan 0.75 lb útiles para la receta). Si el sistema calcula el consumo de la receta usando libras directas de carne limpia, el inventario teórico de libras compradas acumulará un desfase constante de desperdicio que el operador tendría que estar ajustando manualmente de forma repetida.
*   **Solución Propuesta (Sin romper la filosofía):** Incorporar un factor de **Rendimiento Operativo (Yield Percentage)** opcional en el catálogo de insumos (ej. Rendimiento: 75%). Al momento de registrar un consumo de receta que requiera carne limpia, el sistema calcula la cantidad a descontar del inventario del libro mayor usando la fórmula:
    $$\text{Cantidad a Descontar} = \frac{\text{Cantidad Neta de la Receta}}{\% \text{ de Rendimiento}}$$
    De este modo, se asume la merma de preparación de manera automática en el libro de movimientos como merma operativa de la receta, manteniendo la inmutabilidad y precisión del cálculo sin intervención manual.

#### Debilidad B: Unidades de compra mayoristas contra unidades de receta mínimas (La paradoja de las Dos Unidades)
*   **Problema:** Al limitar estrictamente el sistema a Libra (`lb`) y Unidad (`Und`), un insumo de especia fina (ej. Pimienta) se consume en cantidades extremadamente pequeñas dentro de una receta de Birria (ej. 0.005 lb por porción). El registro de estas fracciones minúsculas por parte del usuario al crear una receta puede inducir a errores fatales de entrada de datos (ej. ingresar `0.05` en lugar de `0.005` lb, multiplicando por 10 el costo y descuento real).
*   **Solución Propuesta (Sin romper la filosofía):** Mantener el almacenamiento y base de datos estrictamente en `lb` y `Und`, pero proveer una máscara de visualización o sub-escala en la interfaz del usuario para el ingreso de datos menores (ej. permitir que el usuario escriba en gramos en la pantalla de recetas, pero la interfaz guarde el dato convertido automáticamente a libras dividiendo entre $453.59$). Esto mantiene el motor de base de datos intacto, limpio y alineado a las dos unidades autorizadas, eliminando la fricción y el error humano al redactar las recetas.

#### Debilidad B-2: Inexistencia de "Litros" u "Onzas líquidas" para insumos líquidos de barra/cocina
*   **Problema:** El sistema excluye explícitamente los líquidos. Los aceites, salsas industriales, leche o licores se comercializan en botellas o galones de volumen. Intentar forzar su registro en libras o unidades puede generar graves imprecisiones debido a las diferencias de densidad (ej. una libra de aceite no equivale a una libra de agua en volumen).
*   **Solución Propuesta (Sin romper la filosofía):** Los líquidos deben tratarse estrictamente bajo el formato **Unidad (Und)** en el catálogo, definiendo la unidad como la botella o contenedor base (ej. "Botella de Aceite 1L" = 1 Und), y definiendo las porciones en las recetas como fracciones decimales de esa unidad (ej. una porción de receta usa 0.05 de la botella de aceite). Esto preserva la regla de oro de manejar únicamente `lb` y `Und` en la base de datos sin perder el control volumétrico de los ingredientes de cocina.

---

### 15. Arquitectura Detallada de Integración Google Sheets / AppSheet

Para garantizar que el propietario o administrador pueda configurar y vincular de forma completamente dinámica su cuenta de Google y sus recursos, se establece un flujo técnico formal, seguro y sin simulación que cumple estrictamente con las especificaciones del negocio.

#### A. Flujo Bidireccional de Datos Centrales
El flujo opera bajo un esquema de sincronización en tiempo real y diferido:

```
               [ DISPOSITIVO ANDROID ]
                       │     ▲
                       ▼     │ Real-Time Sync (Firestore SDK)
                 [ CLOUD FIRESTORE MASTER ]
                  (Único Punto de Verdad)
                       │     ▲
  Write (Sheets API)   ▼     │ Webhook Trigger (Node API)
               [ REPLICA GOOGLE SHEETS ]
                       │     ▲
                       ▼     │ Native Data Source Link
                    [ GOOGLE APPSHEET ]
```

#### B. Componentes del Flujo y Respuestas a los Puntos Críticos

1.  **Conexión de Cuenta Google y Autorización (OAuth 2.0):**
    *   **Mecanismo:** El administrador utiliza el botón **[ CONECTAR CUENTA DE GOOGLE ]** desde la vista de configuraciones. La aplicación inicia un flujo oficial de **OAuth 2.0**.
    *   **Alcance (Scopes):** Se solicitan los permisos estrictos y necesarios para crear/editar hojas de cálculo: `https://www.googleapis.com/auth/spreadsheets` y `https://www.googleapis.com/auth/drive.file`.
    *   **Seguridad:** El `refresh_token` se recibe de forma segura en el servidor y se almacena encriptado en Firestore Master bajo el documento de configuración del restaurante. Nunca se expone al cliente ni se guarda directamente en código. El frontend o el APK solo interactúan con endpoints proxy seguros del backend.

2.  **Selección de Google Spreadsheet:**
    *   El administrador puede listar los Spreadsheets disponibles en su cuenta mediante el uso del API de **Google Drive v3 (Files: list)** filtrando por `mimeType = 'application/vnd.google-apps.spreadsheet'`.
    *   Si prefiere, el administrador puede ingresar el ID del Spreadsheet de forma manual. El sistema valida el acceso instantáneamente llamando a la metadata básica de la hoja para comprobar conectividad (`spreadsheets.get`).
    *   Al guardar, se realiza la creación e inicialización de las pestañas obligatorias (`Insumos`, `Recetas`, `Movimientos`, `Usuarios`) con sus encabezados normalizados en caso de que sea un Spreadsheet en blanco.

3.  **Integración con AppSheet:**
    *   **Vinculación:** AppSheet lee directamente el Spreadsheet configurado. Se instruye al usuario a vincular este Spreadsheet como la fuente de datos principal (DataSource) de su aplicación AppSheet.
    *   **Configuración:** No se inventan mecanismos ficticios; el sistema provee una guía paso a paso y la descarga de un archivo de configuración modelo para importar la estructura de tablas directamente en la consola de AppSheet.

4.  **Actualización Automática Firestore → Google Sheets (Sentido A):**
    *   **Proceso:** Cada operación de escritura local (Crea, Modifica, Desactiva Insumo o Receta; Registro de Compras o Movimientos de Inventario) se sincroniza primero con Firestore Master.
    *   **Trigger de Sincronización:** El servidor de Node.js intercepta la confirmación de escritura y despacha de forma asíncrona una petición a la **Google Sheets API** para actualizar o agregar las filas correspondientes en el Spreadsheet.
    *   **No Redundancia:** El uso de UUIDs únicos para cada registro previene duplicidades (Upsert lógico basado en la columna ID del Spreadsheet).

5.  **Sincronización Inversa AppSheet → Google Sheets → Firestore (Sentido B):**
    *   **Detección de Cambios:** Cuando se edita información permitida desde AppSheet, esta se escribe en el Google Sheet de forma inmediata.
    *   **Apps Script Webhook:** Se asocia un activador `onChange` o `onEdit` en Google Sheets (mediante un App Script genérico provisto por la plataforma) que dispara un **Webhook seguro (HTTPS POST)** hacia la API de integración de nuestro servidor (`/api/integration/sheets-webhook`).
    *   **Validación:** El webhook recibe el cambio, autentica el token de seguridad firmado del webhook, y comprueba las reglas de negocio antes de aplicarlo en Firestore Master. Si es aprobado, se actualiza Firestore, lo que inmediatamente propaga el cambio en tiempo real a todos los clientes de Android.

6.  **Matriz de Permisos de Escritura (Gobernanza de Datos):**
    Para proteger la integridad del Ledger de inventario, se define la siguiente matriz estricta:

    | Entidad / Tabla | Lectura AppSheet | Escritura AppSheet | Validación Crítica en Backend |
    | :--- | :---: | :---: | :--- |
    | **Insumos** | Sí | Sí | Nombre único, unidad inalterable si tiene movimientos. |
    | **Categorías** | Sí | Sí | Nombre único. |
    | **Proveedores** | Sí | Sí | Nombre único. |
    | **Recetas** | Sí | No | No se permite crear recetas complejas en AppSheet sin validación circular. |
    | **Compras** | Sí | No | Las compras generan costos reales y requieren flujos controlados. |
    | **Movimientos** | Sí | No | El ledger se alimenta de transacciones aprobadas por el motor de inventario. |
    | **Inventario** | Sí | NO | El inventario es calculado; no se puede alterar un stock arbitrariamente. |

7.  **Resolución de Conflictos de Concurrencia:**
    *   **Regla de Oro:** Firestore Master tiene prioridad absoluta de verdad.
    *   **Conflicto de Stock Negativo:** Si un operario en AppSheet intenta forzar una salida de inventario ilegal, el Webhook de la API rechazará la operación, reescribirá la fila de Google Sheets con el stock y el estado de error correcto, y enviará un log a la bitácora administrativa.

8.  **Gestión de Cola de Sincronización Offline:**
    *   Ante la pérdida de conexión en la aplicación Android, las transacciones se apilan localmente en el **Outbox** con estado `PENDIENTE`.
    *   Al restaurar la conexión, el Outbox reproduce en orden cronológico estricto las transacciones acumuladas utilizando UUIDs para evitar duplicación física de registros en Firestore. Tras consolidarse, se actualiza la copia de Google Sheets.

9.  **Historial de Sincronización (Bitácora de Sincronización):**
    *   Cada operación realizada a través de la capa de integración registra una entrada en la tabla `SyncLogs` en Firestore y Google Sheets con la siguiente estructura: `[FechaHora, Usuario, Dispositivo, Operación, Detalle, Estado (Sincronizado/Error), MensajeError, Intentos]`.

---