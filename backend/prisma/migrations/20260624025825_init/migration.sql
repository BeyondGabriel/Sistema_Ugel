-- CreateTable
CREATE TABLE `Usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `rol` ENUM('VIGILANTE', 'ESPECIALISTA', 'JEFE', 'DIRECTORA', 'RRHH', 'ADMIN') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `cambioPassword` BOOLEAN NOT NULL DEFAULT true,
    `nombres` VARCHAR(191) NOT NULL,
    `apellidos` VARCHAR(191) NOT NULL,
    `foto` VARCHAR(191) NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `jefaturaId` INTEGER NULL,
    `jefeId` INTEGER NULL,
    `encargadoTemporalId` INTEGER NULL,

    UNIQUE INDEX `Usuario_email_key`(`email`),
    INDEX `Usuario_jefaturaId_idx`(`jefaturaId`),
    INDEX `Usuario_jefeId_idx`(`jefeId`),
    INDEX `Usuario_encargadoTemporalId_idx`(`encargadoTemporalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Jefatura` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `jefeId` INTEGER NULL,

    UNIQUE INDEX `Jefatura_nombre_key`(`nombre`),
    UNIQUE INDEX `Jefatura_jefeId_key`(`jefeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Movimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `tipo` ENUM('ENTRADA', 'SALIDA') NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `bloqueado` BOOLEAN NOT NULL DEFAULT false,

    INDEX `Movimiento_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Papeleta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `solicitanteId` INTEGER NOT NULL,
    `aprobadorId` INTEGER NULL,
    `tipoTiempo` ENUM('DIAS', 'HORAS') NOT NULL,
    `fechaInicio` DATETIME(3) NOT NULL,
    `fechaFin` DATETIME(3) NOT NULL,
    `horaSalida` DATETIME(3) NULL,
    `horaRetorno` DATETIME(3) NULL,
    `motivo` VARCHAR(191) NOT NULL,
    `motivoOtros` VARCHAR(191) NULL,
    `estado` ENUM('PENDIENTE', 'EN_REVISION', 'OBSERVADO', 'APROBADO', 'RECHAZADO', 'CANCELADO', 'ANULADO', 'ANULACION_SOLICITADA') NOT NULL DEFAULT 'PENDIENTE',
    `token` VARCHAR(191) NULL,
    `motivoRechazo` VARCHAR(191) NULL,
    `motivoAnulacion` VARCHAR(191) NULL,
    `anuladoPorAdmin` BOOLEAN NOT NULL DEFAULT false,
    `adminAnuladorId` INTEGER NULL,
    `fechaAnulacion` DATETIME(3) NULL,
    `firmaExternaSvg` VARCHAR(191) NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Papeleta_numero_key`(`numero`),
    UNIQUE INDEX `Papeleta_token_key`(`token`),
    INDEX `Papeleta_solicitanteId_idx`(`solicitanteId`),
    INDEX `Papeleta_aprobadorId_idx`(`aprobadorId`),
    INDEX `Papeleta_adminAnuladorId_idx`(`adminAnuladorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Visita` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitanteNombre` VARCHAR(191) NOT NULL,
    `visitanteDni` VARCHAR(191) NOT NULL,
    `trabajadorVisitadoId` INTEGER NOT NULL,
    `registradorId` INTEGER NOT NULL,
    `horaEntrada` DATETIME(3) NOT NULL,
    `horaSalida` DATETIME(3) NULL,
    `gafeteEntregado` BOOLEAN NOT NULL DEFAULT false,

    INDEX `Visita_trabajadorVisitadoId_idx`(`trabajadorVisitadoId`),
    INDEX `Visita_registradorId_idx`(`registradorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notificacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `mensaje` VARCHAR(191) NOT NULL,
    `leida` BOOLEAN NOT NULL DEFAULT false,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notificacion_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TokenVerificacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `papeletaId` INTEGER NOT NULL,
    `usuarioConsultanteId` INTEGER NULL,
    `fechaConsulta` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TokenVerificacion_papeletaId_idx`(`papeletaId`),
    INDEX `TokenVerificacion_usuarioConsultanteId_idx`(`usuarioConsultanteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_jefaturaId_fkey` FOREIGN KEY (`jefaturaId`) REFERENCES `Jefatura`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_jefeId_fkey` FOREIGN KEY (`jefeId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_encargadoTemporalId_fkey` FOREIGN KEY (`encargadoTemporalId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jefatura` ADD CONSTRAINT `Jefatura_jefeId_fkey` FOREIGN KEY (`jefeId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Movimiento` ADD CONSTRAINT `Movimiento_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Papeleta` ADD CONSTRAINT `Papeleta_solicitanteId_fkey` FOREIGN KEY (`solicitanteId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Papeleta` ADD CONSTRAINT `Papeleta_aprobadorId_fkey` FOREIGN KEY (`aprobadorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Papeleta` ADD CONSTRAINT `Papeleta_adminAnuladorId_fkey` FOREIGN KEY (`adminAnuladorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visita` ADD CONSTRAINT `Visita_trabajadorVisitadoId_fkey` FOREIGN KEY (`trabajadorVisitadoId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visita` ADD CONSTRAINT `Visita_registradorId_fkey` FOREIGN KEY (`registradorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notificacion` ADD CONSTRAINT `Notificacion_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TokenVerificacion` ADD CONSTRAINT `TokenVerificacion_papeletaId_fkey` FOREIGN KEY (`papeletaId`) REFERENCES `Papeleta`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TokenVerificacion` ADD CONSTRAINT `TokenVerificacion_usuarioConsultanteId_fkey` FOREIGN KEY (`usuarioConsultanteId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
