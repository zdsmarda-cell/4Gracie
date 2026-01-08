
import crypto from 'crypto';

const toBase64 = (obj) => {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
};

export const sign = (payload, secret, options = {}) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  // Default 24h expiration if not specified or parsed
  const exp = now + (24 * 60 * 60); 
  
  const payloadWithExp = {
      ...payload,
      iat: now,
      exp: payload.exp || exp
  };
  
  const encodedHeader = toBase64(header);
  const encodedPayload = toBase64(payloadWithExp);
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedHeader + '.' + encodedPayload)
    .digest('base64url');
    
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

export const verify = (token, secret, callback) => {
  if (!token) return callback(new Error('No token'));
  
  const parts = token.split('.');
  if (parts.length !== 3) return callback(new Error('Invalid token format'));
  
  const [header, payload, signature] = parts;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(header + '.' + payload)
    .digest('base64url');
    
  if (signature !== expectedSignature) {
      return callback(new Error('Invalid signature'));
  }
  
  try {
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (decodedPayload.exp && Date.now() >= decodedPayload.exp * 1000) {
          return callback(new Error('Token expired'));
      }
      callback(null, decodedPayload);
  } catch (e) {
      callback(e);
  }
};

export default { sign, verify };
