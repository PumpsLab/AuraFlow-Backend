import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MongoClient, Db, Document } from 'mongodb';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private client: MongoClient;
  private db!: Db;

  constructor() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.client = new MongoClient(uri);
  }

  async onModuleInit() {
    await this.client.connect();
    const dbName = process.env.MONGODB_DB || 'auraflow';
    this.db = this.client.db(dbName);
    console.log(`Connected to MongoDB: ${dbName}`);
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  getDb(): Db {
    return this.db;
  }

  collection(name: string): import('mongodb').Collection<any> {
    return this.db.collection(name);
  }
}
