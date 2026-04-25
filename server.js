const express = require('express');
const cors = require('cors');
const dns = require('dns').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// Bulk MX Lookup API Endpoint
app.post('/api/bulk-mx', async (req, res) => {
    const { domains } = req.body;

    if (!Array.isArray(domains) || domains.length === 0) {
        return res.status(400).json({ error: 'Please provide an array of domains.' });
    }

    // Process all domains concurrently
    const results = await Promise.all(domains.map(async (domain) => {
        try {
            const records = await dns.resolveMx(domain);
            
            // Format to match the client's expectation
            const formattedRecords = records.map(r => ({
                priority: r.priority,
                target: r.exchange,
                ttl: 'N/A' // Native dns module doesn't expose TTL directly in this function easily
            })).sort((a, b) => a.priority - b.priority);

            return {
                domain,
                records: formattedRecords,
                error: null
            };
        } catch (error) {
            let errorMessage = error.message;
            if (error.code === 'ENOTFOUND') {
                errorMessage = 'Domain does not exist (ENOTFOUND)';
            } else if (error.code === 'ENODATA') {
                errorMessage = 'No MX records found for this domain';
            }
            return {
                domain,
                records: [],
                error: errorMessage
            };
        }
    }));

    // Return the bulk results in a single response
    res.json({ results });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
