-- CreateEnum
CREATE TYPE "MachineType" AS ENUM ('row', 'bike', 'ski');

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN "machineType" "MachineType" NOT NULL DEFAULT 'row';
