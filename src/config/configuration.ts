export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    db: process.env.MONGODB_DB || 'auraflow',
  },
  session: {
    secret: process.env.AURAFLOW_SESSION_SECRET || process.env.AURAFLOW_SESSION_SECRET || '',
    maxAgeMs: 12 * 60 * 60 * 1000,
  },
  encryption: {
    companyKeySecret: process.env.COMPANY_KEY_ENCRYPTION_SECRET || '',
  },
  blockchain: {
    stellarRpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
    stellarNetworkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Future Network ; October 2022',
    confidentialTokenContract: process.env.CONFIDENTIAL_TOKEN_CONTRACT || '',
    payrollContract: process.env.AURAFLOW_PAYROLL_CONTRACT || '',
    verifierContract: process.env.VERIFIER_CONTRACT || '',
    auditorContract: process.env.AUDITOR_CONTRACT || '',
    usdcContract: process.env.USDC_CONTRACT || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  },
});
