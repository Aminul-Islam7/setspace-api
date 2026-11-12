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
	const { category, search, sort, minPrice, maxPrice, top, page = 1, limit = 10 } = req.query;

	const searchableFields = ['title', 'slug', 'category', 'description', 'location', 'amenities', 'ownerName', 'ownerEmail'];

	const pageNum = Math.max(1, parseInt(page, 10));
	const limitNum = Math.max(1, parseInt(limit, 10));

	const sortOptions = {
		newest: { createdAt: -1 },
		featured: { rankingScore: -1 },
		rating: { rating: -1 },
		'price-asc': { hourlyRate: 1 },
		'price-desc': { hourlyRate: -1 },
	};
	
	const sortQuery = sortOptions[sort] || { createdAt: -1 };

	const query = {};

	if (category) {
		query.category = category;
	}

	if (search) {
		const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(escapedSearch, 'i');

		query.$or = searchableFields.map(field => ({ [field]: regex }));
		console.log('searched');
	}

	if (sort) {
	}

	if (minPrice || maxPrice) {
		query.hourlyRate = {};
		if (minPrice) query.hourlyRate.$gte = +minPrice;
		if (maxPrice) query.hourlyRate.$lte = +maxPrice;
	}

	try {
		if (top) {
			const topLimit = Math.max(1, parseInt(top, 10));

			const topStudios = await studiosCollection.find(query).sort({ rankingScore: -1 }).limit(topLimit).toArray();

			return res.status(200).json({
				data: topStudios,
				success: true,
				totalCount: topStudios.length,
				totalPages: Math.ceil(topStudios.length / limitNum);
			});
		}

		const totalCount = await studiosCollection.countDocuments(query);
		const totalPages = Math.ceil(totalCount / limitNum);

		const skip = (pageNum - 1) * limitNum;
		const studios = await studiosCollection.find(query).sort(sortQuery).skip(skip).limit(limitNum).toArray();

		res.status(200).json({
			data: studios,
			success: true,
			totalCount,
			totalPages,
		});
		console.log('query successful');
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
		res.status(201).json({ message: 'Studio added successfully' });
	} catch (error) {
		console.error('Error inserting studio', error);
		res.status(500).json({ message: 'Failed to post studio listing', error: 'Internal Server Error' });
	}
});

app.patch('/api/studios/:id', async (req, res) => {
	const { id } = req.params;

	const { title, slug, category, description, hourlyRate, securityDeposit, maxCapacity, location, image, gallery, amenities } = req.body;

	const updatedData = { title, slug, category, description, hourlyRate, securityDeposit, maxCapacity, location, image, gallery, amenities };

	try {
		result = await studiosCollection.updateOne({ _id: new ObjectId(id) }, updatedData);

		if (!studio) {
			return res.status(404).json({ message: 'Studio not found' });
		}
		res.status(200).json({ message: 'Studio details updated successfully' });
	} catch (error) {
		console.error(`Error updating data of studio with id ${id}`, error);
		res.status(500).json({ message: 'Failed to update studio data', error: 'Internal Server Error' });
	}
});

app.delete('/api/studios/:id', async (req, res) => {
	const { id } = req.params;

	try {
		result = await studiosCollection.deleteOne({ _id: new ObjectId(id) });

		if (!studio) {
			return res.status(404).json({ message: 'Studio not found' });
		}
		res.status(200).json({ message: 'Studio deleted successfully' });
	} catch (error) {
		console.error(`Error deleting studio with id ${id}`, error);
		res.status(500).json({ message: 'Failed to delete the studio', error: 'Internal Server Error' });
	}
});

app.post('/api/studios/:id/reviews', async (req, res) => {
	const { id } = req.params;
	const newReview = req.body;
	const rating = Number(newReview.rating);

	try {
		const result = await studiosCollection.updateOne({ _id: new ObjectId(id) }, [
			{
				$set: {
					reviews: { $concatArrays: ['$reviews', [newReview]] },
					reviewCount: { $add: ['$reviewCount', 1] },
					rankingScore: { $add: ['$rankingScore', rating] },
				},
			},
			{
				$set: {
					rating: { $round: [{ $divide: ['$rankingScore', '$reviewCount'] }, 1] },
				},
			},
		]);

		if (result.matchedCount === 0) {
			return res.status(404).json({ message: 'Studio not found' });
		}
		res.status(201).json({ message: 'Review added successfully' });
	} catch (error) {
		console.error(`Error posting review for the studio with id ${id}:`, error);
		res.status(500).json({ message: 'Failed post review for the studio', error: 'Internal Server Error' });
	}
});
