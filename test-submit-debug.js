require('dotenv').config();
const { rpc, TransactionBuilder, Address, Contract, nativeToScVal, xdr, Networks } = require('@stellar/stellar-sdk');

const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
const PAYROLL_CONTRACT = process.env.AURAFLOW_PAYROLL_CONTRACT;
const EMPLOYER = process.argv[2];
const RECIPIENT = process.argv[3];
const AMOUNT = parseFloat(process.argv[4] || '4');

(async () => {
  console.log('RPC_URL:', RPC_URL);
  console.log('PASSPHRASE:', PASSPHRASE);
  console.log('PAYROLL_CONTRACT:', PAYROLL_CONTRACT);
  console.log('EMPLOYER:', EMPLOYER);
  console.log('RECIPIENT:', RECIPIENT);
  console.log('AMOUNT:', AMOUNT);

  const server = new rpc.Server(RPC_URL);

  // Step 1: Build the transaction (same as backend)
  const account = await server.getAccount(EMPLOYER);
  console.log('Account sequence:', account.sequence);

  const recipientScVal = new Address(RECIPIENT).toScVal();
  const amountScVal = nativeToScVal(Math.round(AMOUNT * 1_000_000), { type: 'i128' });

  const contract = new Contract(PAYROLL_CONTRACT);
  const op = contract.call(
    'process_payroll_batch',
    new Address(EMPLOYER).toScVal(),
    xdr.ScVal.scvVec([recipientScVal]),
    xdr.ScVal.scvVec([amountScVal]),
  );

  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(300)
    .build();

  const unsignedXdr = tx.toXDR();
  console.log('\n--- UNSIGNED XDR ---');
  console.log('Length:', unsignedXdr.length);
  console.log('First 80 chars:', unsignedXdr.slice(0, 80));

  // Step 2: Parse it back (simulating fromXDR round-trip)
  const parsed = TransactionBuilder.fromXDR(unsignedXdr, PASSPHRASE);
  const reSerialized = parsed.toXDR();
  console.log('\n--- ROUND-TRIP ---');
  console.log('Roundtrip matches:', unsignedXdr === reSerialized);
  console.log('Parsed envelope type:', parsed.constructor.name);

  // Step 3: Try submit (will fail because unsigned, but check the error)
  try {
    const result = await server.sendTransaction(parsed);
    console.log('\n--- SUBMIT RESULT (unsigned) ---');
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('\n--- SUBMIT ERROR (unsigned) ---');
    console.log(e.message?.slice(0, 500));
  }

  // Step 4: Check what envelope type the XDR produces
  const envelope = xdr.TransactionEnvelope.fromXDR(Buffer.from(unsignedXdr, 'base64'));
  console.log('\n--- ENVELOPE ANALYSIS ---');
  console.log('Discriminant:', envelope.switch().name);
  if (envelope.switch().name === 'envelopeTypeTx') {
    const v1 = envelope.v1();
    console.log('Has signatures:', v1.signatures().length);
    console.log('Tx operations:', v1.tx().operations().length);
    const op = v1.tx().operations()[0];
    console.log('Op type:', op.body().switch().name);
    if (op.body().switch().name === 'invokeHostFunction') {
      const ihf = op.body().invokeHostFunctionOp();
      console.log('Host function type:', ihf.hostFunction().switch().name);
      if (ihf.hostFunction().switch().name === 'hostFunctionTypeInvokeContract') {
        const invoke = ihf.hostFunction().invokeContract();
        console.log('Contract:', invoke.contractAddress().toString());
        console.log('Function name:', invoke.functionName().toString());
        console.log('Args count:', invoke.args().length);
        invoke.args().forEach((arg, i) => {
          console.log(`  arg[${i}] type:`, arg.switch().name);
        });
      }
    }
  }
})();
