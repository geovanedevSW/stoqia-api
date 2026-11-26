import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryTables1795618000000 implements MigrationInterface {
  name = 'CreateInventoryTables1795618000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."stock_movement_type_enum" AS ENUM('INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT')`,
    );

    await queryRunner.query(
      `CREATE TABLE "inventory_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "quantity" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_inventory_product_warehouse" UNIQUE ("product_id", "warehouse_id"),
        CONSTRAINT "CHK_inventory_quantity_non_negative" CHECK ("quantity" >= 0),
        CONSTRAINT "PK_inventory_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_inventory_items_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_inventory_items_warehouse_id" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "stock_movements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "type" "public"."stock_movement_type_enum" NOT NULL,
        "quantity" integer NOT NULL,
        "previous_balance" integer NOT NULL,
        "new_balance" integer NOT NULL,
        "reason" character varying(255),
        "reference_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_stock_movements_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "PK_stock_movements_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stock_movements_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_stock_movements_warehouse_id" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_stock_movements_product_warehouse" ON "stock_movements" ("product_id", "warehouse_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_stock_movements_created_at" ON "stock_movements" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_stock_movements_created_at"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_stock_movements_product_warehouse"`,
    );
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(`DROP TABLE "inventory_items"`);
    await queryRunner.query(`DROP TYPE "public"."stock_movement_type_enum"`);
  }
}
