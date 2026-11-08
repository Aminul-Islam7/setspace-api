import 'dotenv/config';

import { MongoClient, ObjectId } from 'mongodb';

import cors from 'cors';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 5000;
const mongoClient = new MongoClient(process.env.MONGODB_URI);
const db = mongoClient.db('setspace_prod');
const studiosCollection = db.collection('studios');
const bookingsCollection = db.collection('bookings');

app.use(cors());
app.use(express.json());

app.listen(PORT, () => {
	console.log(`SetSpace API server is running on port ${PORT}`);
});

async function connectToMongoDB() {
	try {
		await mongoClient.connect();
		console.log('Successfully connected to MongoDB!');
		return mongoClient;
	} catch (err) {
		console.dir(err);
	}
}

connectToMongoDB();

app.get('/api/studios', async (req, res) => {
	const { category, search, minPrice, maxPrice, top, page = 1, limit = 10 } = req.query;

	const pageNum = Math.max(1, parseInt(page, 10));
	const limitNum = Math.max(1, parseInt(limit, 10));

	const query = {};

	if (category) {
		query.category = category;
	}

	if (minPrice || maxPrice) {
		query.hourlyRate = {};
		if (minPrice) query.hourlyRate.$gte = +minPrice;
		if (maxPrice) query.hourlyRate.$lte = -maxPrice;
	}

	try {
		if (top) {
			const topLimit = Math.max(1, parseInt(top, 10));

			const topStudios = await studiosCollection.find(query).sort({ rankingScore: -1 }).limit(topLimit).toArray();

			return res.json(topStudios);
		}

		const skip = (pageNum - 1) * limitNum;
		const studios = await studiosCollection.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).toArray();

		res.json(studios);
	} catch (error) {
		console.error('Error fetching studios:', error);
		res.status(500).json({ message: 'Failed to fetch studios', error: 'Internal Server Error' });
	}
});

app.get('/api/studios/:id', async (req, res) => {
	const { id } = req.params;
	try {
		const studio = await studiosCollection.findOne({ _id: new ObjectId(id) });

		if (!studio) {
			return res.status(404).json({ message: 'Studio not found' });
		}
		res.json(studio);
	} catch (error) {
		console.error(`Error fetching studio with id ${id}:`, error);
		res.status(500).json({ message: 'Failed to fetch the studio', error: 'Internal Server Error' });
	}
});

app.post('/api/studios', async (req, res) => {
	const data = req.body;

	try {
		result = await studiosCollection.insertOne(data);
		res.json(result);
	} catch (error) {
		console.error('Error inserting studio', error);
		res.status(500).json({ message: 'Failed to post studio listing', error: 'Internal Server Error' });
	}
});
