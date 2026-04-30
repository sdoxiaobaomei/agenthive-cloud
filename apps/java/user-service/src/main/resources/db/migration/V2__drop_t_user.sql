-- Flyway migration: V2__drop_t_user.sql
-- Service: user-service
-- Ticket: JAVA-004
-- Description: Drop the redundant t_user table. auth-service.sys_user is the single source of truth.

DROP TABLE IF EXISTS t_user;
