-- AlterTable
ALTER TABLE `delegacion` MODIFY `motivo` VARCHAR(1000) NULL,
    MODIFY `documentoRef` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `notificacion` MODIFY `mensaje` VARCHAR(500) NOT NULL;
