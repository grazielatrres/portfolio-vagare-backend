-- O tipo 'document' deixou de ser aceito pela API (LGPD: dados de documentos
-- pessoais como passaporte e RG). Remove os registros já gravados para que esses
-- dados não fiquem armazenados sem que o usuário consiga vê-los ou apagá-los.
-- O valor continua no enum "InfoType" para não exigir recriação do tipo.
DELETE FROM "infos" WHERE "type" = 'document';
