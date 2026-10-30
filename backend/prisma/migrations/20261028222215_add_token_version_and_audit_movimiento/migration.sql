-- AlterTable
ALTER TABLE `movimiento` ADD COLUMN `editadoPorId` INTEGER NULL,
    ADD COLUMN `registradoPorId` INTEGER NULL;

-- AlterTable
ALTER TABLE `usuario` ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE `Movimiento` ADD CONSTRAINT `Movimiento_registradoPorId_fkey` FOREIGN KEY (`registradoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Movimiento` ADD CONSTRAINT `Movimiento_editadoPorId_fkey` FOREIGN KEY (`editadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
