-- AlterTable
ALTER TABLE `papeleta` ADD COLUMN `reasignadoPorId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Papeleta` ADD CONSTRAINT `Papeleta_reasignadoPorId_fkey` FOREIGN KEY (`reasignadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
