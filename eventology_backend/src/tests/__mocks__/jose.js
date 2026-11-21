module.exports = {
  importJWK: async () => ({ type: 'public', [Symbol.toStringTag]: 'CryptoKey' }),
  exportSPKI: async () => 'mock-spki-key',
  jwtVerify: async () => ({ payload: {} }),
};
