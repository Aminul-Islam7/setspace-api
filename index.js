import 'dotenv/config';

import { MongoClient, ObjectId } from 'mongodb';
import { createRemoteJWKSet, jwtVerify } from 'jose';

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

const clientUrl = process.env.CLIENT_URL || 'https://setspace-studios.vercel.app';
const JWKS = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
	const authHeader = req.headers.authorization;
	if (!authHeader) return res.status(401).send({ message: 'Unauthorized' });

	const token = authHeader.split(' ')[1];
	if (!token) return res.status(401).send({ message: 'Unauthorized' });

	const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

	try {
		const { payload } = await jwtVerify(token, JWKS);
		req.user = payload;
		next();
	} catch (error) {
		console.error('JWT Verification Error:', error.message || error);
		return res.status(500).send({ message: 'Internal Server Error' });
	}
};

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

	if (category) query.category = category;

	if (search) {
		const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(escapedSearch, 'i');

		query.$or = searchableFields.map(field => ({ [field]: regex }));
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

	if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid studio ID' });

	try {
		const studio = await studiosCollection.findOne({ _id: new ObjectId(id) });

		if (!studio) return res.status(404).json({ message: 'Studio not found' });

		res.status(200).json(studio);
	} catch (error) {
		console.error(`Error fetching studio with id ${id}:`, error);
		res.status(500).json({ message: 'Failed to fetch the studio', error: 'Internal Server Error' });
	}
});

app.post('/api/studios', verifyToken, async (req, res) => {
	const data = {
		...req.body,
		ownerEmail: req.user.email,
	};

	try {
		await studiosCollection.insertOne(data);
		res.status(201).json({ message: 'Studio added successfully' });
	} catch (error) {
		console.error('Error inserting studio', error);
		res.status(500).json({ message: 'Failed to post studio listing', error: 'Internal Server Error' });
	}
});

app.patch('/api/studios/:id', verifyToken, async (req, res) => {
	const { id } = req.params;

	if (!ObjectId.isValid(id)) {
		return res.status(400).json({ message: 'Invalid studio ID' });
	}

	try {
		const studio = await studiosCollection.findOne({ _id: new ObjectId(id) });
		if (!studio) return res.status(404).json({ message: 'Studio not found' });

		if (studio.ownerEmail !== req.user.email) return res.status(403).json({ message: 'Forbidden: You do not own this studio' });

		const allowedFields = ['title', 'slug', 'category', 'description', 'hourlyRate', 'securityDeposit', 'maxCapacity', 'location', 'image', 'gallery', 'amenities'];

		const updatedData = {};
		for (const field of allowedFields) {
			if (req.body[field] !== undefined) {
				updatedData[field] = req.body[field];
			}
		}

		await studiosCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedData });
		res.status(200).json({ message: 'Studio details updated successfully' });
	} catch (error) {
		console.error(`Error updating data of studio with id ${id}`, error);
		res.status(500).json({ message: 'Failed to update studio data' });
	}
});

app.delete('/api/studios/:id', verifyToken, async (req, res) => {
	const { id } = req.params;

	if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid studio ID' });

	try {
		const studio = await studiosCollection.findOne({ _id: new ObjectId(id) });
		if (!studio) return res.status(404).json({ message: 'Studio not found' });

		if (studio.ownerEmail !== req.user.email) {
			return res.status(403).json({ message: 'Forbidden: You do not own this studio' });
		}

		await studiosCollection.deleteOne({ _id: new ObjectId(id) });
		res.status(200).json({ message: 'Studio deleted successfully' });
	} catch (error) {
		console.error(`Error deleting studio with id ${id}`, error);
		res.status(500).json({ message: 'Failed to delete the studio', error: 'Internal Server Error' });
	}
});

app.post('/api/studios/:id/reviews', verifyToken, async (req, res) => {
	const { id } = req.params;

	if (!ObjectId.isValid(id)) {
		return res.status(400).json({ message: 'Invalid studio ID' });
	}

	try {
		const studio = await studiosCollection.findOne({ _id: new ObjectId(id) });
		if (!studio) {
			return res.status(404).json({ message: 'Studio not found' });
		}

		const completedBooking = await bookingsCollection.findOne({
			studioId: id,
			userEmail: req.user.email,
			status: 'Completed',
		});

		if (!completedBooking) {
			return res.status(403).json({
				message: 'Forbidden: You can only review studios after completing a reservation.',
			});
		}

		const alreadyReviewed = studio.reviews?.some(r => r.userEmail && r.userEmail.toLowerCase() === req.user.email.toLowerCase());

		if (alreadyReviewed) {
			return res.status(400).json({
				message: 'You have already posted a review for this workspace.',
			});
		}

		const rating = Math.min(5, Math.max(1, Number(req.body.rating) || 5));
		const newReview = {
			userName: req.user.name,
			userEmail: req.user.email,
			userAvatar: req.user.image,
			rating,
			comment: req.body.comment?.trim() || '',
			createdAt: new Date().toISOString(),
		};

		await studiosCollection.updateOne({ _id: new ObjectId(id) }, [
			{
				$set: {
					reviews: { $concatArrays: [{ $ifNull: ['$reviews', []] }, [newReview]] },
					reviewCount: { $add: [{ $ifNull: ['$reviewCount', 0] }, 1] },
					rankingScore: { $add: [{ $ifNull: ['$rankingScore', 0] }, rating] },
				},
			},
			{
				$set: {
					rating: { $round: [{ $divide: ['$rankingScore', '$reviewCount'] }, 1] },
				},
			},
		]);

		res.status(201).json({ message: 'Review added successfully', review: newReview });
	} catch (error) {
		console.error(`Error posting review for studio ${id}:`, error);
		res.status(500).json({ message: 'Failed to post review', error: 'Internal Server Error' });
	}
});

app.post('/api/bookings/', verifyToken, async (req, res) => {
	const data = {
		...req.body,
		userEmail: req.user.email,
	};

	const { studioId, bookingDate, startTime, endTime } = data;

	if (startTime >= endTime) return res.status(400).json({ message: 'End time must be after start time' });

	try {
		const existingBooking = await bookingsCollection.findOne({
			studioId,
			bookingDate,
			status: { $ne: 'Cancelled' },
			startTime: { $lt: endTime },
			endTime: { $gt: startTime },
		});

		if (existingBooking) {
			return res.status(409).json({
				message: 'This time slot is already booked. Please choose another time.',
			});
		}

		await bookingsCollection.insertOne(data);
		res.status(201).json({ message: 'Booking created successfully' });
	} catch (error) {
		console.error('Error inserting booking', error);
		res.status(500).json({ message: 'Failed to post the booking request', error: 'Internal Server Error' });
	}
});

app.get('/api/bookings/availability', async (req, res) => {
	const { studioId, date } = req.query;

	const query = {
		studioId: studioId,
		status: { $ne: 'Cancelled' },
	};

	if (date) query.bookingDate = date;

	try {
		const slots = await bookingsCollection
			.find(query, {
				projection: {
					_id: 0,
					bookingDate: 1,
					startTime: 1,
					endTime: 1,
				},
			})
			.toArray();
		console.log(slots);
		res.status(200).json({
			success: true,
			data: slots,
		});
	} catch (error) {
		console.error(`Error fetching availability for studio ${id}:`, error);
		res.status(500).json({ success: false, message: 'Failed to fetch studio availability' });
	}
});

app.get('/api/bookings/:id', verifyToken, async (req, res) => {
	const { id } = req.params;

	if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid bookings ID' });

	try {
		const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });

		if (!booking) return res.status(404).json({ message: 'Booking not found' });

		const isBooker = booking.userEmail === req.user.email;
		const isHost = booking.ownerEmail === req.user.email;

		if (!isBooker && !isHost) return res.status(403).json({ message: 'Forbidden: You cannot view this reservation' });

		res.status(200).json(booking);
	} catch (error) {
		console.error(`Error fetching booking with id ${id}:`, error);
		res.status(500).json({ message: 'Failed to fetch the booking record', error: 'Internal Server Error' });
	}
});

app.patch('/api/bookings/:id', verifyToken, async (req, res) => {
	const { id } = req.params;

	if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid booking ID' });

	const updatedData = {};
	if (req.body.status !== undefined) {
		updatedData.status = req.body.status;
	}

	try {
		const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
		if (!booking) return res.status(404).json({ message: 'Booking not found' });

		const isBooker = booking.userEmail === req.user.email;
		const isHost = booking.ownerEmail === req.user.email;

		if (!isBooker && !isHost) {
			return res.status(403).json({ message: 'Forbidden: You cannot modify this reservation' });
		}

		if (isBooker && !isHost && req.body.status !== 'Cancelled') {
			return res.status(403).json({ message: 'You can only cancel your booking' });
		}

		await bookingsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedData });

		res.status(200).json({ message: 'Booking status updated successfully' });
	} catch (error) {
		console.error(`Error updating booking status with id ${id}`, error);
		res.status(500).json({ message: 'Failed to update booking status' });
	}
});

app.get('/api/users/me/studios', verifyToken, async (req, res) => {
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

app.get('/api/users/me/bookings', verifyToken, async (req, res) => {
	try {
		if (!req.user?.email) {
			return res.status(401).json({
				success: false,
				message: 'Unauthorized. Please log in to view your bookings.',
			});
		}

		const { role } = req.query;
		const filter = role === 'host' ? { ownerEmail: req.user.email } : { userEmail: req.user.email };

		const studios = await bookingsCollection.find(filter).sort({ createdAt: -1 }).toArray();

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
