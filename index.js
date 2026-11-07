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

/**
 * /api/studios [GET Public] - List & search studios (with category, search, sort and limit)
 * /api/studios/:id [GET Public] - Fetch single studio
 *
 * /api/studios [POST Protected] - Create new studio listing
 * /api/studios/:id [PATCH Protected (Owner)] - Update existing studio details
 * /api/studios/:id [DELETE Protected (Owner)] - Delete studio listing
 *
 * POST /api/studios/:id/reviews - Add star rating & review comment to a studio
 *
 * /api/bookings [POST Protected] - Create a studio reservation
 * /api/bookings/:id [GET Protected (Owner/Renter)] - Fetch a booking details
 * /api/bookings/:id/status [PATCH Protected] - Update a booking status
 *
 * /api/users/me/studios [GET Protected] - Fetch all studios owned by the user
 * /api/users/me/bookings [GET Protected] - Fetch all bookings made by the user
 * /api/users/me/incoming-bookings [GET Protected] (Host Reservation Inbox) -
 */

app.get('/api/studios', (req, res) => {});
