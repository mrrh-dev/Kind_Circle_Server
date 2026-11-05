import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import eventsRouter from './routes/events.js';
import joinsRouter from './routes/joins.js';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ---database---
if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is missing. Add it to your .env file.');
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
console.log('You successfully connected to MongoDB!');

const db = client.db(process.env.DB_NAME || 'kindcircle');
const eventsCollection = db.collection('events');
const joinsCollection = db.collection('joins');

// One person can join an event only once
await joinsCollection.createIndex(
  { eventId: 1, userEmail: 1 },
  { unique: true },
);

// Finds one event by the id from the URL. Returns null if the id is wrong or not found.
async function findEventById(id) {
  if (!ObjectId.isValid(id)) return null;
  return eventsCollection.findOne({ _id: new ObjectId(id) });
}

// ---routes---
app.get('/', (req, res) => {
  res.send({ message: 'KindCircle API is running' });
});

// The route files get the database tools from here
app.use(
  '/events',
  eventsRouter(eventsCollection, joinsCollection, findEventById),
);
app.use('/', joinsRouter(eventsCollection, joinsCollection, findEventById));

// If any route throws an error, it ends up here
app.use((error, req, res, next) => {
  console.log(error);
  res.status(500).send({ message: 'Something went wrong. Please try again.' });
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});

export default app;
