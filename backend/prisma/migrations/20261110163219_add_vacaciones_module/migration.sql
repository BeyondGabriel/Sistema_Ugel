-- CreateTable
CREATE TABLE `VacacionSaldo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `anio` INTEGER NOT NULL,
    `diasGanados` DECIMAL(5, 2) NOT NULL DEFAULT 30.00,
    `diasUsados` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NOT NULL,

    INDEX `VacacionSaldo_usuarioId_idx`(`usuarioId`),
    UNIQUE INDEX `VacacionSaldo_usuarioId_anio_key`(`usuarioId`, `anio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SolicitudVacacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `solicitanteId` INTEGER NOT NULL,
    `aprobadorId` INTEGER NULL,
    `rrhhId` INTEGER NULL,
    `tipo` ENUM('DIA_COMPLETO', 'MEDIO_DIA') NOT NULL,
    `fechaInicio` DATETIME(3) NOT NULL,
    `fechaFin` DATETIME(3) NOT NULL,
    `horaInicio` VARCHAR(191) NULL,
    `horaFin` VARCHAR(191) NULL,
    `diasDescontados` DECIMAL(4, 2) NOT NULL,
    `estado` ENUM('PENDIENTE', 'CON_VB', 'APROBADA', 'RECHAZADA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    `motivoRechazo` VARCHAR(191) NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NOT NULL,

    INDEX `SolicitudVacacion_solicitanteId_idx`(`solicitanteId`),
    INDEX `SolicitudVacacion_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolVacaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `anio` INTEGER NOT NULL,
    `fechaInicio` DATETIME(3) NOT NULL,
    `fechaFin` DATETIME(3) NOT NULL,
    `esBloquePrincipal` BOOLEAN NOT NULL DEFAULT true,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RolVacaciones_usuarioId_anio_idx`(`usuarioId`, `anio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VacacionSaldo` ADD CONSTRAINT `VacacionSaldo_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SolicitudVacacion` ADD CONSTRAINT `SolicitudVacacion_solicitanteId_fkey` FOREIGN KEY (`solicitanteId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SolicitudVacacion` ADD CONSTRAINT `SolicitudVacacion_aprobadorId_fkey` FOREIGN KEY (`aprobadorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SolicitudVacacion` ADD CONSTRAINT `SolicitudVacacion_rrhhId_fkey` FOREIGN KEY (`rrhhId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolVacaciones` ADD CONSTRAINT `RolVacaciones_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
