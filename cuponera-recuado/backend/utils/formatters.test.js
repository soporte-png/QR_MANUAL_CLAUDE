const { normalizeCedula, normalizeValor, normalizeFecha } = require('./formatters');

describe('normalizeCedula', () => {
    it('completa la cédula a 10 dígitos', () => {
        expect(normalizeCedula('12345')).toBe('0000012345');
    });

    it('acepta números y elimina caracteres no numéricos', () => {
        expect(normalizeCedula('12.345.678')).toBe('0012345678');
    });

    it('lanza error cuando supera 10 dígitos', () => {
        expect(() => normalizeCedula('12345678901')).toThrow('La cédula no puede exceder 10 dígitos');
    });
});

describe('normalizeValor', () => {
    it('completa el valor a 8 dígitos', () => {
        expect(normalizeValor('1234')).toBe('00001234');
    });

    it('acepta números y elimina caracteres no numéricos', () => {
        expect(normalizeValor('1.234')).toBe('00001234');
    });

    it('lanza error cuando supera 8 dígitos', () => {
        expect(() => normalizeValor('123456789')).toThrow('El valor no puede exceder 8 dígitos');
    });
});

describe('normalizeFecha', () => {
    it('convierte la fecha al formato YYYYMMDD', () => {
        expect(normalizeFecha('2024-02-01')).toBe('20240201');
    });

    it('acepta objetos Date', () => {
        expect(normalizeFecha(new Date('2023-12-31T00:00:00Z'))).toBe('20231231');
    });

    it('lanza error si la fecha es inválida', () => {
        expect(() => normalizeFecha('fecha-invalida')).toThrow('La fecha proporcionada no es válida');
    });
});
