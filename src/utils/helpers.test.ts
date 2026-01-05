
import { describe, it, expect } from 'vitest';
import { removeDiacritics, formatDate, calculateCzIban } from './helpers';

describe('Helpers', () => {
    describe('removeDiacritics', () => {
        it('should remove czech accents', () => {
            expect(removeDiacritics('Příliš žluťoučký kůň')).toBe('Prilis zlutoucky kun');
        });
        it('should handle empty string', () => {
            expect(removeDiacritics('')).toBe('');
        });
    });

    describe('formatDate', () => {
        it('should format ISO date to Czech locale', () => {
            // Note: Output depends on Node/Browser locale implementation, usually DD.MM.YYYY for cs-CZ
            // We use a regex match to be safer across environments or exact match if environment is consistent
            const formatted = formatDate('2023-12-24T10:00:00.000Z');
            expect(formatted).toMatch(/24\. ?12\. ?2023/); 
        });
        it('should return original string if invalid date', () => {
            expect(formatDate('not-a-date')).toBe('not-a-date');
        });
    });

    describe('calculateCzIban', () => {
        it('should calculate valid IBAN for standard account', () => {
            // Example: 123456789/0100 (KB)
            // Bank: 0100, Prefix: 000000, Number: 0123456789
            // Expected IBAN check: CZ18 0100 0000 0001 2345 6789
            const iban = calculateCzIban('123456789/0100');
            expect(iban).toBe('CZ1801000000000123456789');
        });

        it('should handle account with prefix', () => {
            // Example: 19-123456789/0800 (CS)
            // Prefix: 19, Number: 123456789, Bank: 0800
            const iban = calculateCzIban('19-123456789/0800');
            // Calculated logic: 
            // BBAN: 0800 000019 0123456789
            // Numeric: 08000000190123456789 123500
            // Mod97 will determine check digits.
            expect(iban).toHaveLength(24);
            expect(iban.startsWith('CZ')).toBe(true);
        });

        it('should return empty string for invalid format', () => {
            expect(calculateCzIban('invalid')).toBe('');
            expect(calculateCzIban('123/12')).toBe(''); // bad bank code
        });
    });
});
