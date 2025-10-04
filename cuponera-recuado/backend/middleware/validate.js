const createValidator = (schema, property = 'body') => {
    return (req, res, next) => {
        const options = {
            abortEarly: false,
            allowUnknown: false,
            convert: true,
            stripUnknown: true
        };

        const { value, error } = schema.validate(req[property], options);

        if (error) {
            return res.status(400).json({
                error: 'Error de validación',
                detalles: error.details.map((detail) => detail.message)
            });
        }

        req[property] = value;
        next();
    };
};

module.exports = {
    createValidator
};
