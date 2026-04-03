const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());

const port = 3000;
const url = 'mongodb://mongodb:27017';
const client = new MongoClient(url);

let db;

async function connectDB() {
  await client.connect();
  db = client.db('testdb');
  console.log('Connected to MongoDB');
}

connectDB();

app.get('/', async (req, res) => {
  res.send('Hello from backend');
});

app.get('/data', async (req, res) => {
  const collection = db.collection('items');
  await collection.insertOne({ name: 'test item', time: new Date() });
  const items = await collection.find().toArray();
  res.json(items);
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});