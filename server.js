const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'database.json');

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the 'dist' directory (after build)
// Or we can just serve the root for development if we were not using Vite middleware, 
// but for this simple setup, we will let Vite handle dev serving on a different port,
// or we proxy. For simplicity in production/final run, we serve 'dist'.
app.use(express.static(path.join(__dirname, 'dist')));

// API: Get Data
app.get('/api/data', (req, res) => {
    fs.readFile(DB_PATH, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading database:', err);
            return res.status(500).json({ error: 'Failed to read data' });
        }
        try {
            res.json(JSON.parse(data));
        } catch (e) {
            res.status(500).json({ error: 'Invalid JSON data' });
        }
    });
});

// API: Save Winners
app.post('/api/save', (req, res) => {
    const newWinners = req.body; // Expecting the full "winners" object or specific updates
    
    // We need to read the current DB, update winners, and save back to ensure we don't overwrite settings accidentally
    // although the frontend sends the whole winners structure usually.
    
    fs.readFile(DB_PATH, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read db' });
        }
        
        let db;
        try {
            db = JSON.parse(data);
        } catch (e) {
            return res.status(500).json({ error: 'Invalid DB content' });
        }

        // Update winners
        db.winners = newWinners;

        fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to save data' });
            }
            res.json({ success: true });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Ensure you have run 'npm run build' if you want to serve the UI via this server.`);
    console.log(`For development, keep this running and use 'npm run dev' in another terminal.`);
});