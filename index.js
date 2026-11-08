import 'dotenv/config';

import { MongoClient } from 'mongodb';
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

	const match = {};

	if (category) {
		match.category = category;
	}

	if (minPrice || maxPrice) {
		match.hourlyRate = {};
		if (minPrice) match.hourlyRate.$gte = +minPrice;
		if (maxPrice) match.hourlyRate.$lte = -maxPrice;
	}

	try {
		if (top) {
			const topLimit = Math.max(1, parseInt(top, 10));

			const topStudios = await studiosCollection.find(match).sort({ rankingScore: -1 }).limit(topLimit).toArray();

			return res.json(topStudios);
		}

		const skip = (pageNum - 1) * limitNum;
		const studios = await studiosCollection.find(match).sort({ createdAt: -1 }).skip(skip).limit(limitNum).toArray();

		res.json(studios);
	} catch (error) {
		console.error('Error fetching studios:', error);
		res.status(500).json({ error: `Internal Server Error` });
	}
});
