import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const models = Object.keys(p).filter(k => !k.startsWith('_') && !k.startsWith('$'));
console.log('Available Prisma models:', models);
await p.$disconnect();
