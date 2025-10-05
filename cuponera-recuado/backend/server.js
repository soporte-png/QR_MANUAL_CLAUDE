// server.js - API Backend para Cuponera de Recaudo
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const { createValidator } = require('./middleware/validate');
const {
    authLoginSchema,
    authChangePasswordSchema,
    configGeneralSchema,
    configLogosSchema,
    cuponCreateSchema,
    reportFiltersSchema
} = require('./validation/schemas');
const {
    normalizeCedula,
    normalizeValor,
    normalizeFecha
} = require('./utils/formatters');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_super_seguro_cambiar_en_produccion';

const LOGO_FIELDS = ['logo_empresa', 'logo_app', 'logo_login'];
const logosDirectory = path.join(__dirname, 'public', 'logos');
fs.mkdirSync(logosDirectory, { recursive: true });

const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, logosDirectory);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const baseName = path
            .basename(file.originalname, extension)
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'logo';
        const version = Date.now();
        cb(null, `${baseName}-${version}${extension}`);
    }
});

const uploadLogos = multer({
    storage: logoStorage,
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Solo se permiten archivos de imagen'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// Configuración de PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'cuponera_recaudo',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/logos', express.static(logosDirectory));

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        req.user = user;
        next();
    });
};

// Middleware para verificar rol admin
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador' });
    }
    next();
};

// ==================== RUTAS DE AUTENTICACIÓN ====================

// Login
app.post('/api/auth/login', createValidator(authLoginSchema), async (req, res) => {
    try {
        const { username, password } = req.body;

        const result = await pool.query(
            'SELECT * FROM usuarios WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Cambiar contraseña
app.post('/api/auth/change-password', authenticateToken, createValidator(authChangePasswordSchema), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const result = await pool.query(
            'SELECT password_hash FROM usuarios WHERE id = $1',
            [req.user.id]
        );

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        await pool.query(
            'UPDATE usuarios SET password_hash = $1 WHERE id = $2',
            [newPasswordHash, req.user.id]
        );

        res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ==================== RUTAS DE CONFIGURACIÓN ====================

// Obtener configuración
app.get('/api/config', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM configuracion WHERE id = 1');
        res.json(result.rows[0] || {});
    } catch (error) {
        console.error('Error al obtener configuración:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar configuración general
app.put('/api/config/general', authenticateToken, requireAdmin, createValidator(configGeneralSchema), async (req, res) => {
    try {
        const { gln_base, nombre_empresa, documento_base, cuenta_recaudo, numero_acuerdo_base } = req.body;

        const result = await pool.query(
            `UPDATE configuracion SET
                gln_base = $1, 
                nombre_empresa = $2, 
                documento_base = $3, 
                cuenta_recaudo = $4, 
                numero_acuerdo_base = $5 
            WHERE id = 1 RETURNING *`,
            [gln_base, nombre_empresa, documento_base, cuenta_recaudo, numero_acuerdo_base]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al actualizar configuración:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

const uploadLogosMiddleware = (req, res, next) => {
    const upload = uploadLogos.fields(
        LOGO_FIELDS.map((field) => ({ name: field, maxCount: 1 }))
    );

    upload(req, res, (err) => {
        if (err) {
            console.error('Error al subir logos:', err);
            let message = 'Error al subir archivos';

            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    message = 'El archivo supera el tamaño máximo permitido (5 MB)';
                } else {
                    message = err.message;
                }
            } else if (err.message) {
                message = err.message;
            }

            return res.status(400).json({ error: message });
        }
        next();
    });
};

const normalizeLogosPayload = (req, res, next) => {
    const files = req.files || {};
    const payload = {};

    LOGO_FIELDS.forEach((field) => {
        const file = files[field]?.[0];

        if (file) {
            payload[field] = `/logos/${file.filename}`;
            return;
        }

        const value = req.body?.[field];

        if (typeof value === 'string') {
            const trimmed = value.trim();
            const normalized = trimmed.toLowerCase();
            if (
                trimmed.length === 0 ||
                normalized === 'null' ||
                normalized === 'undefined'
            ) {
                payload[field] = null;
            } else {
                payload[field] = trimmed;
            }
        } else {
            payload[field] = null;
        }
    });

    req.body = payload;
    next();
};

// Actualizar logos
app.put(
    '/api/config/logos',
    authenticateToken,
    requireAdmin,
    uploadLogosMiddleware,
    normalizeLogosPayload,
    createValidator(configLogosSchema),
    async (req, res) => {
        try {
            const { logo_empresa, logo_app, logo_login } = req.body;

            const result = await pool.query(
                `UPDATE configuracion SET
                    logo_empresa = COALESCE($1, logo_empresa),
                    logo_app = COALESCE($2, logo_app),
                    logo_login = COALESCE($3, logo_login)
                WHERE id = 1 RETURNING *`,
                [logo_empresa, logo_app, logo_login]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Configuración no encontrada' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error al actualizar logos:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
);

// ==================== RUTAS DE CUPONES ====================

// Generar cupón
app.post('/api/cupones', authenticateToken, createValidator(cuponCreateSchema), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { nombre, cedula, valor, fecha } = req.body;

        let cedulaFormateada;
        let valorFormateado;
        let fechaFormateada;

        try {
            cedulaFormateada = normalizeCedula(cedula);
            valorFormateado = normalizeValor(valor);
            fechaFormateada = normalizeFecha(fecha);
        } catch (formatError) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: formatError.message });
        }

        // Obtener y actualizar consecutivos
        const consecutivosResult = await client.query(
            'SELECT * FROM consecutivos WHERE id = 1 FOR UPDATE'
        );
        const consecutivos = consecutivosResult.rows[0];

        const numeroAcuerdoActual = consecutivos.numero_acuerdo;
        const numeroObligacionActual = consecutivos.numero_obligacion;

        await client.query(
            'UPDATE consecutivos SET numero_acuerdo = numero_acuerdo + 1, numero_obligacion = numero_obligacion + 1 WHERE id = 1'
        );

        // Obtener configuración
        const configResult = await client.query('SELECT * FROM configuracion WHERE id = 1');
        const config = configResult.rows[0];

        // Construir payload GS1-128
        const GS = '\x1D';
        const payload = `415${config.gln_base}${cedulaFormateada}${GS}3900${valorFormateado}${GS}96${fechaFormateada}`;

        // Guardar cupón
        const cuponResult = await client.query(
            `INSERT INTO cupones 
                (nombre, cedula, valor, fecha_limite, usuario_id, numero_acuerdo, numero_obligacion, payload)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [nombre, cedulaFormateada, valorFormateado, fecha, req.user.id, 
             numeroAcuerdoActual.toString(), numeroObligacionActual.toString(), payload]
        );

        await client.query('COMMIT');

        res.json({
            cupon: cuponResult.rows[0],
            payload,
            config: {
                gln_base: config.gln_base,
                nombre_empresa: config.nombre_empresa,
                cuenta_recaudo: config.cuenta_recaudo
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al generar cupón:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// Obtener historial de cupones (con filtros)
app.get('/api/cupones', authenticateToken, createValidator(reportFiltersSchema, 'query'), async (req, res) => {
    try {
        const {
            nombre, cedula, usuario,
            valorMin, valorMax,
            fechaInicio, horaInicio,
            fechaFin, horaFin,
            page, limit
        } = req.query;

        let query = `
            SELECT c.*, u.username 
            FROM cupones c 
            JOIN usuarios u ON c.usuario_id = u.id 
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (nombre) {
            query += ` AND c.nombre ILIKE $${paramCount}`;
            params.push(`%${nombre}%`);
            paramCount++;
        }

        if (cedula) {
            query += ` AND c.cedula LIKE $${paramCount}`;
            params.push(`%${cedula}%`);
            paramCount++;
        }

        if (usuario) {
            query += ` AND u.username ILIKE $${paramCount}`;
            params.push(`%${usuario}%`);
            paramCount++;
        }

        if (valorMin !== undefined) {
            query += ` AND CAST(c.valor AS INTEGER) >= $${paramCount}`;
            params.push(valorMin);
            paramCount++;
        }

        if (valorMax !== undefined) {
            query += ` AND CAST(c.valor AS INTEGER) <= $${paramCount}`;
            params.push(valorMax);
            paramCount++;
        }

        if (fechaInicio) {
            const fechaInicioFull = `${fechaInicio} ${horaInicio || '00:00'}`;
            query += ` AND c.fecha_generacion >= $${paramCount}`;
            params.push(fechaInicioFull);
            paramCount++;
        }

        if (fechaFin) {
            const fechaFinFull = `${fechaFin} ${horaFin || '23:59'}`;
            query += ` AND c.fecha_generacion <= $${paramCount}`;
            params.push(fechaFinFull);
            paramCount++;
        }

        // Contar total de registros
        const countResult = await pool.query(
            query.replace('SELECT c.*, u.username', 'SELECT COUNT(*)'),
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Agregar paginación
        query += ` ORDER BY c.fecha_generacion DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit);
        params.push((page - 1) * limit);

        const result = await pool.query(query, params);

        res.json({
            cupones: result.rows,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error al obtener cupones:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener estadísticas
app.get('/api/cupones/stats', authenticateToken, createValidator(reportFiltersSchema, 'query'), async (req, res) => {
    try {
        const {
            nombre, cedula, usuario,
            valorMin, valorMax,
            fechaInicio, horaInicio,
            fechaFin, horaFin 
        } = req.query;

        let query = `
            SELECT 
                COUNT(*) as total_cupones,
                SUM(CAST(valor AS INTEGER)) as valor_total,
                ARRAY_AGG(DISTINCT u.username) as usuarios
            FROM cupones c 
            JOIN usuarios u ON c.usuario_id = u.id 
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        // Aplicar los mismos filtros
        if (nombre) {
            query += ` AND c.nombre ILIKE $${paramCount}`;
            params.push(`%${nombre}%`);
            paramCount++;
        }

        if (cedula) {
            query += ` AND c.cedula LIKE $${paramCount}`;
            params.push(`%${cedula}%`);
            paramCount++;
        }

        if (usuario) {
            query += ` AND u.username ILIKE $${paramCount}`;
            params.push(`%${usuario}%`);
            paramCount++;
        }

        if (valorMin !== undefined) {
            query += ` AND CAST(c.valor AS INTEGER) >= $${paramCount}`;
            params.push(valorMin);
            paramCount++;
        }

        if (valorMax !== undefined) {
            query += ` AND CAST(c.valor AS INTEGER) <= $${paramCount}`;
            params.push(valorMax);
            paramCount++;
        }

        if (fechaInicio) {
            const fechaInicioFull = `${fechaInicio} ${horaInicio || '00:00'}`;
            query += ` AND c.fecha_generacion >= $${paramCount}`;
            params.push(fechaInicioFull);
            paramCount++;
        }

        if (fechaFin) {
            const fechaFinFull = `${fechaFin} ${horaFin || '23:59'}`;
            query += ` AND c.fecha_generacion <= $${paramCount}`;
            params.push(fechaFinFull);
            paramCount++;
        }

        const result = await pool.query(query, params);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ==================== SERVIDOR ====================

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📊 Base de datos: ${process.env.DB_NAME || 'cuponera_recaudo'}`);
});
