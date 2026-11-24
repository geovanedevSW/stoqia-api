import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWarehousesTable1795534350000 implements MigrationInterface {
    name = 'CreateWarehousesTable1795534350000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "warehouses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(255) NOT NULL, "code" character varying(50) NOT NULL, "location" character varying(255), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_warehouses_code" UNIQUE ("code"), CONSTRAINT "PK_warehouses_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "warehouses"`);
    }
}
