
// Utility functions extracted from StoreContext for testing purposes

export const removeDiacritics = (str: string): string => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const calculateCzIban = (accountString: string): string => {
  if (!accountString) return '';
  const cleanStr = accountString.replace(/\s/g, '');
  const [accountPart, bankCode] = cleanStr.split('/');
  if (!accountPart || !bankCode || bankCode.length !== 4) return '';
  
  let prefix = '';
  let number = accountPart;
  if (accountPart.includes('-')) { 
      [prefix, number] = accountPart.split('-'); 
  }
  
  // Basic validation - validation of length happens via logic, but input sanity check:
  if (!/^\d+$/.test(prefix) && prefix !== '') return '';
  if (!/^\d+$/.test(number)) return '';

  const paddedPrefix = prefix.padStart(6, '0');
  const paddedNumber = number.padStart(10, '0');
  const paddedBank = bankCode.padStart(4, '0');
  
  // BBAN calculation
  const bban = paddedBank + paddedPrefix + paddedNumber;
  
  // Calculate Check Digits
  // Numeric conversion: CZ = 1235
  const numericStr = bban + '123500';
  
  // Modulo 97 on large number
  const remainder = BigInt(numericStr) % 97n;
  const checkDigitsVal = 98n - remainder;
  const checkDigitsStr = checkDigitsVal.toString().padStart(2, '0');
  
  return `CZ${checkDigitsStr}${bban}`;
};
