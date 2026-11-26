import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

jest.setTimeout(30000);

// Testes de integração e concorrência reais contra o PostgreSQL (Docker).
// Comprovam que transações ACID + SELECT ... FOR UPDATE impedem race conditions,
// saldos negativos, deadlocks e duplicações por retry concorrente.
describe('Transfers Concurrency (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let httpServer: App;

  const createdProductIds: string[] = [];
  const createdWarehouseIds: string[] = [];

  async function createTestProduct(suffix: string): Promise<string> {
    const res = await request(httpServer)
      .post('/products')
      .send({
        name: `Smartphone Teste ${suffix}`,
        sku: `TEST-SM-${suffix}`,
        price: 4999.9,
      })
      .expect(201);

    createdProductIds.push(res.body.id);
    return res.body.id;
  }

  async function createTestWarehouse(codeSuffix: string): Promise<string> {
    const res = await request(httpServer)
      .post('/warehouses')
      .send({
        name: `Depósito ${codeSuffix}`,
        code: `TEST-${codeSuffix}`,
        location: 'São Paulo - SP',
      })
      .expect(201);

    createdWarehouseIds.push(res.body.id);
    return res.body.id;
  }

  async function getBalance(
    productId: string,
    warehouseId: string,
  ): Promise<number> {
    const res = await request(httpServer)
      .get('/inventory')
      .query({ productId, warehouseId })
      .expect(200);

    return res.body[0]?.quantity ?? 0;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    dataSource = app.get(DataSource);
    httpServer = app.getHttpServer() as App;
  });

  afterAll(async () => {
    // Limpa apenas os registros criados durante a suíte E2E na ordem das FKs
    if (dataSource && createdProductIds.length > 0) {
      await dataSource.query(
        `DELETE FROM "stock_movements" WHERE "product_id" = ANY($1::uuid[])`,
        [createdProductIds],
      );
      await dataSource.query(
        `DELETE FROM "transfers" WHERE "product_id" = ANY($1::uuid[])`,
        [createdProductIds],
      );
      await dataSource.query(
        `DELETE FROM "inventory_items" WHERE "product_id" = ANY($1::uuid[])`,
        [createdProductIds],
      );
      await dataSource.query(
        `DELETE FROM "products" WHERE "id" = ANY($1::uuid[])`,
        [createdProductIds],
      );
    }

    if (dataSource && createdWarehouseIds.length > 0) {
      await dataSource.query(
        `DELETE FROM "warehouses" WHERE "id" = ANY($1::uuid[])`,
        [createdWarehouseIds],
      );
    }

    if (app) {
      await app.close();
    }
  });

  it('Cenário clássico: 1 unidade no Depósito A com 2 transferências simultâneas (A->B e A->C) deve ter apenas 1 vencedora e nunca ficar negativa', async () => {
    const tag = `${Date.now()}-1`;
    const productId = await createTestProduct(tag);
    const warehouseA = await createTestWarehouse(`${tag}-A`);
    const warehouseB = await createTestWarehouse(`${tag}-B`);
    const warehouseC = await createTestWarehouse(`${tag}-C`);

    await request(httpServer)
      .post('/inventory/inbound')
      .send({
        productId,
        warehouseId: warehouseA,
        quantity: 1,
        reason: 'Carga inicial do cenário de corrida',
      })
      .expect(201);

    // Dispara exatamente no mesmo instante duas requisições disputando a última unidade
    const [resToB, resToC] = await Promise.all([
      request(httpServer).post('/transfers').send({
        productId,
        sourceWarehouseId: warehouseA,
        destinationWarehouseId: warehouseB,
        quantity: 1,
        reason: 'Corrida para B',
      }),
      request(httpServer).post('/transfers').send({
        productId,
        sourceWarehouseId: warehouseA,
        destinationWarehouseId: warehouseC,
        quantity: 1,
        reason: 'Corrida para C',
      }),
    ]);

    const statuses = [resToB.status, resToC.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const [balA, balB, balC] = await Promise.all([
      getBalance(productId, warehouseA),
      getBalance(productId, warehouseB),
      getBalance(productId, warehouseC),
    ]);

    expect(balA).toBe(0);
    expect(balB + balC).toBe(1);
  });

  it('Estresse de concorrência: 3 unidades na origem com 10 transferências simultâneas permite exatamente 3 sucessos e 7 conflitos (409)', async () => {
    const tag = `${Date.now()}-2`;
    const productId = await createTestProduct(tag);
    const warehouseA = await createTestWarehouse(`${tag}-A`);
    const warehouseB = await createTestWarehouse(`${tag}-B`);

    await request(httpServer)
      .post('/inventory/inbound')
      .send({
        productId,
        warehouseId: warehouseA,
        quantity: 3,
      })
      .expect(201);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(httpServer).post('/transfers').send({
          productId,
          sourceWarehouseId: warehouseA,
          destinationWarehouseId: warehouseB,
          quantity: 1,
        }),
      ),
    );

    const createdCount = responses.filter((r) => r.status === 201).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    expect(createdCount).toBe(3);
    expect(conflictCount).toBe(7);

    const [balA, balB] = await Promise.all([
      getBalance(productId, warehouseA),
      getBalance(productId, warehouseB),
    ]);

    expect(balA).toBe(0);
    expect(balB).toBe(3);
  });

  it('Prevenção de deadlock: transferências cruzadas simultâneas (A->B e B->A) concluem sem deadlock', async () => {
    const tag = `${Date.now()}-3`;
    const productId = await createTestProduct(tag);
    const warehouseA = await createTestWarehouse(`${tag}-A`);
    const warehouseB = await createTestWarehouse(`${tag}-B`);

    await Promise.all([
      request(httpServer)
        .post('/inventory/inbound')
        .send({ productId, warehouseId: warehouseA, quantity: 5 })
        .expect(201),
      request(httpServer)
        .post('/inventory/inbound')
        .send({ productId, warehouseId: warehouseB, quantity: 5 })
        .expect(201),
    ]);

    const [resAB, resBA] = await Promise.all([
      request(httpServer).post('/transfers').send({
        productId,
        sourceWarehouseId: warehouseA,
        destinationWarehouseId: warehouseB,
        quantity: 2,
      }),
      request(httpServer).post('/transfers').send({
        productId,
        sourceWarehouseId: warehouseB,
        destinationWarehouseId: warehouseA,
        quantity: 1,
      }),
    ]);

    expect(resAB.status).toBe(201);
    expect(resBA.status).toBe(201);

    const [balA, balB] = await Promise.all([
      getBalance(productId, warehouseA),
      getBalance(productId, warehouseB),
    ]);

    expect(balA).toBe(4);
    expect(balB).toBe(6);
  });

  it('Idempotência concorrente: duas requisições simultâneas com a mesma Idempotency-Key debitam o estoque apenas uma vez', async () => {
    const tag = `${Date.now()}-4`;
    const productId = await createTestProduct(tag);
    const warehouseA = await createTestWarehouse(`${tag}-A`);
    const warehouseB = await createTestWarehouse(`${tag}-B`);
    const idempotencyKey = `idem-e2e-${tag}`;

    await request(httpServer)
      .post('/inventory/inbound')
      .send({ productId, warehouseId: warehouseA, quantity: 5 })
      .expect(201);

    const [r1, r2] = await Promise.all([
      request(httpServer)
        .post('/transfers')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          productId,
          sourceWarehouseId: warehouseA,
          destinationWarehouseId: warehouseB,
          quantity: 2,
        }),
      request(httpServer)
        .post('/transfers')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          productId,
          sourceWarehouseId: warehouseA,
          destinationWarehouseId: warehouseB,
          quantity: 2,
        }),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.transfer.id).toBe(r2.body.transfer.id);
    expect([r1.body.idempotentReplay, r2.body.idempotentReplay].sort()).toEqual([
      false,
      true,
    ]);

    const [balA, balB] = await Promise.all([
      getBalance(productId, warehouseA),
      getBalance(productId, warehouseB),
    ]);

    expect(balA).toBe(3);
    expect(balB).toBe(2);

    // Reutilizar a mesma chave para outra quantidade deve ser rejeitado com 409 Conflict
    await request(httpServer)
      .post('/transfers')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        productId,
        sourceWarehouseId: warehouseA,
        destinationWarehouseId: warehouseB,
        quantity: 1,
      })
      .expect(409);
  });
});
