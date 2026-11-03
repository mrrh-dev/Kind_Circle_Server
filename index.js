import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const app = express();
const port = process.env.PORT || 5000;

// --- middleware ---
app.use(cors());
app.use(express.json());

// ---- database ----
if (!process.env.MONGODB_URI) {
  console.log('MONGODB_URI is missing. Add it to your .env file.');
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  console.log('You successfully connected to MongoDB!');
} catch (err) {
  console.log('Could not connect to MongoDB:', err.message);
  process.exit(1);
}

const db = client.db(process.env.DB_NAME || 'kindcircle');
const eventsCollection = db.collection('events');
const joinsCollection = db.collection('joins');

// doing indexing for fast search
await eventsCollection.createIndex({ eventDate: 1 });
await eventsCollection.createIndex({ createdBy: 1 });
await joinsCollection.createIndex({ userEmail: 1 });
// one person can join an event only once
await joinsCollection.createIndex(
  { eventId: 1, userEmail: 1 },
  { unique: true },
);

// --- routes ---
app.get('/', (req, res) => {
  res.send({ name: 'KindCircle API', status: 'running' });
});

// --- errors ---
// If no route matched, send 404
app.use((req, res) => {
  res.status(404).send({ message: 'That route does not exist.' });
});

// Catches any error thrown in a route.
app.use((error, req, res, next) => {
  console.log(error);
  res
    .status(500)
    .send({ message: 'Something went wrong on our side. Please try again.' });
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
