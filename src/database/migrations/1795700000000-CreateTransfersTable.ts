import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransfersTable1795700000000 implements MigrationInterface {
  name = 'CreateTransfersTable1795700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_status_enum" AS ENUM('COMPLETED')`,
    );

    await queryRunner.query(
      `CREATE TABLE "transfers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "source_warehouse_id" uuid NOT NULL,
        "destination_warehouse_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "status" "public"."transfer_status_enum" NOT NULL DEFAULT 'COMPLETED',
        "reason" character varying(255),
        "idempotency_key" character varying(128),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_transfers_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "CHK_transfers_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "CHK_transfers_distinct_warehouses" CHECK ("source_warehouse_id" <> "destination_warehouse_id"),
        CONSTRAINT "PK_transfers_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transfers_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_transfers_source_warehouse_id" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_transfers_destination_warehouse_id" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_transfers_product_id" ON "transfers" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transfers_source_warehouse_id" ON "transfers" ("source_warehouse_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transfers_destination_warehouse_id" ON "transfers" ("destination_warehouse_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transfers_created_at" ON "transfers" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_transfers_created_at"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transfers_destination_warehouse_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transfers_source_warehouse_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_transfers_product_id"`);
    await queryRunner.query(`DROP TABLE "transfers"`);
    await queryRunner.query(`DROP TYPE "public"."transfer_status_enum"`);
  }
}
