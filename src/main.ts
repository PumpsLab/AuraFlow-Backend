import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('AuraFlow API')
    .setDescription('Confidential payroll on Stellar — API for managing companies, employees, payroll runs, and private payments')
    .setVersion('1.0')
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
