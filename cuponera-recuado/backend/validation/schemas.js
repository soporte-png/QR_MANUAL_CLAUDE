const Joi = require('joi');

const authLoginSchema = Joi.object({
    username: Joi.string().trim().min(1).required(),
    password: Joi.string().min(1).required()
});

const authChangePasswordSchema = Joi.object({
    currentPassword: Joi.string().min(1).required(),
    newPassword: Joi.string().min(6).required()
});

const configGeneralSchema = Joi.object({
    gln_base: Joi.string().pattern(/^\d{13}$/).required(),
    nombre_empresa: Joi.string().trim().min(1).required(),
    documento_base: Joi.string().pattern(/^\d{10}$/).required(),
    cuenta_recaudo: Joi.string().allow('', null).optional(),
    numero_acuerdo_base: Joi.string().allow('', null).optional()
});

const urlOrRelativePathSchema = Joi.string()
    .allow(null, '')
    .custom((value, helpers) => {
        if (value === null || value === '') {
            return value;
        }

        if (/^https?:\/\//i.test(value)) {
            try {
                new URL(value);
                return value;
            } catch (err) {
                return helpers.error('any.invalid');
            }
        }

        if (/^[A-Za-z0-9._~!$&'()*+,;=:@\/?#-]+$/i.test(value) || /^\//.test(value)) {
            if (/\s/.test(value)) {
                return helpers.error('any.invalid');
            }
            return value;
        }

        return helpers.error('any.invalid');
    }, 'URL o ruta relativa');

const configLogosSchema = Joi.object({
    logo_empresa: urlOrRelativePathSchema.optional(),
    logo_app: urlOrRelativePathSchema.optional(),
    logo_login: urlOrRelativePathSchema.optional()
});

const cuponCreateSchema = Joi.object({
    nombre: Joi.string().trim().min(1).required(),
    cedula: Joi.alternatives(
        Joi.string().pattern(/^\d{1,10}$/),
        Joi.number().integer().min(0)
    ).required(),
    valor: Joi.alternatives(
        Joi.string().pattern(/^\d{1,8}$/),
        Joi.number().integer().min(0)
    ).required(),
    fecha: Joi.string().isoDate().required()
});

const reportFiltersSchema = Joi.object({
    nombre: Joi.string().trim().allow('').optional(),
    cedula: Joi.string().pattern(/^\d{1,10}$/).optional(),
    usuario: Joi.string().trim().allow('').optional(),
    valorMin: Joi.number().integer().min(0).optional(),
    valorMax: Joi.number().integer().min(0).optional(),
    fechaInicio: Joi.string().isoDate().optional(),
    horaInicio: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
    fechaFin: Joi.string().isoDate().optional(),
    horaFin: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
}).with('fechaInicio', 'fechaFin').with('fechaFin', 'fechaInicio');

module.exports = {
    authLoginSchema,
    authChangePasswordSchema,
    configGeneralSchema,
    configLogosSchema,
    cuponCreateSchema,
    reportFiltersSchema
};
