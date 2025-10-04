const normalizeCedula = (cedula) => {
    if (cedula === undefined || cedula === null) {
        throw new Error('La cédula es requerida para normalizar');
    }

    const cedulaStr = String(cedula).replace(/\D/g, '');

    if (!cedulaStr) {
        throw new Error('La cédula debe contener al menos un dígito');
    }

    if (cedulaStr.length > 10) {
        throw new Error('La cédula no puede exceder 10 dígitos');
    }

    return cedulaStr.padStart(10, '0');
};

const normalizeValor = (valor) => {
    if (valor === undefined || valor === null) {
        throw new Error('El valor es requerido para normalizar');
    }

    const valorStr = String(valor).replace(/\D/g, '');

    if (!valorStr) {
        throw new Error('El valor debe contener al menos un dígito');
    }

    if (valorStr.length > 8) {
        throw new Error('El valor no puede exceder 8 dígitos');
    }

    return valorStr.padStart(8, '0');
};

const normalizeFecha = (fecha) => {
    if (!fecha) {
        throw new Error('La fecha es requerida para normalizar');
    }

    const date = new Date(fecha);

    if (Number.isNaN(date.getTime())) {
        throw new Error('La fecha proporcionada no es válida');
    }

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}${month}${day}`;
};

module.exports = {
    normalizeCedula,
    normalizeValor,
    normalizeFecha
};
