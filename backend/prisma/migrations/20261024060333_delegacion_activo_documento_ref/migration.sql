-- Renombra `activa` a `activo` conservando los datos existentes y añade la
-- referencia documental de la delegación.
DROP INDEX `Delegacion_activa_fechaInicio_fechaFin_idx` ON `delegacion`;

ALTER TABLE `delegacion`
    CHANGE COLUMN `activa` `activo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `documentoRef` VARCHAR(191) NULL;

CREATE INDEX `Delegacion_activo_fechaInicio_fechaFin_idx` ON `delegacion`(`activo`, `fechaInicio`, `fechaFin`);

