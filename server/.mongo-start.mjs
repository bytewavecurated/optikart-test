import { MongoMemoryServer } from 'mongodb-memory-server';
const m = await MongoMemoryServer.create({ instance: { port: 27017, ip: '127.0.0.1' } });
console.log('URI=' + m.getUri());
setInterval(()=>{},1000);
