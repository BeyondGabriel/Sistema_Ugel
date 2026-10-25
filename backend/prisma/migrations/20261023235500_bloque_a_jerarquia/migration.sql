-- Bloque A: jerarquía, autorización y delegación
--
-- Generado con:
--   prisma migrate diff --from-schema-datamodel _schema_antes_bloque_a.prisma \
--     --to-schema-datamodel prisma/schema.prisma --script

-- AlterTable
ALTER TABLE `Usuario` ADD COLUMN `noDisponible` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `tituloFormal` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Jefatura` ADD COLUMN `esOficial` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Papeleta` ADD COLUMN `requiereAprobadorEspecial` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `Delegacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titularId` INTEGER NOT NULL,
    `encargadoId` INTEGER NOT NULL,
    `motivo` VARCHAR(191) NULL,
    `fechaInicio` DATETIME(3) NOT NULL,
    `fechaFin` DATETIME(3) NOT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `creadoPorId` INTEGER NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Delegacion_titularId_idx`(`titularId`),
    INDEX `Delegacion_encargadoId_idx`(`encargadoId`),
    INDEX `Delegacion_creadoPorId_idx`(`creadoPorId`),
    INDEX `Delegacion_activa_fechaInicio_fechaFin_idx`(`activa`, `fechaInicio`, `fechaFin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Delegacion` ADD CONSTRAINT `Delegacion_titularId_fkey` FOREIGN KEY (`titularId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delegacion` ADD CONSTRAINT `Delegacion_encargadoId_fkey` FOREIGN KEY (`encargadoId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delegacion` ADD CONSTRAINT `Delegacion_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Datos: las cuatro jefaturas oficiales de la UGEL Talara no pueden eliminarse.
UPDATE `Jefatura` SET `esOficial` = true
WHERE `nombre` IN ('Dirección', 'Gestión Pedagógica', 'Unidad de Administración', 'UPDI');
