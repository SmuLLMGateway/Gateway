import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { createDatabaseConfig } from "../config/database.config.js";

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            useFactory: createDatabaseConfig
        })
    ]
})
export class DatabaseModule {}
