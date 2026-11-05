import express from 'express';

const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
	res.send('Welcome to SetSpace!');
});

app.listen(PORT, () => {
	console.log(`SetSpace API server is running on port ${PORT}`);
});
