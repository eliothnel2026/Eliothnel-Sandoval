/**
 * ESPECIFICACIÓN DE BASE DE DATOS - CAPA DE MODELOS Y RELACIONES (3FN)
 * Módulo: FASE 2 - Base de Datos, Migraciones, Modelos, Relaciones, Seeders y Factories.
 * 
 * Este archivo define la estructura de las tablas, relaciones, restricciones
 * e índices que representarán la base de datos profesional y normalizada (3FN).
 * También incluye las Factorías y Seeders programáticos para simulación e inicialización.
 */

export interface DBColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  foreignKey?: { table: string; column: string; onDelete?: 'RESTRICT' | 'CASCADE' };
  unique?: boolean;
  check?: string;
  description: string;
}

export interface DBTable {
  name: string;
  description: string;
  columns: DBColumn[];
  indexes: { name: string; columns: string[]; unique?: boolean; description: string }[];
}

/**
 * 1. DEFINICIÓN METADATA DEL DISEÑO RELACIONAL (POSTGRESQL / SQL SERVER / MYSQL COMPATIBLE)
 * 
 * Se detallan 9 tablas estructuradas en 3FN que implementan fielmente las reglas de negocio,
 * garantizan integridad referencial y proveen auditoría completa.
 */
export const DATABASE_SCHEMA: DBTable[] = [
  {
    name: 'usuarios',
    description: 'Tabla de identidades y roles autorizados del sistema (RBAC).',
    columns: [
      { name: 'id', type: 'UUID / VARCHAR(36)', nullable: false, primaryKey: true, description: 'Clave primaria autogenerada.' },
      { name: 'nombre', type: 'VARCHAR(100)', nullable: false, unique: true, description: 'Nombre completo del colaborador.' },
      { name: 'rol', type: 'VARCHAR(20)', nullable: false, check: "rol IN ('Administrador', 'Gerente', 'Operador')", description: 'Rol asignado para control de accesos.' },
      { name: 'activo', type: 'BOOLEAN', nullable: false, check: 'DEFAULT TRUE', description: 'Permite desactivación lógica del usuario.' },
      { name: 'creado_el', type: 'TIMESTAMP', nullable: false, description: 'Fecha y hora de creación.' },
      { name: 'creado_por', type: 'VARCHAR(100)', nullable: true, description: 'Usuario que realizó la creación.' }
    ],
    indexes: [
      { name: 'idx_usuarios_activo', columns: ['activo'], description: 'Optimiza filtrado de usuarios habilitados.' }
    ]
  },
  {
    name: 'insumos',
    description: 'Catálogo maestro de materias primas e insumos procesados.',
    columns: [
      { name: 'id', type: 'UUID / VARCHAR(36)', nullable: false, primaryKey: true, description: 'Clave primaria.' },
      { name: 'nombre', type: 'VARCHAR(150)', nullable: false, unique: true, description: 'Nombre del insumo (ej. Carne de Res).' },
      { name: 'categoria', type: 'VARCHAR(50)', nullable: false, description: 'Categoría para agrupación (ej. Carnes, Verduras).' },
      { name: 'proveedor_principal', type: 'VARCHAR(150)', nullable: false, description: 'Nombre del proveedor de abastecimiento principal.' },
      { name: 'unidad', type: 'VARCHAR(3)', nullable: false, check: "unidad IN ('lb', 'Und')", description: 'Unidades permitidas del sistema.' },
      { name: 'costo_actual', type: 'DECIMAL(12, 4)', nullable: false, check: 'costo_actual >= 0', description: 'Costo de referencia dinámico actualizado por compras (CPP).' },
      { name: 'activo', type: 'BOOLEAN', nullable: false, check: 'DEFAULT TRUE', description: 'Desactivación lógica del insumo.' },
      { name: 'permitir_compras', type: 'BOOLEAN', nullable: false, description: 'Permite que el insumo se registre en el módulo de compras.' },
      { name: 'permitir_produccion', type: 'BOOLEAN', nullable: false, description: 'Permite que el insumo sea generado internamente mediante receta.' },
      { name: 'creado_el', type: 'TIMESTAMP', nullable: false, description: 'Metadato de creación.' },
      { name: 'creado_por', type: 'VARCHAR(100)', nullable: false, description: 'Usuario creador.' },
      { name: 'modificado_el', type: 'TIMESTAMP', nullable: true, description: 'Fecha de última edición.' },
      { name: 'modificado_por', type: 'VARCHAR(100)', nullable: true, description: 'Usuario modificador.' }
    ],
    indexes: [
      { name: 'idx_insumos_nombre_uq', columns: ['nombre'], unique: true, description: 'Evita duplicados a nivel físico de BD.' },
      { name: 'idx_insumos_activo_cat', columns: ['activo', 'categoria'], description: 'Acelera filtros en listados y selectores.' }
    ]
  },
  {
    name: 'compras',
    description: 'Encabezado de transacciones de compra a proveedores externos.',
    columns: [
      { name: 'id', type: 'UUID / VARCHAR(36)', nullable: false, primaryKey: true, description: 'Clave primaria.' },
      { name: 'proveedor', type: 'VARCHAR(150)', nullable: false, description: 'Proveedor emisor de la factura.' },
      { name: 'documento', type: 'VARCHAR(50)', nullable: false, description: 'Número de factura, remisión o boleta.' },
      { name: 'fecha', type: 'DATE', nullable: false, description: 'Fecha del documento de compra.' },
      { name: 'observaciones', type: 'TEXT', nullable: true, description: 'Notas opcionales del receptor.' },
      { name: 'creado_el', type: 'TIMESTAMP', nullable: false, description: 'Control de auditoría.' },
      { name: 'creado_por', type: 'VARCHAR(100)', nullable: false, description: 'ID o nombre de usuario creador.' }
    ],
    indexes: [
      { name: 'idx_compras_fecha_doc', columns: ['fecha', 'documento'], description: 'Acelera búsquedas y auditoría de documentos.' }
    ]
  },
  {
    name: 'compra_detalles',
    description: 'Detalle granular de cada insumo adquirido por compra.',
    columns: [
      { name: 'id', type: 'UUID / VARCHAR(36)', nullable: false, primaryKey: true, description: 'Clave primaria.' },
      { name: 'compra_id', type: 'UUID / VARCHAR(36)', nullable: false, foreignKey: { table: 'compras', column: 'id', onDelete: 'RESTRICT' }, description: 'Clave foránea de compra asociada.' },
      { name: 'insumo_id', type: 'UUID / VARCHAR(36)', nullable: false, foreignKey: { table: 'insumos', column: 'id', onDelete: 'RESTRICT' }, description: 'Clave foránea del insumo comprado.' },
      { name: 'cantidad', type: 'DECIMAL(12, 4)', nullable: false, check: 'cantidad > 0', description: 'Cantidad física recibida.' },
      { name: 'precio_total', type: 'DECIMAL(12, 4)', nullable: false, check: 'precio_total >= 0', description: 'Costo total pagado por el insumo.' },
      { name: 'costo_unitario_calculado', type: 'DECIMAL(12, 4)', nullable: false, description: 'Derivado matemático: precio_total / cantidad.' }
    ],
    indexes: [
      { name: 'idx_comp_det_insumo', columns: ['insumo_id'], description: 'Acelera obtención del historial de compras de un insumo.' }
    ]
  },
  {
    name: 'recetas',
    description: 'Fórmulas maestras de preparación culinaria (Sub-recetas y recetas finales).',
    columns: [
      { name: 'id', type: 'UUID / VARCHAR(36)', nullable: false, primaryKey: true, description: 'Clave primaria.' },
      { name: 'nombre', type: 'VARCHAR(150)', nullable: false, unique: true, description: 'Nombre descriptivo único de la receta.' },
      { name: 'activa', type: 'BOOLEAN', nullable: false, check: 'DEFAULT TRUE', description: 'Estado operativo de la receta.' },
      { name: 'descripcion', type: 'TEXT', nullable: true, description: 'Instrucciones o descripción del platillo.' },
      { name: 'creado_el', type: 'TIMESTAMP', nullable: false, description: 'Metadato de auditoría.' },
      { name: 'creado_por', type: 'VARCHAR(100)', nullable: false, description: 'Usuario creador.' },
      { name: 'modificado_el', type: 'TIMESTAMP', nullable: true, description: 'Fecha de última modificación.' },
      { name: 'modificado_por', type: 'VARCHAR(100)', nullable: true, description: 'Usuario que modificó.' }
    ],
    indexes: [
      { name: 'idx_recetas_nombre_uq', columns: ['nombre'], unique: true, description: 'Garantiza unicidad de nombres de recetas.' }
    ]
  },
  {
    name: 'receta_ingredientes',
    description: 'Componentes de una receta. Permite anidación relacional recursiva.',
    columns: [
      { name: 'id', type: 'UUID / VARCHAR(36)', nullable: false, primaryKey: true, description: 'Clave primaria.' },
      { name: 'receta_id', type: 'UUID / VARCHAR(36)', nullable: false, foreignKey: { table: 'recetas', column: 'id', onDelete: 'CASCADE' }, description: 'La receta a la que pertenece este componente.' },
      { name: 'tipo', type: 'VARCHAR(10)', nullable: false, check: "tipo IN ('insumo', 'receta')", description: 'Determina si el componente es un insumo básico o una subreceta.' },
      { name: 'target_id', type: 'UUID / VARCHAR(36)', nullable: false, description: 'ID referenciado en insumos o recetas según la columna tipo.' },
      { name: 'cantidad', type: 'DECIMAL(12, 4)', nullable: false, check: 'cantidad > 0', description: 'Cantidad exacta requerida para elaborar 1 porción/libra de la receta.' }
    ],
    indexes: [
      { name: 'idx_rec_ing_receta_padre', columns: ['receta_id'], description: 'Acelera la reconstrucción recursiva de ingredientes.' },
      { name: 'idx_rec_ing_target', columns: ['target_id'], description: 'Permite auditar en qué recetas se utiliza un insumo/subreceta.' }
    ]
  },
  {
    name: 'movimientos',
    description: 'Libro Mayor (Ledger) de Inventario. Registro de transacciones inmutables.',
    columns: [
      { name: 'id', type: 'UUID / VARCHAR(36)', nullable: false, primaryKey: true, description: 'Clave primaria.' },
      { name: 'fecha', type: 'DATE', nullable: false, description: 'Fecha del movimiento.' },
      { name: 'hora', type: 'TIME', nullable: false, description: 'Hora exacta del movimiento.' },
      { name: 'usuario_id', type: 'UUID / VARCHAR(36)', nullable: false, foreignKey: { table: 'usuarios', column: 'id', onDelete: 'RESTRICT' }, description: 'Usuario autor de la transacción.' },
      { name: 'usuario_nombre', type: 'VARCHAR(100)', nullable: false, description: 'Nombre histórico del usuario para auditoría rápida.' },
      { name: 'tipo', type: 'VARCHAR(25)', nullable: false, check: "tipo IN ('Compra', 'Consumo Directo', 'Consumo por Receta', 'Ajuste')", description: 'Tipo transaccional autorizado.' },
      { name: 'observaciones', type: 'TEXT', nullable: false, description: 'Justificación detallada (mandatoria para Ajuste/Consumos).' },
      { name: 'referencia_id', type: 'UUID / VARCHAR(36)', nullable: true, description: 'ID de la compra, receta o ajuste originador.' },
      { name: 'referencia_nombre', type: 'VARCHAR(150)', nullable: true, description: 'Nombre contextual de referencia (ej. Factura F-11, Taco de Birria).' },
      { name: 'referencia_cantidad', type: 'DECIMAL(12, 4)', nullable: true, description: 'Cantidad global de referencia (ej. 40 tacos producidos).' },
      { name: 'creado_el', type: 'TIMESTAMP', nullable: false, description: 'Fecha y hora real de guardado en el servidor.' }
    ],
    indexes: [
      { name: 'idx_movimientos_fecha_tipo', columns: ['fecha', 'tipo'], description: 'Clave para reportes de consumo o compras diarios.' },
      { name: 'idx_movimientos_referencia', columns: ['referencia_id'], description: 'Permite vincular movimientos con su origen analítico.' }
    ]
  },
  {
    name: 'movimiento_detalles',
    description: 'Desglose físico inmutable por insumo de cada transacción de inventario.',
    columns: [
      { name: 'id', type: 'UUID / VARCHAR(36)', nullable: false, primaryKey: true, description: 'Clave primaria.' },
      { name: 'movimiento_id', type: 'UUID / VARCHAR(36)', nullable: false, foreignKey: { table: 'movimientos', column: 'id', onDelete: 'RESTRICT' }, description: 'Vínculo al encabezado del Ledger.' },
      { name: 'insumo_id', type: 'UUID / VARCHAR(36)', nullable: false, foreignKey: { table: 'insumos', column: 'id', onDelete: 'RESTRICT' }, description: 'Vínculo al insumo físico afectado.' },
      { name: 'cantidad', type: 'DECIMAL(12, 4)', nullable: false, description: 'Valor positivo para Entradas (Compras, Sobrantes), negativo para Salidas (Consumos, Mermas).' },
      { name: 'costo_unitario', type: 'DECIMAL(12, 4)', nullable: false, check: 'costo_unitario >= 0', description: 'Costo unitario del insumo al momento del movimiento.' }
    ],
    indexes: [
      { name: 'idx_mov_det_insumo_cant', columns: ['insumo_id', 'cantidad'], description: 'ÍNDICE CRÍTICO: Optimiza el cálculo de existencias recalculadas (Ledger query).' },
      { name: 'idx_mov_det_movimiento', columns: ['movimiento_id'], description: 'Acelera recuperación de detalles por encabezado.' }
    ]
  },
  {
    name: 'auditoria_logs',
    description: 'Bitácora inalterable para auditoría completa de cambios manuales en catálogos y parámetros.',
    columns: [
      { name: 'id', type: 'UUID / VARCHAR(36)', nullable: false, primaryKey: true, description: 'Clave primaria.' },
      { name: 'usuario_id', type: 'UUID / VARCHAR(36)', nullable: false, foreignKey: { table: 'usuarios', column: 'id', onDelete: 'RESTRICT' }, description: 'Colaborador ejecutor.' },
      { name: 'accion', type: 'VARCHAR(50)', nullable: false, description: 'Acción realizada (ej. CREAR_INSUMO, DESACTIVAR_RECETA).' },
      { name: 'tabla_afectada', type: 'VARCHAR(50)', nullable: false, description: 'Tabla que sufrió el cambio.' },
      { name: 'registro_id', type: 'UUID / VARCHAR(36)', nullable: false, description: 'Identificador del registro alterado.' },
      { name: 'datos_anteriores', type: 'TEXT', nullable: true, description: 'JSON string de los valores originales (para modificaciones/bajas).' },
      { name: 'datos_nuevos', type: 'TEXT', nullable: true, description: 'JSON string de los valores insertados o modificados.' },
      { name: 'fecha_hora', type: 'TIMESTAMP', nullable: false, description: 'Marca de tiempo real de servidor.' }
    ],
    indexes: [
      { name: 'idx_auditoria_fecha_accion', columns: ['fecha_hora', 'accion'], description: 'Acelera consultas forenses de cambios.' }
    ]
  }
];

/**
 * 2. SEEDERS Y FACTORÍAS PROGRAMÁTICAS (TYPESCRIPT)
 * 
 * Permite inicializar y poblar la base de datos simulada con datos coherentes,
 * respetando el volumen e integridad exigidos en la arquitectura.
 */

export class DatabaseSeeder {
  /**
   * Genera un identificador único imitando un UUID para mantener el rigor del diseño
   */
  static generateUUID(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Genera datos de auditoría estándar para inserts de semillas
   */
  static getAuditStamp(user: string) {
    return {
      creado_el: new Date().toISOString().replace('T', ' ').substring(0, 19),
      creado_por: user
    };
  }

  /**
   * Factory para crear un Insumo válido
   */
  static createInsumo(
    nombre: string,
    categoria: string,
    proveedor: string,
    unidad: 'lb' | 'Und',
    costoActual: number,
    compras: boolean,
    produccion: boolean,
    usuario: string
  ) {
    return {
      id: this.generateUUID('ins'),
      nombre,
      categoria,
      proveedor_principal: proveedor,
      unidad,
      costo_actual: costoActual,
      activo: true,
      permitir_compras: compras,
      permitir_produccion: produccion,
      ...this.getAuditStamp(usuario),
      modificado_el: null,
      modificado_por: null
    };
  }

  /**
   * Factory para crear un Usuario válido
   */
  static createUsuario(nombre: string, rol: 'Administrador' | 'Gerente' | 'Operador') {
    return {
      id: this.generateUUID('usr'),
      nombre,
      rol,
      activo: true,
      creado_el: new Date().toISOString().replace('T', ' ').substring(0, 19),
      creado_por: 'SYSTEM_BOOT'
    };
  }

  /**
   * Ejecuta la población completa de la base de datos virtual (Seeds del ERP)
   */
  static executeSeed() {
    // 1. Usuarios Semilla (RBAC)
    const usuarios = [
      this.createUsuario('Carlos Mendoza', 'Administrador'),
      this.createUsuario('Elena Rostova', 'Gerente'),
      this.createUsuario('Juan Pérez', 'Operador')
    ];

    const admin = usuarios[0].nombre;

    // 2. Insumos Semilla
    const insumos = [
      this.createInsumo('Carne de Res (Sirloin)', 'Carnes', 'Distribuidora Carnes Express', 'lb', 5.80, true, false, admin),
      this.createInsumo('Tortilla de Maíz Blanco', 'Tortillería', 'El Milagro S.A.', 'Und', 0.08, true, false, admin),
      this.createInsumo('Cebolla Blanca', 'Verduras', 'Frutas y Verduras del Centro', 'lb', 1.20, true, false, admin),
      this.createInsumo('Cilantro Fresco', 'Verduras', 'Frutas y Verduras del Centro', 'lb', 2.15, true, false, admin),
      this.createInsumo('Chile Guajillo', 'Despensa', 'Especias San Juan', 'lb', 4.30, true, false, admin),
      this.createInsumo('Soda Uva 12oz', 'Bebidas', 'Distribuidora del Norte', 'Und', 0.45, true, false, admin)
    ];

    // 3. Recetas Semilla (Estructura recursiva libre de ciclos)
    const recetaBirriaId = this.generateUUID('rec');
    const recetaTacoId = this.generateUUID('rec');

    const recetas = [
      {
        id: recetaBirriaId,
        nombre: 'Birria (SubReceta)',
        activa: true,
        descripcion: 'Preparación base de carne de res sazonada para tacos y caldos.',
        ...this.getAuditStamp(admin)
      },
      {
        id: recetaTacoId,
        nombre: 'Taco de Birria',
        activa: true,
        descripcion: 'Taco de birria tradicional con cebolla picada, cilantro fresco y tortilla.',
        ...this.getAuditStamp(admin)
      }
    ];

    // Ingredientes detallados (Relaciones M:N)
    const recetaIngredientes = [
      // Birria (SubReceta) requiere:
      // - 1.2 lb Carne Sirloin (insumo[0])
      // - 0.1 lb Chile Guajillo (insumo[4])
      {
        id: this.generateUUID('ri'),
        receta_id: recetaBirriaId,
        tipo: 'insumo',
        target_id: insumos[0].id,
        cantidad: 1.2
      },
      {
        id: this.generateUUID('ri'),
        receta_id: recetaBirriaId,
        tipo: 'insumo',
        target_id: insumos[4].id,
        cantidad: 0.1
      },
      // Taco de Birria requiere:
      // - 0.2 lb Birria (SubReceta)
      // - 1.0 Und Tortilla (insumo[1])
      // - 0.05 lb Cebolla Blanca (insumo[2])
      // - 0.02 lb Cilantro Fresco (insumo[3])
      {
        id: this.generateUUID('ri'),
        receta_id: recetaTacoId,
        tipo: 'receta',
        target_id: recetaBirriaId,
        cantidad: 0.2
      },
      {
        id: this.generateUUID('ri'),
        receta_id: recetaTacoId,
        tipo: 'insumo',
        target_id: insumos[1].id,
        cantidad: 1.0
      },
      {
        id: this.generateUUID('ri'),
        receta_id: recetaTacoId,
        tipo: 'insumo',
        target_id: insumos[2].id,
        cantidad: 0.05
      },
      {
        id: this.generateUUID('ri'),
        receta_id: recetaTacoId,
        tipo: 'insumo',
        target_id: insumos[3].id,
        cantidad: 0.02
      }
    ];

    // 4. Compras Semilla (Auditoría e inventario histórico)
    const compraId = this.generateUUID('cmp');
    const compra = {
      id: compraId,
      proveedor: 'Distribuidora Carnes Express & CO',
      documento: 'Factura F-551',
      fecha: '2026-07-19',
      observaciones: 'Abastecimiento inicial aprobado por dirección de compras.',
      creado_el: '2026-07-19 08:00:00',
      creado_por: admin
    };

    const compraDetalles = insumos.map((ins, index) => {
      // Diferentes mermas iniciales de stock
      let cantidad = 100;
      if (index === 1) cantidad = 500; // tortillas
      if (index === 2) cantidad = 50;  // cebolla
      if (index === 3) cantidad = 15;  // cilantro
      if (index === 4) cantidad = 20;  // chile
      if (index === 5) cantidad = 200; // soda

      return {
        id: this.generateUUID('cmpd'),
        compra_id: compraId,
        insumo_id: ins.id,
        cantidad,
        precio_total: cantidad * ins.costo_actual,
        costo_unitario_calculado: ins.costo_actual
      };
    });

    // 5. Ledger de Movimientos Históricos (Semillas con trazabilidad)
    const movimientosId_1 = this.generateUUID('mov');
    const movimientosId_2 = this.generateUUID('mov');

    const movimientos = [
      {
        id: movimientosId_1,
        fecha: '2026-07-19',
        hora: '08:00:00',
        usuario_id: usuarios[0].id,
        usuario_nombre: usuarios[0].nombre,
        tipo: 'Compra',
        observaciones: `Abastecimiento inicial - Proveedor: ${compra.proveedor}. Documento: ${compra.documento}`,
        referencia_id: compraId,
        referencia_nombre: compra.documento,
        referencia_cantidad: null,
        creado_el: '2026-07-19 08:00:00'
      },
      {
        id: movimientosId_2,
        fecha: '2026-07-20',
        hora: '11:15:00',
        usuario_id: usuarios[1].id,
        usuario_nombre: usuarios[1].nombre,
        tipo: 'Consumo por Receta',
        observaciones: 'Despacho almuerzos - 40 Tacos de Birria',
        referencia_id: recetaTacoId,
        referencia_nombre: 'Taco de Birria',
        referencia_cantidad: 40,
        creado_el: '2026-07-20 11:15:00'
      }
    ];

    const movimientoDetalles = [
      // Detalles del movimiento 1 (Entrada de compra para los 6 insumos)
      ...compraDetalles.map(det => ({
        id: this.generateUUID('movd'),
        movimiento_id: movimientosId_1,
        insumo_id: det.insumo_id,
        cantidad: det.cantidad, // Valor positivo para entradas
        costo_unitario: det.costo_unitario_calculado
      })),
      // Detalles del movimiento 2 (Salida por receta desglosada a insumos primarios)
      // Carne Sirloin: 40 * 0.2 * 1.2 = 9.6 lb
      {
        id: this.generateUUID('movd'),
        movimiento_id: movimientosId_2,
        insumo_id: insumos[0].id,
        cantidad: -9.6,
        costo_unitario: insumos[0].costo_actual
      },
      // Chile Guajillo: 40 * 0.2 * 0.1 = 0.8 lb
      {
        id: this.generateUUID('movd'),
        movimiento_id: movimientosId_2,
        insumo_id: insumos[4].id,
        cantidad: -0.8,
        costo_unitario: insumos[4].costo_actual
      },
      // Tortilla: 40 * 1 = 40 Und
      {
        id: this.generateUUID('movd'),
        movimiento_id: movimientosId_2,
        insumo_id: insumos[1].id,
        cantidad: -40.0,
        costo_unitario: insumos[1].costo_actual
      },
      // Cebolla Blanca: 40 * 0.05 = 2.0 lb
      {
        id: this.generateUUID('movd'),
        movimiento_id: movimientosId_2,
        insumo_id: insumos[2].id,
        cantidad: -2.0,
        costo_unitario: insumos[2].costo_actual
      },
      // Cilantro Fresco: 40 * 0.02 = 0.8 lb
      {
        id: this.generateUUID('movd'),
        movimiento_id: movimientosId_2,
        insumo_id: insumos[3].id,
        cantidad: -0.8,
        costo_unitario: insumos[3].costo_actual
      }
    ];

    // 6. Auditoría Log Inicial de la inicialización
    const auditoriaLogs = [
      {
        id: this.generateUUID('aud'),
        usuario_id: usuarios[0].id,
        accion: 'INICIALIZAR_SISTEMA_SEED',
        tabla_afectada: 'multi-tabla',
        registro_id: 'SYSTEM_INIT',
        datos_anteriores: null,
        datos_nuevos: '{"version": "1.0.0", "semillas": "exitosas"}',
        fecha_hora: new Date().toISOString().replace('T', ' ').substring(0, 19)
      }
    ];

    return {
      usuarios,
      insumos,
      recetas,
      recetaIngredientes,
      compras: [compra],
      compraDetalles,
      movimientos,
      movimientoDetalles,
      auditoriaLogs
    };
  }
}
