import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.enableCors({
    origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('AuraFlow API')
    .setDescription(`Confidential payroll on Stellar — API for managing companies, employees, payroll runs, and private payments.

## Authentication

All protected endpoints require **one** of two authentication strategies:

### Strategy 1 — Session Token
1. Obtain a session token via \`POST /auth/session\` (requires Strategy 2 signing).
2. Pass it as the \`x-auraflow-session\` header on subsequent requests.

### Strategy 2 — Signed Request
Sign every request individually with these headers:

| Header | Description |
|--------|-------------|
| \`x-auraflow-wallet\` | Stellar \`G...\` public key (Ed25519) |
| \`x-auraflow-timestamp\` | ISO-8601 timestamp (must be within 5 minutes) |
| \`x-auraflow-signature\` | Base64-encoded Ed25519 detached signature of the canonical message |

The canonical signing message format:
\`\`\`
AuraFlow Request Authorization
version:1
wallet:<address>
method:<HTTP_METHOD>
path:<normalized_path>
timestamp:<ISO-8601>
bodySha256:<SHA-256 hex of request body>
\`\`\`
`)
    .setVersion('1.0')
    .addSecurity('session', {
      type: 'apiKey',
      in: 'header',
      name: 'x-auraflow-session',
      description: 'HMAC-signed session token obtained from POST /auth/session',
    })
    .addSecurity('signed-request', {
      type: 'apiKey',
      in: 'header',
      name: 'x-auraflow-wallet',
      description: 'Stellar public key (used with x-auraflow-timestamp and x-auraflow-signature)',
    })
    .addSecurityRequirements('session')
    .addTag('Auth', 'Wallet-based session authentication')
    .addTag('Companies', 'Company CRUD and treasury management')
    .addTag('Employees', 'Employee management and vault registration')
    .addTag('Streams', 'Payment stream lifecycle')
    .addTag('Payroll', 'Payroll data computation')
    .addTag('Payroll Runs', 'Payroll cycle management')
    .addTag('Claims', 'Employee claim balance and cashout')
    .addTag('Private Payroll', 'Confidential batch payroll payments')
    .addTag('Audit', 'Audit trail and auditor tokens')
    .addTag('Compliance', 'Compliance events and data export')
    .addTag('History', 'Transaction history')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`AuraFlow backend running on port ${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api/docs`);
}
bootstrap();
