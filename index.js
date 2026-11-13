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

// Mock Auth User
app.use((req, res, next) => {
	req.user = {
		id: 'usr_dev_001',
		name: 'Alex Rivera',
		email: 'alex.rivera@setspace.dev',
		avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
	};

	next();
});

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
				totalPages: Math.ceil(topStudios.length / limitNum),
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
	} catch (error) {
		console.error('Error fetching studios:', error);
		res.status(500).json({ message: 'Failed to fetch studios', error: 'Internal Server Error' });
	}
});

app.get('/api/studios/:id', async (req, res) => {
	const { id } = req.params;

	if (!ObjectId.isValid(id)) {
		return res.status(400).json({ message: 'Invalid studio ID' });
	}

	try {
		const studio = await studiosCollection.findOne({ _id: new ObjectId(id) });

		if (!studio) {
			return res.status(404).json({ message: 'Studio not found' });
		}
		res.status(200).json(studio);
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

	if (!ObjectId.isValid(id)) {
		return res.status(400).json({ message: 'Invalid studio ID' });
	}

	const allowedFields = ['title', 'slug', 'category', 'description', 'hourlyRate', 'securityDeposit', 'maxCapacity', 'location', 'image', 'gallery', 'amenities'];

	const updatedData = {};
	for (const field of allowedFields) {
		if (req.body[field] !== undefined) {
			updatedData[field] = req.body[field];
		}
	}

	try {
		const result = await studiosCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedData });

		if (result.matchedCount === 0) {
			return res.status(404).json({ message: 'Studio not found' });
		}

		res.status(200).json({ message: 'Studio details updated successfully' });
	} catch (error) {
		console.error(`Error updating data of studio with id ${id}`, error);
		res.status(500).json({ message: 'Failed to update studio data' });
	}
});

app.delete('/api/studios/:id', async (req, res) => {
	const { id } = req.params;

	if (!ObjectId.isValid(id)) {
		return res.status(400).json({ message: 'Invalid studio ID' });
	}

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

	if (!ObjectId.isValid(id)) {
		return res.status(400).json({ message: 'Invalid studio ID' });
	}

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

app.post('/api/bookings/', async (req, res) => {
	const data = req.body;

	try {
		result = await bookingsCollection.insertOne(data);
		res.status(201).json({ message: 'Booking created successfully' });
	} catch (error) {
		console.error('Error inserting booking', error);
		res.status(500).json({ message: 'Failed to post the booking request', error: 'Internal Server Error' });
	}
});

app.get('/api/bookings/:id', async (req, res) => {
	const { id } = req.params;

	if (!ObjectId.isValid(id)) {
		return res.status(400).json({ message: 'Invalid bookings ID' });
	}

	try {
		const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });

		if (!booking) {
			return res.status(404).json({ message: 'Booking not found' });
		}
		res.status(200).json(booking);
	} catch (error) {
		console.error(`Error fetching booking with id ${id}:`, error);
		res.status(500).json({ message: 'Failed to fetch the booking record', error: 'Internal Server Error' });
	}
});

app.patch('/api/bookings/:id', async (req, res) => {
	const { id } = req.params;

	if (!ObjectId.isValid(id)) {
		return res.status(400).json({ message: 'Invalid booking ID' });
	}

	const updatedData = {};
	if (req.body.status !== undefined) {
		updatedData.status = req.body.status;
	}

	try {
		const result = await bookingsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedData });

		if (result.matchedCount === 0) {
			return res.status(404).json({ message: 'Booking not found' });
		}

		res.status(200).json({ message: 'Booking status updated successfully' });
	} catch (error) {
		console.error(`Error updating booking status with id ${id}`, error);
		res.status(500).json({ message: 'Failed to update booking status' });
	}
});

app.get('api/users/me/studios', async (req, res) => {
	try {
		if (!req.user?.email) {
			return res.status(401).json({
				success: false,
				message: 'Unauthorized. Please log in to view your listings.',
			});
		}

		const studios = await studiosCollection.find({ ownerEmail: req.user.email }).sort({ createdAt: -1 }).toArray();

		return res.status(200).json({
			data: studios,
			success: true,
		});
	} catch (error) {
		console.error('Error fetching user studios:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to fetch your studio listings.',
		});
	}
});

app.get('api/users/me/bookings', async (req, res) => {
	try {
		if (!req.user?.email) {
			return res.status(401).json({
				success: false,
				message: 'Unauthorized. Please log in to view your bookings.',
			});
		}

		const studios = await bookingsCollection.find({ userEmail: req.user.email }).sort({ createdAt: -1 }).toArray();

		return res.status(200).json({
			data: studios,
			success: true,
		});
	} catch (error) {
		console.error('Error fetching user bookings:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to fetch your bookings.',
		});
	}
});
